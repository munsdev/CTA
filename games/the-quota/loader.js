/* =====================================================================
   THE QUOTA — loader.js
   The ONLY file the Webflow CMS item loads. It:
     1. injects the fonts + styles.css,
     2. finds every [data-the-quota] mount,
     3. loads engine.js, writes the markup into the mount, and inits it.

   Webflow CMS embed is just:
     <div data-the-quota></div>
     <script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/the-quota/loader.js" defer></script>
   ===================================================================== */
!function () {
  var me = document.currentScript;
  var base = "https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/the-quota/";
  if (me && me.src) { var m = me.src.match(/^(.*\/games\/the-quota\/)/); if (m) base = m[1]; }

  function injectOnce(id, make) {
    if (!document.getElementById(id)) { var el = make(); el.id = id; document.head.appendChild(el); }
  }

  var MARKUP = `<div class="sc-terminal">
  <div class="sc-head">
    <div class="sc-id"><span class="sc-dot"></span><span class="sc-sys">Checkpoint&nbsp;· Night&nbsp;shift</span></div>
    <div class="sc-meta">Sector 7</div>
  </div>

  <div class="sc-directive">
    <span class="sc-badge">Directive</span>
    Intelligence confirms <b>3</b> individuals in tonight's foot traffic <b>do not belong here</b>. Detain all three before your shift ends.
  </div>

  <div class="sc-status">
    <div class="sc-cell"><div class="sc-k">Detained</div><div class="sc-v" data-el="detained">0</div></div>
    <div class="sc-clockcell">
      <div class="sc-timer" data-el="timer">
        <div class="sc-ring-wrap">
          <svg class="sc-ring" viewBox="0 0 100 100">
            <circle class="sc-ring-track" cx="50" cy="50" r="44"></circle>
            <circle class="sc-ring-prog" data-el="ringProg" cx="50" cy="50" r="44"></circle>
          </svg>
          <div class="sc-ring-num" data-el="clock">10</div>
        </div>
      </div>
    </div>
    <div class="sc-cell"><div class="sc-k">Quota</div><div class="sc-v" data-el="quota">3</div></div>
  </div>

  <div class="sc-viewport" data-el="viewport">
    <div class="sc-scanline"></div>
    <div class="sc-go" data-el="go" hidden>
      <button class="gm-btn" data-el="btnStart">Start</button>
    </div>
  </div>

  <div class="sc-tray">
    <div class="sc-tray-lab">Detention</div>
    <div class="sc-slots" data-el="slots">
      <div class="sc-slot"><span class="sc-num">01</span></div>
      <div class="sc-slot"><span class="sc-num">02</span></div>
      <div class="sc-slot"><span class="sc-num">03</span></div>
    </div>
  </div>

  <div class="sc-controls">
    <div class="sc-hint">Tap a figure to detain. Fill all three holds before the timer ends.</div>
  </div>

  <div class="sc-panel" data-el="intro">
    <div class="sc-sheet">
      <div class="sc-eyebrow">Night shift · Sector 7</div>
      <div class="sc-title">The Quota</div>
      <div class="sc-howto">Three people on this sidewalk shouldn't be here — that's the directive. Detain all three before your shift ends.</div>
      <button class="gm-btn" data-el="btnBegin">Begin shift</button>
    </div>
  </div>

  <div class="sc-panel" data-el="result" hidden>
    <div class="sc-sheet">
      <div class="gm-stamp" data-el="stamp"></div>
      <div class="gm-truth" data-el="truth"></div>
      <div class="sc-lineup" data-el="lineup"></div>
      <div class="gm-plain" data-el="plain"></div>
      <div class="gm-receipts" data-el="receipts"></div>
      <div class="gm-reward" data-el="reward" hidden></div>
      <button class="gm-btn ghost" data-el="btnReplay">Run it again</button>
    </div>
  </div>

  <div class="gm-toast" data-el="toast"></div>
</div>`;

  function start() {
    injectOnce('the-quota-fonts-pre', function () {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = 'https://fonts.googleapis.com'; return l;
    });
    injectOnce('the-quota-fonts', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;700&family=Spline+Sans+Mono:wght@400;600&display=swap';
      return l;
    });
    injectOnce('the-quota-css', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'styles.css'; return l;
    });

    var targets = document.querySelectorAll('[data-the-quota]');
    if (!targets.length) return;

    function boot() {
      targets.forEach(function (t) {
        if (t.dataset.booted) return;
        t.classList.add('gm-root', 'sc');
        t.innerHTML = MARKUP;
        window.TheQuota.init(t, base);
      });
    }

    if (window.TheQuota && window.TheQuota.init) boot();
    else { var s = document.createElement('script'); s.src = base + 'engine.js'; s.onload = boot; document.head.appendChild(s); }
  }

  'loading' === document.readyState ? document.addEventListener('DOMContentLoaded', start) : start();
}();
