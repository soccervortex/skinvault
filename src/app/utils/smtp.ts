import net from 'node:net';
import tls from 'node:tls';
import { lookup } from 'node:dns/promises';
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

function getOverallTimeoutMs(): number {
  const raw = Number.parseInt(String(process.env.SMTP_TIMEOUT_MS || ''), 10);
  const ms = Number.isFinite(raw) ? raw : 0;
  return Math.min(120_000, Math.max(5_000, ms || 60_000));
}

function timeLeftMs(deadline: number, fallbackMs: number): number {
  const left = deadline - Date.now();
  if (left <= 0) return 1;
  return Math.min(fallbackMs, left);
}

function extractEnvelopeFrom(fromHeader: string): string | null {
  const raw = String(fromHeader || '').trim();
  const m = /<([^>]+)>/.exec(raw);
  const candidate = m?.[1] || raw;
  return sanitizeEmail(candidate);
}

async function resolveIpv4(host: string, timeoutMs: number): Promise<string> {
  const safeHost = String(host || '').trim();
  if (!safeHost) return safeHost;

  try {
    const res = await Promise.race([
      lookup(safeHost, { family: 4 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), timeoutMs)),
    ]);
    return (res as any)?.address || safeHost;
  } catch {
    return safeHost;
  }
}

function getSmtpConfig(): SmtpConfig | null {
  const host = sanitizeString(String(process.env.SMTP_HOST || '')).trim();
  const port = Number.parseInt(String(process.env.SMTP_PORT || ''), 10);
  const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || port === 465;

  const from = String(process.env.SMTP_FROM || process.env.EMAIL_FROM || '').trim().slice(0, 300);
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
    let timer: NodeJS.Timeout | undefined;
    timer = setTimeout(onTimeout, timeoutMs);
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

  const deadline = Date.now() + getOverallTimeoutMs();

  const to = sanitizeEmail(args.to);
  if (!to) return { ok: false, error: 'Invalid recipient email' };

  const envelopeFrom = extractEnvelopeFrom(config.from);
  if (!envelopeFrom) return { ok: false, error: 'Invalid SMTP_FROM email' };

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
    const connectHost = await resolveIpv4(config.host, timeLeftMs(deadline, 6_000));

    socket = config.secure
      ? tls.connect({ host: connectHost, port: config.port, servername: config.host, rejectUnauthorized: false })
      : net.connect({ host: connectHost, port: config.port, family: 4 });

    socket.setTimeout(timeLeftMs(deadline, 25_000), () => {
      try {
        socket?.destroy(new Error('SMTP socket timeout'));
      } catch {
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`SMTP connect timeout (${config.host}:${config.port})`)),
        timeLeftMs(deadline, 15_000)
      );
      socket!.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket!.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    const greet = await readResponse(socket, timeLeftMs(deadline, 15_000));
    if (!/^220[\- ]/m.test(greet)) {
      throw new Error(`SMTP greeting failed: ${greet.slice(0, 800)}`);
    }

    const ehlo = await sendCmd(socket, `EHLO ${config.host}`, true, timeLeftMs(deadline, 15_000));
    const caps = parseCapabilities(ehlo);

    if (!config.secure && caps.starttls) {
      socket = await upgradeToStartTls(socket, config.host);
      await sendCmd(socket, `EHLO ${config.host}`, true, timeLeftMs(deadline, 15_000));
    }

    if (config.user && config.pass) {
      await authLogin(socket, config.user, config.pass);
    }

    await sendCmd(socket, `MAIL FROM:<${envelopeFrom}>`, true, timeLeftMs(deadline, 15_000));
    await sendCmd(socket, `RCPT TO:<${to}>`, true, timeLeftMs(deadline, 15_000));

    await sendCmd(socket, 'DATA', true, timeLeftMs(deadline, 15_000));
    socket.write(message.replace(/\r?\n/g, '\r\n') + '\r\n.\r\n');
    const dataResp = await readResponse(socket, timeLeftMs(deadline, 20_000));
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
