// ============================================================================
// Bird Rebels: Ice Blaster — engine
// Loaded by loader.js. Builds the game's markup into the mount point, then
// boots. Character roster comes live from GET /api/characters (backed by
// D1 + R2) — adding a new state bird is a database row + an R2 upload, no
// redeploy of this file required.
// ============================================================================
(function () {

  var TIERS = {
    easy:   { label: 'Easy',   interval: 2400, speed: 70,  size: 46, k: 30, rampWindow: 130 },
    medium: { label: 'Medium', interval: 1500, speed: 125, size: 34, k: 20, rampWindow: 90  },
    hard:   { label: 'Hard',   interval: 850,  speed: 195, size: 24, k: 12, rampWindow: 60  }
  };
  var TIER_ORDER = ['easy', 'medium', 'hard'];
  var MIN_CUBE_SIZE = 24;
  var DEFAULT_TIER = 'medium';
  var MAX_LIVES = 5;
  var START_LIVES = 3;

  // All character art shares one canvas template (same size/framing), so a
  // single standard eye position works for every bird — no per-emblem tuning.
  var STANDARD_EYE = { xr: 0.55, yr: 0.165 };
  var CHAR_ASPECT = 937 / 887; // height / width of the shared art canvas

  var SNOWFLAKE_INTERVAL = 24000;
  var FIRE_COOLDOWN = 230;
  var TRIPLE_BLAST_MS = 10000;
  var MAX_STAGE_RATIO = 0.72;
  var LB_MAX = 10;

  // Sound files are served as static assets from ./public/sounds/ — add your
  // 5 files there with these exact names and redeploy (`wrangler deploy`),
  // no other code changes needed.
  var SOUND_FILES = {
    laser: 'sounds/laser.mp3',
    hit: 'sounds/hit.mp3',
    explosion: 'sounds/explosion.mp3',
    powerup: 'sounds/powerup.mp3',
    powerdown: 'sounds/powerdown.mp3',
    squish: 'sounds/squish.mp3'
  };
  var SOUND_VOLUME = { laser: 0.35, hit: 0.55, explosion: 0.5, powerup: 0.7, powerdown: 0.6, squish: 0.6 };

  function makeSoundPlayer(base) {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return function () {}; // very old browser — silently no-op

    var ctx = new AudioContextClass();
    var buffers = {};

    // Fetch + decode every sound ONCE, up front, into raw PCM buffers. Each
    // play() call after that just schedules already-decoded audio, which is
    // effectively instant — this is what actually fixes the mobile lag; the
    // old approach re-created and re-decoded an <audio> element on every
    // single trigger, which mobile browsers are slow to spin up each time.
    Object.keys(SOUND_FILES).forEach(function (key) {
      fetch(base + '/' + SOUND_FILES[key])
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (data) { return ctx.decodeAudioData(data); })
        .then(function (buf) { buffers[key] = buf; })
        .catch(function () {}); // if one sound fails to load, the rest still work
    });

    // Mobile browsers keep the AudioContext suspended until a genuine user
    // gesture. Unlock on the first touch/click/key anywhere on the page so
    // it's ready well before the first shot is fired.
    function unlock() { if (ctx.state === 'suspended') ctx.resume(); }
    ['touchstart', 'mousedown', 'keydown'].forEach(function (evt) {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });

    return function play(key) {
      var buf = buffers[key];
      if (!buf) return; // not decoded yet (e.g. still loading on a slow connection) — skip rather than lag
      try {
        unlock();
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var gain = ctx.createGain();
        gain.gain.value = SOUND_VOLUME[key] != null ? SOUND_VOLUME[key] : 0.6;
        src.connect(gain).connect(ctx.destination);
        src.start(0);
      } catch (e) {}
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function hexToRgb(hex) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var num = parseInt(hex, 16);
    if (isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  // Blends a color toward white so it stays visible as the beam's bright
  // inner core even when the source accent color is dark — some character
  // accent colors will be dark, per spec, so the core can't just BE the
  // accent or a dark-accent laser would be nearly invisible.
  function lightenForCore(hex) {
    var c = hexToRgb(hex);
    if (!c) return '#ff8a8a';
    var mix = function (ch) { return Math.round(ch + (255 - ch) * 0.72); };
    return 'rgb(' + mix(c.r) + ',' + mix(c.g) + ',' + mix(c.b) + ')';
  }
  function computeLaserColors(accentHex) {
    if (!accentHex || !hexToRgb(accentHex)) return { outer: '#9d2732', core: '#ff8a8a' };
    return { outer: accentHex, core: lightenForCore(accentHex) };
  }
  // Blends `amount` (0-1) of mixHex into baseHex — used to tint the game
  // background gradient a little toward the character's accent color.
  function mixColor(baseHex, mixHexColor, amount) {
    var a = hexToRgb(baseHex), b = hexToRgb(mixHexColor);
    if (!a || !b) return baseHex;
    var r = Math.round(a.r + (b.r - a.r) * amount);
    var g = Math.round(a.g + (b.g - a.g) * amount);
    var bl = Math.round(a.b + (b.b - a.b) * amount);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function computeBgColors(accentHex) {
    if (!accentHex || !hexToRgb(accentHex)) return { top: '#0a1420', bottom: '#16283c' };
    return { top: mixColor('#0a1420', accentHex, 0.16), bottom: mixColor('#16283c', accentHex, 0.16) };
  }
  // Picks black or white for the life-marker background chip, whichever
  // contrasts better against the given accent color (simple perceived-
  // brightness heuristic — good enough for a UI contrast decision).
  function pickContrastBg(accentHex) {
    var c = hexToRgb(accentHex);
    if (!c) return '#14202c';
    var luminance = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    return luminance > 150 ? '#000000' : '#ffffff';
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  var TEMPLATE = ''
    + '<div class="rl-frame">'
    + '  <div class="rl-screen" data-rl-screen="start">'
    + '    <div class="rl-screen-inner">'
    + '      <h1 class="rl-h1">Bird Rebels: Ice Blaster</h1>'
    + '      <p class="rl-sub">Ice cubes are falling — laser them down before they reach the bottom.</p>'
    + '      <div class="rl-char-label-row rl-field-label">Select Your Rebel</div>'
    + '      <div class="rl-char-grid" data-rl-char-grid><div class="rl-loading">Loading roster…</div></div>'
    + '      <div class="rl-field-label" style="margin-bottom:8px;">Difficulty</div>'
    + '      <div class="rl-tier-row" data-rl-tier-row>'
    + '        <button type="button" class="rl-tier-btn" data-rl-tier="easy">Easy</button>'
    + '        <button type="button" class="rl-tier-btn rl-selected" data-rl-tier="medium">Medium</button>'
    + '        <button type="button" class="rl-tier-btn" data-rl-tier="hard">Hard</button>'
    + '      </div>'
    + '      <p class="rl-tier-note">Speed &amp; frequency climb the whole run — faster on Hard, gentler on Easy. Cube size shrinks to its smallest setting, then holds.</p>'
    + '      <div class="rl-check-row">'
    + '        <input type="checkbox" id="rl-kidmode-toggle" data-rl-kidmode>'
    + '        <label for="rl-kidmode-toggle"><span data-rl-mode-label>Kid Mode</span>'
    + '          <small>No life bar, no penalty for missed cubes — snowflakes still grant triple blast</small>'
    + '        </label>'
    + '      </div>'
    + '      <button class="rl-btn" data-rl-start>Start Game</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-open-leaderboard>Leaderboard</button>'
    + '      <p class="rl-error" data-rl-start-error></p>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-screen rl-game-wrap" data-rl-screen="game" hidden>'
    + '    <div class="rl-hud">'
    + '      <div class="rl-hud-stat">Melted<br><b data-rl-score>0</b></div>'
    + '      <div class="rl-lives" data-rl-lives>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="0"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="0"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '      </div>'
    + '      <button class="rl-hud-btn" data-rl-finish hidden>Finish</button>'
    + '      <div class="rl-hud-stat" style="text-align:right;">Escaped<br><b data-rl-escaped>0</b></div>'
    + '      <button class="rl-hud-btn" data-rl-pause title="Pause">Pause</button>'
    + '    </div>'
    + '    <div class="rl-stage-outer" data-rl-stage-outer>'
    + '      <div class="rl-triple-banner" data-rl-triple-banner hidden>⚡ Triple Blast <span data-rl-triple-timer>10</span>s</div>'
    + '      <div class="rl-blizzard-banner" data-rl-blizzard-banner hidden>❄️ Blizzard Mode</div>'
    + '      <div class="rl-stage" data-rl-stage><canvas data-rl-canvas></canvas></div>'
    + '    </div>'
    + '    <div class="rl-pause-hint">move to aim · tap / click / space to fire</div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="pause" hidden>'
    + '    <div class="rl-pause-panel">'
    + '      <h2>Paused</h2>'
    + '      <button class="rl-btn" data-rl-resume>Resume</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-restart-run>Restart Run</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-reset>Reset</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="gameover" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2>Melted Through!</h2>'
    + '      <p class="rl-final">Ice cubes melted<b data-rl-final-score>0</b></p>'
    + '      <div data-rl-score-submit>'
    + '        <div class="rl-initials-row">'
    + '          <input type="text" maxlength="1" data-rl-initial="0" autocomplete="off" autocapitalize="characters">'
    + '          <input type="text" maxlength="1" data-rl-initial="1" autocomplete="off" autocapitalize="characters">'
    + '          <input type="text" maxlength="1" data-rl-initial="2" autocomplete="off" autocapitalize="characters">'
    + '        </div>'
    + '        <button class="rl-btn" data-rl-submit-score>Save Score</button>'
    + '        <p class="rl-error" data-rl-submit-error></p>'
    + '        <div class="rl-board" data-rl-board-inline hidden></div>'
    + '      </div>'
    + '      <p class="rl-tier-note" data-rl-kid-note hidden>Kid Mode runs aren\'t added to the leaderboard.</p>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-restart>Play Again</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="leaderboard" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 style="margin-bottom:14px;">Leaderboard</h2>'
    + '      <div class="rl-tabs" data-rl-lb-tabs>'
    + '        <button type="button" class="rl-tab" data-rl-lb-tab="easy">Easy</button>'
    + '        <button type="button" class="rl-tab rl-selected" data-rl-lb-tab="medium">Medium</button>'
    + '        <button type="button" class="rl-tab" data-rl-lb-tab="hard">Hard</button>'
    + '      </div>'
    + '      <div class="rl-board" data-rl-board-full><div class="rl-loading">Loading…</div></div>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-close-leaderboard>Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-toast" data-rl-toast></div>'
    + '</div>';

  function boot(mount) {
    if (mount.dataset.booted) return;
    mount.dataset.booted = '1';

    var BASE = mount.getAttribute('data-rl-base') || '';
    mount.classList.add('rl-root');
    mount.appendChild(el(TEMPLATE));
    var playSound = makeSoundPlayer(BASE);

    var toastTimer = null;
    var toastElRef = mount.querySelector('[data-rl-toast]');
    function toast(msg, ms) {
      if (!toastElRef) return;
      toastElRef.textContent = msg;
      toastElRef.classList.add('rl-show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastElRef.classList.remove('rl-show'); }, ms || 1600);
    }

    var blizzardTheme = new Audio(BASE + '/sounds/blizzard-theme.mp3');
    blizzardTheme.loop = true;
    blizzardTheme.volume = 0.55;
    blizzardTheme.preload = 'auto';
    function stopBlizzardTheme() { try { blizzardTheme.pause(); blizzardTheme.currentTime = 0; } catch (e) {} }

    var screens = {};
    mount.querySelectorAll('[data-rl-screen]').forEach(function (e) {
      screens[e.getAttribute('data-rl-screen')] = e;
    });
    function showScreen(name) {
      screens.pause.hidden = true;
      screens.gameover.hidden = true;
      screens.leaderboard.hidden = true;
      if (name === 'start') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'game') { screens.start.hidden = true; screens.game.hidden = false; }
      else if (name === 'pause') { screens.start.hidden = true; screens.game.hidden = false; screens.pause.hidden = false; }
      else if (name === 'gameover') { screens.start.hidden = true; screens.game.hidden = false; screens.gameover.hidden = false; }
      else if (name === 'leaderboard-from-start') { screens.start.hidden = false; screens.game.hidden = true; screens.leaderboard.hidden = false; }
      else if (name === 'leaderboard-close') { screens.start.hidden = false; screens.game.hidden = true; }
    }

    // ---------- character roster (live from the API) ----------
    var charGrid = mount.querySelector('[data-rl-char-grid]');
    var startError = mount.querySelector('[data-rl-start-error]');
    var roster = [];
    var selectedChar = null;
    var charImgs = {};
    var charAccent = {};

    function renderCharGrid() {
      if (!roster.length) {
        charGrid.innerHTML = '<div class="rl-loading">No characters available yet.</div>';
        return;
      }
      charGrid.innerHTML = '';
      roster.forEach(function (ch, i) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'rl-char-card' + (i === 0 ? ' rl-selected' : '');
        card.setAttribute('data-rl-char', ch.code);
        var img = document.createElement('img');
        img.alt = ch.label;
        img.src = BASE + ch.src;
        var span = document.createElement('span');
        span.textContent = ch.label;
        card.appendChild(img); card.appendChild(span);
        card.addEventListener('click', function () {
          selectedChar = ch.code;
          charGrid.querySelectorAll('.rl-char-card').forEach(function (c) { c.classList.toggle('rl-selected', c === card); });
        });
        charGrid.appendChild(card);

        var preload = new Image();
        preload.src = BASE + ch.src;
        charImgs[ch.code] = preload;
        charAccent[ch.code] = ch.accentColor || null;
      });
      if (roster.length) selectedChar = roster[0].code;
    }

    fetch(BASE + '/api/characters')
      .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(function (data) {
        roster = Array.isArray(data) ? data : [];
        renderCharGrid();
      })
      .catch(function () {
        charGrid.innerHTML = '<div class="rl-loading">Couldn\'t load the character roster. Check the Worker is deployed and try refreshing.</div>';
      });

    // ---------- difficulty tier selector ----------
    var selectedTier = DEFAULT_TIER;
    var pendingBlizzard = false;
    mount.querySelectorAll('[data-rl-tier]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedTier = btn.getAttribute('data-rl-tier');
        mount.querySelectorAll('[data-rl-tier]').forEach(function (b) { b.classList.toggle('rl-selected', b === btn); });
      });
    });

    // Secret: tap "Hard" repeatedly, IN A ROW — any click anywhere else resets
    // the count immediately. Taps 1–2 just select Hard normally; from the 3rd
    // tap on, an escalating popup teases the unlock, landing on the 6th tap.
    // Blizzard Mode then works on whatever difficulty you go on to pick —
    // it's a modifier, not tied to Hard.
    var hardBtn = mount.querySelector('[data-rl-tier="hard"]');
    var blizzardTaps = 0;
    var TAP_MESSAGES = { 3: 'Keep going', 4: 'Almost there', 5: 'ALMOST THERE' };
    document.addEventListener('click', function (e) {
      if (pendingBlizzard) return; // already unlocked
      if (hardBtn.contains(e.target)) return; // handled by hardBtn's own listener below
      blizzardTaps = 0; // any click elsewhere breaks the streak
    }, true); // capture phase so this runs before hardBtn's own click handler either way

    hardBtn.addEventListener('click', function () {
      if (pendingBlizzard) return; // already unlocked this session-visit
      blizzardTaps++;

      if (blizzardTaps >= 6) {
        pendingBlizzard = true;
        hardBtn.classList.add('rl-blizzard-armed');
        setModeLabel(true);
        toast('🌀 Oh yeah! Blizzard Mode unlocked — enjoy yourself!', 2600);
      } else if (TAP_MESSAGES[blizzardTaps]) {
        toast(TAP_MESSAGES[blizzardTaps], 1200);
      }
    });

    var kidModeEl = mount.querySelector('[data-rl-kidmode]');
    var modeLabelEl = mount.querySelector('[data-rl-mode-label]');
    function setModeLabel(blizzardArmed) {
      // Swaps the word "Kid" out of the scene when Blizzard is armed — the
      // grown-up variant calls the same no-stakes toggle "Leisure Mode".
      modeLabelEl.textContent = blizzardArmed ? 'Leisure Mode' : 'Kid Mode';
    }

    // ---------- leaderboard ----------
    var lbTier = DEFAULT_TIER;
    function loadLeaderboard(tier, container) {
      container.innerHTML = '<div class="rl-loading">Loading…</div>';
      fetch(BASE + '/api/leaderboard?tier=' + encodeURIComponent(tier))
        .then(function (r) { return r.json(); })
        .then(function (arr) { renderBoard(container, arr); })
        .catch(function () { container.innerHTML = '<div class="rl-loading">Couldn\'t load the leaderboard.</div>'; });
    }
    function renderBoard(container, arr, highlightTs) {
      if (!arr || !arr.length) {
        container.innerHTML = '<div class="rl-board-empty">No scores yet — be the first.</div>';
        return;
      }
      var html = '';
      arr.forEach(function (row, i) {
        var mine = highlightTs && row.ts === highlightTs;
        html += '<div class="rl-board-row' + (mine ? ' rl-me' : '') + '">'
          + '<span class="rl-rank">' + (i + 1) + '</span>'
          + '<span class="rl-char-tag">' + (row.character || '—') + '</span>'
          + '<span class="rl-init">' + row.initials + '</span>'
          + '<span class="rl-pts">' + row.score + '</span>'
          + '</div>';
      });
      container.innerHTML = html;
    }

    mount.querySelector('[data-rl-open-leaderboard]').addEventListener('click', function () {
      lbTier = DEFAULT_TIER;
      mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (t) { t.classList.toggle('rl-selected', t.getAttribute('data-rl-lb-tab') === lbTier); });
      loadLeaderboard(lbTier, mount.querySelector('[data-rl-board-full]'));
      showScreen('leaderboard-from-start');
    });
    mount.querySelector('[data-rl-close-leaderboard]').addEventListener('click', function () { showScreen('leaderboard-close'); });
    mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        lbTier = tab.getAttribute('data-rl-lb-tab');
        mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (t) { t.classList.toggle('rl-selected', t === tab); });
        loadLeaderboard(lbTier, mount.querySelector('[data-rl-board-full]'));
      });
    });

    // ---------- game elements ----------
    var stageOuter = mount.querySelector('[data-rl-stage-outer]');
    var stage = mount.querySelector('[data-rl-stage]');
    var canvas = mount.querySelector('[data-rl-canvas]');
    var ctx = canvas.getContext('2d');
    var scoreEl = mount.querySelector('[data-rl-score]');
    var escapedEl = mount.querySelector('[data-rl-escaped]');
    var livesWrap = mount.querySelector('[data-rl-lives]');
    var finishBtn = mount.querySelector('[data-rl-finish]');
    var pauseBtn = mount.querySelector('[data-rl-pause]');
    var lifeEls = mount.querySelectorAll('[data-rl-lives] .rl-life');
    var tripleBanner = mount.querySelector('[data-rl-triple-banner]');
    var tripleTimerEl = mount.querySelector('[data-rl-triple-timer]');
    var blizzardBanner = mount.querySelector('[data-rl-blizzard-banner]');
    var finalScoreEl = mount.querySelector('[data-rl-final-score]');
    var initialInputs = mount.querySelectorAll('[data-rl-initial]');
    var boardInline = mount.querySelector('[data-rl-board-inline]');
    var submitError = mount.querySelector('[data-rl-submit-error]');
    var scoreSubmitBlock = mount.querySelector('[data-rl-score-submit]');
    var kidNote = mount.querySelector('[data-rl-kid-note]');

    var dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    var W = 360, H = 480;

    function layoutStage() {
      var rect = stageOuter.getBoundingClientRect();
      var cw = rect.width, ch = rect.height;
      if (cw < 10 || ch < 10) return;
      var w = cw, h = ch;
      if (w / h > MAX_STAGE_RATIO) w = h * MAX_STAGE_RATIO;
      stage.style.width = w + 'px';
      stage.style.height = h + 'px';
      W = w; H = h;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(layoutStage) : null;
    if (ro) ro.observe(stageOuter);
    window.addEventListener('resize', layoutStage);

    // ---------- game state ----------
    var S = null;
    function freshState() {
      var accentColor = charAccent[selectedChar] || null;
      var blizzard = !!pendingBlizzard; // works on any difficulty now
      pendingBlizzard = false; // one-shot: must be re-unlocked (tap Hard x6 again) for the next run
      return {
        running: true,
        paused: false,
        startedAt: performance.now(),
        lastT: performance.now(),
        elapsed: 0,
        pausedAccum: 0,
        aimX: W / 2,
        loonX: W / 2,
        firing: false,
        pendingFire: false,
        lastFireAt: -9999,
        lives: START_LIVES,
        melted: 0,
        escaped: 0,
        cubes: [],
        snow: null,           // life-restore pickup
        triple: null,         // triple-blast pickup
        nextSnowAt: SNOWFLAKE_INTERVAL,
        nextTripleAt: SNOWFLAKE_INTERVAL / 2,
        nextSpawnAt: 0,
        projectiles: [],
        particles: [],
        shards: [],
        tripleUntil: 0,
        tripleWasActive: false,
        laserColors: computeLaserColors(accentColor),
        bgColors: computeBgColors(accentColor),
        cfg: {
          character: selectedChar,
          accentColor: accentColor,
          tier: selectedTier,
          kidMode: !!kidModeEl.checked,
          blizzard: blizzard
        }
      };
    }

    function currentDifficulty(t) {
      var tier = TIERS[S.cfg.tier] || TIERS[DEFAULT_TIER];
      var growth = Math.sqrt(1 + t / tier.k);
      var interval = Math.max(230, tier.interval / growth);
      var speed = tier.speed * growth;
      var sizeT = clamp(t / tier.rampWindow, 0, 1);
      var size = lerp(tier.size, MIN_CUBE_SIZE, sizeT);
      return { interval: interval, speed: speed, size: size };
    }

    function setLives(n, opts) {
      opts = opts || {};
      S.lives = clamp(n, 0, MAX_LIVES);
      lifeEls.forEach(function (e, i) {
        var on = i < S.lives ? '1' : '0';
        if (e.getAttribute('data-on') !== on) {
          e.setAttribute('data-on', on);
          if (opts.pulse) { e.classList.remove('rl-pulse'); void e.offsetWidth; e.classList.add('rl-pulse'); }
        }
      });
    }

    function updateHud() {
      scoreEl.textContent = S.melted;
      escapedEl.textContent = S.escaped;
      if (S.paused) return; // freeze triple-blast timer/sound state while paused
      var now = performance.now();
      var tripleActive = now < S.tripleUntil;
      if (!tripleActive && S.tripleWasActive) playSound('powerdown');
      S.tripleWasActive = tripleActive;
      if (tripleActive) {
        tripleBanner.hidden = false;
        tripleTimerEl.textContent = Math.ceil((S.tripleUntil - now) / 1000);
      } else {
        tripleBanner.hidden = true;
      }
    }

    // ---------- eye position (one standard spot for every character) ----------
    function getEyePos() {
      var loonW = clamp(W * 0.34, 90, 170);
      var loonH = loonW * CHAR_ASPECT;
      var left = S.loonX - loonW / 2;
      var top = H - loonH * 0.94;
      return {
        x: left + STANDARD_EYE.xr * loonW,
        y: top + STANDARD_EYE.yr * loonH,
        loonLeft: left, loonTop: top, loonW: loonW, loonH: loonH
      };
    }

    // ---------- spawning ----------
    function spawnCube(size) {
      var margin = size / 2 + 4;
      var x = rand(margin, W - margin);
      var speed = currentDifficulty(S.elapsed).speed;
      S.cubes.push({ x: x, y: -size, size: size, speed: speed * rand(0.85, 1.18), rot: rand(-0.12, 0.12) });
    }
    function spawnSnowflake() {
      var fromLeft = Math.random() < 0.5;
      var y = rand(H * 0.14, H * 0.42);
      S.snow = { x: fromLeft ? -20 : W + 20, y: y, vx: (fromLeft ? 1 : -1) * rand(34, 46), vy: rand(-4, 4), r: 11, wob: rand(0, Math.PI * 2) };
    }
    function spawnTripleOrb() {
      var fromLeft = Math.random() < 0.5;
      var y = rand(H * 0.14, H * 0.42);
      S.triple = { x: fromLeft ? -20 : W + 20, y: y, vx: (fromLeft ? 1 : -1) * rand(34, 46), vy: rand(-4, 4), r: 11, wob: rand(0, Math.PI * 2) };
    }

    // ---------- weapon presets ----------
    // Speed/trail are expressed as ratios of stage height so they scale
    // sensibly across screen sizes, same spirit as "25vh" — computed to
    // actual px against the live H when a shot is fired.
    var WEAPONS = {
      laser:  { speedRatio: 3.2, pathWidth: 9,  trailRatio: 0.55, pierce: true  }, // fast, narrow, long trail, passes through
      rocket: { speedRatio: 1.3, pathWidth: 24, trailRatio: 0.25, pierce: false } // slower, wide, short trail, stops on impact
    };
    var TOY_COLORS = ['#ffb59e', '#7b3f8f', '#c8a2e0', '#ff8fb0', '#5b7fd4', '#9be08a', '#ffd36e'];
    // peach, eggplant, lavender, rose pink, blueberry, mint, butter

    function spawnProjectile(x0, y0, x1, y1, weaponKey, now, color) {
      var weapon = WEAPONS[weaponKey];
      var dx = x1 - x0, dy = y1 - y0;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      S.projectiles.push({
        x0: x0, y0: y0, dirX: dx / dist, dirY: dy / dist, totalDist: dist,
        traveled: 0,
        weapon: weaponKey,
        speed: weapon.speedRatio * H,
        pathWidth: weapon.pathWidth,
        trailLength: weapon.trailRatio * H,
        pierce: weapon.pierce,
        color: color || null,
        impacted: false, impactAt: 0, fadeStart: 0,
        headX: x0, headY: y0, tailX: x0, tailY: y0
      });
    }

    // ---------- firing ----------
    function fire(now) {
      if (now - S.lastFireAt < FIRE_COOLDOWN) return;
      S.lastFireAt = now;
      var weaponKey = S.cfg.blizzard ? 'rocket' : 'laser';
      playSound(S.cfg.blizzard ? 'squish' : 'laser');
      var eye = getEyePos();
      var triple = now < S.tripleUntil;
      var offsets = triple ? [-W / 4, 0, W / 4] : [0];
      offsets.forEach(function (off) {
        var topX = eye.x + off;
        var color = weaponKey === 'rocket' ? TOY_COLORS[Math.floor(rand(0, TOY_COLORS.length))] : null;
        spawnProjectile(eye.x, eye.y, topX, -6, weaponKey, now, color);
      });
    }

    // Checks only the projectile's CURRENT trail segment (tail..head) — the
    // active kill-stripe trails behind the head, never ahead of it. Called
    // every frame while a projectile is alive, not just once at fire time.
    function checkProjectileHits(pr, x0, y0, x1, y1) {
      var dy = y1 - y0;
      var half = pr.pathWidth / 2 + 7;
      for (var i = S.cubes.length - 1; i >= 0; i--) {
        var c = S.cubes[i];
        var ty = dy !== 0 ? (c.y - y0) / dy : 0;
        ty = clamp(ty, 0, 1);
        var bx = lerp(x0, x1, ty);
        if (Math.abs(bx - c.x) < half + c.size / 2 && c.y > -c.size && c.y < H) {
          spawnBurst(c.x, c.y, '#bfe9ff');
          S.cubes.splice(i, 1);
          S.melted++;
          playSound('hit');
          if (!pr.pierce) {
            pr.impacted = true; pr.impactAt = performance.now();
            spawnBurst(c.x, c.y, pr.color || '#ffcf4d');
            return; // this weapon explodes on first contact — stop checking
          }
        }
      }
      if (S.snow) {
        var ty2 = dy !== 0 ? (S.snow.y - y0) / dy : 0; ty2 = clamp(ty2, 0, 1);
        var bx2 = lerp(x0, x1, ty2);
        if (Math.abs(bx2 - S.snow.x) < half + S.snow.r) {
          onSnowflakeHit();
          if (!pr.pierce) { pr.impacted = true; pr.impactAt = performance.now(); return; }
        }
      }
      if (S.triple) {
        var ty3 = dy !== 0 ? (S.triple.y - y0) / dy : 0; ty3 = clamp(ty3, 0, 1);
        var bx3 = lerp(x0, x1, ty3);
        if (Math.abs(bx3 - S.triple.x) < half + S.triple.r) {
          onTripleOrbHit();
          if (!pr.pierce) { pr.impacted = true; pr.impactAt = performance.now(); return; }
        }
      }
    }

    function updateProjectiles(dt, now) {
      for (var i = S.projectiles.length - 1; i >= 0; i--) {
        var pr = S.projectiles[i];
        if (!pr.impacted) {
          pr.traveled = Math.min(pr.totalDist, pr.traveled + pr.speed * dt);
        }
        pr.headX = pr.x0 + pr.dirX * pr.traveled;
        pr.headY = pr.y0 + pr.dirY * pr.traveled;
        var tailTraveled = Math.max(0, pr.traveled - pr.trailLength);
        pr.tailX = pr.x0 + pr.dirX * tailTraveled;
        pr.tailY = pr.y0 + pr.dirY * tailTraveled;

        if (!pr.impacted) {
          checkProjectileHits(pr, pr.tailX, pr.tailY, pr.headX, pr.headY);
        }

        if (pr.impacted) {
          if (now - pr.impactAt > 220) S.projectiles.splice(i, 1);
        } else if (pr.traveled >= pr.totalDist) {
          if (!pr.fadeStart) pr.fadeStart = now;
          if (now - pr.fadeStart > 160) S.projectiles.splice(i, 1);
        }
      }
    }

    // Life-restore pickup: adds a life, up to MAX_LIVES. Doesn't spawn at all
    // in Kid Mode (see loop()), since lives aren't tracked there.
    function onSnowflakeHit() {
      spawnBurst(S.snow.x, S.snow.y, '#ffffff');
      S.snow = null;
      setLives(S.lives + 1, { pulse: true });
    }

    // Triple-blast pickup: always grants triple blast, independent of lives —
    // works in Kid Mode too.
    function onTripleOrbHit() {
      spawnBurst(S.triple.x, S.triple.y, '#9de6ff');
      S.triple = null;
      S.tripleUntil = performance.now() + TRIPLE_BLAST_MS;
      playSound('powerup');
    }

    function spawnBurst(x, y, color) {
      for (var i = 0; i < 10; i++) {
        var a = rand(0, Math.PI * 2), sp = rand(40, 140);
        S.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color: color });
      }
    }

    // Ice-shatter when a cube hits the floor: a spray of angular shards that
    // launch up and outward from the impact point, tumble, fall under gravity,
    // and fade. Distinct from the round spark particles used on a laser hit.
    function spawnShatter(x, y, size) {
      var n = 7 + Math.floor(size / 8);
      for (var i = 0; i < n; i++) {
        var ang = -Math.PI / 2 + rand(-1.1, 1.1); // biased upward
        var sp = rand(70, 210);
        S.shards.push({
          x: x + rand(-size / 3, size / 3), y: y,
          vx: Math.cos(ang) * sp * rand(0.6, 1.2),
          vy: Math.sin(ang) * sp,
          rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
          s: rand(size * 0.14, size * 0.32), life: 1
        });
      }
    }

    function onCubeEscaped() {
      S.escaped++;
      playSound('explosion');
      if (S.cfg.kidMode) return;
      setLives(S.lives - 1, { pulse: true });
      if (S.lives <= 0) endGame();
    }

    // ---------- input ----------
    function pointerXFromEvent(e) {
      var rect = stage.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      return clamp(clientX - rect.left, 0, W);
    }
    function onPointerMove(e) { if (!S || !S.running || S.paused) return; S.aimX = pointerXFromEvent(e); }
    function onPointerDown(e) {
      if (!S || !S.running || S.paused) return;
      S.aimX = pointerXFromEvent(e);
      S.firing = true;
      S.pendingFire = true; // fires once the loon visually arrives at this spot, see loop()
      e.preventDefault();
    }
    function onPointerUp() { if (S) S.firing = false; }

    stage.addEventListener('mousemove', onPointerMove);
    stage.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);
    stage.addEventListener('touchstart', function (e) { onPointerMove(e); onPointerDown(e); }, { passive: false });
    stage.addEventListener('touchmove', function (e) { onPointerMove(e); e.preventDefault(); }, { passive: false });
    stage.addEventListener('touchend', onPointerUp);
    stage.addEventListener('touchcancel', onPointerUp);

    window.addEventListener('keydown', function (e) {
      if (!S || !S.running || screens.game.hidden) return;
      if (e.code === 'Escape') { togglePause(); return; }
      if (S.paused) return;
      if (e.code === 'Space') { S.firing = true; S.pendingFire = true; e.preventDefault(); }
      else if (e.code === 'ArrowLeft') { S.aimX = clamp(S.aimX - 22, 0, W); }
      else if (e.code === 'ArrowRight') { S.aimX = clamp(S.aimX + 22, 0, W); }
    });
    window.addEventListener('keyup', function (e) { if (e.code === 'Space' && S) S.firing = false; });

    // ---------- pause ----------
    function togglePause() {
      if (!S || !S.running) return;
      if (S.paused) resumeGame(); else pauseGame();
    }
    function pauseGame() {
      S.paused = true; S.firing = false; S.pauseStartedAt = performance.now();
      if (S.cfg.blizzard) blizzardTheme.pause();
      showScreen('pause');
    }
    function resumeGame() {
      var now = performance.now();
      if (S.pauseStartedAt) {
        var pausedMs = now - S.pauseStartedAt;
        S.pausedAccum += pausedMs / 1000;
        if (S.tripleUntil > 0) S.tripleUntil += pausedMs; // don't let triple blast silently expire while paused
        S.pauseStartedAt = null;
      }
      S.lastT = now; // avoid a big dt jump on resume
      S.paused = false;
      if (S.cfg.blizzard) { var p = blizzardTheme.play(); if (p && p.catch) p.catch(function () {}); }
      showScreen('game');
    }
    pauseBtn.addEventListener('click', togglePause);
    mount.querySelector('[data-rl-resume]').addEventListener('click', resumeGame);
    mount.querySelector('[data-rl-restart-run]').addEventListener('click', function () {
      stopBlizzardTheme();
      S = freshState();
      setLives(START_LIVES);
      blizzardBanner.hidden = !S.cfg.blizzard; // one-shot arm was already consumed at the original Start — almost always hidden here
      showScreen('game');
    });
    var doReset = function () {
      if (S) S.running = false;
      stopBlizzardTheme();
      blizzardBanner.hidden = true;
      pendingBlizzard = false;
      blizzardTaps = 0;
      hardBtn.classList.remove('rl-blizzard-armed');
      setModeLabel(false);
      showScreen('start');
    };
    mount.querySelector('[data-rl-reset]').addEventListener('click', doReset);

    // External page-level hooks: any element ANYWHERE ELSE on the page carrying
    // data-rl-pause or data-rl-reset auto-wires to the same behavior as the
    // game's own built-in buttons — same convention as data-dc-pause/
    // data-dc-reset on DC Lagoon. Elements inside the mount are skipped since
    // those are the game's own buttons, already wired above.
    document.querySelectorAll('[data-rl-pause]').forEach(function (node) {
      if (mount.contains(node)) return;
      node.addEventListener('click', togglePause);
    });
    document.querySelectorAll('[data-rl-reset]').forEach(function (node) {
      if (mount.contains(node)) return;
      node.addEventListener('click', doReset);
    });

    // ---------- render ----------
    function drawBackground() {
      var colors = S.bgColors || { top: '#0a1420', bottom: '#16283c' };
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, colors.top); g.addColorStop(1, colors.bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // Deliberately abstract "toy rocket" sprite (rounded cap + shaft + two
    // base nubs) — a cartoonish nod to the Whipple Building protest coverage,
    // not anatomical detail. Drawn pointing "up" (−y); caller translates.
    var RAINBOW = ['#ff5f5f', '#ffab5f', '#ffe95f', '#5fe08a', '#5fb8ff', '#9d7bff', '#ff7be0'];
    function drawRocket(scale, color) {
      ctx.fillStyle = color;
      roundRect(ctx, -3.2 * scale, -9 * scale, 6.4 * scale, 15 * scale, 3.2 * scale);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-3 * scale, 6 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.arc(3 * scale, 6 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      roundRect(ctx, -1.5 * scale, -7 * scale, 1.8 * scale, 8 * scale, 0.9 * scale);
      ctx.fill();
    }

    // Renders every live projectile's CURRENT trail segment (tail..head) —
    // the visual trail IS the active kill-stripe, so what you see is exactly
    // what can hit something. Laser and rocket share this one draw path,
    // branching only on weapon type.
    function drawProjectiles(now) {
      var lineIntensity = S.cfg.tier === 'easy' ? 0.4 : (S.cfg.tier === 'medium' ? 0.7 : 1);
      S.projectiles.forEach(function (pr) {
        var fadeAlpha = pr.impacted
          ? clamp(1 - (now - pr.impactAt) / 220, 0, 1)
          : (pr.fadeStart ? clamp(1 - (now - pr.fadeStart) / 160, 0, 1) : 1);
        if (fadeAlpha <= 0) return;

        if (pr.weapon === 'rocket') {
          var segs = 8;
          for (var i = 1; i <= segs; i++) {
            var t0 = (i - 1) / segs, t1 = i / segs;
            var ax = lerp(pr.tailX, pr.headX, t0), ay = lerp(pr.tailY, pr.headY, t0);
            var bx = lerp(pr.tailX, pr.headX, t1), by = lerp(pr.tailY, pr.headY, t1);
            var col = RAINBOW[i % RAINBOW.length];
            ctx.save();
            ctx.globalAlpha = fadeAlpha * lineIntensity * (0.25 + 0.65 * (i / segs));
            ctx.strokeStyle = col; ctx.lineWidth = (1 + (i / segs) * pr.pathWidth * 0.55) * (0.6 + 0.4 * lineIntensity);
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.restore();
          }
          if (!pr.impacted || (now - pr.impactAt) < 150) {
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(pr.headX, pr.headY);
            drawRocket(1.5, pr.color);
            ctx.restore();
          }
        } else {
          var colors = S.laserColors || { outer: '#9d2732', core: '#ff8a8a' };
          ctx.save();
          ctx.globalAlpha = fadeAlpha * 0.5; ctx.strokeStyle = colors.outer; ctx.lineWidth = pr.pathWidth;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
          ctx.globalAlpha = fadeAlpha; ctx.strokeStyle = colors.core; ctx.lineWidth = Math.max(2, pr.pathWidth * 0.35);
          ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
          ctx.restore();
        }
      });
    }
    function drawLoon(eye) {
      var img = charImgs[S.cfg.character];
      if (!img || !img.complete || !img.naturalWidth) return;
      ctx.drawImage(img, eye.loonLeft, eye.loonTop, eye.loonW, eye.loonH);
    }
    function drawCubes() {
      S.cubes.forEach(function (c) {
        var half = c.size / 2;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        var grad = ctx.createLinearGradient(-half, -half, half, half);
        grad.addColorStop(0, '#e8f8ff'); grad.addColorStop(1, '#7fc4e8');
        ctx.fillStyle = grad; ctx.strokeStyle = 'rgba(79,143,184,0.9)'; ctx.lineWidth = 2;
        roundRect(ctx, -half, -half, c.size, c.size, Math.max(2, c.size * 0.12));
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-half * 0.55, -half * 0.7, c.size * 0.22, c.size * 0.5);
        ctx.restore();
      });
    }
    // Life-restore pickup — a snowflake that glows in the character's accent
    // color (falls back to a plain icy white when no accent color is set).
    function drawSnowflake(now) {
      if (!S.snow) return;
      var sf = S.snow; var bob = Math.sin(now / 260 + sf.wob) * 3;
      var glow = S.cfg.accentColor || '#f4fbff';
      ctx.save(); ctx.translate(sf.x, sf.y + bob);
      ctx.shadowColor = glow; ctx.shadowBlur = 8;
      ctx.strokeStyle = glow; ctx.fillStyle = glow; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.95;
      for (var i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3 + now / 4000);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sf.r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, sf.r * 0.55); ctx.lineTo(3, sf.r * 0.75); ctx.moveTo(0, sf.r * 0.55); ctx.lineTo(-3, sf.r * 0.75); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    // Triple-blast pickup — a simple circle with a 3-way split-laser glyph.
    function drawTripleOrb(now) {
      if (!S.triple) return;
      var tp = S.triple; var bob = Math.sin(now / 220 + tp.wob) * 3;
      var col = '#ffcf4d';
      ctx.save(); ctx.translate(tp.x, tp.y + bob);
      ctx.shadowColor = col; ctx.shadowBlur = 9;
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(0, 0, tp.r, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      [-0.42, 0, 0.42].forEach(function (off) {
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(off * tp.r * 1.5, -tp.r * 0.85);
        ctx.stroke();
      });
      ctx.restore();
    }
    function drawParticles(dt) {
      for (var i = S.particles.length - 1; i >= 0; i--) {
        var p = S.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt * 1.6;
        if (p.life <= 0) { S.particles.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    function drawShards(dt) {
      var floorY = H - 4;
      for (var i = S.shards.length - 1; i >= 0; i--) {
        var sh = S.shards[i];
        sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += 420 * dt; // gravity
        sh.rot += sh.vr * dt; sh.life -= dt * 1.15;
        if (sh.y > floorY) { sh.y = floorY; sh.vy *= -0.35; sh.vx *= 0.6; } // little bounce off the floor
        if (sh.life <= 0) { S.shards.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = clamp(sh.life, 0, 1);
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        var g = ctx.createLinearGradient(-sh.s, -sh.s, sh.s, sh.s);
        g.addColorStop(0, '#eaf9ff'); g.addColorStop(1, '#8fd0ee');
        ctx.fillStyle = g;
        ctx.strokeStyle = 'rgba(79,143,184,0.8)'; ctx.lineWidth = 1;
        // an angular triangular shard
        ctx.beginPath();
        ctx.moveTo(0, -sh.s);
        ctx.lineTo(sh.s * 0.85, sh.s * 0.7);
        ctx.lineTo(-sh.s * 0.7, sh.s * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }

    // ---------- main loop ----------
    function loop(now) {
      if (!S) return;
      var dt = Math.min(0.05, (now - S.lastT) / 1000);
      S.lastT = now;
      if (S.running && !S.paused) {
        S.elapsed = (now - S.startedAt) / 1000 - S.pausedAccum;

        S.loonX = lerp(S.loonX, S.aimX, 0.28);
        S.loonX = clamp(S.loonX, 0, W);

        var arrived = Math.abs(S.loonX - S.aimX) < 3;
        if (S.pendingFire && arrived) { fire(now); S.pendingFire = false; }
        else if (S.firing && arrived) { fire(now); }

        var diff = currentDifficulty(S.elapsed);
        if (now >= S.nextSpawnAt) {
          spawnCube(diff.size);
          S.nextSpawnAt = now + diff.interval * rand(0.8, 1.2);
        }
        // Life-restore pickup doesn't spawn in Kid Mode — lives aren't tracked there.
        if (!S.cfg.kidMode && !S.snow && (now - S.startedAt) >= S.nextSnowAt) {
          spawnSnowflake();
          S.nextSnowAt += SNOWFLAKE_INTERVAL;
        }
        if (!S.triple && (now - S.startedAt) >= S.nextTripleAt) {
          spawnTripleOrb();
          S.nextTripleAt += SNOWFLAKE_INTERVAL;
        }

        var floorY = H - 6;
        for (var i = S.cubes.length - 1; i >= 0; i--) {
          var c = S.cubes[i];
          c.y += c.speed * dt;
          if (c.y - c.size / 2 > floorY) {
            S.cubes.splice(i, 1);
            spawnShatter(clamp(c.x, c.size, W - c.size), floorY, c.size);
            onCubeEscaped();
          }
        }
        if (S.snow) {
          S.snow.x += S.snow.vx * dt;
          if (S.snow.x < -40 || S.snow.x > W + 40) S.snow = null;
        }
        if (S.triple) {
          S.triple.x += S.triple.vx * dt;
          if (S.triple.x < -40 || S.triple.x > W + 40) S.triple = null;
        }
        updateProjectiles(dt, now);
      }

      drawBackground();
      var eye = getEyePos();
      drawProjectiles(now);
      drawLoon(eye);
      drawCubes();
      drawSnowflake(now);
      drawTripleOrb(now);
      drawShards(S.paused ? 0 : dt);
      drawParticles(S.paused ? 0 : dt);

      updateHud();
      requestAnimationFrame(loop);
    }

    function endGame() {
      if (!S.running) return;
      S.running = false;
      stopBlizzardTheme();
      blizzardBanner.hidden = true;
      finalScoreEl.textContent = S.melted;
      boardInline.hidden = true;
      submitError.textContent = '';
      initialInputs.forEach(function (inp) { inp.value = ''; });
      scoreSubmitBlock.hidden = S.cfg.kidMode;
      kidNote.hidden = !S.cfg.kidMode;
      showScreen('gameover');
      if (!S.cfg.kidMode) setTimeout(function () { initialInputs[0].focus(); }, 50);
    }

    // ---------- initials input UX ----------
    initialInputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1);
        if (inp.value && initialInputs[idx + 1]) initialInputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && initialInputs[idx - 1]) initialInputs[idx - 1].focus();
      });
    });

    mount.querySelector('[data-rl-submit-score]').addEventListener('click', function () {
      var btn = this;
      var initials = Array.prototype.map.call(initialInputs, function (i) { return i.value || ''; }).join('');
      submitError.textContent = '';
      if (initials.length !== 3) { submitError.textContent = 'Enter 3 letters.'; return; }
      btn.setAttribute('disabled', 'disabled'); btn.textContent = 'Saving…';
      fetch(BASE + '/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initials: initials, tier: S.cfg.tier, score: S.melted, character: S.cfg.character })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            submitError.textContent = res.data && res.data.error ? res.data.error : 'Could not save score.';
            btn.removeAttribute('disabled'); btn.textContent = 'Save Score';
            return;
          }
          boardInline.hidden = false;
          renderBoard(boardInline, res.data.board, res.data.board.length ? res.data.board[0].ts : null);
          btn.textContent = 'Saved';
        })
        .catch(function () {
          submitError.textContent = 'Network error — try again.';
          btn.removeAttribute('disabled'); btn.textContent = 'Save Score';
        });
    });

    mount.querySelector('[data-rl-restart]').addEventListener('click', function () {
      var btn = mount.querySelector('[data-rl-submit-score]');
      btn.removeAttribute('disabled'); btn.textContent = 'Save Score';
      pendingBlizzard = false;
      blizzardTaps = 0;
      hardBtn.classList.remove('rl-blizzard-armed');
      setModeLabel(false);
      showScreen('start');
    });

    finishBtn.addEventListener('click', function () { endGame(); });

    // ---------- start ----------
    var loopStarted = false;
    mount.querySelector('[data-rl-start]').addEventListener('click', function () {
      startError.textContent = '';
      if (!selectedChar) { startError.textContent = 'Pick a rebel first.'; return; }
      showScreen('game');
      layoutStage();
      S = freshState();
      setLives(START_LIVES);
      livesWrap.hidden = S.cfg.kidMode;
      finishBtn.hidden = !S.cfg.kidMode;

      if (S.cfg.accentColor) {
        livesWrap.style.setProperty('--rl-life-glow', S.cfg.accentColor);
        livesWrap.style.setProperty('--rl-life-bg', pickContrastBg(S.cfg.accentColor));
      } else {
        livesWrap.style.removeProperty('--rl-life-glow');
        livesWrap.style.removeProperty('--rl-life-bg');
      }

      hardBtn.classList.remove('rl-blizzard-armed'); // arm state is consumed by freshState() either way

      stopBlizzardTheme();
      blizzardBanner.hidden = !S.cfg.blizzard;
      if (S.cfg.blizzard) {
        toast('🌀 BLIZZARD MODE', 2000);
        blizzardTheme.currentTime = 0;
        var p = blizzardTheme.play();
        if (p && p.catch) p.catch(function () {});
      }

      if (!loopStarted) {
        loopStarted = true;
        requestAnimationFrame(function (now) { S.lastT = now; S.startedAt = now; loop(now); });
      }
    });

    layoutStage();
  }

  function bootAll() {
    document.querySelectorAll('[data-rl-mount]').forEach(boot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAll);
  else bootAll();
})();
