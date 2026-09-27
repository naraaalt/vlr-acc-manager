// QA-ONLY (mockup): compare PLAY button placement + size. This file does NOT go into the production
// build — make-preview.mjs appends it to dist/preview.html so it can be photographed, so decisions
// come from pictures of the real app, not from mock-ups drawn outside it.
//
// Selected via location.hash: #pv1 .. #pv10
//
// Deliberately does NOT touch src/App.jsx: if the button were planted in App.jsx, every variant
// would need changes to the real component and the 'variants' would get mixed in with the app. Here
// the app is left as it is, the button is merely appended. Plain script (not ESM) because
// preview.html merges everything into one inline <script>.
(function () {
  var PLAY = '\u25B6';

  var CSS = `
.pv-play {
  border: 1px solid var(--brand); background: var(--brand-soft); color: var(--brand);
  font: inherit; font-size: 9.5px; font-weight: 700; letter-spacing: .16em;
  padding: 4px 12px; cursor: pointer; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 7px;
}
.pv-play:hover { background: rgba(var(--brand-rgb), .22); }
.pv-play b { font-size: 11px; letter-spacing: 0; }

/* V1 - right header, one cluster with ADD */
.pv1 .header-right .pv-play { margin-right: 2px; }

/* V2 - per-account-row action, ahead of SWITCH/RENAME/DEL */
.pv2 .acct-actions .pv-play { padding: 3px 8px; }

/* V3 - hero in the header of the selected account card */
.pv3 .ov-head .pv-play { margin-left: auto; }
.pv3 .ov-status { margin-left: 0; }

/* V4 - dock as wide as the content, at the bottom */
.pv4 .content { padding-bottom: 52px; }
.pv-dock {
  position: fixed; left: 337px; right: 1px; bottom: 35px; height: 40px;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.pv-dock .pv-ctx { color: var(--faint); font-size: 9.5px; letter-spacing: .16em; }
.pv-dock .pv-play { padding: 6px 26px; }

/* V5 - floating, stuck to the selected content */
.pv-float { position: fixed; right: 26px; bottom: 50px; padding: 9px 20px; font-size: 11px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .5); }
.pv-float .pv-ctx { color: var(--brand); opacity: .75; font-size: 9px; letter-spacing: .14em; }

/* The timer moved to the Daily Store header (V6+). */
.pv-timer { display: inline-flex; align-items: center; gap: 6px; }
.pv-timer .icon { opacity: .7; color: var(--dim); }
.pv-timer-lbl { color: var(--faint); font-size: 8.5px; font-weight: 700; letter-spacing: .18em; }
.pv-timer-count { color: var(--danger); font-size: 13px; font-weight: 800; letter-spacing: .04em;
  text-shadow: 0 0 10px rgba(var(--danger-rgb), .3); }

/* V6 - PLAY replaces the timer strip, button as wide as the strip */
.pv6 .refresh-strip { padding: 7px 10px; }
.pv-play-strip { flex: 1; justify-content: center; padding: 7px 20px; font-size: 10.5px; }

/* V8-V10 - the V7 concept (timer on the right) but the button is as small as Steam's Play button,
   and "SELECTED 01/05" is dropped because next to the timer it looks odd. */
.pv8 .refresh-strip, .pv9 .refresh-strip { padding: 7px 14px; }
.pv-center { justify-content: center; }
.pv-between { justify-content: space-between; }
.pv-sm { padding: 5px 16px; font-size: 10px; }
.pv-sm b { font-size: 10px; }
.pv-side {
  color: var(--dim); font-size: 9.5px; font-weight: 700; letter-spacing: .18em;
  display: inline-flex; align-items: center; gap: 8px;
}
/* V11-V13 - small button on the LEFT; the right side is filled by one of three things. */
.pv11 .refresh-strip, .pv12 .refresh-strip, .pv13 .refresh-strip { padding: 7px 14px; }
.pv11 .refresh-strip .pv-timer-count, .pv12 .refresh-strip .pv-timer-count { font-size: 15px; }

/* V14-V15 - the PLAY button moves up to the hero, replacing the ONLINE chip next to the username.
   .ov-level is already margin-left:auto, so the level stays pinned right and the button
   sits right next to the name. */
.pv-hero { padding: 4px 13px; font-size: 10px; gap: 8px; }
.pv-hero b { font-size: 10px; }
.pv-hero .dot { width: 5px; height: 5px; flex: 0 0 auto; }

/* V16-V17 - PLAY takes over the RR slot in the account row. RR does not disappear from the app:
   the main page already shows it three times (ov-rr, the RR meter, and "x / 100 RR THIS SEASON"). */
.pv16 .acct-l2 .pv-play, .pv16i .acct-l2 .pv-play, .pv17 .acct-l2 .pv-play { margin-left: auto; padding: 2px 10px; }
.pv16 .acct-l2 .pv-play b, .pv16i .acct-l2 .pv-play b, .pv17 .acct-l2 .pv-play b { font-size: 9px; }
.pv16 .acct-l2 .pv-play, .pv16i .acct-l2 .pv-play, .pv17 .acct-l2 .pv-play { font-size: 8.5px; gap: 5px; }
/* V17 - the button widens to fill the rest of the second row, so there is no empty gap. */
.pv17 .acct-l2 .pv-play { flex: 1; justify-content: center; }

/* The timer number size is matched to the "STORE REFRESHES IN" label (22px -> 9.5px).
   Effect: the glow is dropped (glow is an effect for large text; at label size it turns into a smudge),
   and the strip automatically gets shorter because its tallest element is only the icon. */
.pv16 .refresh-strip .rs-count,
.pv17 .refresh-strip .rs-count,
.pv16i .refresh-strip .rs-count {
  font-size: 9.5px; letter-spacing: .1em; text-shadow: none;
}
/* V16i - the clock icon is shrunk too so the whole row reads at one size. */
.pv16i .refresh-strip .icon { width: 12px; height: 12px; }

/* V10 drops the strip, so the timer has to push itself to the right. */
.pv10 .store .panel-title .pv-timer { margin-left: auto; }
.pv10 .store .panel-title .pv-sm { margin-left: 14px; }
`;

  function el(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  var SMALL = '<a class="pv-play pv-sm" title="Launch Valorant"><b>' + PLAY + '</b> PLAY</a>';

  // The approved V7 concept: the timer moves to the Daily Store header, "SELECTED 01/05" is
  // dropped (next to the timer it looks odd), the strip is emptied so it can be refilled.
  function v7Base() {
    var strip = document.querySelector('.refresh-strip');
    var title = document.querySelector('.store .panel-title');
    if (!strip || !title) return null;
    var count = strip.querySelector('.rs-count');
    var clock = strip.querySelector('.icon');
    var aux = title.querySelector('.aux');
    if (aux) aux.remove();
    title.appendChild(el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
      '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
      (count ? count.textContent : '--:--:--') + '</span></span>'));
    strip.innerHTML = '';
    return strip;
  }

  // The new strip row: a small PLAY button on the LEFT, the right side is handed to the caller.
  // "SELECTED 01/05" is dropped because next to the timer it looks odd.
  function leftBase() {
    var strip = document.querySelector('.refresh-strip');
    var title = document.querySelector('.store .panel-title');
    if (!strip || !title) return null;
    var aux = title.querySelector('.aux');
    if (aux) aux.remove();
    var clock = strip.querySelector('.icon');
    var count = strip.querySelector('.rs-count');
    var badge = el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
      '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
      (count ? count.textContent : '--:--:--') + '</span></span>');
    strip.innerHTML = '';
    strip.classList.add('pv-between');
    strip.appendChild(el(SMALL));
    return { strip: strip, badge: badge, title: title };
  }

  function accountChip() {
    var name = document.querySelector('.panel.overview .ov-name');
    var dot = document.querySelector('.panel.overview .ov-status .dot');
    return el('<span class="pv-side"><span class="' + (dot ? dot.className : 'dot off') +
      '"></span>' + (name ? name.textContent : '') + '</span>');
  }

  // Replace the RR slot in each account row with the PLAY button. ERROR accounts get no button
  // (decision C); their slot is left as it is.
  function rowPlay() {
    var rows = [...document.querySelectorAll('.acct')];
    if (!rows.length) return false;
    var count = 0;
    rows.forEach(function (row) {
      // PLAY now really lives in the account row, so the RR slot this candidate used to occupy
      // is no longer rendered. This candidate is kept as a comparison (and for its screenshot),
      // so the button is appended to the end of the second row — rather than replacing an element
      // that no longer exists, which would leave this candidate silently empty.
      var l2 = row.querySelector('.acct-l2');
      if (!l2 || l2.querySelector('.pv-play')) return;
      l2.appendChild(el('<a class="pv-play" title="Launch Valorant with this account"><b>' +
        PLAY + '</b> PLAY</a>'));
      count++;
    });
    return count > 0;
  }

  var variants = {
    // V16 - PLAY replaces RR in the account row, a compact button on the right.
    pv16: function () { return rowPlay(); },
    // V16i - like V16, but the clock icon in the strip is shrunk too.
    pv16i: function () { return rowPlay(); },
    // V17 - same, but the button widens to fill the rest of the second row.
    pv17: function () { return rowPlay(); },
    // V14 - PLAY replaces the status chip, its dot goes INTO the button as well
    // so the session status (online/saved) does not disappear from the hero.
    pv14: function () {
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      // Decision C: ERROR accounts have no PLAY button, and their error chip must stay intact.
      if (status.classList.contains('is-err')) return true;
      var dot = status.querySelector('.dot');
      var btn = el('<a class="pv-play pv-hero" title="Launch Valorant">' +
        (dot ? dot.outerHTML : '') + '<b>' + PLAY + '</b> PLAY</a>');
      head.replaceChild(btn, status);
      return true;
    },
    // V14e - the ERROR case COMPARISON: select the errored account FIRST, then append the button.
    // The order matters — if the button is appended first, React's .ov-status node is detached
    // for good and the error layout can never be seen (so the test would be misleading).
    pv14e: function () {
      var row = [...document.querySelectorAll('.acct')].find((n) => n.querySelector('.dot.err'));
      if (!row) return false;
      if (!row.classList.contains('sel')) { row.click(); return false; }
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      if (status.classList.contains('is-err')) return true; // error chip left intact
      var dot = status.querySelector('.dot');
      head.replaceChild(el('<a class="pv-play pv-hero" title="Launch Valorant">' +
        (dot ? dot.outerHTML : '') + '<b>' + PLAY + '</b> PLAY</a>'), status);
      return true;
    },
    // V15 - same, but WITHOUT the dot. The session status is still readable on the SESSION row
    // ("Signed in" / "Saved session") inside the INFO cell.
    pv15: function () {
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      if (status.classList.contains('is-err')) return true;
      head.replaceChild(el('<a class="pv-play pv-hero" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY</a>'), status);
      return true;
    },
    // V11 - button on the left, timer on the right of the same bar. The bar still belongs to the store.
    pv11: function () {
      var b = leftBase();
      if (!b) return false;
      b.strip.appendChild(b.badge);
      return true;
    },
    // V12 - button on the left, account name on the right. The timer stays in the panel header.
    pv12: function () {
      var strip = document.querySelector('.refresh-strip');
      var title = document.querySelector('.store .panel-title');
      if (!strip || !title) return false;
      var clock = strip.querySelector('.icon');
      var count = strip.querySelector('.rs-count');
      var aux = title.querySelector('.aux');
      if (aux) aux.remove();
      title.appendChild(el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
        '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
        (count ? count.textContent : '--:--:--') + '</span></span>'));
      strip.innerHTML = '';
      strip.classList.add('pv-between');
      strip.appendChild(el(SMALL));
      strip.appendChild(accountChip());
      return true;
    },
    // V13 - button on the left, the right left empty (comparison: this is the one that felt odd).
    // The timer must NOT disappear — it moves to the panel header so the store keeps a countdown.
    pv13: function () {
      var b = leftBase();
      if (!b) return false;
      b.title.appendChild(b.badge);
      return true;
    },
    pv1: function () {
      var host = document.querySelector('.header-right');
      var add = host && host.querySelector('.ghost-btn');
      if (!add) return false;
      add.parentElement.insertBefore(el('<a class="pv-play" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY</a>'), add);
      return true;
    },
    pv2: function () {
      var row = document.querySelector('.acct.sel') || document.querySelector('.acct');
      var actions = row && row.querySelector('.acct-actions');
      if (!actions) return false;
      actions.insertBefore(el('<a class="pv-play" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY</a>'), actions.firstChild);
      return true;
    },
    pv3: function () {
      var head = document.querySelector('.panel.overview .ov-head');
      if (!head) return false;
      head.appendChild(el('<a class="pv-play" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY VALORANT</a>'));
      return true;
    },
    pv4: function () {
      var name = document.querySelector('.panel.overview .ov-name');
      document.body.appendChild(el('<div class="pv-dock"><span class="pv-ctx">' +
        (name ? name.textContent : '') + '</span><a class="pv-play" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY VALORANT</a></div>'));
      return true;
    },
    pv5: function () {
      document.body.appendChild(el('<a class="pv-play pv-float" title="Launch Valorant"><b>' + PLAY +
        '</b> PLAY<span class="pv-ctx"> \u00b7 VALORANT</span></a>'));
      return true;
    },
    // V6 - button as wide as the strip, timer on the left of the Daily Store header.
    pv6: function () {
      var strip = document.querySelector('.refresh-strip');
      var title = document.querySelector('.store .panel-title');
      if (!strip || !title) return false;
      var count = strip.querySelector('.rs-count');
      var clock = strip.querySelector('.icon');
      var aux = title.querySelector('.aux');
      if (aux) aux.remove();
      title.appendChild(el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
        '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
        (count ? count.textContent : '--:--:--') + '</span></span>'));
      strip.innerHTML = '';
      strip.appendChild(el('<a class="pv-play pv-play-strip" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY VALORANT</a>'));
      return true;
    },
    // V7 - strip-wide button too, but the timer is not tucked away on the left.
    pv7: function () {
      var strip = document.querySelector('.refresh-strip');
      var title = document.querySelector('.store .panel-title');
      if (!strip || !title) return false;
      var count = strip.querySelector('.rs-count');
      var clock = strip.querySelector('.icon');
      var aux = title.querySelector('.aux');
      if (aux) aux.remove();
      title.appendChild(el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
        '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
        (count ? count.textContent : '--:--:--') + '</span></span>'));
      strip.innerHTML = '';
      strip.appendChild(el('<a class="pv-play pv-play-strip" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY VALORANT</a>'));
      return true;
    },
    // V8 - small button in the CENTRE: the empty space is balanced left and right.
    pv8: function () {
      var strip = v7Base();
      if (!strip) return false;
      strip.classList.add('pv-center');
      strip.appendChild(el(SMALL));
      return true;
    },
    // V9 - small button on the RIGHT, the left is filled with the identity of the account to launch.
    pv9: function () {
      var strip = v7Base();
      if (!strip) return false;
      var name = document.querySelector('.panel.overview .ov-name');
      var dot = document.querySelector('.panel.overview .ov-status .dot');
      strip.classList.add('pv-between');
      strip.appendChild(el('<span class="pv-side"><span class="' +
        (dot ? dot.className : 'dot off') + '"></span>' +
        (name ? name.textContent : '') + '</span>'));
      strip.appendChild(el(SMALL));
      return true;
    },
    // V10 - the strip is REMOVED: the small button rides along on the DAILY STORE row, so there is
    // no bar left to fill. Cheapest in height (a full 45px back to the store card).
    pv10: function () {
      var strip = document.querySelector('.refresh-strip');
      var title = document.querySelector('.store .panel-title');
      if (!strip || !title) return false;
      var count = strip.querySelector('.rs-count');
      var clock = strip.querySelector('.icon');
      var aux = title.querySelector('.aux');
      if (aux) aux.remove();
      title.appendChild(el('<span class="pv-timer">' + (clock ? clock.outerHTML : '') +
        '<span class="pv-timer-lbl">REFRESHES IN</span><span class="pv-timer-count">' +
        (count ? count.textContent : '--:--:--') + '</span></span>'));
      title.appendChild(el(SMALL));
      strip.remove();
      return true;
    }
  };

  var key = (location.hash || '').replace('#', '');
  var build = variants[key];
  if (!build) return;

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.documentElement.classList.add(key);

  var done = false;
  var attempt = function () {
    if (done) return;
    try { done = build(); } catch { done = false; }
    // Store/overview only exist once the mock data has finished loading, so retry until it works.
    if (!done) setTimeout(attempt, 120);
  };
  setTimeout(attempt, 60);
}());
