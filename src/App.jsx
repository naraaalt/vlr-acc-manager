import { useState } from 'react';
import AddAccountModal from './components/AddAccountModal.jsx';
import AccountList from './components/AccountList.jsx';
import AccountMarket from './components/AccountMarket.jsx';
import { useAccounts } from './hooks/useAccounts.js';

export default function App() {
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [marketLabel, setMarketLabel] = useState(null);
  const { accounts, loading, error, tcno, switchingLabel, refresh, capture, addManually, remove, switchTo, syncCurrent, refreshAccount, importTcno } = useAccounts();
  const marketAccount = accounts.find((account) => account.label === marketLabel && account.status === 'ready');
  if (marketAccount) return <main className="app-shell"><AccountMarket account={marketAccount} onBack={() => setMarketLabel(null)} /></main>;
  return <main className="app-shell">
    <div className="app-atmosphere" aria-hidden="true" />
    <header className="topbar"><div className="title-stack"><h1>Accounts<span aria-hidden="true">.</span></h1><p className="account-name"><span className="live-signal" aria-hidden="true" />Daily store dashboard</p></div><div className="header-actions"><button className="secondary-button" type="button" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh all'}</button><button type="button" onClick={() => setAdding(true)}>Add account</button></div></header>
    <section className="dashboard-tools"><label htmlFor="account-search">Search accounts</label><input id="account-search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by label or Riot ID" /></section>
    {error && <section className="status error"><h2>Accounts unavailable</h2><p>{error}</p></section>}
    {loading ? <section className="status"><span className="spinner" /> Loading saved accounts…</section> : <AccountList accounts={accounts} filter={filter} switchingLabel={switchingLabel} onSwitch={switchTo} onSync={syncCurrent} onRefresh={refreshAccount} onDelete={remove} onViewMarket={setMarketLabel} />}
    {adding && <AddAccountModal tcno={tcno} onCapture={capture} onManualAdd={addManually} onImport={importTcno} onClose={() => setAdding(false)} />}
  </main>;
}
