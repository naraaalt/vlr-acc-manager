import { useCallback, useEffect, useRef, useState } from 'react';

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorKind, setErrorKind] = useState(null);
  // Whether a Riot Client session is readable right now — independent of how
  // many accounts are saved. Drives the header RIOT SESSION pill.
  const [session, setSession] = useState({ live: false });
  const [tcno, setTcno] = useState({ available: false, accounts: [] });
  const [switchingLabel, setSwitchingLabel] = useState(null);
  // Kept apart from switchingLabel: PLAY switches on the way to launching, and the
  // row has to be able to say which of the two it is doing.
  const [playingLabel, setPlayingLabel] = useState(null);

  const [progress, setProgress] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null); setErrorKind(null); setProgress(null);
    try {
      const [dashboard, detected] = await Promise.all([window.valorant.getDashboard(), window.valorant.detectTcno()]);
      if (!dashboard.ok) {
        setErrorKind(dashboard.errorKind ?? null);
        throw new Error(dashboard.error);
      }
      setAccounts(dashboard.data.accounts);
      setSession(dashboard.data.session ?? { live: false });
      if (detected.ok) setTcno(detected.data);
    } catch (requestError) { setError(requestError.message || 'Unable to load saved accounts.'); }
    finally { setLoading(false); setProgress(null); }
  }, []);

  // Progressive dashboard load: accounts appear one by one as their stores
  // resolve. Progress events only arrive while the main promise is pending;
  // the final set replaces any partial state when it lands.
  useEffect(() => {
    if (!window.valorant.onDashboardProgress) return undefined;
    window.valorant.onDashboardProgress((update) => {
      setProgress(update);
      if (update?.account) {
        setAccounts((current) => {
          const exists = current.some((account) => account.id === update.account.id);
          if (!exists) return [...current, update.account];
          return current.map((account) => (account.id === update.account.id ? update.account : account));
        });
      }
    });
    return undefined;
  }, []);

  // System sleep/resume: after sleep the countdown anchors, rate-limit map and
  // session validity are all stale. Re-run the dashboard fetch once, with a
  // 15s debounce (resume fires alongside network reconnection flicker).
  const resumingRef = useRef(false);
  useEffect(() => {
    if (!window.valorant.onSystemResumed) return undefined;
    window.valorant.onSystemResumed(() => {
      if (resumingRef.current) return;
      resumingRef.current = true;
      setTimeout(() => { resumingRef.current = false; }, 15_000);
      refresh();
    });
    return undefined;
  }, [refresh]);

  const capture = useCallback(async (label) => {
    const response = await window.valorant.captureCurrentAccount(label);
    if (!response.ok) throw new Error(response.error);
    await refresh();
  }, [refresh]);
  const addManually = useCallback(async (label) => {
    const response = await window.valorant.addManualAccount(label);
    if (!response.ok) throw new Error(response.error);
    await refresh();
  }, [refresh]);
  const remove = useCallback(async (label) => {
    const response = await window.valorant.deleteAccount(label);
    if (!response.ok) throw new Error(response.error);
    await refresh();
  }, [refresh]);
  const rename = useCallback(async (oldLabel, newLabel) => {
    const response = await window.valorant.renameAccount(oldLabel, newLabel);
    if (!response.ok) throw new Error(response.error);
    await refresh();
  }, [refresh]);
  const switchTo = useCallback(async (label) => {
    setSwitchingLabel(label);
    try {
      const response = await window.valorant.switchAccount(label);
      if (!response.ok) throw new Error(response.error);
      await refresh();
    } finally { setSwitchingLabel(null); }
  }, [refresh]);
  const play = useCallback(async (label) => {
    setPlayingLabel(label);
    try {
      const response = await window.valorant.playAccount(label);
      if (!response.ok) throw new Error(response.error);
      // A PLAY that had to switch really changes which session is live, so the
      // dashboard is re-read rather than patched in place. A plain launch changes
      // no account state at all.
      if (response.data?.switched) await refresh();
      return response.data;
    } finally { setPlayingLabel(null); }
  }, [refresh]);
  const refreshAccount = useCallback(async (label) => {
    const response = await window.valorant.refreshAccountMarket(label);
    if (!response.ok) throw new Error(response.error);
    setAccounts((current) => current.map((account) => account.label === label
      ? { ...account, active: response.data.active, status: 'ready', error: null, store: response.data.store, lastCheckedAt: new Date().toISOString() }
      : account));
  }, []);
  const importTcno = useCallback(async (ids) => {
    const response = await window.valorant.importTcno(ids);
    if (!response.ok) throw new Error(response.error);
    await refresh();
    return response.data;
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);
  return { accounts, loading, error, errorKind, progress, session, tcno, switchingLabel, playingLabel, refresh, capture, addManually, remove, rename, switchTo, play, refreshAccount, importTcno };
}
