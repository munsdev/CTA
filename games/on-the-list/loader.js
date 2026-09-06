/* On the List — the only file the CMS loads.

   Injects the font and stylesheet, finds every [data-on-the-list] mount, writes
   the markup, loads engine.js and calls init. Resolves its own base URL from
   its script src, so a pinned SHA carries through to the sibling files. */
!function () {
  'use strict';

  var me = document.currentScript;
  var base = 'https://cdn.jsdelivr.net/gh/munsdev/CTA@main/games/on-the-list/';
  if (me && me.src) {
    var m = me.src.match(/^(.*\/on-the-list\/)/);
    if (m) base = m[1];
  }

  function injectOnce(id, make) {
    if (document.getElementById(id)) return;
    var node = make();
    node.id = id;
    document.head.appendChild(node);
  }

  var MARKUP =
    '<div class="ol-ov" data-el="ovTitle">' +
      '<div class="ol-eyebrow">Warrant service &middot; day shift</div>' +
      '<div class="ol-title">ON THE LIST</div>' +
      '<div class="ol-howto">Everyone out here is on the list. Cuff them one at a time &mdash; ' +
        'each arrest joins the column behind you, and the column is what you have to steer around.</div>' +
      '<div class="ol-pick"><span class="ol-pick-lbl">Who is serving</span>' +
        '<div class="ol-officers" data-el="officers"></div></div>' +
      '<button class="gm-btn" data-el="btnStart">Start the shift</button>' +
    '</div>' +
    '<div class="ol-ov" data-el="ovPause" hidden>' +
      '<div class="ol-title">PAUSED</div>' +
      '<div class="ol-howto">Arrow keys or tap to steer. Your own column blocks the way.</div>' +
      '<div class="ol-btns">' +
        '<button class="gm-btn" data-el="btnResume">Resume</button>' +
        '<button class="gm-btn ghost" data-el="btnQuit">End shift</button>' +
      '</div>' +
    '</div>' +
    '<div class="ol-ov" data-el="ovEnd" hidden>' +
      '<div class="gm-stamp" data-el="stamp"></div>' +
      '<div class="gm-truth" data-el="truth"></div>' +
      '<div class="gm-plain" data-el="plain"></div>' +
      '<div class="gm-receipts" data-el="receipts"></div>' +
      '<div class="gm-reward" data-el="reward" hidden></div>' +
      '<div class="ol-btns">' +
        '<button class="gm-btn" data-el="btnReplay">Work another shift</button>' +
        '<button class="gm-btn ghost" data-el="btnChange">Change officer</button>' +
      '</div>' +
    '</div>' +
    '<button class="ol-fab" data-el="btnPause" title="Pause" hidden>PAUSE</button>' +
    '<div class="gm-toast" data-el="toast"></div>';

  function start() {
    injectOnce('on-the-list-fonts-pre', function () {
      var l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = 'https://fonts.googleapis.com';
      return l;
    });
    injectOnce('on-the-list-fonts', function () {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      return l;
    });
    injectOnce('on-the-list-css', function () {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = base + 'styles.css';
      return l;
    });

    var targets = document.querySelectorAll('[data-on-the-list]');
    if (!targets.length) return;

    var booted = false;
    function boot() {
      if (booted) return;
      booted = true;
      Array.prototype.forEach.call(targets, function (target) {
        target.classList.add('gm-root', 'ol');
        target.innerHTML = '<div class="ol-stage" data-el="stage">' + MARKUP + '</div>';
        window.OnTheList.init(target, base);
        wirePageControls(target);
      });
    }

    /* Any element on the Webflow page can drive the game. */
    function wirePageControls(root) {
      function on(selector, fn) {
        document.querySelectorAll(selector).forEach(function (node) {
          node.addEventListener('click', function (ev) { ev.preventDefault(); fn(); });
        });
      }
      on('[data-otl-reset], [gm-reset-button]', function () { if (root.otlReset) root.otlReset(); });
      on('[data-otl-pause]', function () { if (root.otlPause) root.otlPause(); });
    }

    if (window.OnTheList && window.OnTheList.init) {
      boot();
    } else {
      var s = document.createElement('script');
      s.src = base + 'engine.js';
      s.onload = boot;
      document.head.appendChild(s);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}();
