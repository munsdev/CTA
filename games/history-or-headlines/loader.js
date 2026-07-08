/* =====================================================================
   HISTORY OR HEADLINES — loader.js
   The ONLY file the Webflow CMS item loads. It injects fonts + styles.css,
   finds every [data-history-or-headlines] mount, loads engine.js, writes
   the markup and inits it.

   Webflow CMS embed (pinned to a commit SHA, per the DC Lagoon pattern —
   a fresh SHA per deploy guarantees jsDelivr serves fresh):
     <div data-history-or-headlines></div>
     <script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@{sha}/games/history-or-headlines/loader.js"></script>
   The loader self-resolves `base` from its own src, so styles.css and
   engine.js are fetched from the same pinned SHA automatically.

   OPTIONAL PAGE CONTROLS — add to any Webflow element:
     data-hoh-reset     -> send the game back to its start screen
     gm-reset-button    -> same (house-wide convention)
   No pause control: this game is step-by-step, nothing runs to pause.
   ===================================================================== */
!function () {
  var me = document.currentScript;
  var base = "https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/history-or-headlines/";
  if (me && me.src) { var m = me.src.match(/^(.*\/games\/history-or-headlines\/)/); if (m) base = m[1]; }

  function injectOnce(id, make) {
    if (!document.getElementById(id)) { var el = make(); el.id = id; document.head.appendChild(el); }
  }

  var MARKUP = `<div class="hh-archive">
  <div class="hh-head">
    <div class="hh-id"><span class="hh-dot"></span><span class="hh-sys" data-el="fileLabel">File 01 / 05</span></div>
    <div class="hh-meta">Archive</div>
  </div>

  <div class="hh-progwrap">
    <div class="hh-prog"><i data-el="progFill"></i></div>
  </div>

  <div class="hh-stage" data-el="stage">
    <div class="hh-card" data-el="card">
      <div class="hh-card-in">

        <div class="hh-face hh-face-f">
          <div class="hh-ch">
            <span class="hh-ch-file" data-el="frontFile">File 01</span>
            <span class="hh-ch-tag" data-el="frontTag"></span>
          </div>
          <div class="hh-fb">
            <p class="hh-fact" data-el="fact"></p>
            <p class="hh-ask">Did this happen in Nazi Germany, or is it happening now?</p>
            <div class="hh-years">
              <button class="hh-opt hh-yr" data-pick="historic"><span class="y" data-el="yrHist"></span><span class="e">Nazi Germany</span></button>
              <button class="hh-opt hh-yr" data-pick="modern"><span class="y" data-el="yrMod"></span><span class="e">U.S. today</span></button>
            </div>
            <div class="hh-alt">
              <button class="hh-opt hh-altb" data-pick="both">Both eras</button>
              <button class="hh-opt hh-altb" data-pick="neither">Neither</button>
            </div>
            <button class="hh-link" data-el="btnSeeResult" hidden>See result &#8594;</button>
          </div>
        </div>

        <div class="hh-face hh-face-b">
          <div class="hh-ch">
            <span class="hh-res" data-el="resTag"></span>
            <span class="hh-ch-tag" data-el="backFile">File 01</span>
          </div>
          <div class="hh-rb">
            <p class="hh-truth-line" data-el="cardTruth"></p>
            <p class="hh-reveal" data-el="reveal"></p>
            <p class="hh-foot" data-el="foot" hidden></p>
            <a class="hh-src" data-el="src" target="_blank" rel="noopener" hidden></a>
            <button class="hh-link" data-el="btnReread">&#8634; Re-read the question</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <div class="hh-nav">
    <button class="gm-btn ghost" data-el="btnPrev">&#8592; Prev</button>
    <div class="hh-dots" data-el="dots"></div>
    <button class="gm-btn" data-el="btnNext">Next &#8594;</button>
  </div>

  <div class="hh-panel" data-el="intro">
    <button class="hh-gear" data-el="btnGear" type="button" aria-label="Settings" title="Settings">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8.6 4.4l1.7 1.3-1.7 3-2-.8a7.6 7.6 0 0 1-1.8 1l-.3 2.1h-3.4l-.3-2.1a7.6 7.6 0 0 1-1.8-1l-2 .8-1.7-3 1.7-1.3a7.7 7.7 0 0 1 0-2.1L5.3 9.5l1.7-3 2 .8a7.6 7.6 0 0 1 1.8-1l.3-2.1h3.4l.3 2.1a7.6 7.6 0 0 1 1.8 1l2-.8 1.7 3-1.7 1.3a7.7 7.7 0 0 1 0 2.1z"
              fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="hh-sheet">
      <div class="hh-eyebrow">History // Headlines</div>
      <div class="hh-title">History or Headlines</div>
      <div class="hh-howto">Each card describes one real thing a government did. You decide: was this Nazi Germany, or is this the United States right now? Some are both. Some are neither.</div>

      <div class="hh-settings" data-el="settings" hidden>
        <div class="hh-set-row">
          <span class="hh-set-lab">Files per round</span>
          <div class="hh-stepper">
            <button type="button" data-el="fewer" aria-label="Fewer files">&#8722;</button>
            <b data-el="countVal">5</b>
            <button type="button" data-el="more" aria-label="More files">&#43;</button>
          </div>
        </div>
        <div class="hh-set-note" data-el="countNote"></div>
      </div>

      <button class="gm-btn" data-el="btnBegin">Open the file</button>
    </div>
  </div>

  <div class="hh-panel" data-el="result" hidden>
    <div class="hh-sheet">
      <div class="gm-stamp" data-el="stamp"></div>
      <div class="gm-truth" data-el="truth"></div>
      <div class="gm-plain" data-el="plain"></div>
      <div class="gm-receipts" data-el="receipts"></div>
      <ul class="hh-charges" data-el="charges"></ul>
      <div class="gm-reward" data-el="reward" hidden></div>
      <button class="gm-btn ghost" data-el="btnReplay">Stand trial again</button>
    </div>
  </div>

  <div class="gm-toast" data-el="toast"></div>
</div>`;

  function start() {
    injectOnce('hoh-fonts-pre', function () {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = 'https://fonts.googleapis.com'; return l;
    });
    injectOnce('hoh-fonts', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;700&family=Spline+Sans+Mono:wght@400;600&display=swap';
      return l;
    });
    injectOnce('hoh-css', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'styles.css'; return l;
    });

    var targets = document.querySelectorAll('[data-history-or-headlines]');
    if (!targets.length) return;

    function boot() {
      targets.forEach(function (t) {
        if (t.dataset.booted) return;
        t.classList.add('gm-root', 'hh');
        t.innerHTML = MARKUP;
        window.HistoryOrHeadlines.init(t, base);
      });
    }

    if (window.HistoryOrHeadlines && window.HistoryOrHeadlines.init) boot();
    else { var s = document.createElement('script'); s.src = base + 'engine.js'; s.onload = boot; document.head.appendChild(s); }
  }

  'loading' === document.readyState ? document.addEventListener('DOMContentLoaded', start) : start();
}();
