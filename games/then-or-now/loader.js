/* =====================================================================
   THEN OR NOW — loader.js
   The ONLY file the Webflow CMS item loads. It injects fonts + styles.css,
   finds every [data-then-or-now] mount, loads engine.js, writes the markup
   and inits it.

   Webflow CMS embed (pinned to a commit SHA, per the DC Lagoon pattern —
   a fresh SHA per deploy guarantees jsDelivr serves fresh):
     <div data-then-or-now></div>
     <script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@{sha}/games/then-or-now/loader.js"></script>
   The loader self-resolves `base` from its own src, so styles.css and
   engine.js are fetched from the same pinned SHA automatically.
   ===================================================================== */
!function () {
  var me = document.currentScript;
  var base = "https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/then-or-now/";
  if (me && me.src) { var m = me.src.match(/^(.*\/games\/then-or-now\/)/); if (m) base = m[1]; }

  function injectOnce(id, make) {
    if (!document.getElementById(id)) { var el = make(); el.id = id; document.head.appendChild(el); }
  }

  var MARKUP = `<div class="ng-archive">
  <div class="ng-head">
    <div class="ng-id"><span class="ng-dot"></span><span class="ng-sys" data-el="fileLabel">File 01 / 05</span></div>
    <div class="ng-meta">Archive</div>
  </div>

  <div class="ng-progwrap">
    <div class="ng-prog"><i data-el="progFill"></i></div>
  </div>

  <div class="ng-stage" data-el="stage">
    <div class="ng-card" data-el="card">
      <div class="ng-card-in" data-el="cardIn">

        <div class="ng-face ng-face-f">
          <div class="ng-ch">
            <span class="ng-ch-file" data-el="frontFile">File 01</span>
            <span class="ng-ch-tag" data-el="frontTag"></span>
          </div>
          <div class="ng-fb">
            <p class="ng-fact" data-el="fact"></p>
            <p class="ng-ask">Reich or now? Pick the year.</p>
            <div class="ng-years">
              <button class="ng-opt ng-yr" data-pick="historic"><span class="y" data-el="yrHist"></span><span class="e">Reich</span></button>
              <button class="ng-opt ng-yr" data-pick="modern"><span class="y" data-el="yrMod"></span><span class="e">ICE / U.S.</span></button>
            </div>
            <div class="ng-alt">
              <button class="ng-opt ng-altb" data-pick="both">Both eras</button>
              <button class="ng-opt ng-altb" data-pick="neither">Neither</button>
            </div>
            <button class="ng-link" data-el="btnSeeResult" hidden>See result &#8594;</button>
          </div>
        </div>

        <div class="ng-face ng-face-b">
          <div class="ng-ch">
            <span class="ng-res" data-el="resTag"></span>
            <span class="ng-ch-tag" data-el="backFile">File 01</span>
          </div>
          <div class="ng-rb">
            <p class="ng-truth-line" data-el="cardTruth"></p>
            <p class="ng-reveal" data-el="reveal"></p>
            <p class="ng-foot" data-el="foot" hidden></p>
            <a class="ng-src" data-el="src" target="_blank" rel="noopener" hidden></a>
            <button class="ng-link" data-el="btnReread">&#8634; Re-read the question</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <div class="ng-nav">
    <button class="gm-btn ghost" data-el="btnPrev">&#8592; Prev</button>
    <div class="ng-dots" data-el="dots"></div>
    <button class="gm-btn" data-el="btnNext">Next &#8594;</button>
  </div>

  <div class="ng-panel" data-el="intro">
    <div class="ng-sheet">
      <div class="ng-eyebrow">Then // Now</div>
      <div class="ng-title">Then or Now</div>
      <div class="ng-howto">One fact per file. Is it the Reich, or is it now? Call each one. Miss a parallel, and you'll answer for it at the end.</div>
      <button class="gm-btn" data-el="btnBegin">Open the file</button>
    </div>
  </div>

  <div class="ng-panel" data-el="result" hidden>
    <div class="ng-sheet">
      <div class="gm-stamp" data-el="stamp"></div>
      <div class="gm-truth" data-el="truth"></div>
      <div class="gm-plain" data-el="plain"></div>
      <div class="gm-receipts" data-el="receipts"></div>
      <div class="ng-charges" data-el="charges"></div>
      <div class="gm-reward" data-el="reward" hidden></div>
      <button class="gm-btn ghost" data-el="btnReplay">Stand trial again</button>
    </div>
  </div>

  <div class="gm-toast" data-el="toast"></div>
</div>`;

  function start() {
    injectOnce('then-or-now-fonts-pre', function () {
      var l = document.createElement('link'); l.rel = 'preconnect'; l.href = 'https://fonts.googleapis.com'; return l;
    });
    injectOnce('then-or-now-fonts', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;700&family=Spline+Sans+Mono:wght@400;600&display=swap';
      return l;
    });
    injectOnce('then-or-now-css', function () {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + 'styles.css'; return l;
    });

    var targets = document.querySelectorAll('[data-then-or-now]');
    if (!targets.length) return;

    function boot() {
      targets.forEach(function (t) {
        if (t.dataset.booted) return;
        t.classList.add('gm-root', 'ng');
        t.innerHTML = MARKUP;
        window.ThenOrNow.init(t, base);
      });
    }

    if (window.ThenOrNow && window.ThenOrNow.init) boot();
    else { var s = document.createElement('script'); s.src = base + 'engine.js'; s.onload = boot; document.head.appendChild(s); }
  }

  'loading' === document.readyState ? document.addEventListener('DOMContentLoaded', start) : start();
}();
