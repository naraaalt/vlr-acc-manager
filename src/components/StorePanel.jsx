import { useCallback, useEffect, useRef, useState } from 'react';
import { divisionColor, fmtDuration, rankIconUrl, relativeTime, weaponCategory } from '../lib/format.js';
import { nightMarketCountdown, sortNightMarketOffers } from '../lib/nightMarket.js';
import { tierRgb } from '../lib/tierColor.js';
import { getAudioPrefs, setAudioPrefs, subscribeAudioPrefs } from '../lib/audioPrefs.js';
import { presentError } from '../lib/errorPresentation.js';
import { BrandMark, Icon } from './Icons.jsx';

function Pips({ total = 5, done = 0 }) {
  return (
    <span className="pips">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`pip${index < done ? ' won' : ''}`} />
      ))}
      <span className="pips-n">{done} <i>/ {total}</i></span>
    </span>
  );
}

export function AccountOverview({ account, busy, onSwitch, onRefresh, onRefreshAll, onDelete }) {
  const store = account.status === 'ready' ? account.store : null;
  const profile = store?.profile;
  const rank = profile?.rank ?? null;
  const color = divisionColor(rank);
  const icon = rank ? rankIconUrl(rank, 'large') : null;
  const online = Boolean(account.active);
  const ranked = (profile?.placementsRemaining ?? 0) === 0;

  if (account.status === 'error') {
    const presentation = presentError(account.error, account.errorKind);
    const runAction = () => {
      if (presentation.action === 'switch') onSwitch(account.label);
      else if (presentation.action === 'refresh') onRefresh(account.label);
      else if (presentation.action === 'refresh-all') onRefreshAll();
      else if (presentation.action === 'delete') onDelete(account.label);
    };
    return (
      <section className="panel overview" aria-label="Account overview">
        <div className="ov-head">
          <span className="ov-mark"><BrandMark size={20} /></span>
          <h2 className="ov-name">{(account.store?.accountName ?? account.accountName ?? account.label).toUpperCase()}</h2>
          <span className="ov-status is-err"><span className="dot err" />{presentation.title}</span>
          <span className="ov-level">LV. {profile?.level ?? '—'}</span>
        </div>
        <div className="ov-body">
          <div className="ov-cell ov-wide ov-error-wrap">
            <p className="ov-error"><Icon name="warn" size={14} /> <b>{presentation.explain}</b></p>
            <p className="ov-error-hint">{presentation.hint}</p>
            <p className="ov-error-raw">{account.error}</p>
            <button
              type="button" className={presentation.action === 'switch' || presentation.action === 'delete' ? 'danger-btn' : 'ghost-btn'}
              disabled={busy} onClick={runAction}
            >{presentation.actionLabel}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel overview" aria-label="Account overview">
      <div className="ov-head">
        <span className="ov-mark"><BrandMark size={20} /></span>
        <h2 className="ov-name">{(store?.accountName ?? account.accountName ?? account.label).toUpperCase()}</h2>
        <span className={`ov-status ${online ? 'is-on' : ''}`}><span className={`dot ${online ? 'on' : 'off'}`} />{online ? 'ONLINE' : 'SAVED'}</span>
        <span className="ov-level">LV. {profile?.level ?? '—'}</span>
      </div>
      <div className="ov-body">
        <div className="ov-cell ov-rank">
          {icon && <img src={icon} alt="" width="46" height="46" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}
          <div>
            <div className="ov-rankname" style={rank ? { color } : undefined}>{rank ?? 'UNRANKED'}</div>
            <div className="ov-rr"><b>{profile?.rr ?? '—'}</b> RR</div>
          </div>
        </div>
        <div className="ov-cell ov-mid">
          {ranked ? (
            <>
              <div className="klabel">RANKED RATING</div>
              <div className="rrmeter"><span style={{ width: `${profile?.rr ?? 0}%`, background: color }} /></div>
              <div className="mid-sub"><b>{profile?.rr ?? '—'}</b> / 100 RR THIS SEASON</div>
            </>
          ) : (
            <>
              <div className="klabel">COMPETITIVE PROGRESS</div>
              <Pips total={5} done={Math.max(0, 5 - (profile?.placementsRemaining ?? 0))} />
              <div className="mid-sub">{profile.placementsRemaining} PLACEMENT{profile.placementsRemaining === 1 ? '' : 'S'} REMAINING</div>
            </>
          )}
        </div>
        <div className="ov-cell ov-info">
          <div className="kv"><span className="k">RIOT ID</span><span className="v">{store?.accountName ?? account.accountName ?? '—'}</span></div>
          <div className="kv"><span className="k">ACCOUNT LEVEL</span><span className="v">{profile?.level ?? '—'}</span></div>
          <div className="kv"><span className="k">SESSION</span><span className="v"><span className={`dot ${online ? 'on' : 'off'}`} />{busy ? 'Syncing…' : online ? 'Signed in' : 'Saved session'}</span></div>
          <div className="kv"><span className="k">LAST ACTIVE</span><span className="v dim">{relativeTime(account.lastCheckedAt)}</span></div>
        </div>
      </div>
    </section>
  );
}

// `entry` adalah slot yang dipakai Night Market. Ia INLINE — tepat setelah countdown di baris yang
// sama — bukan barisnya sendiri, karena baris penuh kedua untuk event langka akan menghabiskan 44px
// di setiap peluncuran sepanjang ~50 minggu setahun saat tidak ada apa pun untuk ditaruh di situ.
//
// Prop `offersCount` yang lama sudah dibuang: App.jsx menghitungnya dan mengoperkannya, tapi
// komponen ini tidak pernah membacanya. Prop yang tidak dipakai lebih buruk daripada tidak ada prop
// — ia terbaca sebagai fitur yang ada.
export function StoreRefreshStrip({ countdown, entry = null }) {
  return (
    <section className="panel refresh-strip" aria-label="Store refresh countdown">
      <Icon name="clock" size={12} />
      <span className="rs-lbl">STORE REFRESHES IN</span>
      <span className="rs-count">{countdown}</span>
      {entry}
    </section>
  );
}

// Pintu masuk Night Market, dirender KE DALAM baris refresh yang sudah ada. Ia menyebut namanya dan
// menawarkan VIEW — sengaja tanpa jumlah offer dan tanpa hitungan waktu: hitungannya ada di halaman,
// tempat angka yang dijelaskannya berada, dan sebuah pintu tidak perlu jadwalnya dicetak di pintu.
// App.jsx hanya merendernya kalau akun terpilih memang punya market, jadi ia tidak memakan apa pun
// sepanjang minggu-minggu saat tidak ada.
export function NightMarketEntry({ onOpen }) {
  return (
    <span
      className="rs-nm" role="button" tabIndex={0}
      title="Open the night market"
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}
    >
      <Icon name="cart" size={12} />
      <span className="nm-lbl">NIGHT MARKET</span>
      <span className="nm-go">VIEW</span>
    </span>
  );
}

export function DailyStore({ account, selectedOffer, onSelectOffer, previewsHidden, onPreview }) {
  const store = account.status === 'ready' ? account.store : null;
  const offers = store?.offers ?? [];
  const activeOffer = offers.length ? Math.min(selectedOffer, offers.length - 1) : 0;
  const title = (
    <div className="panel-title">
      <Icon name="cart" size={13} />
      <span className="t">DAILY STORE</span>
      <span className="aux">SELECTED {String(activeOffer + 1).padStart(2, '0')}/{String(offers.length).padStart(2, '0')}</span>
    </div>
  );

  if (!offers.length) {
    return (
      <section className="panel store" aria-label="Daily store">
        {title}
        <p className="store-hidden">STORE DATA UNAVAILABLE</p>
      </section>
    );
  }

  return (
    <section className="panel store" aria-label="Daily store">
      {title}
      {store?.contentUnavailable && (
        <p className="snap-note">SKIN NAMES AND PREVIEWS UNAVAILABLE — RIOT&apos;S OFFERS AND PRICES BELOW.</p>
      )}
      {previewsHidden
        ? <p className="store-hidden">{offers.length} STORE SKINS HIDDEN — PRESS [H] TO SHOW.</p>
        : <div className="cards">
            {offers.map((offer, index) => {
              const selected = index === activeOffer;
              // Warna tier dipasang sebagai custom property, bukan kelas: nilainya datang dari Riot
              // saat runtime, jadi tidak bisa ada di styles.css. Kartu tanpa tier tidak mendapat
              // kelas .tiered sama sekali — dengan begitu tidak pernah ada rgba(var(--tier-rgb))
              // yang variabelnya kosong, yang akan membatalkan seluruh deklarasinya.
              const tierRgbValue = tierRgb(offer.tier?.color);
              return (
                <article
                  key={offer.id} className={`card${selected ? ' sel' : ''}${tierRgbValue ? ' tiered' : ''}`}
                  style={tierRgbValue ? { '--tier': offer.tier.color, '--tier-rgb': tierRgbValue } : undefined}
                  onClick={() => onSelectOffer(index)}
                  onKeyDown={(event) => { if (event.key === 'Enter') onSelectOffer(index); }}
                  role="button" tabIndex={0} aria-pressed={selected}
                >
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <div className="prev">
                    {offer.image
                      ? <img src={offer.image} alt={offer.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                      : <span className="prev-fallback">NO IMAGE</span>}
                    {!offer.video && !offer.levels?.some((level) => level.video) && (
                      <span className="novideo-tag" title="Riot provides no showcase video for this skin">NO VIDEO</span>
                    )}
                    {(offer.video || offer.levels?.length > 1) && (
                      <button
                        type="button" className="preview-btn"
                        onClick={(event) => { event.stopPropagation(); onPreview(offer); }}
                        title="Open the skin showcase video"
                      ><Icon name="eye" size={11} />PREVIEW</button>
                    )}
                  </div>
                  <div className="meta">
                    <span className="skname" title={offer.name}>{offer.name}</span>
                    <div className="skrow">
                      <span className="wcat">{weaponCategory(offer.name)}</span>
                      <span className="vp">{offer.price?.toLocaleString('en-US') ?? '—'} VP</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>}
    </section>
  );
}

export function MarketView({ account, countdown, onBack }) {
  const store = account.status === 'ready' ? account.store : null;

  return (
    <section className="market-page" aria-label="Market view">
      <div className="market-top">
        <button type="button" className="ghost-btn" onClick={onBack}><Icon name="back" />BACK TO ACCOUNTS</button>
        <span className="market-meta">SESSION {account.active ? 'ACTIVE' : 'SAVED'} · REFRESH IN {countdown}</span>
      </div>
      <div className="market-head">
        <BrandMark size={18} />
        <h2>{account.label.toUpperCase()} — FULL MARKET</h2>
        <span className="market-live"><span className="dot on" />{store?.offers.length ?? 0} SKINS TRACKED</span>
      </div>
      <table className="market-table">
        <thead>
          <tr><th>#</th><th>OFFER</th><th>TYPE</th><th className="num-col">PRICE</th></tr>
        </thead>
        <tbody>
          {(store?.offers ?? []).map((offer, index) => (
            <tr key={offer.id} className={index === 0 ? 'sel' : ''}>
              <td className="idx">{String(index + 1).padStart(2, '0')}</td>
              <td className="nm">
                {offer.image && <img src={offer.image} alt="" width="46" height="17" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                {offer.name}
              </td>
              <td className="cat">{weaponCategory(offer.name)}</td>
              <td className="price">{offer.price?.toLocaleString('en-US') ?? '—'} VP</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="market-foot">DATA FROM RIOT STOREFRONT API · PRICES IN VP · [ESC] BACK</p>
    </section>
  );
}

// Halaman Night Market: enam kartu, dan warnanya adalah TIER skin itu — tidak ada label "TIER:
// PREMIUM" di mana pun, karena kata adalah pembawa warna yang lebih buruk daripada warna itu sendiri.
// Tiernya datang sudah jadi dari main process (rank, warna), jadi tidak ada yang diturunkan ulang
// di sini.
//
// Diurutkan tier dulu, diskon kedua. Riot mengirim urutannya sendiri dan daily store mempertahankan
// urutan itu; Night Market dengan sengaja tidak, karena yang dicari user di layar ini adalah offer
// terbaiknya, dan tier adalah potongan pertama yang jujur untuk itu — diskon 40% untuk skin Select
// nilainya di bawah 20% untuk skin Ultra.
//
// Header dan footer sengaja pendek: hitungan waktunya ada di sini (bukan di pintu masuk), dan label
// seperti "SESSION ACTIVE", "SORTED BY SKIN TIER" serta "PRICES IN VP" dibuang atas permintaan —
// ketiganya menjelaskan hal yang sudah terlihat dari halamannya sendiri.
export function NightMarketView({ account, now, onBack, onPreview }) {
  const market = account.status === 'ready' ? account.store?.nightMarket : null;
  // Diurutkan DI SINI, bukan di App.jsx, dan hasilnya array baru: payload akun tetap berisi urutan
  // asli dari Riot (state akun tetap salinan yang setia), sementara halaman ini yang memutuskan cara
  // menyajikannya. Urutan itu keputusan tampilan, jadi tempatnya di komponen tampilan.
  const offers = sortNightMarketOffers(market?.offers);
  const remaining = nightMarketCountdown(market?.endsAt, now);

  return (
    <section className="market-page nm-page" aria-label="Night market">
      <div className="market-top">
        <button type="button" className="ghost-btn" onClick={onBack}><Icon name="back" />BACK TO ACCOUNTS</button>
        <span className="market-meta">{remaining === null ? 'NO END DATE' : `ENDS IN ${fmtDuration(remaining)}`}</span>
      </div>
      <div className="market-head">
        <BrandMark size={18} />
        <h2>{account.label.toUpperCase()} — NIGHT MARKET</h2>
        <span className="nm-head-live">{offers.length} OFFERS</span>
      </div>
      {market?.contentUnavailable && (
        <p className="snap-note">SKIN NAMES AND PREVIEWS UNAVAILABLE — RIOT&apos;S OFFERS AND PRICES BELOW.</p>
      )}
      <div className="nm-cards">
        {offers.map((offer) => {
          const tierRgbValue = tierRgb(offer.tier?.color);
          const tierStyle = tierRgbValue ? { '--tier': offer.tier.color, '--tier-rgb': tierRgbValue } : undefined;
          return (
            <article
              key={offer.id}
              className={`nm-card${tierRgbValue ? ' tiered' : ''}`}
              style={tierStyle}
            >
              {/* Garis tepi: penanda tier yang terbaca sekilas di grid enam kartu. */}
              <span className="nm-edge" style={{ background: offer.tier?.color ?? 'var(--border2)' }} />
              {offer.seen && <span className="nm-seen">OPENED</span>}
              <div className="nm-prev">
                {offer.image
                  ? <img src={offer.image} alt={offer.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  : <span className="nm-noimg">NO IMAGE</span>}
              </div>
              <div className="nm-meta">
                <span className="nm-name" title={offer.name}>{offer.name}</span>
                <div className="nm-bottom">
                  {/* Persentase memakai warna tier saat ada; tanpa tier ia jatuh ke gold, satu-satunya
                      warna yang tersisa yang berarti "angka". */}
                  <span className="nm-pct" style={offer.tier?.color ? { color: offer.tier.color } : undefined}>
                    {offer.discountPercent == null ? '—' : `-${offer.discountPercent}%`}
                  </span>
                  <span className="nm-now">{offer.price?.toLocaleString('en-US') ?? '—'} VP</span>
                  <span className="nm-was">{offer.originalPrice?.toLocaleString('en-US') ?? '—'}</span>
                </div>
                <button
                  type="button" className="ghost-btn nm-pv"
                  onClick={() => onPreview(offer)} title="Open the skin showcase"
                ><Icon name="eye" size={11} />PREVIEW</button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="market-foot">DISCOUNTS AS SENT BY RIOT · [ESC] BACK</p>
    </section>
  );
}

const LEVEL_LABELS = {
  'EEquippableSkinLevelItem::VFX': 'VFX',
  'EEquippableSkinLevelItem::Animation': 'ANIM',
  'EEquippableSkinLevelItem::Finisher': 'FINISHER',
  'EEquippableSkinLevelItem::KillCounter': 'KILLCOUNTER'
};

function levelLabel(level, index) {
  if (level.item && LEVEL_LABELS[level.item]) return LEVEL_LABELS[level.item];
  return `LVL ${index + 1}`;
}

// Showcase modal: one <video> whose src is bound declaratively (via key) to
// the selected level — the fix for the stale/blank video bug — plus replay,
// upgrade-level and chroma-variant switching. Audio: muted by default (store
// previews are ambient), toggle + volume slider in the stage overlay.
export function SkinPreviewModal({ offer, onClose }) {
  const levels = (offer?.levels ?? []).filter((level) => level.video || level.icon);
  const chromas = offer?.chromas ?? [];
  const [levelIndex, setLevelIndex] = useState(0);
  const [chromaIndex, setChromaIndex] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  // Audio prefs live in a module-level store persisted to localStorage: the
  // chosen volume carries across skins, modal cycles, and app restarts.
  const [audio, setAudio] = useState(getAudioPrefs());
  useEffect(() => subscribeAudioPrefs(setAudio), []);
  const { soundOn, volume } = audio;
  const videoRef = useRef(null);
  useEffect(() => {
    setLevelIndex(0);
    setChromaIndex(0);
    setVideoKey((key) => key + 1);
  }, [offer?.id]);

  const applyAudio = (element, on, value) => {
    if (!element) return;
    element.muted = !on;
    element.volume = Math.min(1, Math.max(0, value / 100));
  };
  useEffect(() => { applyAudio(videoRef.current, soundOn, volume); }, [soundOn, volume]);

  // Some CDN responses stream slowly or stall entirely; canplay may never fire
  // in a reasonable time even though enough data has arrived to show frames.
  // Escape hatches:
  //   - onPlaying: the video actually started (strongest signal)
  //   - onLoadedData + stall timeout: first frame decoded; give the network a
  //     grace window, then reveal the video even if canplay never fires —
  //     a stalled frame beats an infinite loader
  const [videoLoading, setVideoLoading] = useState(Boolean(offer?.video));
  const stallTimerRef = useRef(null);
  // Stable identities: the effect below lists these as dependencies, and an
  // unstable function would re-run it on every render, restarting the timer
  // instead of letting it fire.
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
  }, []);
  const startStallTimer = useCallback(() => {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => setVideoLoading(false), 6000);
  }, [clearStallTimer]);
  useEffect(() => () => clearStallTimer(), [clearStallTimer]);

  const activeLevel = levels[levelIndex] ?? null;
  const activeChroma = chromas[chromaIndex] ?? null;
  const standardLevel = levels.find((level) => !level.item) ?? levels[0] ?? null;
  // Showcase resolution order for the selected level + variant:
  //   1. variant-specific video (865/2921 chromas have one)
  //   2. picked variant's full-quality render — a chosen variant must always
  //      change the stage, so it wins over the default-color level video
  //   3. level video
  //   4. level icon / base image
  const variantVideo = activeChroma?.video ?? null;
  const wantsVariantStill = !variantVideo && chromaIndex > 0 && activeChroma?.render;
  const activeVideo = wantsVariantStill ? null : (variantVideo ?? activeLevel?.video ?? offer?.video ?? null);
  const activeRender = wantsVariantStill ? activeChroma.render : null;
  const stillImage = activeRender ?? standardLevel?.icon ?? offer?.image ?? null;

  // Reset the loading state machine whenever the stage content changes —
  // mirrors the <video> remount below (same key inputs).
  useEffect(() => {
    setVideoLoading(Boolean(activeVideo));
    if (activeVideo) startStallTimer();
    else clearStallTimer();
  }, [activeVideo, startStallTimer, clearStallTimer]);

  return (
    <div className="overlay open skin-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal skin-modal" role="dialog" aria-modal="true" aria-label={`${offer?.name ?? 'Skin'} showcase`}>
        <div className="dialog-head">
          <span style={{ color: 'var(--red)' }}>▚</span>
          <span className="skin-modal-name">{(offer?.name ?? 'SKIN').toUpperCase()}</span>
          <span className="spacer">{activeLevel ? levelLabel(activeLevel, levelIndex) : 'SHOWCASE'}</span>
          <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close showcase"><Icon name="close" /></button>
        </div>
        <div className="skin-stage">
          {activeVideo && (
            <div className={`stage-loader${videoLoading ? ' visible' : ''}`} aria-hidden="true">
              <div className="ld-sweep"><div className="ld-sweep-label"><span className="loader-label">LOADING SHOWCASE</span></div></div>
              <span className="stage-sub">BUFFERING <b>riotcdn</b></span>
            </div>
          )}
          {activeVideo
            ? <video
                ref={videoRef}
                key={`${offer?.id ?? 'skin'}:${levelIndex}:${chromaIndex}:${videoKey}`}
                className="skin-video" src={activeVideo}
                autoPlay muted={soundOn ? undefined : true} loop playsInline
                onLoadStart={() => { setVideoLoading(true); startStallTimer(); }}
                onLoadedData={() => { startStallTimer(); }}
                onCanPlay={() => { clearStallTimer(); setVideoLoading(false); }}
                onPlaying={() => { clearStallTimer(); setVideoLoading(false); }}
                onWaiting={() => { setVideoLoading(true); startStallTimer(); }}
                onStalled={() => { startStallTimer(); }}
                onLoadedMetadata={(event) => applyAudio(event.currentTarget, soundOn, volume)}
                onError={(event) => { clearStallTimer(); event.currentTarget.classList.add('skin-video-dead'); setVideoLoading(false); }}
              />
            : <div className="skin-stage-fallback">
                {stillImage
                  ? <img src={stillImage} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  : <span>NO SHOWCASE AVAILABLE FOR THIS SKIN</span>}
              </div>}
          {!activeVideo && activeRender && <span className="skin-render-note">VARIANT RENDER — NO VIDEO FOR THIS VARIANT</span>}
          <div className="skin-stage-actions">
            {activeVideo && (
              <>
                <button
                  type="button" className={`ghost-btn sound-btn${soundOn ? ' on' : ''}`}
                  onClick={() => setAudioPrefs({ soundOn: !soundOn })}
                  title={soundOn ? 'Mute preview' : 'Unmute preview (not every skin video has audio)'}
                ><Icon name={soundOn ? 'sound' : 'soundoff'} size={12} /></button>
                <div className={`vol-slider${soundOn ? ' on' : ''}`} title="Preview volume">
                  <input
                    type="range" min="0" max="100" value={volume} aria-label="Preview volume"
                    onChange={(event) => setAudioPrefs({ volume: Number(event.target.value), soundOn: true })}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
                <button type="button" className="ghost-btn" onClick={() => setVideoKey((key) => key + 1)} title="Replay from the start">
                  <Icon name="refresh" size={12} />REPLAY
                </button>
              </>
            )}
          </div>
        </div>
        {levels.length > 1 && (
          <div className="skin-variants">
            <span className="sv-label">UPGRADE</span>
            <div className="sv-row">
              {levels.map((level, index) => (
                <button
                  key={level.name + index} type="button"
                  className={`sv-btn${index === levelIndex ? ' on' : ''}${!level.video ? ' muted' : ''}`}
                  onClick={() => setLevelIndex(index)}
                  title={level.name}
                >
                  {level.icon && <img src={level.icon} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                  {levelLabel(level, index)}
                </button>
              ))}
            </div>
          </div>
        )}
        {chromas.length > 1 && (
          <div className="skin-variants">
            <span className="sv-label">VARIANT</span>
            <div className="sv-row">
              {chromas.map((chroma, index) => (
                <button
                  key={chroma.name + index} type="button"
                  className={`sv-btn sv-chroma${index === chromaIndex ? ' on' : ''}`}
                  onClick={() => setChromaIndex(index)}
                  title={chroma.name}
                >
                  <img src={chroma.swatch} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  {index === 0 ? 'DEFAULT' : `V${index}`}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="skin-modal-foot">
          <span>{chromas.length} VARIANTS · {levels.length} LEVELS</span>
          <span>[ESC] CLOSE</span>
        </div>
      </section>
    </div>
  );
}
