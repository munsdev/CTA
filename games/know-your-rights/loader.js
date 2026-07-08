/* =====================================================================
   KNOW YOUR RIGHTS — loader.js   (door slice)
   The only file the Webflow CMS item loads. Injects fonts + styles.css,
   finds [data-know-your-rights] mounts, loads engine.js, writes markup,
   inits. Self-resolves base from its own src.

   CMS embed (pin to a commit SHA so jsDelivr serves fresh):
     <div data-know-your-rights></div>
     <script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@{sha}/games/know-your-rights/loader.js"></script>

   Boot gate: inline minimal CSS synchronously, hold markup under a
   loading screen, reveal once styles + fonts settle (or 4s timeout).
   PAGE CONTROLS: data-kyr-reset / gm-reset-button -> title.
   ===================================================================== */
!function () {
  var me = document.currentScript;
  var base = "https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/know-your-rights/";
  if (me && me.src) { var m = me.src.match(/^(.*\/games\/know-your-rights\/)/); if (m) base = m[1]; }
  var READY_TIMEOUT = 4000;

  var BOOT_CSS =
    '[data-know-your-rights]{position:relative;min-height:320px;}' +
    '[data-know-your-rights]:not(.pr-ready) .pr-frame{visibility:hidden;}' +
    '[data-know-your-rights] .pr-loader{position:absolute;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:#05070d;transition:opacity .35s ease;}' +
    '[data-know-your-rights] .pr-loader.is-gone{opacity:0;pointer-events:none;}' +
    '[data-know-your-rights] .pr-loader-txt{font-family:"Archivo Narrow",system-ui,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.32em;font-size:12px;color:#5e6a86;animation:pr-pulse 1.25s ease-in-out infinite;}' +
    '@keyframes pr-pulse{0%,100%{opacity:.32}50%{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){[data-know-your-rights] .pr-loader-txt{animation:none;opacity:.75}}';

  function injectOnce(id, make){ var f=document.getElementById(id); if(f) return f; var el=make(); el.id=id; document.head.appendChild(el); return el; }

  var MARKUP = `<div class="pr-frame">

  <div class="pr-screen" data-el="title">
    <div class="pr-titlecard">
      <div class="pr-eyebrow">Know</div>
      <div class="pr-big">Your Rights</div>
      <div class="pr-sub">Learn the lines. Know when to use them.</div>
    </div>
    <div class="pr-difflabel">Timer</div>
    <div class="pr-diff" data-el="diffRow">
      <button type="button" data-diff="easy">Easy<i>20s</i></button>
      <button type="button" data-diff="medium">Medium<i>10s</i></button>
      <button type="button" data-diff="hard">Hard<i>5s</i></button>
      <button type="button" data-diff="practice">Practice<i>off</i></button>
    </div>
    <div class="pr-difflabel">Time of day</div>
    <div class="pr-diff two" data-el="lightRow">
      <button type="button" data-light="day">Day</button>
      <button type="button" data-light="night">Night</button>
    </div>
    <div class="pr-menulist" data-el="menuList"></div>
    <div class="pr-menufoot">Educational. Not legal advice.</div>
  </div>

  <div class="pr-screen" data-el="game" hidden>
    <div class="pr-hud">
      <button class="pr-rec" data-el="btnRec" type="button"><i class="dot"></i><span>REC</span></button>
      <span class="pr-scene" data-el="sceneName"></span>
      <span class="pr-dots" data-el="beatDots"></span>
      <button class="pr-hud-btn" data-el="btnHint" type="button">Hint</button>
      <button class="pr-x" data-el="btnQuit" type="button" aria-label="Back to title">&#215;</button>
    </div>
    <div class="pr-view"><canvas data-el="canvas" width="160" height="144" aria-hidden="true"></canvas></div>
    <div class="pr-timer">
      <span class="pr-count" data-el="count"></span>
      <div class="pr-bar-track"><div class="pr-bar" data-el="bar"></div></div>
    </div>
    <div class="pr-box" data-el="box">
      <div class="pr-line">
        <span class="pr-speaker" data-el="speaker">IMMIGRATION</span>
        <p class="pr-text" data-el="text"></p>
        <span class="pr-more" data-el="more" hidden>&#9660;</span>
      </div>
      <div class="pr-opts" data-el="opts" hidden></div>
    </div>
  </div>

  <div class="pr-screen pr-end" data-el="result" hidden>
    <div class="gm-stamp" data-el="stamp"></div>
    <div class="gm-truth" data-el="truth"></div>
    <div class="pr-card">
      <div class="pr-cardhead">What you could have done</div>
      <ul class="pr-list" data-el="list"></ul>
    </div>
    <div class="gm-plain" data-el="plain"></div>
    <div class="gm-reward" data-el="reward" hidden></div>
    <div class="pr-endbtns">
      <button class="gm-btn" data-el="btnReplay" type="button">Play it again</button>
      <button class="gm-btn ghost" data-el="btnTitle" type="button">Title</button>
    </div>
  </div>
</div>

<div class="pr-loader" data-el="loader"><div class="pr-loader-txt">Loading</div></div>`;

  function start() {
    injectOnce('kyr-boot', function(){ var s=document.createElement('style'); s.textContent=BOOT_CSS; return s; });
    injectOnce('kyr-fonts-pre', function(){ var l=document.createElement('link'); l.rel='preconnect'; l.href='https://fonts.googleapis.com'; return l; });
    injectOnce('kyr-fonts', function(){ var l=document.createElement('link'); l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;700&family=Spline+Sans+Mono:wght@400;600&display=swap'; return l; });
    var cssLink = injectOnce('kyr-css', function(){ var l=document.createElement('link'); l.rel='stylesheet'; l.href=base+'styles.css'; return l; });

    var targets = document.querySelectorAll('[data-know-your-rights]');
    if (!targets.length) return;

    function boot(){
      targets.forEach(function(t){ if (t.dataset.booted) return;
        t.classList.add('gm-root','pr'); t.innerHTML=MARKUP; window.KnowYourRights.init(t, base); });
      whenReady(reveal);
    }
    function whenReady(cb){
      var fired=false, pending=2;
      function done(){ if(!fired && --pending<=0){ fired=true; cb(); } }
      if (cssLink.sheet) done(); else { cssLink.addEventListener('load',done); cssLink.addEventListener('error',done); }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(done,done); else done();
      setTimeout(function(){ if(!fired){ fired=true; cb(); } }, READY_TIMEOUT);
    }
    function reveal(){
      targets.forEach(function(t){ t.classList.add('pr-ready');
        var ld=t.querySelector('.pr-loader'); if(!ld) return; ld.classList.add('is-gone');
        setTimeout(function(){ ld.hidden=true; }, 400); });
    }
    if (window.KnowYourRights && window.KnowYourRights.init) boot();
    else { var s=document.createElement('script'); s.src=base+'engine.js'; s.onload=boot; document.head.appendChild(s); }
  }
  'loading'===document.readyState ? document.addEventListener('DOMContentLoaded', start) : start();
}();
