import { useState } from 'react';

export default function AddAccountModal({ tcno, onCapture, onManualAdd, onImport, onClose }) {
  const [label, setLabel] = useState('');
  const [savingMode, setSavingMode] = useState(null);
  const [error, setError] = useState(null);
  const saving = savingMode !== null;
  const submit = async (event) => {
    event.preventDefault(); setSavingMode('current'); setError(null);
    try { await onCapture(label); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  const addManually = async () => {
    if (!label.trim()) { setError('Enter a label before adding an account manually.'); return; }
    setSavingMode('manual'); setError(null);
    try { await onManualAdd(label); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  const importAccounts = async () => {
    setSavingMode('import'); setError(null);
    try { await onImport(tcno.accounts.map((account) => account.id)); onClose(); } catch (requestError) { setError(requestError.message); } finally { setSavingMode(null); }
  };
  return <div className="dialog-backdrop" role="presentation">
    <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
      <header><h2 id="add-account-title">Add account</h2><button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Close">×</button></header>
      <form onSubmit={submit}>
        <label htmlFor="account-label">Label</label>
        <input id="account-label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Main account" maxLength="64" autoFocus disabled={saving} required />
        <p>This securely snapshots the Riot Client session currently signed in on this PC.</p>
        <div className="add-account-actions"><button type="submit" disabled={saving}>{savingMode === 'current' ? 'Saving…' : 'Save current account'}</button><button type="button" className="secondary-button" onClick={addManually} disabled={saving}>{savingMode === 'manual' ? 'Waiting for sign-in…' : 'Add manually'}</button></div>
        <p className="manual-add-help">Closes Riot Client and Valorant, then opens the Riot sign-in screen. Sign in to the account you want; it will save automatically.</p>
      </form>
      {tcno.available && tcno.accounts.length > 0 && <section className="tcno-import">
        <h3>Import from TCNO Account Switcher</h3>
        <p>{tcno.accounts.length} saved account{tcno.accounts.length === 1 ? '' : 's'} detected.</p>
        <button type="button" className="secondary-button" onClick={importAccounts} disabled={saving}>Import detected accounts</button>
      </section>}
      {error && <p className="form-error">{error}</p>}
    </section>
  </div>;
}
