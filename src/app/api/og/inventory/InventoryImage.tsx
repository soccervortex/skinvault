/* eslint-disable @next/next/no-img-element */

export function InventoryImage({ profile, rank, totalValue, totalItems, topItems, currency, baseUrl }: any) {
  const formatValue = (value: number) => {
    const iso = String(currency || 'USD').toUpperCase();
    const locale = (() => {
      if (iso === 'EUR') return 'nl-NL';
      if (iso === 'GBP') return 'en-GB';
      if (iso === 'JPY') return 'ja-JP';
      if (iso === 'KRW') return 'ko-KR';
      if (iso === 'TRY') return 'tr-TR';
      if (iso === 'PLN') return 'pl-PL';
      return 'en-US';
    })();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: iso,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const proxy = (rawUrl: string) => {
    const u = String(rawUrl || '').trim();
    if (!u) return '';
    const b = String(baseUrl || '').trim();
    if (!b) return u;

    if (u.startsWith('data:')) return u;
    if (u.startsWith(`${b}/api/image-proxy?`)) return u;
    if (u.startsWith('/')) return `${b}${u}`;

    try {
      const bu = new URL(b);
      const uu = new URL(u);
      if (bu.origin === uu.origin) return u;
    } catch {
      // If URL parsing fails, fall back to proxying.
    }

    return `${b}/api/image-proxy?url=${encodeURIComponent(u)}`;
  };

  const getSteamIconSrc = (iconUrl: string) => {
    const raw = String(iconUrl || '').trim();
    if (!raw) return '';
    const alreadySized = /\/\d+fx\d+f$/.test(raw);
    const path = raw.replace(/^https?:\/\/[^/]+\/economy\/image\//i, '');
    const steamUrl = `https://community.cloudflare.steamstatic.com/economy/image/${path}${alreadySized ? '' : '/256fx256f'}`;
    return proxy(steamUrl);
  };

  const avatarSrc = proxy(String(profile?.avatar || '').trim());

  const topFive = Array.isArray(topItems) ? topItems.slice(0, 5) : [];

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#08090d',
        color: 'white',
        fontFamily: '"Inter", sans-serif',
        padding: '56px',
        border: '10px solid #1a1b21',
        borderRadius: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {avatarSrc ? (
          <img
            src={avatarSrc}
            width={120}
            height={120}
            alt={profile.name}
            style={{ borderRadius: '50%', border: `5px solid ${rank.color}` }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: `5px solid ${rank.color}`,
              backgroundColor: '#1a1b21',
            }}
          />
        )}
        <div style={{ marginLeft: '30px', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: 60, margin: 0, fontWeight: 900, letterSpacing: -1 }}>{profile.name}</h1>
          <p style={{ fontSize: 30, margin: '6px 0 0', color: '#9ca3af', fontWeight: 700 }}>SkinVaults Inventory</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 22px', borderRadius: '16px', backgroundColor: '#1a1b21', border: '2px solid #2a2d36' }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: rank.color, letterSpacing: -0.5 }}>{rank.name}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: 22, color: '#9ca3af', margin: 0, letterSpacing: 2, fontWeight: 900 }}>VAULT VALUE</p>
          <p style={{ fontSize: 58, fontWeight: 900, margin: '6px 0 0', color: '#22c55e', letterSpacing: -1 }}>{formatValue(totalValue)}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: 22, color: '#9ca3af', margin: 0, letterSpacing: 2, fontWeight: 900 }}>TOTAL ITEMS</p>
          <p style={{ fontSize: 58, fontWeight: 900, margin: '6px 0 0', letterSpacing: -1 }}>{totalItems}</p>
        </div>
      </div>

      <div style={{ display: 'flex', width: '100%', marginTop: '34px', backgroundColor: '#12141c', border: '2px solid #2a2d36', borderRadius: '20px', padding: '22px 26px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: '100%', marginBottom: '14px' }}>
            <p style={{ fontSize: 22, color: '#9ca3af', margin: 0, letterSpacing: 2, fontWeight: 900 }}>TOP 5 ITEMS</p>
            <p style={{ fontSize: 20, color: '#6b7280', margin: 0, fontWeight: 800 }}>By value</p>
          </div>

          {topFive.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {topFive.map((item: any, index: number) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 12px', borderRadius: '14px', backgroundColor: '#0d0f16', border: '1px solid #20222b' }}>
                  {(() => {
                    const iconSrc = getSteamIconSrc(String(item?.icon_url || '').trim());
                    return (
                      <div style={{ width: '54px', height: '54px', borderRadius: '10px', backgroundColor: '#1a1b21', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', border: index === 0 ? '2px solid #f59e0b' : '1px solid #20222b' }}>
                        {iconSrc ? (
                          <img src={iconSrc} width={54} height={54} alt={String(item?.market_hash_name || 'Item')} style={{ objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#9ca3af', fontWeight: 900, fontSize: 18 }}>#{index + 1}</span>
                        )}
                        <div style={{ position: 'absolute', top: 4, left: 6, fontSize: 12, fontWeight: 900, color: 'white', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>#{index + 1}</div>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '14px', flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 22, margin: 0, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{index + 1}. {String(item.market_hash_name || '').trim() || 'Unknown Item'}</p>
                    {Number(item?.amount || 0) > 1 ? (
                      <p style={{ fontSize: 16, margin: '4px 0 0', color: '#6b7280', fontWeight: 800 }}>x{Number(item.amount)}</p>
                    ) : (
                      <p style={{ fontSize: 16, margin: '4px 0 0', color: '#6b7280', fontWeight: 800 }}>&nbsp;</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '14px' }}>
                    <p style={{ fontSize: 22, margin: 0, color: '#22c55e', fontWeight: 900 }}>{formatValue(Number(item?.price || 0) * Number(item?.amount || 1))}</p>
                    <p style={{ fontSize: 16, margin: '4px 0 0', color: '#6b7280', fontWeight: 800 }}>{Number(item?.amount || 1) > 1 ? `${formatValue(Number(item?.price || 0))} each` : ' '}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 22, margin: 0, color: '#9ca3af', fontWeight: 800 }}>No top items available</p>
          )}
        </div>
      </div>
    </div>
  );
}
