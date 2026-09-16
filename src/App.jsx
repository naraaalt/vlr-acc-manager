import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddAccountModal from './components/AddAccountModal.jsx';
import Sidebar from './components/Sidebar.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { AccountOverview, DailyStore, MarketView, StoreRefreshStrip, SkinPreviewModal } from './components/StorePanel.jsx';
import { useAccounts } from './hooks/useAccounts.js';
import { useUpdates } from './hooks/useUpdates.js';
import { useConfirm } from './components/ConfirmDialog.jsx';
import { fmtCountdown, storeCountdownSeconds, crossedStoreReset, parseRank } from './lib/format.js';
import { presentError } from './lib/errorPresentation.js';
import { getPreviewsHidden, setPreviewsHidden as persistPreviewsHidden, getSortMode, setSortMode as persistSortMode, nextSortMode } from './lib/uiPrefs.js';
import { orderAccounts, SORT_LABELS } from './lib/accountOrder.js';
import { getSetting, subscribeSettings, getLastSelection, setLastSelection } from './lib/settings.js';
import { isRateLimited, cooldownSeconds, markRefreshed, isRefreshAllRateLimited, markRefreshAll, refreshAllCooldownSeconds } from './lib/rateLimit.js';
import { Icon, BrandMark } from './components/Icons.jsx';
import WindowControls from './components/WindowControls.jsx';

// Skeleton mirror of the dashboard layout: same panels, grayed shimmer bars
// and empty card frames instead of a blank screen while accounts load. When
// progressive-load progress events arrive, shows "FETCHING x/y" with the
// label of the account currently being fetched.
function LoadingSkeleton({ progress = null }) {
  return (
    <>
      <section className="panel overview skel-panel" aria-hidden="true">
        <div className="ov-head">
          <span className="skel-bar" style={{ width: 20, height: 20 }} />
          <span className="skel-bar" style={{ width: 180, height: 16 }} />
          <span className="skel-bar" style={{ width: 70, height: 12 }} />
          <span className="skel-bar" style={{ marginLeft: 'auto', width: 64, height: 20 }} />
        </div>
        <div className="ov-body">
          <div className="ov-cell ov-rank"><span className="skel-bar" style={{ width: 46, height: 46 }} /><span className="skel-bar" style={{ width: 110, height: 14 }} /></div>
          <div className="ov-cell ov-mid"><span className="skel-bar" style={{ width: 150, height: 10 }} /><span className="skel-bar" style={{ width: 120, height: 11 }} /></div>
          <div className="ov-cell ov-info">
            {[0, 1, 2, 3].map((key) => (
              <div className="kv" key={key}><span className="skel-bar" style={{ width: 70, height: 8 }} /><span className="skel-bar" style={{ width: 96, height: 12 }} /></div>
            ))}
          </div>
        </div>
      </section>
      <section className="panel refresh-strip skel-panel" aria-hidden="true">
        <span className="skel-bar" style={{ width: 15, height: 15 }} />
        <span className="skel-bar" style={{ width: 140, height: 10 }} />
        <span className="skel-bar" style={{ width: 120, height: 22 }} />
      </section>
      <section className="panel store skel-panel" aria-hidden="true">
        <div className="panel-title">
          <span className="skel-bar" style={{ width: 13, height: 13 }} />
          <span className="skel-bar" style={{ width: 90, height: 10 }} />
        </div>
        <div className="cards">
          {[0, 1, 2, 3].map((key) => (
            <article className="card" key={key}>
              <div className="prev"><span className="skel-bar" style={{ width: '72%', height: 54 }} /></div>
              <div className="meta">
                <span className="skel-bar" style={{ width: '84%', height: 11 }} />
                <span className="skel-bar" style={{ width: '46%', height: 9 }} />
              </div>
            </article>
          ))}
        </div>
        {progress && (
          <div className="skel-progress">
            <span className="skel-progress-label">
              FETCHING {progress.done}/{progress.total}
              {progress.account ? ` — ${String(progress.account.label).toUpperCase()}` : ''}
            </span>
            <span className="skel-progress-track"><span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></span>
          </div>
        )}
      </section>
    </>
  );
}

export default function App() {
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [marketLabel, setMarketLabel] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedOffer, setSelectedOffer] = useState(0);
  // [H] skin-preview toggle persists across restarts via uiPrefs.
  const [previewsHidden, setPreviewsHidden] = useState(getPreviewsHidden);
  // Account sort mode (active-first is the invariant; this reorders the rest).
  const [sortMode, setSortMode] = useState(getSortMode);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [commandFlash, setCommandFlash] = useState(null);
  const [toast, setToast] = useState(null);
  const [quitOpen, setQuitOpen] = useState(false);
  // The settings panel is opened from the header button only (no keybind), but it has to be
  // in the keymap guard: see the first block of keyHandler.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updates = useUpdates();
  // DISMISS = diam sampai app ditutup, BUKAN skip versi: penawarannya muncul lagi setelah
  // restart, jadi tidak ada update yang bisa hilang selamanya gara-gara satu klik nyasar.
  // Baris SYSTEM di panel tetap menampilkan versi yang tersedia — yang dibuang nag-nya, bukan
  // faktanya.
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busyLabel, setBusyLabel] = useState(null);
  const flashTimer = useRef(null);
  const toastTimer = useRef(null);
  const { accounts: loadedAccounts, loading, error, errorKind, progress, session, tcno, switchingLabel, refresh, capture, addManually, remove, rename, switchTo, refreshAccount, importTcno } = useAccounts();
  const { confirm, pending: confirmPending } = useConfirm();

  // The signed-in account always sits at the top of the list, even after an
  // app restart: the backend `active` flag only holds while that account's
  // live Riot session token is valid, and it is recomputed on every load.
  // orderAccounts owns that invariant (unit-tested); the selected mode only
  // reorders the accounts below it.
  const accounts = useMemo(
    () => orderAccounts(loadedAccounts, sortMode, parseRank),
    [loadedAccounts, sortMode]
  );

  const busy = Boolean(switchingLabel) || Boolean(busyLabel);
  const tcnoAvailable = Boolean(tcno.available);

  // Keep a selection once accounts load: the remembered account when REOPEN LAST ACCOUNT is
  // on, else the active account, else first ready, else first. Falls back the same way after
  // a refresh removed the current selection.
  //
  // The remembered label is only a preference among accounts that still exist. It can never
  // outrank the signed-in invariant — that is about ORDER in the list and is owned by
  // orderAccounts, not about which row is highlighted.
  useEffect(() => {
    setSelectedLabel((current) => {
      if (current && accounts.some((account) => account.label === current)) return current;
      const remembered = getSetting('restoreLastSelection') ? getLastSelection() : null;
      const rememberedAccount = remembered ? accounts.find((account) => account.label === remembered) : null;
      const fallback = rememberedAccount
        ?? accounts.find((account) => account.active)
        ?? accounts.find((account) => account.status === 'ready')
        ?? accounts[0]
        ?? null;
      return fallback?.label ?? null;
    });
  }, [accounts]);

  // Remember the selection only while the setting is on, so turning it off leaves nothing
  // behind for a later launch to pick up.
  useEffect(() => {
    if (getSetting('restoreLastSelection') && selectedLabel) setLastSelection(selectedLabel);
  }, [selectedLabel]);

  const needle = filter.trim().toLocaleLowerCase();
  const visible = accounts.filter((account) => `${account.label} ${account.accountName ?? ''} ${account.store?.accountName ?? ''}`.toLocaleLowerCase().includes(needle));
  const selectedIndex = visible.findIndex((account) => account.label === selectedLabel);
  // Render-time fallback mirrors the selection effect above, so a render that
  // happens before the effect runs still has a concrete account.
  const selectedAccount = selectedIndex >= 0
    ? visible[selectedIndex]
    : visible.find((account) => account.active)
      ?? visible.find((account) => account.status === 'ready')
      ?? visible[0]
      ?? null;
  const activeIndex = selectedAccount ? visible.indexOf(selectedAccount) : -1;
  const marketAccount = accounts.find((account) => account.label === marketLabel && account.status === 'ready');
  // The pill reports the Riot Client session itself, not saved-account
  // bookkeeping: a signed-in client is ACTIVE even with zero accounts saved.
  const sessionActive = Boolean(session.live);

  useEffect(() => { setSelectedOffer(0); }, [selectedLabel]);

  // Daily store resets on a fixed 00:00 UTC server schedule — the same instant
  // worldwide (17:00 PT / 20:00 ET / 07:00 WIB, per region), shifting only when
  // a local region observes DST. Counting straight to the next UTC midnight
  // keeps the timer exact even when the last store snapshot is stale.
  const countdown = useMemo(() => fmtCountdown(storeCountdownSeconds(now)), [now]);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const flash = useCallback((key) => {
    setCommandFlash(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setCommandFlash(null), 650);
  }, []);

  // [O] cycles the account sort. The active account stays pinned first in every
  // mode, so cycling can never hide the signed-in account.
  const cycleSort = useCallback(() => {
    flash('O');
    setSortMode((current) => {
      const next = nextSortMode(current);
      persistSortMode(next);
      showToast(`SORT: ${SORT_LABELS[next]}`, 'ok');
      return next;
    });
  }, [flash, showToast]);

  // Daily rotation: the moment the countdown crosses 00:00 UTC the store is
  // new, so tell the user and pull it. crossedStoreReset is monotonic, so this
  // fires once per rotation — including when the machine slept through it.
  // Skipped while a load is already in flight so a resume-triggered refresh
  // and this one cannot stack into a double request.
  const lastTickRef = useRef(now);
  useEffect(() => {
    const previous = lastTickRef.current;
    lastTickRef.current = now;
    if (crossedStoreReset(previous, now) == null) return;
    if (getSetting('notifyOnRotation')) {
      window.valorant?.notifyStoreReset?.({
        title: 'Daily store refreshed',
        body: `${accounts.length} account${accounts.length === 1 ? '' : 's'} — new offers are live.`
      });
    }
    if (!getSetting('autoSyncOnRotation')) {
      // Still surface the event rather than swallowing it: the store rotated whether or not
      // this app pulled the new offers.
      showToast('DAILY STORE RESET — AUTO-SYNC OFF', 'ok');
      return;
    }
    if (!loading) {
      markRefreshAll();
      refresh()
        .then(() => showToast('DAILY STORE RESET — SYNCED', 'ok'))
        .catch((failure) => showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn'));
    } else {
      showToast('DAILY STORE RESET', 'ok');
    }
  }, [now, loading, accounts.length, refresh, showToast]);

  const doSwitch = useCallback(async (label) => {
    const target = label ?? selectedAccount?.label;
    if (!target || busy) return;
    // CONFIRM SWITCH & DELETE is the one setting that REMOVES a safeguard, so the prompt is
    // read here rather than baked in: off means act immediately.
    if (getSetting('confirmDestructive')) {
      const ok = await confirm({
        title: 'SWITCH ACCOUNT',
        body: `Switch the Riot Client to “${target}”? The client restarts with this account's saved session.`,
        confirmLabel: 'SWITCH',
        danger: true
      });
      if (!ok) return;
    }
    flash('S');
    switchTo(target)
      .then(() => showToast(`SWITCHED SESSION → ${target.toUpperCase()}`, 'ok'))
      .catch((failure) => showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn'));
  }, [busy, selectedAccount, switchTo, showToast, flash, confirm]);

  // Rate limiting: Riot dislikes bursts. Manual refreshes are gated to one
  // per account per 30s (refresh-all marks every account + its own timer).
  const doRefresh = useCallback((label) => {
    const target = label ?? selectedAccount?.label;
    if (!target || busy) return;
    if (isRateLimited(target)) {
      flash('R');
      showToast(`RATE LIMITED — ${target.toUpperCase()} RETRY IN ${cooldownSeconds(target)}s`, 'warn');
      return;
    }
    flash('R');
    setBusyLabel(target);
    refreshAccount(target)
      .then(() => { markRefreshed(target); showToast(`${target.toUpperCase()} STORE SYNCED`, 'ok'); })
      .catch((failure) => showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn'))
      .finally(() => setBusyLabel(null));
  }, [busy, selectedAccount, refreshAccount, showToast, flash]);

  const doRefreshAll = useCallback(() => {
    if (isRefreshAllRateLimited()) {
      flash('CTRL+R');
      showToast(`RATE LIMITED — RETRY IN ${refreshAllCooldownSeconds()}s`, 'warn');
      return;
    }
    flash('CTRL+R');
    markRefreshAll();
    refresh()
      .then(() => showToast(`${accounts.length} ACCOUNTS SYNCED`, 'ok'))
      .catch((failure) => showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn'));
  }, [accounts.length, refresh, showToast, flash]);

  const doDelete = useCallback(async (label) => {
    const target = label ?? selectedAccount?.label;
    if (!target || busy) return;
    if (getSetting('confirmDestructive')) {
      const ok = await confirm({
        title: 'DELETE ACCOUNT',
        body: `Delete saved account “${target}”? This cannot be undone.`,
        confirmLabel: 'DELETE',
        danger: true
      });
      if (!ok) return;
    }
    flash('X');
    remove(target)
      .then(() => showToast('ACCOUNT DELETED', 'warn'))
      .catch((failure) => showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn'));
  }, [busy, selectedAccount, remove, showToast, flash, confirm]);

  const doRename = useCallback(async (oldLabel, newLabel) => {
    try {
      await rename(oldLabel, newLabel);
      setSelectedLabel((current) => (current === oldLabel ? newLabel : current));
      showToast(`RENAMED → ${newLabel.toUpperCase()}`, 'ok');
    } catch (failure) {
      showToast((failure?.message ?? String(failure)).toUpperCase(), 'warn');
    }
  }, [rename, showToast]);

  const openMarket = useCallback((label) => {
    const target = accounts.find((account) => account.label === label);
    if (target?.status === 'ready' && !busy) setMarketLabel(label);
  }, [accounts, busy]);

  const startUpdate = useCallback(async () => {
    const release = updates.release;
    if (!release?.available) return;
    const megabytes = release.installer.size ? `~${Math.round(release.installer.size / 1048576)} MB` : 'the installer';
    const ok = await confirm({
      title: `UPDATE TO ${String(release.latestVersion).toUpperCase()}`,
      body: `Sapphire will download ${release.installer.name} (${megabytes}), close, run the installer silently, and start again. Saved accounts and sessions are not touched.`,
      confirmLabel: 'UPDATE',
      danger: true
    });
    if (!ok) return;
    const downloaded = await updates.download();
    if (downloaded) await updates.install();
  }, [confirm, updates]);

  const toggleMarket = useCallback(() => {
    if (busy) return;
    setMarketLabel((current) => (current ? null : selectedAccount?.status === 'ready' ? selectedAccount.label : null));
  }, [busy, selectedAccount]);

  // Single global keymap. The listener subscribes once and always reads the
  // freshest closure through the ref. The ref is refreshed in an effect rather
  // than during render: writing a ref while rendering is unsafe under
  // concurrent rendering, where a discarded render would still mutate it.
  const keyHandlerRef = useRef(null);
  const keyHandler = (event) => {
    if (confirmPending) {
      // A pending confirmation is the topmost layer and owns the keyboard. Its own listener
      // handles Escape/Enter/Tab (in the capture phase), but it only calls preventDefault —
      // so without this guard every other key reaches the keymap BEHIND it: H toggled skin
      // previews, Q raised the quit prompt, A raised the add-account modal.
      return;
    }
    if (settingsOpen) {
      // Without this the app's own hotkeys fire BEHIND the open modal: X would raise the
      // delete confirmation, Q the quit prompt, A the add-account modal, H would toggle a
      // setting nobody can see. The panel's own onKeyDown owns the arrows and Enter; this
      // only closes on Escape.
      if (event.key === 'Escape') setSettingsOpen(false);
      return;
    }
    if (quitOpen) {
      if (event.key === 'Enter') { event.preventDefault(); window.close(); }
      else if (event.key === 'Escape') setQuitOpen(false);
      return;
    }
    if (adding) {
      if (event.key === 'Escape') setAdding(false);
      return;
    }
    if (previewIndex != null) {
      if (event.key === 'Escape') setPreviewIndex(null);
      return;
    }
    const target = event.target;
    const inText = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    // Overlay close beats input blur: one Escape always closes the topmost
    // layer, whether or not the modal input currently holds focus.
    if (event.key === 'Escape' && (inText || marketLabel)) {
      event.preventDefault();
      if (inText) target.blur();
      else setMarketLabel(null);
      return;
    }
    if (inText) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      doRefreshAll();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!visible.length) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = visible[(activeIndex + delta + visible.length) % visible.length];
        setSelectedLabel(next.label);
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault();
        const count = selectedAccount?.store?.offers.length ?? 0;
        if (!count) return;
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        setSelectedOffer((current) => (current + delta + count) % count);
        return;
      }
      case 'Enter':
        event.preventDefault();
        flash('M');
        if (!busy && selectedAccount?.status === 'ready') setMarketLabel(selectedAccount.label);
        return;
      case 'm':
      case 'M':
        flash('M');
        toggleMarket();
        return;
      case 's':
      case 'S':
        if (!busy && selectedAccount) doSwitch(selectedAccount.label);
        return;
      case 'r':
      case 'R':
        if (!busy && selectedAccount) doRefresh(selectedAccount.label);
        return;
      case 'h':
      case 'H': {
        // Compute next state outside the updater: a side effect inside a state
        // updater runs twice under StrictMode.
        const nextHidden = !previewsHidden;
        flash('H');
        setPreviewsHidden(nextHidden);
        persistPreviewsHidden(nextHidden);
        return;
      }
      case 'p':
      case 'P': {
        const offer = selectedAccount?.status === 'ready' ? selectedAccount.store?.offers?.[Math.min(selectedOffer, (selectedAccount.store?.offers?.length ?? 1) - 1)] : null;
        if (offer && (offer.video || (offer.levels?.length ?? 0) > 1)) { flash('P'); setPreviewIndex(Math.min(selectedOffer, (selectedAccount.store.offers.length) - 1)); }
        return;
      }
      case 'i':
      case 'I':
        if (tcnoAvailable) { event.preventDefault(); flash('I'); setAdding(true); }
        return;
      case 'o':
      case 'O':
        cycleSort();
        return;
      case 'a':
      case 'A':
        // preventDefault stops the key's default text insertion from landing
        // in the modal input that autofocuses during this same keypress.
        event.preventDefault();
        flash('A');
        setAdding(true);
        return;
      case 'x':
      case 'X':
        if (!busy && selectedAccount) doDelete(selectedAccount.label);
        return;
      case 'q':
      case 'Q':
        setQuitOpen(true);
        return;
      case 'Escape':
        if (marketLabel) setMarketLabel(null);
        return;
      default:
    }
  };
  // No dependency array on purpose: this runs after every commit and keeps the
  // ref pointing at the newest closure. It is declared before the listener
  // effect so the ref is populated before input can arrive.
  useEffect(() => { keyHandlerRef.current = keyHandler; });

  useEffect(() => {
    const handler = (event) => keyHandlerRef.current?.(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // The settings panel is the other writer for these two, and App mirrors both in state.
  // Subscribing is what keeps a change made in the panel visible immediately in the sidebar,
  // the store and the sort button instead of drifting until the next launch.
  useEffect(() => subscribeSettings(() => {
    setPreviewsHidden(getSetting('previewsHidden'));
    setSortMode(getSetting('sortMode'));
  }), []);

  const pill = error ? { on: false, text: 'ERROR' } : loading ? { on: false, text: 'SYNCING' } : sessionActive ? { on: true, text: 'ACTIVE' } : { on: false, text: 'STANDBY' };
  const offersCount = selectedAccount?.status === 'ready' ? (selectedAccount.store?.offers?.length ?? 0) : 0;

  return <div className="app-frame">
    <header className="app-header">
      <div className="brand">
        <BrandMark size={20} />
        <span className="brand-vlr">SAPPHIRE</span>
      </div>
      <div className="header-right">
        <button type="button" className="ghost-btn hdr-settings" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Open settings"><Icon name="settings" /></button>
        {updates.release?.available && !updateDismissed && (
          <span className="update-notice">
            <button
              type="button" className={`update-pill${updates.status === 'ready' ? ' ready' : ''}`}
              onClick={startUpdate} title={`Sapphire ${updates.release.latestVersion} is available`}
            >
              <Icon name="import" size={11} />
              {updates.status === 'ready' ? 'RESTART TO UPDATE'
                : updates.status === 'installing' ? 'INSTALLING…'
                  : `UPDATE ${updates.release.latestVersion}`}
            </button>
            <button
              type="button" className="update-dismiss" onClick={() => setUpdateDismissed(true)}
              title="Dismiss until next launch" aria-label="Dismiss update notice"
            ><Icon name="close" size={10} /></button>
          </span>
        )}
        <button type="button" className="ghost-btn" onClick={() => setAdding(true)}><Icon name="plus" />ADD</button>
        <span className="session-pill">
          <span className={`dot ${pill.on ? 'on' : pill.text === 'ERROR' ? 'err' : 'off'}`} />
          RIOT SESSION: {pill.text}
        </span>
      </div>
      <WindowControls />
    </header>

    {marketAccount
      ? <main className="app-main market-main"><MarketView account={marketAccount} countdown={countdown} onBack={() => setMarketLabel(null)} /></main>
      : <main className="app-main">
          <Sidebar
            accounts={accounts} visible={visible} totalCount={accounts.length}
            selectedIndex={activeIndex} onSelect={setSelectedLabel} onOpenMarket={openMarket}
            filter={filter} onFilter={setFilter}
            sortMode={sortMode} onCycleSort={cycleSort}
            tcnoAvailable={tcnoAvailable} busy={busy} commandFlash={commandFlash}
            switchingLabel={switchingLabel}
            onSwitch={doSwitch} onRefresh={doRefresh} onRefreshAll={doRefreshAll}
            onDelete={doDelete} onRename={doRename} onImport={() => setAdding(true)} onAdd={() => setAdding(true)}
          />
          <div className="v-divider" aria-hidden="true" />
          <section className="content" aria-label="Account details">
            {error && (() => {
              const presentation = presentError(error, errorKind);
              return (
                <section className="panel error-panel">
                  <div className="panel-title"><span className="corner red" /><span className="t">{presentation.title}</span></div>
                  <p className="error-msg"><Icon name="warn" size={14} /> <b>{presentation.explain}</b></p>
                  <p className="error-hint">{presentation.hint}</p>
                  <div className="error-actions">
                    <button type="button" className="ghost-btn" onClick={doRefreshAll}><Icon name="refresh" />{presentation.actionLabel}</button>
                  </div>
                </section>
              );
            })()}
            {loading && !accounts.length && (
              <LoadingSkeleton progress={progress} />
            )}
            {!loading && !accounts.length && (
              <section className="panel empty-panel">
                <div className="panel-title"><span className="corner" /><span className="t">NO ACCOUNTS SAVED</span></div>
                <p className="error-msg">Save the Riot Client session currently signed in on this PC to begin. Press <kbd>A</kbd> or click ADD.</p>
                <button type="button" className="primary-btn" onClick={() => setAdding(true)}><Icon name="plus" />ADD ACCOUNT</button>
              </section>
            )}
            {!loading && accounts.length > 0 && visible.length === 0 && (
              <section className="panel empty-panel">
                <div className="panel-title"><span className="corner" /><span className="t">NO MATCH</span></div>
                <p className="error-msg">No account matches “{filter}”. Clear the sidebar filter to see all {accounts.length}.</p>
              </section>
            )}
            {selectedAccount && (
              <>
                <AccountOverview account={selectedAccount} busy={busy} onSwitch={doSwitch} onRefresh={doRefresh} onRefreshAll={doRefreshAll} onDelete={doDelete} />
                {selectedAccount.status === 'ready' && <>
                  <StoreRefreshStrip countdown={countdown} offersCount={offersCount} />
                  <DailyStore
                    account={selectedAccount}
                    selectedOffer={selectedOffer}
                    onSelectOffer={setSelectedOffer}
                    previewsHidden={previewsHidden}
                    onPreview={setPreviewIndex}
                  />
                </>}
              </>
            )}
          </section>
        </main>}

    {previewIndex != null && marketAccount == null && selectedAccount?.status === 'ready' && (
      <SkinPreviewModal
        offer={selectedAccount.store?.offers?.[Math.min(previewIndex, (selectedAccount.store?.offers?.length ?? 1) - 1)]}
        onClose={() => setPreviewIndex(null)}
      />
    )}

    <footer className="app-footer">
      <div className="brand"><BrandMark size={14} /></div>
      <span className="foot-title">SAPPHIRE ACCOUNT MANAGER</span>
      <span className="foot-meta">LOCAL-ONLY · SESSIONS STAY ON THIS PC · FULL KEYBINDS IN COMMANDS PANEL</span>
    </footer>

    <div
      className={`overlay${adding ? ' open' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget && !switchingLabel) setAdding(false); }}
      aria-hidden={!adding}
    >
      {adding && <AddAccountModal tcno={tcno} onCapture={capture} onManualAdd={addManually} onImport={importTcno} onClose={() => setAdding(false)} />}
    </div>

    <div className={`overlay${quitOpen ? ' open' : ''}`} onClick={(event) => { if (event.target === event.currentTarget) setQuitOpen(false); }} aria-hidden={!quitOpen}>
      <div className="modal quit-modal">
        <div className="quit-big">QUIT SAPPHIRE</div>
        <div className="quit-sub">PRESS <kbd>ENTER</kbd> TO CLOSE THE APP · <kbd>ESC</kbd> TO RESUME</div>
      </div>
    </div>

    <div
      className={`overlay${settingsOpen ? ' open' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}
      aria-hidden={!settingsOpen}
    >
      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          version={updates.version}
          updateState={updates}
          onCheckUpdate={() => updates.check({ force: true })}
        />
      )}
    </div>

    {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
  </div>;
}
