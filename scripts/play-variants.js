// QA-ONLY (mockup): bandingkan penempatan + ukuran tombol PLAY. File ini TIDAK ikut ke build
// produksi — make-preview.mjs menempelkannya ke dist/preview.html supaya bisa difoto, supaya
// keputusan diambil dari gambar app asli, bukan dari gambar karangan di luar app.
//
// Dipilih lewat location.hash: #pv1 .. #pv10
//
// Sengaja TIDAK menyentuh src/App.jsx: kalau tombolnya ditanam di App.jsx, tiap varian butuh
// mengubah komponen asli dan 'varians' jadi bercampur dengan app. Di sini app-nya apa adanya,
// tombolnya cuma ditempel. Plain script (bukan ESM) karena preview.html menyatukan semuanya
// jadi satu <script> inline.
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

/* V1 - header kanan, satu kluster dengan ADD */
.pv1 .header-right .pv-play { margin-right: 2px; }

/* V2 - aksi per-baris akun, mendahului SWITCH/RENAME/DEL */
.pv2 .acct-actions .pv-play { padding: 3px 8px; }

/* V3 - hero di header kartu akun terpilih */
.pv3 .ov-head .pv-play { margin-left: auto; }
.pv3 .ov-status { margin-left: 0; }

/* V4 - dock selebar konten, di bawah */
.pv4 .content { padding-bottom: 52px; }
.pv-dock {
  position: fixed; left: 337px; right: 1px; bottom: 35px; height: 40px;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.pv-dock .pv-ctx { color: var(--faint); font-size: 9.5px; letter-spacing: .16em; }
.pv-dock .pv-play { padding: 6px 26px; }

/* V5 - mengambang, melekat ke konten terpilih */
.pv-float { position: fixed; right: 26px; bottom: 50px; padding: 9px 20px; font-size: 11px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .5); }
.pv-float .pv-ctx { color: var(--brand); opacity: .75; font-size: 9px; letter-spacing: .14em; }

/* Timer yang pindah ke header Daily Store (V6+). */
.pv-timer { display: inline-flex; align-items: center; gap: 6px; }
.pv-timer .icon { opacity: .7; color: var(--dim); }
.pv-timer-lbl { color: var(--faint); font-size: 8.5px; font-weight: 700; letter-spacing: .18em; }
.pv-timer-count { color: var(--danger); font-size: 13px; font-weight: 800; letter-spacing: .04em;
  text-shadow: 0 0 10px rgba(var(--danger-rgb), .3); }

/* V6 - PLAY menggantikan strip timer, tombol selebar strip */
.pv6 .refresh-strip { padding: 7px 10px; }
.pv-play-strip { flex: 1; justify-content: center; padding: 7px 20px; font-size: 10.5px; }

/* V8-V10 - konsep V7 (timer di kanan) tapi tombolnya sekecil tombol Play Steam,
   dan "SELECTED 01/05" dibuang karena di sebelah timer jadi ganjil. */
.pv8 .refresh-strip, .pv9 .refresh-strip { padding: 7px 14px; }
.pv-center { justify-content: center; }
.pv-between { justify-content: space-between; }
.pv-sm { padding: 5px 16px; font-size: 10px; }
.pv-sm b { font-size: 10px; }
.pv-side {
  color: var(--dim); font-size: 9.5px; font-weight: 700; letter-spacing: .18em;
  display: inline-flex; align-items: center; gap: 8px;
}
/* V11-V13 - tombol kecil di KIRI; sisi kanan diisi salah satu dari tiga hal. */
.pv11 .refresh-strip, .pv12 .refresh-strip, .pv13 .refresh-strip { padding: 7px 14px; }
.pv11 .refresh-strip .pv-timer-count, .pv12 .refresh-strip .pv-timer-count { font-size: 15px; }

/* V14-V15 - tombol PLAY naik ke hero, menggantikan chip ONLINE di samping username.
   .ov-level sudah margin-left:auto, jadi level tetap menempel di kanan dan tombolnya
   duduk persis di sebelah nama. */
.pv-hero { padding: 4px 13px; font-size: 10px; gap: 8px; }
.pv-hero b { font-size: 10px; }
.pv-hero .dot { width: 5px; height: 5px; flex: 0 0 auto; }

/* V16-V17 - PLAY mengambil slot RR di baris akun. RR tidak hilang dari app: main page
   sudah menampilkannya tiga kali (ov-rr, meter RR, dan "x / 100 RR THIS SEASON"). */
.pv16 .acct-l2 .pv-play, .pv16i .acct-l2 .pv-play, .pv17 .acct-l2 .pv-play { margin-left: auto; padding: 2px 10px; }
.pv16 .acct-l2 .pv-play b, .pv16i .acct-l2 .pv-play b, .pv17 .acct-l2 .pv-play b { font-size: 9px; }
.pv16 .acct-l2 .pv-play, .pv16i .acct-l2 .pv-play, .pv17 .acct-l2 .pv-play { font-size: 8.5px; gap: 5px; }
/* V17 - tombolnya melebar mengisi sisa baris kedua, jadi tidak ada celah kosong. */
.pv17 .acct-l2 .pv-play { flex: 1; justify-content: center; }

/* Ukuran angka timer disamakan dengan label "STORE REFRESHES IN" (22px -> 9.5px).
   Efeknya: glow-nya dibuang (glow itu efek untuk teks besar; di ukuran label jadi noda),
   dan strip otomatis jadi lebih pendek karena elemen tertingginya tinggal ikon. */
.pv16 .refresh-strip .rs-count,
.pv17 .refresh-strip .rs-count,
.pv16i .refresh-strip .rs-count {
  font-size: 9.5px; letter-spacing: .1em; text-shadow: none;
}
/* V16i - sekalian ikon jamnya dikecilkan supaya seluruh baris terbaca satu ukuran. */
.pv16i .refresh-strip .icon { width: 12px; height: 12px; }

/* V10 membuang strip, jadi timer harus mendorong dirinya sendiri ke kanan. */
.pv10 .store .panel-title .pv-timer { margin-left: auto; }
.pv10 .store .panel-title .pv-sm { margin-left: 14px; }
`;

  function el(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  var SMALL = '<a class="pv-play pv-sm" title="Launch Valorant"><b>' + PLAY + '</b> PLAY</a>';

  // Konsep V7 yang sudah disetujui: timer pindah ke header Daily Store, "SELECTED 01/05"
  // dibuang (di sebelah timer jadi ganjil), strip dikosongkan supaya bisa diisi ulang.
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

  // Baris strip versi baru: tombol PLAY kecil di KIRI, sisi kanan diserahkan pemanggilnya.
  // "SELECTED 01/05" dibuang karena di sebelah timer jadi ganjil.
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

  // Ganti slot RR di tiap baris akun dengan tombol PLAY. Akun ERROR tidak diberi tombol
  // (keputusan C); slotnya dibiarkan apa adanya.
  function rowPlay() {
    var rows = [...document.querySelectorAll('.acct')];
    if (!rows.length) return false;
    var count = 0;
    rows.forEach(function (row) {
      var rr = row.querySelector('.acct-rr');
      if (!rr) return;
      var dot = row.querySelector('.acct-l1 .dot');
      if (dot && dot.classList.contains('err')) return;
      var btn = el('<a class="pv-play" title="Launch Valorant with this account"><b>' +
        PLAY + '</b> PLAY</a>');
      row.querySelector('.acct-l2').replaceChild(btn, rr);
      count++;
    });
    return count > 0;
  }

  var variants = {
    // V16 - PLAY menggantikan RR di baris akun, tombol ringkas di kanan.
    pv16: function () { return rowPlay(); },
    // V16i - seperti V16, tapi ikon jam di strip ikut dikecilkan.
    pv16i: function () { return rowPlay(); },
    // V17 - sama, tapi tombolnya melebar mengisi sisa baris kedua.
    pv17: function () { return rowPlay(); },
    // V14 - PLAY menggantikan chip status, dot-nya IKUT masuk ke dalam tombol
    // supaya status sesi (online/saved) tidak hilang dari hero.
    pv14: function () {
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      // Keputusan C: akun ERROR tidak punya tombol PLAY, dan chip error-nya harus tetap utuh.
      if (status.classList.contains('is-err')) return true;
      var dot = status.querySelector('.dot');
      var btn = el('<a class="pv-play pv-hero" title="Launch Valorant">' +
        (dot ? dot.outerHTML : '') + '<b>' + PLAY + '</b> PLAY</a>');
      head.replaceChild(btn, status);
      return true;
    },
    // V14e - PEMBANDING kasus ERROR: pilih akun yang error DULU, baru tempel tombolnya.
    // Urutannya penting — kalau tombol ditempel dulu, node .ov-status milik React terlepas
    // permanen dan layout error tidak akan pernah terlihat (jadi tesnya menyesatkan).
    pv14e: function () {
      var row = [...document.querySelectorAll('.acct')].find((n) => n.querySelector('.dot.err'));
      if (!row) return false;
      if (!row.classList.contains('sel')) { row.click(); return false; }
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      if (status.classList.contains('is-err')) return true; // chip error dibiarkan utuh
      var dot = status.querySelector('.dot');
      head.replaceChild(el('<a class="pv-play pv-hero" title="Launch Valorant">' +
        (dot ? dot.outerHTML : '') + '<b>' + PLAY + '</b> PLAY</a>'), status);
      return true;
    },
    // V15 - sama, tapi TANPA dot. Status sesi masih terbaca di baris SESSION
    // ("Signed in" / "Saved session") di dalam sel INFO.
    pv15: function () {
      var head = document.querySelector('.panel.overview .ov-head');
      var status = head && head.querySelector('.ov-status');
      if (!status) return false;
      if (status.classList.contains('is-err')) return true;
      head.replaceChild(el('<a class="pv-play pv-hero" title="Launch Valorant"><b>' +
        PLAY + '</b> PLAY</a>'), status);
      return true;
    },
    // V11 - tombol di kiri, timer di kanan bar yang sama. Bar tetap jadi milik store.
    pv11: function () {
      var b = leftBase();
      if (!b) return false;
      b.strip.appendChild(b.badge);
      return true;
    },
    // V12 - tombol di kiri, nama akun di kanan. Timer tetap di panel header.
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
    // V13 - tombol di kiri, kanan dibiarkan kosong (pembanding: ini yang tadi terasa ganjil).
    // Timernya TIDAK boleh hilang — ia pindah ke panel header supaya store tetap punya hitungan.
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
    // V6 - tombol selebar strip, timer di kiri header Daily Store.
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
    // V7 - tombol selebar strip juga, tapi timer tidak disembunyikan di kiri.
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
    // V8 - tombol kecil di TENGAH: ruang kosongnya jadi seimbang kiri-kanan.
    pv8: function () {
      var strip = v7Base();
      if (!strip) return false;
      strip.classList.add('pv-center');
      strip.appendChild(el(SMALL));
      return true;
    },
    // V9 - tombol kecil di KANAN, kiri diisi identitas akun yang akan di-launch.
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
    // V10 - strip DIBUANG: tombol kecilnya numpang di baris DAILY STORE, jadi tidak ada
    // bar yang perlu diisi. Paling hemat tinggi (45px penuh kembali ke kartu store).
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
    // Store/overview baru ada setelah data mock selesai dimuat, jadi coba lagi sampai berhasil.
    if (!done) setTimeout(attempt, 120);
  };
  setTimeout(attempt, 60);
}());
