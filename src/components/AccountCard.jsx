import { useState } from 'react';

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

export default function AccountCard({ account, switchingLabel, onSwitch, onSync, onRefresh, onDelete, onViewMarket }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [skinsHidden, setSkinsHidden] = useState(false);
  const switchAccount = async () => { setWorking(true); setError(null); try { await onSwitch(account.label); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  const syncLogin = async () => { setWorking(true); setError(null); try { await onSync(account.label); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  const refreshMarket = async () => { setWorking(true); setError(null); try { await onRefresh(account.label); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  const removeAccount = async () => { if (!window.confirm(`Delete saved account “${account.label}”? This cannot be undone.`)) return; setWorking(true); setError(null); try { await onDelete(account.label); } catch (requestError) { setError(requestError.message); } finally { setWorking(false); } };
  const switchDisabled = working || Boolean(switchingLabel);
  return <article className={`account-card ${account.status === 'ready' ? 'is-ready' : 'is-error'} ${account.active ? 'is-active' : ''}`}>
    <header className="account-card-header"><div className="account-card-heading"><h2>{account.label}</h2><p>{account.accountName ?? 'Riot account'}</p>{account.active && <span className="active-status"><span aria-hidden="true" />You are logged in</span>}</div><button className="text-button" type="button" onClick={removeAccount} disabled={switchDisabled}>Delete</button></header>
    {account.status === 'ready' ? <>
      <AccountStats profile={account.store.profile} />
      <p className="expiry">{formatTime(account.store.expiresIn)}</p>
      <button type="button" className="text-button visibility-button" onClick={() => setSkinsHidden((hidden) => !hidden)} aria-expanded={!skinsHidden}>{skinsHidden ? `Show skins (${account.store.offers.length})` : 'Hide skins'}</button>
      {skinsHidden ? <p className="skins-hidden">{account.store.offers.length} store skins hidden.</p> : <section className="offers" aria-label={`${account.label} daily store offers`}>
        {account.store.offers.map((offer) => <article className="offer" key={offer.id}>
          <div className="art">{offer.image ? <img src={offer.image} alt="" /> : <span>Image unavailable</span>}</div>
          <h3>{offer.name}</h3><p>{offer.price?.toLocaleString() ?? '—'} <span>VP</span></p>
        </article>)}
      </section>}
    </> : <section className="account-error"><strong>Store unavailable</strong><p>{account.error}</p><button type="button" className="secondary-button" onClick={syncLogin} disabled={switchDisabled}>{working ? 'Saving…' : 'Save current login'}</button></section>}
    {error && <p className="form-error">{error}</p>}
    <footer className="account-card-actions"><button type="button" onClick={switchAccount} disabled={switchDisabled}>{switchingLabel === account.label ? 'Switching…' : 'Switch to this account'}</button>{account.status === 'ready' && <button type="button" className="secondary-button" onClick={refreshMarket} disabled={switchDisabled}>{working ? 'Refreshing…' : 'Refresh market'}</button>}{account.status === 'ready' && <button type="button" className="secondary-button" onClick={() => onViewMarket(account.label)} disabled={Boolean(switchingLabel) || working}>View market</button>}</footer>
  </article>;
}
