import { useCallback, useEffect, useState } from 'react';

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tcno, setTcno] = useState({ available: false, accounts: [] });
  const [switchingLabel, setSwitchingLabel] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dashboard, detected] = await Promise.all([window.valorant.getDashboard(), window.valorant.detectTcno()]);
      if (!dashboard.ok) throw new Error(dashboard.error);
      setAccounts(dashboard.data);
      if (detected.ok) setTcno(detected.data);
    } catch (requestError) { setError(requestError.message || 'Unable to load saved accounts.'); }
    finally { setLoading(false); }
  }, []);

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
  const switchTo = useCallback(async (label) => {
    setSwitchingLabel(label);
    try {
      const response = await window.valorant.switchAccount(label);
      if (!response.ok) throw new Error(response.error);
      await refresh();
    } finally { setSwitchingLabel(null); }
  }, [refresh]);
  const syncCurrent = useCallback(async (label) => {
    const response = await window.valorant.syncCurrentAccount(label);
    if (!response.ok) throw new Error(response.error);
    await refresh();
  }, [refresh]);
  const refreshAccount = useCallback(async (label) => {
    const response = await window.valorant.refreshAccountMarket(label);
    if (!response.ok) throw new Error(response.error);
    setAccounts((current) => current.map((account) => account.label === label
      ? { ...account, active: response.data.active, status: 'ready', error: null, store: response.data.store }
      : account));
  }, []);
  const importTcno = useCallback(async (ids) => {
    const response = await window.valorant.importTcno(ids);
    if (!response.ok) throw new Error(response.error);
    await refresh();
    return response.data;
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);
  return { accounts, loading, error, tcno, switchingLabel, refresh, capture, addManually, remove, switchTo, syncCurrent, refreshAccount, importTcno };
}
