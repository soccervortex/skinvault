export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get('token') || '').trim();

  const { listSteamCurrencies, getCurrencyMetaFromSteamCode } = await import('@/app/utils/currency-preference');
  const currencies = listSteamCurrencies().map((c) => ({
    code: c.code,
    iso: c.iso,
    symbol: c.symbol,
    locale: getCurrencyMetaFromSteamCode(c.code).locale,
  }));

  const baseW = 520;
  const baseH = 150;

  const wParamRaw = String(url.searchParams.get('w') || '').trim();
  const hParamRaw = String(url.searchParams.get('h') || '').trim();
  const sParamRaw = String(url.searchParams.get('scale') || '').trim();

  const wParam = wParamRaw ? Number.parseInt(wParamRaw, 10) : NaN;
  const hParam = hParamRaw ? Number.parseInt(hParamRaw, 10) : NaN;
  const sParam = sParamRaw ? Number.parseFloat(sParamRaw) : NaN;

  const clampScale = (v: number) => {
    if (!Number.isFinite(v)) return 1;
    if (v < 0.25) return 0.25;
    if (v > 3) return 3;
    return v;
  };

  let scale = Number.isFinite(sParam) ? clampScale(sParam) : NaN;
  if (!Number.isFinite(scale) && (Number.isFinite(wParam) || Number.isFinite(hParam))) {
    const derived = Number.isFinite(wParam) ? wParam / baseW : (hParam / baseH);
    scale = clampScale(derived);
  }
  if (!Number.isFinite(scale)) scale = 1;

  const viewportW = Number.isFinite(wParam) ? wParam : Math.round(baseW * scale);
  const viewportH = Number.isFinite(hParam) ? hParam : Math.round(baseH * scale);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SkinVaults Overlay</title>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    .viewport { width: ${viewportW}px; height: ${viewportH}px; }
    .wrap { width: ${baseW}px; height: ${baseH}px; transform: scale(${scale}); transform-origin: top left; }
    .card { width: 100%; height: 100%; border-radius: 18px; background: rgba(8,9,13,0.88); border: 1px solid rgba(59,130,246,0.55); box-shadow: 0 20px 60px rgba(0,0,0,0.55); position: relative; padding: 14px 16px; box-sizing: border-box; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo { width: 28px; height: 28px; border-radius: 8px; background: rgba(59,130,246,0.20); border: 1px solid rgba(59,130,246,0.45); display:flex; align-items:center; justify-content:center; overflow: hidden; }
    .logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .title { color: rgba(148,163,184,0.95); font-size: 10px; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; }
    .valueRow { margin-top: 10px; display: flex; align-items: baseline; gap: 10px; }
    .currency { color: #60a5fa; font-size: 26px; font-weight: 900; font-style: italic; }
    .value { color: #ffffff; font-size: 52px; font-weight: 900; letter-spacing: -0.05em; font-style: italic; line-height: 1; }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .toggles { display: flex; gap: 6px; padding: 4px; border-radius: 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); position: relative; }
    .btn { appearance: none; border: 0; cursor: pointer; font-weight: 900; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; padding: 8px 10px; border-radius: 10px; color: rgba(148,163,184,0.95); background: transparent; }
    .btn.primary { background: rgba(37,99,235,0.95); color: #fff; }
    .btn.icon { padding: 8px 10px; width: 34px; display: inline-flex; align-items: center; justify-content: center; }
    .popover { position: absolute; top: calc(100% + 10px); right: 0; width: 260px; background: rgba(17,20,29,0.98); border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.55); padding: 10px; display: none; z-index: 999; }
    .popover.open { display: block; }
    .pop-title { font-size: 9px; font-weight: 900; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(148,163,184,0.95); padding: 6px 8px 8px; }
    .pop-search { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.35); color: #fff; font-weight: 800; font-size: 11px; outline: none; }
    .pop-list { margin: 10px 0 0; padding: 0; list-style: none; max-height: 220px; overflow: auto; }
    .pop-item { width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25); color: rgba(226,232,240,0.95); cursor: pointer; font-weight: 900; font-size: 11px; }
    .pop-item:hover { border-color: rgba(59,130,246,0.55); }
    .pop-item.active { border-color: rgba(59,130,246,0.75); background: rgba(37,99,235,0.18); }
    .pop-item .meta { font-size: 9px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(148,163,184,0.95); }
    .live { position: absolute; right: 16px; bottom: 12px; display: flex; align-items: center; gap: 10px; color: rgba(148,163,184,0.95); font-size: 12px; font-weight: 800; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.15); }
    .error { color: rgba(248,113,113,0.9); font-size: 11px; font-weight: 800; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="viewport">
    <div class="wrap">
      <div class="card">
      <div class="row">
        <div class="brand">
          <div class="logo"><img src="/icons/favicon-48x48.png" alt="SkinVaults" /></div>
          <div>
            <div class="title">TOTAL VAULT VALUE</div>
          </div>
        </div>
        <div class="right">
          <div class="toggles">
            <button class="btn primary" id="btn-currency" type="button">EUR</button>
            <button class="btn icon" id="btn-settings" type="button" aria-label="Currency settings">⚙</button>
            <div class="popover" id="currencyPopover">
              <div class="pop-title">Currency</div>
              <input class="pop-search" id="currencySearch" type="text" placeholder="Search (e.g. EUR, USD, ¥)" />
              <ul class="pop-list" id="currencyList"></ul>
            </div>
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
  </div>

  <script>
    (function() {
      const token = ${JSON.stringify(token)};
      const hasToken = !!token;
      const elValue = document.getElementById('value');
      const elTime = document.getElementById('time');
      const elError = document.getElementById('error');
      const elSymbol = document.getElementById('currencySymbol');
      const btnCurrency = document.getElementById('btn-currency');
      const btnSettings = document.getElementById('btn-settings');
      const pop = document.getElementById('currencyPopover');
      const list = document.getElementById('currencyList');
      const search = document.getElementById('currencySearch');

      const currencies = ${JSON.stringify(currencies)};

      function pad2(n) { return String(n).padStart(2, '0'); }
      function setTimeNow() {
        const d = new Date();
        elTime.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      }
      function normalizeCode(input) {
        const raw = String(input || '').trim();
        if (!raw) return null;
        const hit = currencies.find(c => String(c.code) === raw);
        if (hit) return String(hit.code);
        const iso = raw.toUpperCase();
        const hitIso = currencies.find(c => String(c.iso).toUpperCase() === iso);
        return hitIso ? String(hitIso.code) : null;
      }

      function setCurrency(code) {
        const normalized = normalizeCode(code) || '3';
        try { localStorage.setItem('sv_obs_currency', normalized); } catch {}
        try { localStorage.setItem('sv_currency', normalized); } catch {}

        const meta = currencies.find(c => String(c.code) === normalized) || currencies.find(c => String(c.code) === '3') || { code: '3', iso: 'EUR', symbol: '€', locale: 'nl-NL' };

        btnCurrency.textContent = String(meta.iso || 'EUR');
        elSymbol.textContent = String(meta.symbol || '€');

        renderList(String(search && search.value ? search.value : ''));
      }
      function getCurrency() {
        try {
          const vGlobal = normalizeCode(localStorage.getItem('sv_currency'));
          if (vGlobal) return vGlobal;
          const v = normalizeCode(localStorage.getItem('sv_obs_currency'));
          if (v) return v;
        } catch {}
        return '3';
      }

      function fmt(num, locale) {
        try {
          return Number(num).toLocaleString(locale || 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } catch {
          return String(num);
        }
      }

      function renderList(query) {
        if (!list) return;
        const q = String(query || '').trim().toLowerCase();
        const active = getCurrency();
        const filtered = !q ? currencies : currencies.filter(c => {
          return String(c.iso).toLowerCase().includes(q) || String(c.code).toLowerCase().includes(q) || String(c.symbol).toLowerCase().includes(q);
        });

        list.innerHTML = filtered.map(c => {
          const isActive = String(c.code) === String(active);
          const cls = 'pop-item' + (isActive ? ' active' : '');
          return '<li><button type="button" class="' + cls + '" data-code="' + String(c.code) + '">' +
            '<span>' + String(c.iso) + '</span>' +
            '<span class="meta">' + String(c.symbol) + ' • ' + String(c.code) + '</span>' +
          '</button></li>';
        }).join('');

        Array.from(list.querySelectorAll('button[data-code]')).forEach((b) => {
          b.addEventListener('click', () => {
            const code = b.getAttribute('data-code');
            setCurrency(code);
            if (pop) pop.classList.remove('open');
            refresh();
          });
        });
      }

      async function refresh() {
        setTimeNow();
        if (!hasToken) {
          elError.style.display = 'block';
          elError.textContent = 'Missing token';
          return;
        }

        const currency = getCurrency();
        const meta = currencies.find(c => String(c.code) === String(currency)) || currencies.find(c => String(c.code) === '3') || { code: '3', iso: 'EUR', symbol: '€', locale: 'nl-NL' };
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
          elValue.textContent = isFinite(n) ? fmt(n, meta.locale) : '0,00';
        } catch {
          elError.style.display = 'block';
          elError.textContent = 'Offline';
        }
      }

      if (btnSettings && pop) {
        btnSettings.addEventListener('click', (e) => {
          e.preventDefault();
          pop.classList.toggle('open');
          if (pop.classList.contains('open')) {
            try { search && search.focus(); } catch {}
          }
        });
      }

      if (btnCurrency && pop) {
        btnCurrency.addEventListener('click', (e) => {
          e.preventDefault();
          pop.classList.toggle('open');
          if (pop.classList.contains('open')) {
            try { search && search.focus(); } catch {}
          }
        });
      }

      if (search) {
        search.addEventListener('input', () => {
          renderList(String(search.value || ''));
        });
      }

      document.addEventListener('click', (e) => {
        if (!pop) return;
        const t = e.target;
        if (t === btnSettings || t === btnCurrency) return;
        if (pop.contains(t)) return;
        pop.classList.remove('open');
      });

      setCurrency(getCurrency());
      renderList('');
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
