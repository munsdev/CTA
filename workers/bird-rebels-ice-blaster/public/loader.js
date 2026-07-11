// ============================================================================
// Bird Rebels: Ice Blaster — loader (technical name "rebel-loon" kept for the Worker/bucket/DB, only the on-screen title changed)
// This is the ONLY file the Webflow embed loads directly. It injects the
// stylesheet, finds (or creates) the mount point, then loads engine.js,
// which builds the game's markup and boots it.
//
// Webflow embed:
//   <div data-rl-mount></div>
//   <script src="https://YOUR-WORKER-SUBDOMAIN.workers.dev/loader.js"></script>
// ============================================================================
(function () {
  var thisScript = document.currentScript;
  var BASE = thisScript ? thisScript.src.replace(/\/loader\.js.*$/, '') : '';

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = BASE + '/styles.css';
  document.head.appendChild(link);

  // Prefer an explicit mount point; fall back to inserting one right after
  // this script tag so a bare `<script src="...loader.js">` still works.
  var mount = document.querySelector('[data-rl-mount]');
  if (!mount) {
    mount = document.createElement('div');
    mount.setAttribute('data-rl-mount', '');
    if (thisScript && thisScript.parentNode) {
      thisScript.parentNode.insertBefore(mount, thisScript.nextSibling);
    } else {
      document.body.appendChild(mount);
    }
  }
  mount.setAttribute('data-rl-base', BASE);

  var engine = document.createElement('script');
  engine.src = BASE + '/engine.js';
  document.body.appendChild(engine);
})();
