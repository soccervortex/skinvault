/* eslint-disable @next/next/no-img-element */

export function InventoryImage({ profile, rank, totalValue, totalItems, topItems, currency }: any) {
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

  const getSteamIconSrc = (iconUrl: string) => {
    const raw = String(iconUrl || '').trim();
    if (!raw) return '';
    const alreadySized = /\/\d+fx\d+f$/.test(raw);
    const path = raw.replace(/^https?:\/\/[^/]+\/economy\/image\//i, '');
    return `https://community.cloudflare.steamstatic.com/economy/image/${path}${alreadySized ? '' : '/256fx256f'}`;
  };

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
        <img
          src={profile.avatar}
          width="120"
          height="120"
          alt={profile.name}
          style={{ borderRadius: '50%', border: `5px solid ${rank.color}` }}
        />
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

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '40px' }}>
        {topItems.map((item: any, index: number) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 18px', backgroundColor: '#12141c', padding: '22px', borderRadius: '18px', border: '2px solid #2a2d36', width: '260px' }}>
            <img src={getSteamIconSrc(item.icon_url)} width="120" height="120" alt={item.market_hash_name} style={{ marginBottom: '14px' }} />
            <p style={{ fontSize: 20, textAlign: 'center', margin: 0, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 }}>{item.market_hash_name}</p>
            <p style={{ fontSize: 26, color: '#22c55e', fontWeight: 900, margin: '8px 0 0', letterSpacing: -0.5 }}>{formatValue(item.price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
