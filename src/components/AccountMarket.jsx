function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return 'Store time unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m remaining`;
}

function AccountStats({ profile }) {
  if (!profile) return null;
  return <dl className="account-stats">
    <div><dt>Level</dt><dd>{profile.level ?? '—'}</dd></div>
    <div><dt>Rank</dt><dd>{profile.rank ?? '—'}</dd></div>
    {profile.rr !== null && profile.rr !== undefined && <div><dt>RR</dt><dd>{profile.rr}</dd></div>}
    {profile.placementsRemaining > 0 && <div><dt>Placements</dt><dd>{profile.placementsRemaining} remaining</dd></div>}
  </dl>;
}

export default function AccountMarket({ account, onBack }) {
  return <section className="market-page">
    <button type="button" className="secondary-button" onClick={onBack}>Back to accounts</button>
    <header className="market-header"><div><h1>{account.label}</h1><p className="account-name">{account.store.accountName ?? account.accountName ?? 'Riot account'}</p></div>{account.active && <span className="active-status"><span aria-hidden="true" />You are logged in</span>}</header>
    <AccountStats profile={account.store.profile} />
    <p className="expiry">{formatTime(account.store.expiresIn)}</p>
    <section className="market-offers" aria-label={`${account.label} daily store`}>
      {account.store.offers.map((offer) => <article className="market-offer" key={offer.id}>
        <div className="market-art">{offer.image ? <img src={offer.image} alt="" /> : <span>Image unavailable</span>}</div>
        <h2>{offer.name}</h2><p>{offer.price?.toLocaleString() ?? '—'} <span>VP</span></p>
      </article>)}
    </section>
  </section>;
}
