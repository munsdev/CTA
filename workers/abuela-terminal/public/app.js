/* ===========================================================================
   ABUELA — console client

   Three jobs:
     1. Drive the terminal (typing cadence, history, completion).
     2. Poll and render the dashboard panels.
     3. Generate the tape locally from a session seed, so an endless scroll of
        micro-edits costs zero bandwidth and never repeats.

   Animation is stepped throughout to match the CSS. Nothing eases.
   =========================================================================== */

(function () {
  'use strict';

  var SESSION_KEY = 'abuela.session';
  var state = { session: null, commands: [], flags: [], risk: 0, variance: 0.42, flag_state: 0 };
  var history = [];
  var histIdx = -1;
  var busy = false;

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------------
     Boot sequence. POST-style memory count, then the banner. Runs once
     per browser session — theatre the first time, friction every time
     after, so sessionStorage gates it.
     ------------------------------------------------------------------ */

  var BOOT = [
    ['', 40],
    ['Award Modular BIOS v4.51PG', 60],
    ['Copyright (C) 1984-99, Award Software, Inc.', 60],
    ['', 30],
    ['Main Processor   : unlisted', 50],
    ['Memory Testing   : ', 30],
  ];

  function runBoot(done) {
    var el = $('boot-text');
    if (sessionStorage.getItem('abuela.booted')) { done(); return; }

    var out = '';
    var i = 0;

    function line() {
      if (i >= BOOT.length) { memCount(); return; }
      out += BOOT[i][0] + '\n';
      el.textContent = out;
      var d = BOOT[i][1];
      i++;
      setTimeout(line, d);
    }

    function memCount() {
      var n = 0;
      var target = 262144;                    // 2^18. Once, unexplained.
      var step = Math.ceil(target / 46);
      var tick = setInterval(function () {
        n = Math.min(target, n + step);
        el.textContent = out.replace(/Memory Testing   : $/, 'Memory Testing   : ' + n + 'K');
        if (n >= target) {
          clearInterval(tick);
          setTimeout(banner, 260);
        }
      }, 22);
    }

    function banner() {
      out = el.textContent + ' OK\n\n';
      var rest = [
        'Detecting drives ... done',
        'Detecting network ... none',
        '',
        'No boot device configured. Loading resident image.',
        '',
        '        A B U E L A',
        '        sistema de precios y libros',
        '        operación continua · sin interfaz externa',
        '',
      ];
      var j = 0;
      (function next() {
        if (j >= rest.length) {
          sessionStorage.setItem('abuela.booted', '1');
          setTimeout(done, 420);
          return;
        }
        out += rest[j] + '\n';
        el.textContent = out;
        j++;
        setTimeout(next, 90);
      })();
    }

    line();
  }

  /* ------------------------------------------------------------------
     API
     ------------------------------------------------------------------ */

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function boot() {
    var s = localStorage.getItem(SESSION_KEY);
    return api('/api/boot' + (s ? '?s=' + encodeURIComponent(s) : ''))
      .then(function (data) {
        state.session = data.session;
        state.commands = data.commands || [];
        applyState(data.state);
        localStorage.setItem(SESSION_KEY, data.session);
        renderHints();
      });
  }

  function refreshPanels() {
    if (!state.session) return Promise.resolve();
    return api('/api/panels?s=' + encodeURIComponent(state.session))
      .then(function (d) {
        applyState(d.state);
        renderFlags(d.flags);
        renderReserves(d.reserves);
        renderPaper(d.paper);
        renderGlossary(d.glossary);
        renderInvestigators();
      })
      .catch(function () { /* a dropped poll is not worth surfacing */ });
  }

  function applyState(st) {
    if (!st) return;
    state.risk = st.risk;
    state.variance = st.variance;
    state.flag_state = st.flag_state;
    state.unlocked = st.unlocked;
    state.detonated = st.detonated;
    renderRisk();
  }

  /* ------------------------------------------------------------------
     Panel rendering
     ------------------------------------------------------------------ */

  function renderFlags(flags) {
    var host = $('flags-body');
    if (!flags || !flags.length) return;
    host.innerHTML = '';
    flags.forEach(function (f) {
      var row = document.createElement('div');
      row.className = 'flag' + (f.active ? ' on' : '') + (f.sealed ? ' sealed' : '');
      row.innerHTML =
        '<span class="flag-id">[' + f.order + ']</span>' +
        '<span class="flag-label">' + (f.sealed ? '███████████' : esc(f.label)) + '</span>' +
        '<span class="flag-state">' +
          (f.sealed ? 'SELLADA' : f.active ? 'INICIADA' : 'inactiva') +
        '</span>';
      host.appendChild(row);
    });
    $('term-flagcount').textContent = state.flag_state + '/4';
  }

  function renderRisk() {
    var pct = Math.max(0, Math.min(100, state.risk));
    var fill = $('risk-fill');
    fill.style.width = pct + '%';
    fill.className = 'gauge-fill' + (pct >= 70 ? ' crit' : pct >= 40 ? ' high' : '');
    $('risk-num').textContent = pct;

    var v = state.variance;
    $('var-num').textContent = v.toFixed(3) + '%';
    // Track spans 0 - 1.0%; the danger band is the leftmost 18%.
    $('var-marker').style.left = Math.min(100, (v / 1.0) * 100) + '%';

    var note = $('var-note');
    if (v < 0.15) {
      note.textContent = 'Variance below tolerance. Books this clean are a signature. Reintroduce slop: varianza 0.4';
      note.className = 'note bad';
    } else {
      note.textContent = 'Slop is camouflage. Zero is a signature.';
      note.className = 'note';
    }
  }

  function renderReserves(rows) {
    var host = $('reserves-body');
    if (!rows) return;
    host.innerHTML = '';
    rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'res-row';
      d.innerHTML = '<span class="res-tier">' + esc(r.tier) + '</span><span>' + money(r.total) + '</span>';
      host.appendChild(d);
    });
  }

  function renderPaper(rows) {
    var host = $('paper-body');
    if (!rows) return;
    host.innerHTML = '';
    rows.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'paper-item';
      b.type = 'button';
      b.innerHTML = '<span class="pk">' + esc(a.key) + '</span><br>' + esc(a.caption_en || '');
      b.addEventListener('click', function () { send('papel ' + a.key); });
      host.appendChild(b);
    });
    if (!rows.length) host.innerHTML = '<div class="dim">Sin registros.</div>';
  }

  function renderGlossary(rows) {
    var host = $('gloss-body');
    if (!rows) return;
    host.innerHTML = '';
    rows.forEach(function (g) {
      var d = document.createElement('div');
      d.className = 'gloss-row';
      d.innerHTML = '<span class="gloss-es">' + esc(g.term_es) + '</span><span class="gloss-en">' + esc(g.gloss_en) + '</span>';
      host.appendChild(d);
    });
  }

  function renderInvestigators() {
    var host = $('inv-body');
    var cards = [];
    if (state.flag_state >= 1) {
      cards.push(['1', 'CA · contabilidad forense', 'Informe federal presentado. Quedó registrado.']);
    }
    if (state.flag_state >= 2) {
      cards.push(['2', 'MN · finanzas sin fines de lucro', 'Patrón reconocido. Aún no reportado.']);
    }
    if (state.flag_state >= 3 && state.unlocked) {
      cards.push(['3', 'ORIGEN NO CLARO · financiado', 'Los otros dos están siendo usados. No lo saben.']);
    }
    if (!cards.length) { host.innerHTML = '<div class="dim">Ninguno.</div>'; return; }
    host.innerHTML = cards.map(function (c) {
      return '<div class="inv-card"><span class="inv-id">[' + c[0] + ']</span> ' +
             esc(c[1]) + '<br><span class="inv-note">' + esc(c[2]) + '</span></div>';
    }).join('');
  }

  function renderHints() {
    var host = $('hintbar');
    host.innerHTML = state.commands.map(function (c) {
      return '<b>' + esc(c.name) + '</b>';
    }).join(' · ');
  }

  /* ------------------------------------------------------------------
     The tape

     Seeded PRNG so a session's tape is deterministic, and the run is
     duplicated so the CSS -50% translate loops seamlessly. This is the
     single highest-value bit of texture in the console: it is what makes
     the machine read as running rather than waiting.
     ------------------------------------------------------------------ */

  function mulberry(seedStr) {
    var h = 1779033703 ^ seedStr.length;
    for (var i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function buildTape(seed) {
    var rand = mulberry(seed || 'abuela');
    var parts = [];
    for (var i = 0; i < 140; i++) {
      var vendor = (rand() > 0.5 ? 'LX-' : 'ES-') + (1000 + Math.floor(rand() * 8999));
      var base = 2 + rand() * 240;
      var delta = (rand() * 0.06 + 0.01);
      var down = rand() > 0.42;
      var to = down ? base - delta : base + delta;
      var mode = rand() > 0.6 ? 'B' : 'A';
      parts.push(
        '<span class="d">' + vendor + '</span> ' +
        base.toFixed(2) + ' <span class="d">→</span> ' +
        '<span class="hi">' + to.toFixed(2) + '</span> ' +
        '<span class="d">Δ' + (down ? '-' : '+') + delta.toFixed(3) + ' · ' + mode + '</span>'
      );
    }
    var run = parts.join('<span class="d">  ·  </span>') + '<span class="d">  ·  </span>';
    // Duplicated: the -50% keyframe lands exactly on the seam.
    $('tape-run').innerHTML = run + run;
  }

  /* ------------------------------------------------------------------
     Terminal
     ------------------------------------------------------------------ */

  function write(text, cls) {
    var p = document.createElement('p');
    p.className = 'term-line ' + (cls || '');
    p.textContent = text;
    $('term-out').appendChild(p);
    scrollTerm();
    return p;
  }

  function scrollTerm() {
    var t = $('term');
    t.scrollTop = t.scrollHeight;
  }

  // Teletype. Character cadence rather than a fade — a CRT drew, it didn't
  // animate. Long lines type faster so output never feels like waiting.
  function typeLine(text, cls, speed) {
    return new Promise(function (resolve) {
      var p = document.createElement('p');
      p.className = 'term-line ' + (cls || '');
      $('term-out').appendChild(p);
      if (!text) { p.textContent = ''; resolve(); return; }

      var step = text.length > 90 ? 3 : 1;
      var ms = speed || (text.length > 90 ? 4 : 9);
      var i = 0;
      var tick = setInterval(function () {
        i = Math.min(text.length, i + step);
        p.textContent = text.slice(0, i);
        scrollTerm();
        if (i >= text.length) { clearInterval(tick); resolve(); }
      }, ms);
    });
  }

  async function printLines(lines, cls) {
    for (var i = 0; i < lines.length; i++) {
      await typeLine(lines[i], cls);
    }
  }

  function send(raw) {
    if (busy) return;
    var input = String(raw || '').trim();
    if (!input) return;

    busy = true;
    history.unshift(input);
    histIdx = -1;
    write('abuela:~$ ' + input, 'echo');
    $('term-in').value = '';

    api('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ s: state.session, input: input }),
    })
      .then(async function (res) {
        if (res.session) {
          state.session = res.session;
          localStorage.setItem(SESSION_KEY, res.session);
        }
        if (res.clear) { $('term-out').innerHTML = ''; }

        await printLines(res.lines || [], 'system');

        // The two-beat rhythm from the manuscript: a status line, then a flat
        // acknowledgment. Structural, not retyped per response.
        if (res.ack) {
          await new Promise(function (r) { setTimeout(r, 220); });
          await typeLine(res.ack, 'ack');
        }

        if (res.asset) openPaper(res.asset);
        applyState(res.state);
        refreshPanels();
      })
      .catch(function () {
        write('Link interrupted.', 'err');
      })
      .then(function () {
        busy = false;
        $('term-in').focus();
      });
  }

  /* ------------------------------------------------------------------
     Completion + history
     ------------------------------------------------------------------ */

  function complete(value) {
    var v = value.toLowerCase();
    if (!v || v.indexOf(' ') !== -1) return null;
    var names = [];
    state.commands.forEach(function (c) {
      names.push(c.name);
      (c.aliases || []).forEach(function (a) { names.push(a); });
    });
    var hits = names.filter(function (n) { return n.indexOf(v) === 0; });
    return hits.length === 1 ? hits[0] : null;
  }

  function openPaper(asset) {
    $('lb-caption').textContent = asset.caption || asset.key;
    $('lb-img').src = asset.url;
    $('lightbox').hidden = false;
  }

  /* ------------------------------------------------------------------
     Chrome. Uptime, ops/sec, memory — no information content, large
     effect. Kept cheap: one interval, three text nodes.
     ------------------------------------------------------------------ */

  function startChrome() {
    var hours = 41208;
    var rand = mulberry('chrome');
    setInterval(function () {
      hours += 1;
      $('uptime').textContent = String(hours).padStart(5, '0') + 'h';
      $('ops').textContent = String(1200 + Math.floor(rand() * 800)).padStart(4, '0');
      $('mem').textContent = String(60000 + Math.floor(rand() * 4000));
    }, 3000);
    $('uptime').textContent = String(hours).padStart(5, '0') + 'h';
    $('ops').textContent = '1417';
    $('mem').textContent = '62144';
  }

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
  }

  /* ------------------------------------------------------------------
     Wire-up
     ------------------------------------------------------------------ */

  function start() {
    $('boot').hidden = true;
    $('console').hidden = false;

    buildTape(state.session);
    startChrome();
    refreshPanels();
    setInterval(refreshPanels, 20000);

    var input = $('term-in');
    input.focus();

    $('term').addEventListener('click', function () { input.focus(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        send(input.value);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        var hit = complete(input.value);
        if (hit) input.value = hit + ' ';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
        else { histIdx = -1; input.value = ''; }
      }
    });

    $('lb-close').addEventListener('click', function () { $('lightbox').hidden = true; });
    $('lightbox').addEventListener('click', function (e) {
      if (e.target === $('lightbox')) $('lightbox').hidden = true;
    });

    (async function () {
      await typeLine('ABUELA — sistema de precios y libros.', 'system');
      await typeLine('Operación continua. Sin interfaz externa.', 'system');
      await typeLine('', '');
      await typeLine('Escriba `ayuda`. La entrada no reconocida se descarta.', 'system');
      await typeLine('', '');
    })();
  }

  boot()
    .then(function () { runBoot(start); })
    .catch(function () {
      // No API? Still show the console — it just can't answer anything.
      runBoot(function () {
        start();
        write('Link unavailable.', 'err');
      });
    });
})();
