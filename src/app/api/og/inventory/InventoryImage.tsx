/* eslint-disable @next/next/no-img-element */

export function InventoryImage({ profile, rank, totalValue, totalItems, topItems }: any) {
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
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
        padding: '50px',
        border: '10px solid #1a1b21',
        borderRadius: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <img
          src={profile.avatar}
          width="100"
          height="100"
          alt={profile.name}
          style={{ borderRadius: '50%', border: `4px solid ${rank.color}` }}
        />
        <div style={{ marginLeft: '30px', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: 52, margin: 0, fontWeight: 800 }}>{profile.name}</h1>
          <p style={{ fontSize: 32, margin: '5px 0 0', color: '#9ca3af' }}>SkinVaults Inventory</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderRadius: '15px', backgroundColor: '#1a1b21' }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: rank.color }}>{rank.name}</span>
            </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: 24, color: '#9ca3af', margin: 0 }}>VAULT VALUE</p>
          <p style={{ fontSize: 48, fontWeight: 800, margin: '5px 0 0', color: '#22c55e' }}>{formatValue(totalValue)}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: 24, color: '#9ca3af', margin: 0 }}>TOTAL ITEMS</p>
          <p style={{ fontSize: 48, fontWeight: 800, margin: '5px 0 0' }}>{totalItems}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '40px' }}>
        {topItems.map((item: any, index: number) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 20px', backgroundColor: '#1a1b21', padding: '20px', borderRadius: '15px', border: '2px solid #374151' }}>
            <img src={`https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}`} width="100" height="100" alt={item.market_hash_name} style={{ marginBottom: '15px' }} />
            <p style={{ fontSize: 16, textAlign: 'center', margin: 0, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.market_hash_name}</p>
            <p style={{ fontSize: 18, color: '#22c55e', fontWeight: 600, margin: '5px 0 0' }}>{formatValue(item.price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
