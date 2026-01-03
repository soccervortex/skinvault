export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get('token') || '').trim();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SkinVaults Overlay</title>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    .wrap { width: 520px; height: 150px; }
    .card { width: 100%; height: 100%; border-radius: 18px; background: rgba(8,9,13,0.88); border: 1px solid rgba(59,130,246,0.55); box-shadow: 0 20px 60px rgba(0,0,0,0.55); position: relative; padding: 14px 16px; box-sizing: border-box; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo { width: 28px; height: 28px; border-radius: 8px; background: rgba(59,130,246,0.20); border: 1px solid rgba(59,130,246,0.45); display:flex; align-items:center; justify-content:center; color: #93c5fd; font-weight: 900; font-size: 12px; letter-spacing: 0.08em; }
    .title { color: rgba(148,163,184,0.95); font-size: 10px; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
    .valueRow { margin-top: 10px; display: flex; align-items: baseline; gap: 10px; }
    .currency { color: #60a5fa; font-size: 26px; font-weight: 900; font-style: italic; }
    .value { color: #ffffff; font-size: 52px; font-weight: 900; letter-spacing: -0.05em; font-style: italic; line-height: 1; }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .toggles { display: flex; gap: 6px; padding: 4px; border-radius: 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); }
    .btn { appearance: none; border: 0; cursor: pointer; font-weight: 900; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; padding: 8px 10px; border-radius: 10px; color: rgba(148,163,184,0.95); background: transparent; }
    .btn.active { background: rgba(37,99,235,0.95); color: #fff; }
    .live { position: absolute; right: 16px; bottom: 12px; display: flex; align-items: center; gap: 10px; color: rgba(148,163,184,0.95); font-size: 12px; font-weight: 800; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.15); }
    .error { color: rgba(248,113,113,0.9); font-size: 11px; font-weight: 800; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="row">
        <div class="brand">
          <div class="logo">SV</div>
          <div>
            <div class="title">TOTAL VAULT VALUE</div>
          </div>
        </div>
        <div class="right">
          <div class="toggles">
            <button class="btn" id="btn-eur" type="button">EUR</button>
            <button class="btn" id="btn-usd" type="button">USD</button>
          </div>
        </div>
      </div>

      <div class="valueRow">
        <div class="currency" id="currencySymbol">€</div>
        <div class="value" id="value">0,00</div>
      </div>

      <div class="error" id="error" style="display:none;"></div>

      <div class="live">
        <div class="dot"></div>
        <div>LIVE <span id="time">--:--</span></div>
      </div>
    </div>
  </div>

  <script>
    (function() {
      const token = ${JSON.stringify(token)};
      const hasToken = !!token;
      const elValue = document.getElementById('value');
      const elTime = document.getElementById('time');
      const elError = document.getElementById('error');
      const elSymbol = document.getElementById('currencySymbol');
      const btnEur = document.getElementById('btn-eur');
      const btnUsd = document.getElementById('btn-usd');

      function pad2(n) { return String(n).padStart(2, '0'); }
      function setTimeNow() {
        const d = new Date();
        elTime.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      }
      function setCurrency(code) {
        try { localStorage.setItem('sv_obs_currency', code); } catch {}
        const isUsd = code === '1';
        btnUsd.classList.toggle('active', isUsd);
        btnEur.classList.toggle('active', !isUsd);
        elSymbol.textContent = isUsd ? '$' : '€';
      }
      function getCurrency() {
        try {
          const v = localStorage.getItem('sv_obs_currency');
          if (v === '1' || v === '3') return v;
        } catch {}
        return '3';
      }
      function fmt(num) {
        try {
          return Number(num).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } catch {
          return String(num);
        }
      }

      async function refresh() {
        setTimeNow();
        if (!hasToken) {
          elError.style.display = 'block';
          elError.textContent = 'Missing token';
          return;
        }

        const currency = getCurrency();
        const apiUrl = '/api/obs/vault?token=' + encodeURIComponent(token) + '&currency=' + encodeURIComponent(currency);

        try {
          const res = await fetch(apiUrl, { cache: 'no-store' });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json) {
            elError.style.display = 'block';
            elError.textContent = 'Could not load';
            return;
          }

          elError.style.display = 'none';
          const total = json.total || '0.00';
          const n = Number(String(total).replace(/[^0-9.]/g, ''));
          elValue.textContent = isFinite(n) ? fmt(n) : '0,00';
        } catch {
          elError.style.display = 'block';
          elError.textContent = 'Offline';
        }
      }

      btnEur.addEventListener('click', () => { setCurrency('3'); refresh(); });
      btnUsd.addEventListener('click', () => { setCurrency('1'); refresh(); });

      setCurrency(getCurrency());
      refresh();
      setInterval(refresh, 60 * 1000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
