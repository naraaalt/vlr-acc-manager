import { useState } from 'react';
import { divisionColor, rankIconUrl, relativeTime } from '../lib/format.js';
import { SORT_LABELS } from '../lib/accountOrder.js';
import { Icon } from './Icons.jsx';

function AccountRow({ account, selected, onSelect, onOpenMarket, onSwitch, onDelete, onRename, switching, anySwitching }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const store = account.status === 'ready' ? account.store : null;
  const profile = store?.profile;
  const rank = profile?.rank ?? null;
  const color = divisionColor(rank);
  const iconUrl = rank ? rankIconUrl(rank) : null;
  const sel = (fn) => (event) => { event.stopPropagation(); if (!anySwitching) fn(); };
  const beginRename = () => { setDraft(account.label); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== account.label) onRename(account.label, next);
  };
  const onEditKey = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); commit(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setEditing(false); }
  };
  return (
    <li
      className={`acct${selected ? ' sel' : ''}${switching ? ' busy' : ''}`}
      onClick={onSelect}
      onDoubleClick={() => { if (!anySwitching && account.status === 'ready') onOpenMarket(account.label); }}
      role="button" tabIndex={0} aria-pressed={selected}
    >
      <div className="acct-l1">
        <span className="acct-av" style={rank ? { borderColor: `${color}55`, color } : undefined}>{account.label.slice(0, 1).toUpperCase()}</span>
        {editing
          ? <input
              className="acct-rename"
              value={draft}
              autoFocus
              maxLength={64}
              disabled={anySwitching}
              onChange={(event) => setDraft(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={onEditKey}
              onBlur={commit}
              aria-label="New account label"
            />
          : <span className="acct-name" title={account.store?.accountName ?? account.accountName ?? account.label}>{account.label}</span>}
        <span className="acct-lv">LV.{profile?.level ?? '—'}</span>
        <span className={`dot ${account.active ? 'on' : account.status === 'error' ? 'err' : 'off'}`} />
      </div>
      <div className="acct-l2">
        {iconUrl
          ? <img className="acct-rankic" src={iconUrl} alt="" width="14" height="14" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          : <span className="acct-rankic acct-rankic-empty" />}
        <span className="acct-rank" style={rank ? { color } : undefined}>{rank ?? 'UNRANKED'}</span>
        <span className="acct-rr">{profile?.rr != null ? `${profile.rr} RR` : '—'}</span>
      </div>
      <div className="acct-actions">
        <button type="button" onClick={sel(onSwitch)} disabled={anySwitching} title="Switch Riot session to this account">
          {switching ? 'SWITCHING…' : 'SWITCH'}
        </button>
        <button type="button" onClick={sel(beginRename)} disabled={anySwitching} title="Rename this account">RENAME</button>
        <button type="button" onClick={sel(onDelete)} disabled={anySwitching} title="Delete saved account">DEL</button>
      </div>
    </li>
  );
}

function SyncNote({ accounts }) {
  return (
    <div className="sync-panel">
      <p className="snap-note">LAST SYNC {accounts[0]?.lastCheckedAt ? relativeTime(accounts[0].lastCheckedAt).toUpperCase() : '—'}</p>
    </div>
  );
}

// Commands mirror the non-duplicated keymap: switching happens per-row via the
// account card buttons, so there is no Switch entry. Import only exists when
// TCNO is installed.
const COMMANDS = [
  { key: 'R', icon: 'refresh', label: 'Refresh Account', busyGated: true },
  { key: 'CTRL+R', icon: 'refreshall', label: 'Refresh All', busyGated: true },
  { key: 'O', icon: 'sort', label: 'Sort Accounts' },
  { key: 'X', icon: 'trash', label: 'Delete Account', busyGated: true }
];

function CommandPanel({ commandFlash, tcnoAvailable, busy, onCommand, onOpenAdd }) {
  const commands = [...COMMANDS, ...(tcnoAvailable ? [{ key: 'I', icon: 'import', label: 'Import From TCNO' }] : [])];
  return (
    <nav className="cmd-panel" aria-label="Keyboard commands">
      <div className="panel-label"><span>COMMANDS</span></div>
      <ul className="cmd-list">
        {commands.map((command) => {
          const disabled = busy && command.busyGated;
          return (
            <li
              key={command.key}
              className={`${commandFlash === command.key ? 'flash' : ''}${disabled ? ' disabled' : ''}`}
              onClick={() => { if (!disabled) onCommand(command.key); }}
              onKeyDown={(event) => { if (event.key === 'Enter' && !disabled) onCommand(command.key); }}
              role="button" tabIndex={0}
            >
              <Icon name={command.icon} />
              <span>{command.label}</span>
              <kbd>{command.key}</kbd>
            </li>
          );
        })}
        <li className="cmd-add" onClick={onOpenAdd} onKeyDown={(event) => { if (event.key === 'Enter') onOpenAdd(); }} role="button" tabIndex={0}>
          <Icon name="plus" />
          <span>Add Account</span>
          <kbd>A</kbd>
        </li>
      </ul>
    </nav>
  );
}

export default function Sidebar({
  accounts, visible, totalCount, selectedIndex, onSelect, onOpenMarket,
  filter, onFilter, sortMode, onCycleSort,
  tcnoAvailable, busy, commandFlash, switchingLabel,
  onSwitch, onRefresh, onRefreshAll, onDelete, onRename, onImport, onAdd
}) {
  const readyCount = accounts.filter((account) => account.status === 'ready').length;
  // Command rows act on the selected account; row buttons act on their own row.
  const runCommand = (key) => {
    if (key === 'R') onRefresh();
    else if (key === 'CTRL+R') onRefreshAll();
    else if (key === 'X') onDelete();
    else if (key === 'I') onImport();
    else if (key === 'O') onCycleSort();
  };
  return (
    <aside className="sidebar">
      <div className="side-head">
        <span className="side-title">ACCOUNTS ({visible.length})</span>
        <span className="side-count">{readyCount}/{totalCount} READY</span>
      </div>
      <div className="side-filter">
        <Icon name="search" size={12} />
        <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="filter…" aria-label="Filter accounts" />
        <button
          type="button" className={`sort-btn${sortMode !== 'active' ? ' on' : ''}`} onClick={onCycleSort}
          title={`Sort: ${SORT_LABELS[sortMode]} — click or press [O] to cycle`}
          aria-label={`Sort accounts, currently ${SORT_LABELS[sortMode]}`}
        >
          <Icon name="sort" size={11} />
          <span>{SORT_LABELS[sortMode]}</span>
        </button>
      </div>
      <ul className="acct-list">
        {visible.map((account, index) => (
          <AccountRow
            key={account.id} account={account}
            selected={index === selectedIndex}
            onSelect={() => onSelect(account.label)}
            onOpenMarket={onOpenMarket}
            onSwitch={() => onSwitch(account.label)}
            onDelete={() => onDelete(account.label)}
            onRename={onRename}
            switching={switchingLabel === account.label}
            anySwitching={busy}
          />
        ))}
      </ul>
      <SyncNote accounts={accounts} />
      <CommandPanel
        commandFlash={commandFlash} tcnoAvailable={tcnoAvailable} busy={busy}
        onCommand={runCommand} onOpenAdd={onAdd}
      />
    </aside>
  );
}
