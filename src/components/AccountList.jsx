import AccountCard from './AccountCard.jsx';

export default function AccountList({ accounts, filter, switchingLabel, onSwitch, onSync, onRefresh, onDelete, onViewMarket }) {
  const needle = filter.trim().toLocaleLowerCase();
  const visible = accounts.filter((account) => `${account.label} ${account.accountName ?? ''}`.toLocaleLowerCase().includes(needle));
  if (!visible.length) return <section className="empty-state"><h2>{accounts.length ? 'No matching accounts' : 'No saved accounts yet'}</h2><p>{accounts.length ? 'Try a different search.' : 'Save the session currently signed in to Riot Client to begin.'}</p></section>;
  return <section className="account-list">{visible.map((account) => <AccountCard key={account.id} account={account} switchingLabel={switchingLabel} onSwitch={onSwitch} onSync={onSync} onRefresh={onRefresh} onDelete={onDelete} onViewMarket={onViewMarket} />)}</section>;
}
