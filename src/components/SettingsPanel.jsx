import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import { SETTINGS, getSettings, setSetting, subscribeSettings } from '../lib/settings.js';

// Renders itself from the registry in src/lib/settings.js: one row per entry, and no
// per-setting markup in here. Adding a preference is one registry entry, not a UI change.
//
// Rows are deliberately one line high. The hint for the FOCUSED row renders in the panel
// footer: at two lines per row the list overflows its max-height on a 1280x832 window, and
// ten rows at ~35px each is ~350px against a 466px budget, and the SYSTEM row adds ~40px —
// both re-measured headlessly rather than trusted (see the plan's phase 7).
//
// Escape is handled by App.jsx's keymap guard, which also swallows every other key while
// this is open. Arrows and Enter are handled here, by the modal itself.
function SettingRow({ setting, value, focused, onFocus, onAct }) {
  const changed = value !== setting.default;
  return (
    <li
      className={`set-row${focused ? ' sel' : ''}${changed ? ' changed' : ''}`}
      onMouseEnter={onFocus}
      onClick={() => { onFocus(); onAct(1); }}
    >
      <span className="set-label">{setting.label}</span>
      <div className="set-value">
        {setting.kind === 'toggle' && (
          <span className={`set-pill${value ? ' on' : ''}`}>{value ? 'ON' : 'OFF'}</span>
        )}
        {setting.kind === 'choice' && setting.options.map((option) => (
          <button
            key={String(option.value)} type="button"
            className={`set-opt${option.value === value ? ' on' : ''}`}
            onClick={(event) => { event.stopPropagation(); setSetting(setting.id, option.value); }}
          >{option.label}</button>
        ))}
        {setting.kind === 'range' && (
          <>
            <input
              type="range" min={setting.min} max={setting.max} step={setting.step}
              value={value} aria-label={setting.label}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setSetting(setting.id, Number(event.target.value))}
            />
            <span className="set-readout">{setting.format ? setting.format(value) : value}</span>
          </>
        )}
      </div>
      {/* The slot is always present so a row does not jump sideways when the revert
          button appears. */}
      <div className="set-revert-slot">
        {changed && (
          <button
            type="button" className="set-revert"
            title={`Reset ${setting.label} to default`}
            aria-label={`Reset ${setting.label} to default`}
            onClick={(event) => { event.stopPropagation(); setSetting(setting.id, setting.default); }}
          ><Icon name="refresh" size={10} /></button>
        )}
      </div>
    </li>
  );
}

export default function SettingsPanel({ onClose, version, updateState, onCheckUpdate }) {
  const [values, setValues] = useState(getSettings);
  const [focused, setFocused] = useState(0);
  const sectionRef = useRef(null);
  const rows = SETTINGS;
  // Baris SYSTEM bukan setting (tidak ada yang dipersist), tapi ia tetap satu perhentian panah:
  // permukaan yang keyboard-first ini tidak boleh punya satu-satunya kontrol yang cuma bisa
  // diklik mouse. Karena itu `focused` berjalan 0..rows.length.
  const systemIndex = rows.length;
  const onSystemRow = focused === systemIndex;

  useEffect(() => subscribeSettings(setValues), []);
  useEffect(() => { sectionRef.current?.focus(); }, []);

  // direction 1 = forwards, -1 = backwards.
  const act = (setting, direction) => {
    if (!setting) return;
    const value = values[setting.id];
    if (setting.kind === 'toggle') { setSetting(setting.id, !value); return; }
    if (setting.kind === 'range') { setSetting(setting.id, value + direction * setting.step); return; }
    if (setting.kind === 'choice') {
      const index = setting.options.findIndex((option) => option.value === value);
      const next = (index + direction + setting.options.length) % setting.options.length;
      setSetting(setting.id, setting.options[next].value);
    }
  };

  const runFocused = () => {
    if (onSystemRow) { onCheckUpdate?.(); return; }
    act(rows[focused], 1);
  };

  const onKey = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setFocused((index) => Math.min(systemIndex, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setFocused((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); runFocused(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); runFocused(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); if (!onSystemRow) act(rows[focused], -1); }
  };

  const updateLabel = updateState?.status === 'available' ? `${updateState.release?.latestVersion ?? ''} AVAILABLE`
    : updateState?.status === 'downloading' ? `DOWNLOADING ${updateState.progress?.total ? `${Math.round((updateState.progress.received / updateState.progress.total) * 100)}%` : '…'}`
      : updateState?.status === 'ready' ? 'READY — RESTART TO UPDATE'
        : updateState?.status === 'installing' ? 'INSTALLING…'
          : updateState?.status === 'checking' ? 'CHECKING…'
            : updateState?.status === 'error' ? String(updateState.error ?? 'CHECK FAILED').toUpperCase().slice(0, 48)
              : 'UP TO DATE';

  return (
    <section
      className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Settings"
      ref={sectionRef} tabIndex={-1} onKeyDown={onKey}
    >
      <div className="dialog-head">
        <Icon name="settings" size={12} />
        SETTINGS
        <span className="spacer">ESC TO CLOSE</span>
        <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close settings"><Icon name="close" /></button>
      </div>
      <ul className="set-list">
        {rows.map((setting, index) => (
          <SettingRow
            key={setting.id} setting={setting} value={values[setting.id]}
            focused={index === focused} onFocus={() => setFocused(index)} onAct={() => act(setting, 1)}
          />
        ))}
      </ul>
      <div className={`set-system${onSystemRow ? ' sel' : ''}`} onMouseEnter={() => setFocused(systemIndex)}>
        <span className="set-system-label">SYSTEM</span>
        <span className="set-version">SAPPHIRE {version ?? '—'}</span>
        <span className={`set-update-state${updateState?.status === 'error' ? ' bad' : ''}`}>{updateLabel}</span>
        <button
          type="button" className="set-action" onClick={onCheckUpdate}
          onMouseEnter={() => setFocused(systemIndex)}
          disabled={updateState?.status === 'checking'}
        >{updateState?.status === 'checking' ? 'CHECKING…' : 'CHECK NOW'}</button>
      </div>
      <div className="set-foot">
        <span className="set-focus-hint">{rows[focused]?.hint ?? 'Ask GitHub whether a newer Sapphire has been published.'}</span>
        <span className="set-note">STORED ON THIS PC ONLY</span>
      </div>
    </section>
  );
}