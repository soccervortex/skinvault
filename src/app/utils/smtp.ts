import net from 'node:net';
import tls from 'node:tls';
import { sanitizeEmail, sanitizeString } from '@/app/utils/sanitize';

type SendSmtpEmailArgs = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure: boolean;
  from: string;
  replyTo?: string;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = sanitizeString(String(process.env.SMTP_HOST || '')).trim();
  const port = Number.parseInt(String(process.env.SMTP_PORT || ''), 10);
  const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || port === 465;

  const from = sanitizeString(String(process.env.SMTP_FROM || process.env.EMAIL_FROM || '')).trim();
  if (!host || !Number.isFinite(port) || port <= 0 || !from) return null;

  const user = sanitizeString(String(process.env.SMTP_USER || '')).trim() || undefined;
  const pass = sanitizeString(String(process.env.SMTP_PASS || '')).trim() || undefined;
  const replyTo = sanitizeEmail(String(process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || '')) || undefined;

  return { host, port, secure, user, pass, from, replyTo };
}

function buildMessage(args: { from: string; to: string; subject: string; replyTo?: string; text: string; html?: string }): string {
  const lines: string[] = [];
  lines.push(`From: ${args.from}`);
  lines.push(`To: ${args.to}`);
  lines.push(`Subject: ${args.subject}`);
  if (args.replyTo) lines.push(`Reply-To: ${args.replyTo}`);
  lines.push('MIME-Version: 1.0');

  if (args.html) {
    const boundary = `sv_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(args.text);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(args.html);
    lines.push('');
    lines.push(`--${boundary}--`);
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(args.text);
  }

  return lines.join('\r\n');
}

async function readResponse(socket: net.Socket, timeoutMs: number): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (d: Buffer) => {
      chunks.push(d);
      const text = Buffer.concat(chunks).toString('utf8');
      if (/\r?\n\d{3} /m.test(text)) {
        cleanup();
        resolve(text);
      }
    };
    const onError = (e: any) => {
      cleanup();
      reject(e);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error('SMTP timeout'));
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      if (timer) clearTimeout(timer);
    };

    socket.on('data', onData);
    socket.on('error', onError);
    const timer = setTimeout(onTimeout, timeoutMs);
  });
}

function parseCapabilities(ehloResponse: string): { starttls: boolean; authLogin: boolean } {
  const starttls = /\n250[\- ]STARTTLS\r?\n/i.test(ehloResponse);
  const authLogin = /\n250[\- ]AUTH\s+.*\bLOGIN\b/i.test(ehloResponse) || /\n250[\- ]AUTH\s+LOGIN\b/i.test(ehloResponse);
  return { starttls, authLogin };
}

async function sendCmd(socket: net.Socket, cmd: string, expect2xx: boolean = true, timeoutMs: number = 10_000): Promise<string> {
  socket.write(cmd + '\r\n');
  const resp = await readResponse(socket, timeoutMs);
  if (expect2xx) {
    const ok = /^2\d\d[\- ]/m.test(resp) || /^3\d\d[\- ]/m.test(resp);
    if (!ok) throw new Error(`SMTP command failed: ${cmd} :: ${resp.slice(0, 800)}`);
  }
  return resp;
}

async function upgradeToStartTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  await sendCmd(socket, 'STARTTLS', true);
  const tlsSocket = tls.connect({ socket, servername: host, rejectUnauthorized: false });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SMTP STARTTLS timeout')), 10_000);
    tlsSocket.once('secureConnect', () => {
      clearTimeout(timer);
      resolve();
    });
    tlsSocket.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
  return tlsSocket;
}

async function authLogin(socket: net.Socket, user: string, pass: string): Promise<void> {
  await sendCmd(socket, 'AUTH LOGIN', true);
  await sendCmd(socket, Buffer.from(user, 'utf8').toString('base64'), true);
  await sendCmd(socket, Buffer.from(pass, 'utf8').toString('base64'), true);
}

export async function sendSmtpEmail(args: SendSmtpEmailArgs): Promise<{ ok: boolean; error?: string }> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, error: 'SMTP not configured' };

  const to = sanitizeEmail(args.to);
  if (!to) return { ok: false, error: 'Invalid recipient email' };

  const subject = sanitizeString(args.subject).slice(0, 200);
  if (!subject) return { ok: false, error: 'Missing subject' };

  const replyTo = args.replyTo ? sanitizeEmail(args.replyTo) : config.replyTo;
  const text = sanitizeString(args.text || '').trim() || sanitizeString(String(args.html || '')).trim();
  const html = args.html ? String(args.html) : undefined;

  const message = buildMessage({
    from: config.from,
    to,
    subject,
    replyTo: replyTo || undefined,
    text: text || '(no message)',
    html,
  });

  let socket: net.Socket | tls.TLSSocket | null = null;
  try {
    socket = config.secure
      ? tls.connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: false })
      : net.connect({ host: config.host, port: config.port });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMTP connect timeout')), 10_000);
      socket!.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket!.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    const greet = await readResponse(socket, 10_000);
    if (!/^220[\- ]/m.test(greet)) {
      throw new Error(`SMTP greeting failed: ${greet.slice(0, 800)}`);
    }

    const ehlo = await sendCmd(socket, `EHLO ${config.host}`, true);
    const caps = parseCapabilities(ehlo);

    if (!config.secure && caps.starttls) {
      socket = await upgradeToStartTls(socket, config.host);
      await sendCmd(socket, `EHLO ${config.host}`, true);
    }

    if (config.user && config.pass) {
      await authLogin(socket, config.user, config.pass);
    }

    await sendCmd(socket, `MAIL FROM:<${sanitizeEmail(config.from) || config.from}>`, true);
    await sendCmd(socket, `RCPT TO:<${to}>`, true);

    await sendCmd(socket, 'DATA', true);
    socket.write(message.replace(/\r?\n/g, '\r\n') + '\r\n.\r\n');
    const dataResp = await readResponse(socket, 10_000);
    if (!/^250[\- ]/m.test(dataResp)) {
      throw new Error(`SMTP DATA failed: ${dataResp.slice(0, 800)}`);
    }

    try {
      await sendCmd(socket, 'QUIT', false);
    } catch {
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || 'Failed to send SMTP email') };
  } finally {
    try {
      socket?.end();
    } catch {
    }
  }
}
