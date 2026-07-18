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
  // Neither ice cubes nor the player's aim/firing position can enter the
  // outer edges of the play field — otherwise a cube (especially one
  // pushed by Rainbow Blizzard wind) can end up effectively untouchable
  // if it's beyond where the player is allowed to aim. 0.08 = 8% inset on
  // each side, the middle of the requested 5-10% range.
  var PLAY_AREA_EDGE_INSET_RATIO = 0.08;
  // Rainbow Blizzard Mode only: max cumulative horizontal drift a cube can
  // pick up over a full top-to-bottom fall, as a fraction of stage width.
  var WIND_MAX_RATIO = { easy: 0.10, medium: 0.20, hard: 0.60 }; // doubled for Rainbow Blizzard Mode
  var DEFAULT_TIER = 'medium';
  // Persistent, on-device developer log — captures sign-in/purchase events
  // with timestamps directly in localStorage, viewable via a hidden
  // Settings screen (tap the Settings heading 8 times). Exists because
  // chrome://inspect/adb aren't practical for on-the-go phone-only
  // testing. Ring-buffered to 200 entries so it can't grow unbounded.
  var DEVLOG_KEY = 'rl_devlog_v1';
  var DEVLOG_MAX_ENTRIES = 200;
  function devLog(msg) {
    try {
      var entries = JSON.parse(localStorage.getItem(DEVLOG_KEY) || '[]');
      if (!Array.isArray(entries)) entries = [];
      entries.push(new Date().toISOString().slice(11, 19) + '  ' + msg);
      if (entries.length > DEVLOG_MAX_ENTRIES) entries = entries.slice(entries.length - DEVLOG_MAX_ENTRIES);
      localStorage.setItem(DEVLOG_KEY, JSON.stringify(entries));
    } catch (e) {}
    // Still logs to console too, for anyone who DOES have chrome://inspect
    // available — this doesn't replace that, just adds a path that works
    // without it.
    try { console.log('[devlog] ' + msg); } catch (e) {}
  }
  var MAX_LIVES = 5;
  var START_LIVES = 3;

  // ---------- translations ----------
  // English is the base/fallback set — every key must exist here. Other
  // languages only need to list what actually differs from English;
  // applyLanguage() falls back to the English string for any key a
  // language doesn't override, so a partial translation never breaks.
  var I18N = {
    en: {
      selectYourRebel: 'Select Your Rebel', loadingRoster: 'Loading roster…',
      getMoreRebels: 'Get More Rebels', difficulty: 'Difficulty', scene: 'Scene',
      startGame: 'Start Game', finish: 'Finish', pause: 'Pause',
      hudMelted: 'Melted<br><b data-rl-score>0</b>', hudEscaped: 'Escaped<br><b data-rl-escaped>0</b>',
      blizzardBannerText: '❄️ Rainbow Blizzard Mode', pauseHint: 'move to aim · tap / click / space to fire',
      paused: 'Paused', resume: 'Resume', restartRun: 'Restart Run', reset: 'Reset',
      meltedThrough: 'Melted Through!', iceCubesMelted: 'Ice cubes melted<b data-rl-final-score>0</b>',
      accuracy: 'Accuracy<b data-rl-final-accuracy>0%</b>', saveScore: 'Save Score',
      casualNoLeaderboard: 'Casual Mode runs aren\'t added to the leaderboard.', playAgain: 'Play Again',
      leaderboard: 'Leaderboard', tierEasy: 'Easy', tierMedium: 'Medium', tierHard: 'Hard',
      sortBy: 'Sort by', sortScore: 'Score', sortAccuracy: 'Accuracy', sortName: 'Name', sortDate: 'Date',
      loading: 'Loading…', loadMore: 'Load More', back: 'Back',
      about: 'About',
      aboutIce: 'Ice cubes are falling — laser them down before they reach the bottom.',
      aboutSpeed: 'Speed &amp; frequency climb the whole run — faster on Hard, gentler on Easy. Cube size shrinks to its smallest setting, then holds.',
      aboutCasual: '<b>Casual Mode</b> — no life bar, no penalty for missed cubes. Weapon powerups still work normally.',
      aboutBlizzard: '<b>Rainbow Blizzard</b> — swaps your laser for rockets, adds a separate leaderboard.',
      credits: 'Credits',
      creditsTheme: 'Rainbow Blizzard theme: chopped &amp; modified from a track by Emmett Doyle.',
      creditsArt: 'Original Rebel Loon artwork by Casey The American.',
      creditsLink: '<a href="https://birdrebels.art" target="_blank" rel="noopener">birdrebels.art</a> — more Bird Rebels art, merch, and downloads.',
      supportArtist: 'Support the Artist',
      settings: 'Settings', soundEffects: 'Sound Effects', music: 'Music', language: 'Language', vibration: 'Vibration', account: 'Account', notSignedIn: 'Not signed in — sign in with Google to unlock rebels.', signInGoogle: 'Sign in with Google', signOut: 'Sign Out', notNow: 'Not Now', welcomeSignInTitle: 'Sign in with Google', welcomeSignInSub: 'Save your rebels to your account so they\'re never lost, even on a new device.',
      rebelShop: 'Rebel Shop', rebelShopSub: 'Add a rebel to your flock. It\'s yours from here on out.',
      claimCode: 'Claim a Code', purchase: 'Purchase',
      selectScene: 'Select Scene', selectSceneSub: 'Pick which look you want to play.', confirm: 'Confirm',
      difficultySub: 'Pick a challenge level and any extra options.',
      difficultyNote: 'Speed &amp; frequency climb the whole run — faster on Hard, gentler on Easy. Cube size shrinks to its smallest setting, then holds.',
      casualModeLabel: 'Casual Mode<small>No life bar, no penalty for missed cubes — weapon powerups still work normally. Casual Mode runs are not eligible for the leaderboard.</small>',
      menu: 'Menu'
    },
    de: {
      selectYourRebel: 'Wähle deinen Rebellen', loadingRoster: 'Lade Vogelliste…',
      getMoreRebels: 'Mehr Rebellen holen', difficulty: 'Schwierigkeit', scene: 'Szene',
      startGame: 'Spiel starten', finish: 'Beenden', pause: 'Pause',
      hudMelted: 'Geschmolzen<br><b data-rl-score>0</b>', hudEscaped: 'Entkommen<br><b data-rl-escaped>0</b>',
      blizzardBannerText: '❄️ Regenbogen-Blizzard-Modus', pauseHint: 'bewegen zum Zielen · tippen / klicken / Leertaste zum Feuern',
      paused: 'Pausiert', resume: 'Fortsetzen', restartRun: 'Lauf neu starten', reset: 'Zurücksetzen',
      meltedThrough: 'Durchgeschmolzen!', iceCubesMelted: 'Geschmolzene Eiswürfel<b data-rl-final-score>0</b>',
      accuracy: 'Genauigkeit<b data-rl-final-accuracy>0%</b>', saveScore: 'Punktzahl speichern',
      casualNoLeaderboard: 'Läufe im entspannten Modus zählen nicht für die Bestenliste.', playAgain: 'Nochmal spielen',
      leaderboard: 'Bestenliste', tierEasy: 'Leicht', tierMedium: 'Mittel', tierHard: 'Schwer',
      sortBy: 'Sortieren nach', sortScore: 'Punktzahl', sortAccuracy: 'Genauigkeit', sortName: 'Name', sortDate: 'Datum',
      loading: 'Lädt…', loadMore: 'Mehr laden', back: 'Zurück',
      about: 'Über',
      aboutIce: 'Eiswürfel fallen herab — schieß sie ab, bevor sie den Boden erreichen.',
      aboutSpeed: 'Geschwindigkeit &amp; Häufigkeit steigen während des Laufs — schneller bei Schwer, sanfter bei Leicht. Die Würfelgröße schrumpft bis zu einem Minimum und bleibt dann.',
      aboutCasual: '<b>Entspannter Modus</b> — keine Lebensanzeige, keine Strafe für verpasste Würfel. Waffen-Powerups funktionieren normal.',
      aboutBlizzard: '<b>Regenbogen-Blizzard</b> — ersetzt deinen Laser durch Raketen, fügt eine eigene Bestenliste hinzu.',
      credits: 'Mitwirkende',
      creditsTheme: 'Regenbogen-Blizzard-Musik: bearbeitet nach einem Stück von Emmett Doyle.',
      creditsArt: 'Original Rebel-Loon-Artwork von Casey The American.',
      creditsLink: '<a href="https://birdrebels.art" target="_blank" rel="noopener">birdrebels.art</a> — weitere Bird-Rebels-Kunst, Merch und Downloads.',
      supportArtist: 'Den Künstler unterstützen',
      settings: 'Einstellungen', soundEffects: 'Soundeffekte', music: 'Musik', language: 'Sprache', vibration: 'Vibration', account: 'Konto', notSignedIn: 'Nicht angemeldet — mit Google anmelden, um Rebellen freizuschalten.', signInGoogle: 'Mit Google anmelden', signOut: 'Abmelden', notNow: 'Nicht jetzt', welcomeSignInTitle: 'Mit Google anmelden', welcomeSignInSub: 'Speichere deine Rebellen in deinem Konto, damit sie nie verloren gehen — auch auf einem neuen Gerät nicht.',
      rebelShop: 'Rebellen-Shop', rebelShopSub: 'Füge deinem Schwarm einen Rebellen hinzu. Er gehört dir für immer.',
      claimCode: 'Code einlösen', purchase: 'Kaufen',
      selectScene: 'Szene auswählen', selectSceneSub: 'Wähle den Look, mit dem du spielen möchtest.', confirm: 'Bestätigen',
      difficultySub: 'Wähle eine Schwierigkeitsstufe und weitere Optionen.',
      difficultyNote: 'Geschwindigkeit &amp; Häufigkeit steigen während des Laufs — schneller bei Schwer, sanfter bei Leicht. Die Würfelgröße schrumpft bis zu einem Minimum und bleibt dann.',
      casualModeLabel: 'Entspannter Modus<small>Keine Lebensanzeige, keine Strafe für verpasste Würfel — Waffen-Powerups funktionieren normal. Läufe im entspannten Modus zählen nicht für die Bestenliste.</small>',
      menu: 'Menü'
    },
    fr: {
      selectYourRebel: 'Choisis ton rebelle', loadingRoster: 'Chargement de la liste…',
      getMoreRebels: 'Obtenir plus de rebelles', difficulty: 'Difficulté', scene: 'Scène',
      startGame: 'Démarrer', finish: 'Terminer', pause: 'Pause',
      hudMelted: 'Fondus<br><b data-rl-score>0</b>', hudEscaped: 'Échappés<br><b data-rl-escaped>0</b>',
      blizzardBannerText: '❄️ Mode Blizzard Arc-en-ciel', pauseHint: 'bouger pour viser · toucher / cliquer / espace pour tirer',
      paused: 'En pause', resume: 'Reprendre', restartRun: 'Recommencer la partie', reset: 'Réinitialiser',
      meltedThrough: 'Tout a fondu !', iceCubesMelted: 'Glaçons fondus<b data-rl-final-score>0</b>',
      accuracy: 'Précision<b data-rl-final-accuracy>0%</b>', saveScore: 'Enregistrer le score',
      casualNoLeaderboard: 'Les parties en Mode Détente ne comptent pas pour le classement.', playAgain: 'Rejouer',
      leaderboard: 'Classement', tierEasy: 'Facile', tierMedium: 'Moyen', tierHard: 'Difficile',
      sortBy: 'Trier par', sortScore: 'Score', sortAccuracy: 'Précision', sortName: 'Nom', sortDate: 'Date',
      loading: 'Chargement…', loadMore: 'Charger plus', back: 'Retour',
      about: 'À propos',
      aboutIce: 'Des glaçons tombent — détruis-les avant qu\'ils n\'atteignent le sol.',
      aboutSpeed: 'La vitesse et la fréquence augmentent tout au long de la partie — plus rapide en Difficile, plus douce en Facile. La taille des glaçons diminue jusqu\'à un minimum, puis se stabilise.',
      aboutCasual: '<b>Mode Détente</b> — pas de barre de vie, aucune pénalité pour les glaçons manqués. Les bonus d\'armes fonctionnent normalement.',
      aboutBlizzard: '<b>Blizzard Arc-en-ciel</b> — remplace ton laser par des roquettes, ajoute un classement séparé.',
      credits: 'Crédits',
      creditsTheme: 'Thème musical du Blizzard Arc-en-ciel : adapté d\'un morceau d\'Emmett Doyle.',
      creditsArt: 'Illustration originale de Rebel Loon par Casey The American.',
      creditsLink: '<a href="https://birdrebels.art" target="_blank" rel="noopener">birdrebels.art</a> — plus d\'art, de produits dérivés et de téléchargements Bird Rebels.',
      supportArtist: 'Soutenir l\'artiste',
      settings: 'Paramètres', soundEffects: 'Effets sonores', music: 'Musique', language: 'Langue', vibration: 'Vibration', account: 'Compte', notSignedIn: 'Non connecté — connectez-vous avec Google pour débloquer des rebelles.', signInGoogle: 'Se connecter avec Google', signOut: 'Se déconnecter', notNow: 'Pas maintenant', welcomeSignInTitle: 'Se connecter avec Google', welcomeSignInSub: 'Enregistrez vos rebelles sur votre compte pour ne jamais les perdre, même sur un nouvel appareil.',
      rebelShop: 'Boutique des Rebelles', rebelShopSub: 'Ajoute un rebelle à ta troupe. Il est à toi pour de bon.',
      claimCode: 'Utiliser un code', purchase: 'Acheter',
      selectScene: 'Choisir une scène', selectSceneSub: 'Choisis l\'apparence avec laquelle tu veux jouer.', confirm: 'Confirmer',
      difficultySub: 'Choisis un niveau de difficulté et des options supplémentaires.',
      difficultyNote: 'La vitesse et la fréquence augmentent tout au long de la partie — plus rapide en Difficile, plus douce en Facile. La taille des glaçons diminue jusqu\'à un minimum, puis se stabilise.',
      casualModeLabel: 'Mode Détente<small>Pas de barre de vie, aucune pénalité pour les glaçons manqués — les bonus d\'armes fonctionnent normalement. Les parties en Mode Détente ne comptent pas pour le classement.</small>',
      menu: 'Menu'
    },
    es: {
      selectYourRebel: 'Elige a tu rebelde', loadingRoster: 'Cargando la lista…',
      getMoreRebels: 'Consigue más rebeldes', difficulty: 'Dificultad', scene: 'Escena',
      startGame: 'Empezar', finish: 'Finalizar', pause: 'Pausa',
      hudMelted: 'Derretidos<br><b data-rl-score>0</b>', hudEscaped: 'Escapados<br><b data-rl-escaped>0</b>',
      blizzardBannerText: '❄️ Modo Ventisca Arcoíris', pauseHint: 'mueve para apuntar · toca / clic / espacio para disparar',
      paused: 'Pausado', resume: 'Reanudar', restartRun: 'Reiniciar partida', reset: 'Restablecer',
      meltedThrough: '¡Todo se derritió!', iceCubesMelted: 'Cubos de hielo derretidos<b data-rl-final-score>0</b>',
      accuracy: 'Precisión<b data-rl-final-accuracy>0%</b>', saveScore: 'Guardar puntuación',
      casualNoLeaderboard: 'Las partidas en Modo Casual no se añaden a la clasificación.', playAgain: 'Jugar de nuevo',
      leaderboard: 'Clasificación', tierEasy: 'Fácil', tierMedium: 'Medio', tierHard: 'Difícil',
      sortBy: 'Ordenar por', sortScore: 'Puntuación', sortAccuracy: 'Precisión', sortName: 'Nombre', sortDate: 'Fecha',
      loading: 'Cargando…', loadMore: 'Cargar más', back: 'Atrás',
      about: 'Acerca de',
      aboutIce: 'Están cayendo cubos de hielo — destrúyelos antes de que lleguen al suelo.',
      aboutSpeed: 'La velocidad y la frecuencia aumentan durante toda la partida — más rápido en Difícil, más suave en Fácil. El tamaño del cubo se reduce hasta un mínimo y luego se mantiene.',
      aboutCasual: '<b>Modo Casual</b> — sin barra de vida, sin penalización por cubos perdidos. Las mejoras de armas funcionan con normalidad.',
      aboutBlizzard: '<b>Ventisca Arcoíris</b> — cambia tu láser por cohetes y añade una clasificación aparte.',
      credits: 'Créditos',
      creditsTheme: 'Tema de la Ventisca Arcoíris: adaptado de una pista de Emmett Doyle.',
      creditsArt: 'Arte original de Rebel Loon por Casey The American.',
      creditsLink: '<a href="https://birdrebels.art" target="_blank" rel="noopener">birdrebels.art</a> — más arte, productos y descargas de Bird Rebels.',
      supportArtist: 'Apoya al artista',
      settings: 'Ajustes', soundEffects: 'Efectos de sonido', music: 'Música', language: 'Idioma', vibration: 'Vibración', account: 'Cuenta', notSignedIn: 'No has iniciado sesión — inicia sesión con Google para desbloquear rebeldes.', signInGoogle: 'Iniciar sesión con Google', signOut: 'Cerrar sesión', notNow: 'Ahora no', welcomeSignInTitle: 'Iniciar sesión con Google', welcomeSignInSub: 'Guarda tus rebeldes en tu cuenta para que nunca se pierdan, incluso en un dispositivo nuevo.',
      rebelShop: 'Tienda de Rebeldes', rebelShopSub: 'Añade un rebelde a tu bandada. Es tuyo para siempre.',
      claimCode: 'Canjear un código', purchase: 'Comprar',
      selectScene: 'Elegir escena', selectSceneSub: 'Elige el aspecto con el que quieres jugar.', confirm: 'Confirmar',
      difficultySub: 'Elige un nivel de dificultad y opciones adicionales.',
      difficultyNote: 'La velocidad y la frecuencia aumentan durante toda la partida — más rápido en Difícil, más suave en Fácil. El tamaño del cubo se reduce hasta un mínimo y luego se mantiene.',
      casualModeLabel: 'Modo Casual<small>Sin barra de vida, sin penalización por cubos perdidos — las mejoras de armas funcionan con normalidad. Las partidas en Modo Casual no se añaden a la clasificación.</small>',
      menu: 'Menú'
    }
  };
  var LANG_KEY = 'rl_lang_v1';
  function t(key, lang) {
    var dict = I18N[lang] || I18N.en;
    return (key in dict) ? dict[key] : I18N.en[key];
  }

  // All character art shares one canvas template (same size/framing), so a
  // single standard eye position works for every bird — no per-emblem tuning.
  var STANDARD_EYE = { xr: 0.55, yr: 0.165 };
  var CHAR_ASPECT = 937 / 887; // height / width of the shared art canvas

  var SNOWFLAKE_INTERVAL = 24000;
  var FIRE_COOLDOWN = 230;
  var POWERUP_MS = 10000; // duration any weapon powerup stays active once collected
  var MEGA_RADIUS_RATIO = 0.5; // mega rocket blast radius, as a fraction of stage width
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
      var url = base + '/' + SOUND_FILES[key];
      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error('fetch ' + r.status + ' for ' + url);
          return r.arrayBuffer();
        })
        .then(function (data) { return ctx.decodeAudioData(data); })
        .then(function (buf) { buffers[key] = buf; })
        .catch(function (err) {
          // Was silently swallowed before — now visible in chrome://inspect
          // so a real load/decode failure isn't indistinguishable from "still loading".
          console.error('[rl sound] failed to load "' + key + '":', err && err.message ? err.message : err);
        });
    });

    // Mobile browsers keep the AudioContext suspended until a genuine user
    // gesture. Unlock on the first touch/click/key anywhere on the page so
    // it's ready well before the first shot is fired.
    function unlock() {
      if (ctx.state === 'suspended') {
        ctx.resume().then(
          function () { console.log('[rl sound] AudioContext resumed, state:', ctx.state); },
          function (err) { console.error('[rl sound] AudioContext resume failed:', err); }
        );
      }
    }
    ['touchstart', 'mousedown', 'keydown'].forEach(function (evt) {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });

    var sfxGain = 1; // 0-1 master multiplier, controlled by the Settings slider (native only)
    function play(key) {
      var buf = buffers[key];
      if (!buf) { console.warn('[rl sound] "' + key + '" not ready yet (ctx.state=' + ctx.state + ')'); return; }
      if (sfxGain <= 0) return;
      try {
        unlock();
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var gain = ctx.createGain();
        gain.gain.value = (SOUND_VOLUME[key] != null ? SOUND_VOLUME[key] : 0.6) * sfxGain;
        src.connect(gain).connect(ctx.destination);
        src.start(0);
      } catch (e) { console.error('[rl sound] play() threw for "' + key + '":', e); }
    }
    function setVolume(v) { sfxGain = Math.max(0, Math.min(1, v)); }
    return { play: play, unlock: unlock, setVolume: setVolume };
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
  function hexToRgba(hex, alpha) {
    var c = hexToRgb(hex);
    if (!c) return 'rgba(44,74,99,' + alpha + ')';
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }
  // Accepts either a hex color or an 'hsl(...)' string (used for the Rainbow
  // Blizzard cycling glow) and returns a matching translucent color.
  function colorToRgba(color, alpha) {
    if (String(color).indexOf('hsl') === 0) {
      return color.replace('hsl(', 'hsla(').replace(')', ',' + alpha + ')');
    }
    return hexToRgba(color, alpha);
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
    return { top: mixColor('#0a1420', accentHex, 0.22), bottom: mixColor('#16283c', accentHex, 0.22) };
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
    + '  <div class="rl-splash" data-rl-splash hidden>'
    + '    <img class="rl-splash-logo" src="logo/ice-blaster-logo-round.png" alt="Bird Rebels: Ice Blaster">'
    + '  </div>'
    + '  <div class="rl-screen" data-rl-screen="start">'
    + '    <div class="rl-topbar" data-rl-topbar>'
    + '      <img class="rl-topbar-logo" src="logo/ice-blaster-logo.png" alt="Bird Rebels: Ice Blaster">'
    + '      <button class="rl-topbar-menu-btn" data-rl-menu-btn type="button" aria-label="Menu" title="Menu">&#9776;</button>'
    + '    </div>'
    + '    <div class="rl-screen-inner">'
    + '      <div class="rl-select-rebel-group" data-rl-select-rebel-group>'
    + '        <div class="rl-char-label-row rl-field-label rl-field-label-lg" data-i18n="selectYourRebel">Select Your Rebel</div>'
    + '        <div class="rl-char-grid" data-rl-char-grid><div class="rl-loading" data-i18n="loadingRoster">Loading roster…</div></div>'
    + '        <div class="rl-carousel" data-rl-carousel>'
    + '          <button type="button" class="rl-carousel-arrow rl-carousel-prev" data-rl-carousel-prev aria-label="Previous rebel">&#8249;</button>'
    + '          <div class="rl-carousel-track" data-rl-carousel-track></div>'
    + '          <button type="button" class="rl-carousel-arrow rl-carousel-next" data-rl-carousel-next aria-label="Next rebel">&#8250;</button>'
    + '        </div>'
    + '        <button class="rl-btn rl-btn-ghost" data-rl-get-more-rebels data-i18n="getMoreRebels">Get More Rebels</button>'
    + '        <div class="rl-picker-row">'
    + '          <button type="button" class="rl-scene-btn" data-rl-difficulty-btn>'
    + '            <span class="rl-scene-btn-label" data-i18n="difficulty">Difficulty</span>'
    + '            <span class="rl-scene-btn-name" data-rl-difficulty-btn-name data-i18n="tierMedium">Medium</span>'
    + '          </button>'
    + '          <button type="button" class="rl-scene-btn" data-rl-scene-btn>'
    + '            <span class="rl-scene-btn-label" data-i18n="scene">Scene</span>'
    + '            <span class="rl-scene-btn-name" data-rl-scene-btn-name>Standard</span>'
    + '          </button>'
    + '        </div>'
    + '        <button class="rl-btn" data-rl-start data-i18n="startGame">Start Game</button>'
    + '        <button class="rl-btn rl-btn-ghost" data-rl-open-leaderboard data-i18n="leaderboard">Leaderboard</button>'
    + '        <p class="rl-error" data-rl-start-error></p>'
    + '      </div>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-screen rl-game-wrap" data-rl-screen="game" hidden>'
    + '    <div class="rl-hud">'
    + '      <div class="rl-hud-stat" data-i18n-html="hudMelted">Melted<br><b data-rl-score>0</b></div>'
    + '      <div class="rl-lives" data-rl-lives>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="1"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="0"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '        <svg class="rl-life" viewBox="0 0 24 24" data-on="0"><g class="rl-life-glyph"><line x1="12" y1="2" x2="12" y2="22"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(60 12 12)"/><line x1="12" y1="2" x2="12" y2="22" transform="rotate(120 12 12)"/></g></svg>'
    + '      </div>'
    + '      <button class="rl-hud-btn" data-rl-finish hidden data-i18n="finish">Finish</button>'
    + '      <div class="rl-hud-stat" style="text-align:right;" data-i18n-html="hudEscaped">Escaped<br><b data-rl-escaped>0</b></div>'
    + '      <button class="rl-hud-btn" data-rl-pause title="Pause" data-i18n="pause">Pause</button>'
    + '    </div>'
    + '    <div class="rl-stage-outer" data-rl-stage-outer>'
    + '      <div class="rl-powerup-bar" data-rl-triple-banner hidden>'
    + '        <div class="rl-powerup-bar-fill" data-rl-powerup-bar-fill></div>'
    + '        <span class="rl-powerup-bar-label"><span data-rl-powerup-label>⚡ Triple Laser</span> <span data-rl-triple-timer>10</span>s</span>'
    + '      </div>'
    + '      <div class="rl-blizzard-banner" data-rl-blizzard-banner hidden data-i18n="blizzardBannerText">❄️ Rainbow Blizzard Mode</div>'
    + '      <div class="rl-stage" data-rl-stage><canvas data-rl-canvas></canvas></div>'
    + '    </div>'
    + '    <div class="rl-pause-hint" data-i18n="pauseHint">move to aim · tap / click / space to fire</div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="pause" hidden>'
    + '    <div class="rl-pause-panel">'
    + '      <h2 data-i18n="paused">Paused</h2>'
    + '      <button class="rl-btn" data-rl-resume data-i18n="resume">Resume</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-restart-run data-i18n="restartRun">Restart Run</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-reset data-i18n="reset">Reset</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="gameover" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="meltedThrough">Melted Through!</h2>'
    + '      <p class="rl-final" data-i18n-html="iceCubesMelted">Ice cubes melted<b data-rl-final-score>0</b></p>'
    + '      <p class="rl-final" data-i18n-html="accuracy">Accuracy<b data-rl-final-accuracy>0%</b></p>'
    + '      <div data-rl-score-submit>'
    + '        <div class="rl-initials-row">'
    + '          <input type="text" maxlength="1" data-rl-initial="0" autocomplete="off" autocapitalize="characters">'
    + '          <input type="text" maxlength="1" data-rl-initial="1" autocomplete="off" autocapitalize="characters">'
    + '          <input type="text" maxlength="1" data-rl-initial="2" autocomplete="off" autocapitalize="characters">'
    + '        </div>'
    + '        <button class="rl-btn" data-rl-submit-score data-i18n="saveScore">Save Score</button>'
    + '        <p class="rl-error" data-rl-submit-error></p>'
    + '        <p class="rl-lb-set-note" data-rl-board-inline-note hidden></p>'
    + '        <div class="rl-board" data-rl-board-inline hidden></div>'
    + '      </div>'
    + '      <p class="rl-tier-note" data-rl-kid-note hidden data-i18n="casualNoLeaderboard">Casual Mode runs aren\'t added to the leaderboard.</p>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-restart data-i18n="playAgain">Play Again</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="leaderboard" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 style="margin-bottom:2px;" data-i18n="leaderboard">Leaderboard</h2>'
    + '      <p class="rl-lb-set-note" data-rl-lb-set-note>Normal scores</p>'
    + '      <div class="rl-tabs" data-rl-lb-tabs>'
    + '        <button type="button" class="rl-tab" data-rl-lb-tab="easy" data-i18n="tierEasy">Easy</button>'
    + '        <button type="button" class="rl-tab rl-selected" data-rl-lb-tab="medium" data-i18n="tierMedium">Medium</button>'
    + '        <button type="button" class="rl-tab" data-rl-lb-tab="hard" data-i18n="tierHard">Hard</button>'
    + '      </div>'
    + '      <div class="rl-lb-sort-row">'
    + '        <label for="rl-lb-sort" data-i18n="sortBy">Sort by</label>'
    + '        <select id="rl-lb-sort" data-rl-lb-sort>'
    + '          <option value="score" data-i18n="sortScore">Score</option>'
    + '          <option value="accuracy" data-i18n="sortAccuracy">Accuracy</option>'
    + '          <option value="initials" data-i18n="sortName">Name</option>'
    + '          <option value="ts" data-i18n="sortDate">Date</option>'
    + '        </select>'
    + '      </div>'
    + '      <div class="rl-board" data-rl-board-full><div class="rl-loading" data-i18n="loading">Loading…</div></div>'
    + '      <button type="button" class="rl-btn rl-btn-ghost" data-rl-lb-load-more hidden data-i18n="loadMore">Load More</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-leaderboard data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="info" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="about">About</h2>'
    + '      <p class="rl-info-block" data-i18n="aboutIce">Ice cubes are falling — laser them down before they reach the bottom.</p>'
    + '      <p class="rl-info-block" data-i18n="aboutSpeed">Speed &amp; frequency climb the whole run — faster on Hard, gentler on Easy. Cube size shrinks to its smallest setting, then holds.</p>'
    + '      <p class="rl-info-block" data-i18n-html="aboutCasual"><b>Casual Mode</b> — no life bar, no penalty for missed cubes. Weapon powerups still work normally.</p>'
    + '      <p class="rl-info-block" data-i18n-html="aboutBlizzard"><b>Rainbow Blizzard</b> — swaps your laser for rockets, adds a separate leaderboard.</p>'
    + '      <div class="rl-info-divider"></div>'
    + '      <h3 class="rl-info-subhead" data-i18n="credits">Credits</h3>'
    + '      <p class="rl-info-block" data-i18n="creditsTheme">Rainbow Blizzard theme: chopped &amp; modified from a track by Emmett Doyle.</p>'
    + '      <p class="rl-info-block" data-i18n="creditsArt">Original Rebel Loon artwork by Casey The American.</p>'
    + '      <p class="rl-info-block" data-i18n-html="creditsLink"><a href="https://birdrebels.art" target="_blank" rel="noopener">birdrebels.art</a> — more Bird Rebels art, merch, and downloads.</p>'
    + '      <a class="rl-btn rl-btn-ghost" href="https://birdrebels.art" target="_blank" rel="noopener" data-i18n="supportArtist">Support the Artist</a>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-info data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="settings" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="settings" data-rl-dev-tap>Settings</h2>'
    + '      <div class="rl-slider-row">'
    + '        <label for="rl-sfx-volume" data-i18n="soundEffects">Sound Effects</label>'
    + '        <input type="range" id="rl-sfx-volume" data-rl-sfx-volume min="0" max="100" value="100">'
    + '      </div>'
    + '      <div class="rl-slider-row">'
    + '        <label for="rl-music-volume" data-i18n="music">Music</label>'
    + '        <input type="range" id="rl-music-volume" data-rl-music-volume min="0" max="100" value="100">'
    + '      </div>'
    + '      <div class="rl-field-label" style="margin:18px 0 8px;" data-rl-lang-label data-i18n="language">Language</div>'
    + '      <div class="rl-lang-row" data-rl-lang-row>'
    + '        <button type="button" class="rl-tier-btn rl-selected" data-rl-lang="en">English</button>'
    + '        <button type="button" class="rl-tier-btn" data-rl-lang="de">Deutsch</button>'
    + '        <button type="button" class="rl-tier-btn" data-rl-lang="fr">Français</button>'
    + '        <button type="button" class="rl-tier-btn" data-rl-lang="es">Español</button>'
    + '      </div>'
    + '      <div class="rl-check-row" style="margin-top:18px;">'
    + '        <input type="checkbox" id="rl-vibration-toggle" data-rl-vibration checked>'
    + '        <label for="rl-vibration-toggle" data-i18n="vibration">Vibration</label>'
    + '      </div>'
    + '      <div class="rl-field-label" style="margin:18px 0 8px;" data-i18n="account">Account</div>'
    + '      <p class="rl-info-block" style="margin-bottom:10px;" data-rl-account-status data-i18n="notSignedIn">Not signed in — sign in with Google to unlock rebels.</p>'
    + '      <button type="button" class="rl-btn" data-rl-signin-btn data-i18n="signInGoogle">Sign in with Google</button>'
    + '      <button type="button" class="rl-btn rl-btn-ghost" data-rl-signout-btn hidden data-i18n="signOut">Sign Out</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-settings data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="shop" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="rebelShop">Rebel Shop</h2>'
    + '      <p class="rl-sub" data-i18n="rebelShopSub">Add a rebel to your flock. It\'s yours from here on out.</p>'
    + '      <div class="rl-char-grid" data-rl-shop-grid></div>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-shop-claim-code data-i18n="claimCode">Claim a Code</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-shop data-i18n="back">Back</button>'
    + '      <div class="rl-shop-detail" data-rl-shop-detail hidden>'
    + '        <div class="rl-shop-detail-panel">'
    + '          <img data-rl-shop-detail-img alt="">'
    + '          <h3 data-rl-shop-detail-name></h3>'
    + '          <div class="rl-shop-detail-price" data-rl-shop-detail-price>…</div>'
    + '          <button class="rl-btn" data-rl-shop-detail-buy data-i18n="purchase">Purchase</button>'
    + '          <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-shop-detail-back data-i18n="back">Back</button>'
    + '        </div>'
    + '      </div>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="scenes" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="selectScene">Select Scene</h2>'
    + '      <p class="rl-sub" data-i18n="selectSceneSub">Pick which look you want to play.</p>'
    + '      <div class="rl-char-grid" data-rl-scene-grid><div class="rl-loading" data-i18n="loading">Loading…</div></div>'
    + '      <button type="button" class="rl-btn" data-rl-scene-confirm disabled data-i18n="confirm">Confirm</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-scenes data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="difficulty" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="difficulty">Difficulty</h2>'
    + '      <p class="rl-sub" data-i18n="difficultySub">Pick a challenge level and any extra options.</p>'
    + '      <div class="rl-tier-row" data-rl-tier-row>'
    + '        <button type="button" class="rl-tier-btn" data-rl-tier="easy" data-i18n="tierEasy">Easy</button>'
    + '        <button type="button" class="rl-tier-btn rl-selected" data-rl-tier="medium" data-i18n="tierMedium">Medium</button>'
    + '        <button type="button" class="rl-tier-btn" data-rl-tier="hard" data-i18n="tierHard">Hard</button>'
    + '      </div>'
    + '      <p class="rl-tier-note" data-i18n="difficultyNote">Speed &amp; frequency climb the whole run — faster on Hard, gentler on Easy. Cube size shrinks to its smallest setting, then holds.</p>'
    + '      <div class="rl-check-row">'
    + '        <input type="checkbox" id="rl-kidmode-toggle" data-rl-kidmode>'
    + '        <label for="rl-kidmode-toggle" data-i18n-html="casualModeLabel">Casual Mode'
    + '          <small>No life bar, no penalty for missed cubes — weapon powerups still work normally. Casual Mode runs are not eligible for the leaderboard.</small>'
    + '        </label>'
    + '      </div>'
    + '      <button class="rl-btn" data-rl-confirm-difficulty data-i18n="confirm">Confirm</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-difficulty data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="menu" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2 data-i18n="menu">Menu</h2>'
    + '      <button type="button" class="rl-btn rl-btn-ghost rl-menu-list-item" data-rl-menu-signin data-i18n="signInGoogle" hidden>Sign in with Google</button>'
    + '      <button type="button" class="rl-btn rl-btn-ghost rl-menu-list-item" data-rl-menu-signout data-i18n="signOut" hidden>Sign Out</button>'
    + '      <button type="button" class="rl-btn rl-btn-ghost rl-menu-list-item" data-rl-menu-about data-i18n="about">About</button>'
    + '      <button type="button" class="rl-btn rl-btn-ghost rl-menu-list-item" data-rl-menu-settings data-i18n="settings">Settings</button>'
    + '      <button type="button" class="rl-btn rl-btn-ghost rl-menu-list-item" data-rl-menu-leaderboard data-i18n="leaderboard">Leaderboard</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-menu data-i18n="back">Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-overlay" data-rl-screen="devlog" hidden>'
    + '    <div class="rl-screen-inner">'
    + '      <h2>Developer Log</h2>'
    + '      <p class="rl-sub">Recent sign-in/purchase activity, most recent first. Nothing here is sent anywhere — it only exists on this screen.</p>'
    + '      <pre class="rl-devlog-output" data-rl-devlog-output></pre>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-devlog-copy>Copy to Clipboard</button>'
    + '      <button class="rl-btn rl-btn-ghost" data-rl-devlog-clear>Clear Log</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-close-devlog>Back</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-unlock-modal" data-rl-welcome-signin hidden>'
    + '    <div class="rl-unlock-panel">'
    + '      <h3 data-i18n="welcomeSignInTitle">Sign in with Google</h3>'
    + '      <p class="rl-sub" data-i18n="welcomeSignInSub">Save your rebels to your account so they\'re never lost, even on a new device.</p>'
    + '      <button class="rl-btn" data-rl-welcome-signin-yes data-i18n="signInGoogle">Sign in with Google</button>'
    + '      <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-welcome-signin-no data-i18n="notNow">Not Now</button>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-unlock-modal" data-rl-claim-modal hidden>'
    + '    <div class="rl-unlock-panel">'
    + '      <h3>Claim a Code</h3>'
    + '      <div data-rl-claim-entry>'
    + '        <input type="text" class="rl-code-input" data-rl-claim-input placeholder="ENTER CODE" maxlength="24">'
    + '        <button class="rl-btn" data-rl-claim-submit>Submit</button>'
    + '        <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-claim-cancel>Cancel</button>'
    + '        <p class="rl-error" data-rl-claim-error></p>'
    + '      </div>'
    + '      <div data-rl-claim-picker hidden>'
    + '        <p>Pick one:</p>'
    + '        <div class="rl-char-grid" data-rl-claim-picker-grid></div>'
    + '        <button class="rl-btn" data-rl-claim-picker-confirm disabled>Confirm</button>'
    + '        <button class="rl-btn rl-btn-ghost rl-btn-back" data-rl-claim-picker-cancel>Cancel</button>'
    + '      </div>'
    + '    </div>'
    + '  </div>'

    + '  <div class="rl-toast" data-rl-toast></div>'
    + '  <div class="rl-bottombar" data-rl-bottombar></div>'
    + '</div>';

  function boot(mount) {
    if (mount.dataset.booted) return;
    mount.dataset.booted = '1';

    var BASE = mount.getAttribute('data-rl-base') || '';
    // Sounds normally load over the network from the same Worker as
    // everything else (BASE). The native wrapper bundles the mp3s inside
    // the app itself and points this at that local folder instead, via
    // data-rl-sound-base — so sound effects work offline from first launch
    // and don't depend on any network fetch. Web never sets this attribute,
    // so it keeps loading sounds from BASE exactly as before.
    var SOUND_BASE = mount.getAttribute('data-rl-sound-base');
    if (SOUND_BASE == null) SOUND_BASE = BASE;
    mount.classList.add('rl-root');
    mount.appendChild(el(TEMPLATE));
    var soundPlayer = makeSoundPlayer(SOUND_BASE);
    var playSound = soundPlayer.play;

    // ---------- bird flock (native app only — off by default, on via data-rl-shop="1") ----------
    // No payment wired yet: tapping a bird in the shop just adds it, as a
    // stand-in for the real Play Billing flow that'll replace this call later.
    // Only the Capacitor wrapper sets data-rl-shop; the Webflow embed never
    // does, so this whole feature is inert on the live web game.
    var shopEnabled = mount.getAttribute('data-rl-shop') === '1';
    if (shopEnabled) {
      mount.classList.add('rl-native');

      // Diagnostic only — confirms in chrome://inspect whether the brand
      // fonts actually loaded, instead of guessing from a screenshot.
      if (document.fonts) {
        Promise.all([
          document.fonts.load('700 16px "Black Elite"'),
          document.fonts.load('400 16px "Genos"')
        ]).then(function () {
          console.log('[rl fonts] Black Elite loaded:', document.fonts.check('700 16px "Black Elite"'));
          console.log('[rl fonts] Genos loaded:', document.fonts.check('400 16px "Genos"'));
        }).catch(function (e) {
          console.error('[rl fonts] font load failed:', e);
        });
      }
    }
    var FLOCK_KEY = 'rl_flock_v1';
    var OG_CODE = 'OG';
    var LAST_CHAR_KEY = 'rl_last_char_v1';
    function loadLastCharPref() {
      try { return localStorage.getItem(LAST_CHAR_KEY) || null; } catch (e) { return null; }
    }
    function saveLastCharPref(code) {
      try { localStorage.setItem(LAST_CHAR_KEY, code); } catch (e) {}
    }
    // Shown once, ever, on first launch — a real visible dialog (not a
    // silent background attempt) offering sign-in with a clear Not Now
    // option. Never shown again after the first time, regardless of
    // whether the person signed in or dismissed it.
    var WELCOME_SIGNIN_SHOWN_KEY = 'rl_welcome_signin_shown_v1';
    function hasShownWelcomeSignIn() {
      try { return localStorage.getItem(WELCOME_SIGNIN_SHOWN_KEY) === '1'; } catch (e) { return true; }
    }
    function markWelcomeSignInShown() {
      try { localStorage.setItem(WELCOME_SIGNIN_SHOWN_KEY, '1'); } catch (e) {}
    }
    // Fixed placeholder for the signed-out state — deliberately NOT a
    // randomly-generated per-install string. There's no such thing as a
    // meaningful "device identity" in this app anymore: entitlements are
    // only ever granted to a real, verified Google account (see
    // requireSignedIn on the Worker), so a signed-out visitor doesn't
    // have — and doesn't need — a unique identity at all. This constant
    // exists purely so screens have a non-null value to pass around before
    // sign-in, not to represent "this particular device."
    var GUEST_IDENTITY = 'guest';
    // Once signed in with Google, IDENTITY gets reassigned to the
    // server-verified account identity (see signInWithGoogle below) — this
    // is what actually ties purchases/entitlements to the person's Google
    // account. Cached locally so it doesn't need re-verifying the ID token
    // every boot; the Worker already validated it once at sign-in time,
    // and this is just a lookup key from then on, not a live credential.
    var GOOGLE_USER_KEY = 'rl_google_user_v1';
    var GOOGLE_EMAIL_KEY = 'rl_google_email_v1';
    function loadSignedInUserId() {
      try { return localStorage.getItem(GOOGLE_USER_KEY) || null; } catch (e) { return null; }
    }
    function saveSignedInIdentity(userId, email) {
      try {
        localStorage.setItem(GOOGLE_USER_KEY, userId);
        if (email) localStorage.setItem(GOOGLE_EMAIL_KEY, email);
      } catch (e) {}
    }
    function loadSignedInEmail() {
      try { return localStorage.getItem(GOOGLE_EMAIL_KEY) || null; } catch (e) { return null; }
    }
    function clearSignedInIdentity() {
      try { localStorage.removeItem(GOOGLE_USER_KEY); localStorage.removeItem(GOOGLE_EMAIL_KEY); } catch (e) {}
    }
    // Single source of truth for "is there a real, signed-in Google
    // identity right now" — used to gray out purchase/coupon buttons and
    // gate the same actions client-side that the Worker already enforces
    // server-side (requireSignedIn there is the actual security boundary;
    // this is just so the UI doesn't let someone tap a button that's
    // guaranteed to fail).
    function isSignedIn() {
      return IDENTITY != null && IDENTITY.indexOf('goog_') === 0;
    }
    var IDENTITY = shopEnabled ? (loadSignedInUserId() || GUEST_IDENTITY) : null;
    // Forward declaration: assigned once inside the shopEnabled block below
    // (where GoogleSignIn/GOOGLE_SIGNIN_CLIENT_ID/refreshAccountUi live) —
    // lets code outside that block (promptSignIn, called from gated
    // purchase/coupon buttons) trigger a real sign-in directly instead of
    // only being able to navigate to wherever the Sign In button happens
    // to live.
    var triggerGoogleSignIn = function () { return Promise.resolve(false); };
    var couponRebels = []; // rebel codes granted via coupon redemption (D1), separate from the local shop flock
    function loadCouponEntitlements() {
      if (!IDENTITY) return Promise.resolve();
      return fetch(BASE + '/api/entitlements?device=' + encodeURIComponent(IDENTITY))
        .then(function (r) { return r.json(); })
        .then(function (arr) {
          couponRebels = (Array.isArray(arr) ? arr : [])
            .filter(function (e) { return e.itemType === 'rebel'; })
            .map(function (e) { return e.itemCode; });
        })
        .catch(function () { couponRebels = []; });
    }
    function getFlock() {
      var local;
      try { var v = JSON.parse(localStorage.getItem(FLOCK_KEY) || '[]'); local = Array.isArray(v) ? v : []; }
      catch (e) { local = []; }
      // Union with coupon-granted rebels so a claimed code shows up in the
      // same strip as shop-bought ones, without disturbing the shop's own storage.
      var merged = local.slice();
      couponRebels.forEach(function (code) { if (merged.indexOf(code) === -1) merged.push(code); });
      return merged;
    }
    function addToFlock(code) {
      var flock;
      try { var v = JSON.parse(localStorage.getItem(FLOCK_KEY) || '[]'); flock = Array.isArray(v) ? v : []; }
      catch (e) { flock = []; }
      if (flock.indexOf(code) === -1) {
        flock.push(code);
        try { localStorage.setItem(FLOCK_KEY, JSON.stringify(flock)); } catch (e) {}
      }
    }

    var toastTimer = null;
    var toastElRef = mount.querySelector('[data-rl-toast]');
    function toast(msg, ms) {
      if (!toastElRef) return;
      toastElRef.textContent = msg;
      toastElRef.classList.add('rl-show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastElRef.classList.remove('rl-show'); }, ms || 1600);
    }

    var blizzardTheme = new Audio(SOUND_BASE + '/sounds/blizzard-theme.mp3');
    blizzardTheme.loop = true;
    var musicGain = 1; // 0-1 master multiplier, controlled by the Settings slider (native only)
    function applyMusicVolume() { blizzardTheme.volume = 0.55 * musicGain; }
    applyMusicVolume();
    blizzardTheme.preload = 'auto';
    function stopBlizzardTheme() { try { blizzardTheme.pause(); blizzardTheme.currentTime = 0; } catch (e) {} }

    // Vibration on ice hitting the ground, native only. Defaults true so it
    // works before Settings has had a chance to load any saved preference.
    // Uses the real Capacitor Haptics plugin (navigator.vibrate() was tried
    // first but didn't actually work in this WebView) — same
    // window.Capacitor.Plugins.X access pattern already used elsewhere in
    // this app (see index.html's back-button handler for the App plugin).
    var vibrationEnabled = true;
    function triggerVibration() {
      if (!shopEnabled || !vibrationEnabled) return;
      try {
        var Haptics = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
        // vibrate() takes no style argument, unlike impact({style:...}) —
        // avoids needing to guess the exact raw string/enum casing Haptics
        // expects for style when calling through the plugin bridge
        // directly instead of importing the JS module (which exposes
        // ImpactStyle as a proper enum).
        if (Haptics && Haptics.vibrate) Haptics.vibrate();
      } catch (e) {}
    }

    var screens = {};
    mount.querySelectorAll('[data-rl-screen]').forEach(function (e) {
      screens[e.getAttribute('data-rl-screen')] = e;
    });
    var bottomBarEl = mount.querySelector('[data-rl-bottombar]');
    // App boots straight onto the setup screen via markup defaults — no
    // showScreen() call fires on initial load, so the bar's starting state
    // needs setting explicitly here rather than relying on the first
    // in-game transition to hide it.
    if (bottomBarEl) bottomBarEl.hidden = true;
    var infoReturnScreen = 'start'; // which screen Help/Settings/Leaderboard should return to on close
    function showScreen(name) {
      screens.pause.hidden = true;
      screens.gameover.hidden = true;
      screens.leaderboard.hidden = true;
      if (screens.shop) screens.shop.hidden = true;
      if (screens.scenes) screens.scenes.hidden = true;
      if (screens.difficulty) screens.difficulty.hidden = true;
      if (screens.info) screens.info.hidden = true;
      if (screens.settings) screens.settings.hidden = true;
      if (screens.menu) screens.menu.hidden = true;
      if (screens.devlog) screens.devlog.hidden = true;
      if (name === 'start') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'game') { screens.start.hidden = true; screens.game.hidden = false; }
      else if (name === 'pause') { screens.start.hidden = true; screens.game.hidden = false; screens.pause.hidden = false; }
      else if (name === 'gameover') { screens.start.hidden = true; screens.game.hidden = false; screens.gameover.hidden = false; }
      else if (name === 'shop-from-start') { screens.start.hidden = false; screens.game.hidden = true; if (screens.shop) screens.shop.hidden = false; }
      else if (name === 'shop-close') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'scenes-from-start') { screens.start.hidden = false; screens.game.hidden = true; if (screens.scenes) screens.scenes.hidden = false; }
      else if (name === 'scenes-close') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'difficulty-from-start') { screens.start.hidden = false; screens.game.hidden = true; if (screens.difficulty) screens.difficulty.hidden = false; }
      else if (name === 'difficulty-close') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'menu-from-start') { screens.start.hidden = false; screens.game.hidden = true; if (screens.menu) screens.menu.hidden = false; }
      else if (name === 'menu-close') { screens.start.hidden = false; screens.game.hidden = true; }
      else if (name === 'info-from-menu') { infoReturnScreen = 'menu'; screens.start.hidden = false; screens.game.hidden = true; if (screens.info) screens.info.hidden = false; }
      else if (name === 'info-close') { showScreen(infoReturnScreen === 'menu' ? 'menu-from-start' : 'start'); }
      else if (name === 'settings-from-menu') { infoReturnScreen = 'menu'; screens.start.hidden = false; screens.game.hidden = true; if (screens.settings) screens.settings.hidden = false; }
      else if (name === 'settings-close') { showScreen(infoReturnScreen === 'menu' ? 'menu-from-start' : 'start'); }
      else if (name === 'devlog-from-settings') { screens.start.hidden = false; screens.game.hidden = true; if (screens.settings) screens.settings.hidden = true; if (screens.devlog) screens.devlog.hidden = false; }
      else if (name === 'devlog-close') { screens.start.hidden = false; screens.game.hidden = true; if (screens.settings) screens.settings.hidden = false; }
      else if (name === 'leaderboard-from-menu') { infoReturnScreen = 'menu'; screens.start.hidden = false; screens.game.hidden = true; screens.leaderboard.hidden = false; }
      else if (name === 'leaderboard-from-start') { infoReturnScreen = 'start'; screens.start.hidden = false; screens.game.hidden = true; screens.leaderboard.hidden = false; }
      else if (name === 'leaderboard-close') { showScreen(infoReturnScreen === 'menu' ? 'menu-from-start' : 'start'); }
      // Bottom bar (the visible textured strip) only shows during actual
      // gameplay — everywhere else the reserved space (see .rl-native
      // .rl-frame's padding-bottom, always applied) just shows the
      // background through instead of an empty strip with nothing behind
      // it.
      if (bottomBarEl) bottomBarEl.hidden = screens.game.hidden;
    }

    // ---------- character roster (live from the API) ----------
    var charGrid = mount.querySelector('[data-rl-char-grid]');
    var shopGrid = mount.querySelector('[data-rl-shop-grid]');
    var startError = mount.querySelector('[data-rl-start-error]');
    var roster = [];
    var selectedChar = null;
    var charImgs = {};
    var charAccent = {};
    var RANDOM_CODE = '__RANDOM__';

    // ---------- scene roster (live from the API — Standard, Rainbow
    // Blizzard, and any future purchasable scenes) ----------
    var sceneGrid = mount.querySelector('[data-rl-scene-grid]');
    var sceneRoster = [];
    var selectedScene = 'standard';
    var pendingSceneCode = null; // picker's in-progress pick, before Confirm

    function preloadChar(ch) {
      var preload = new Image();
      preload.src = BASE + ch.src;
      charImgs[ch.code] = preload;
      charAccent[ch.code] = ch.accentColor || null;
    }

    function rosterByCode(code) {
      for (var i = 0; i < roster.length; i++) if (roster[i].code === code) return roster[i];
      return null;
    }

    function selectCard(card) {
      charGrid.querySelectorAll('.rl-char-card').forEach(function (c) { c.classList.toggle('rl-selected', c === card); });
      if (shopEnabled) updateMenuBg(card.getAttribute('data-rl-char'));
    }

    function updateMenuBg(code) {
      var accent = code ? charAccent[code] : null;
      if (!accent) {
        mount.style.removeProperty('--rl-bg-top');
        mount.style.removeProperty('--rl-bg-bottom');
        return;
      }
      var colors = computeBgColors(accent);
      mount.style.setProperty('--rl-bg-top', colors.top);
      mount.style.setProperty('--rl-bg-bottom', colors.bottom);
    }

    function renderCharGrid() {
      if (!roster.length) {
        charGrid.innerHTML = '<div class="rl-loading">No characters available yet.</div>';
        return;
      }
      roster.forEach(preloadChar);

      if (!shopEnabled) {
        // ---- unchanged web/original behavior ----
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
            selectCard(card);
          });
          charGrid.appendChild(card);
        });
        selectedChar = roster[0].code;
        return;
      }

      // ---- native: build the carousel instead of the char-grid ----
      var og = rosterByCode(OG_CODE) || roster[0];
      var lastChar = loadLastCharPref();
      var wantSelected = (selectedChar && (selectedChar === RANDOM_CODE || rosterByCode(selectedChar)))
        ? selectedChar
        : ((lastChar && (lastChar === RANDOM_CODE || rosterByCode(lastChar))) ? lastChar : og.code);
      selectedChar = wantSelected;
      updateMenuBg(wantSelected);
      renderCarousel();
    }

    // A rebel is "owned" if it's OG, marked auto_unlock in D1 (free +
    // automatic, no purchase needed — e.g. MN by default), or actually in
    // the flock (bought or claimed via coupon).
    function ownedRebelCodes() {
      var codes = [OG_CODE];
      roster.forEach(function (ch) { if (ch.autoUnlock && codes.indexOf(ch.code) === -1) codes.push(ch.code); });
      getFlock().forEach(function (code) { if (codes.indexOf(code) === -1) codes.push(code); });
      return codes;
    }

    // ---------- carousel (native only) ----------
    // True infinite looping that behaves identically whether you swipe or
    // tap the arrows: the track is [spacer, clone-of-last, ...real items,
    // clone-of-first, spacer]. Landing on a clone (however you got there)
    // triggers an instant, invisible jump to the matching real card.
    var carouselTrack = mount.querySelector('[data-rl-carousel-track]');
    var carouselPrevBtn = mount.querySelector('[data-rl-carousel-prev]');
    var carouselNextBtn = mount.querySelector('[data-rl-carousel-next]');
    var carouselSettleTimer = null;

    function buildCarouselItems() {
      var og = rosterByCode(OG_CODE) || roster[0];
      var owned = ownedRebelCodes();
      var items = [{ code: og.code, label: og.label, imgSrc: BASE + og.src }];
      owned.forEach(function (code) {
        if (code === og.code) return;
        var ch = rosterByCode(code);
        if (ch) items.push({ code: ch.code, label: ch.label, imgSrc: BASE + ch.src });
      });
      items.push({ code: RANDOM_CODE, label: 'Random', imgSrc: null, isRandom: true });
      return items;
    }

    function buildCarouselCard(item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'rl-char-card rl-carousel-card';
      card.setAttribute('data-rl-char', item.code);
      if (item.isRandom) {
        card.classList.add('rl-char-random');
        var box = document.createElement('div');
        box.className = 'rl-char-emblem';
        var circle = document.createElement('div');
        circle.className = 'rl-char-emblem-circle';
        circle.textContent = '?';
        box.appendChild(circle);
        card.appendChild(box);
      } else {
        if (charAccent[item.code]) card.style.setProperty('--tile-accent', charAccent[item.code]);
        var img = document.createElement('img');
        img.alt = item.label;
        img.src = item.imgSrc;
        card.appendChild(img);
      }
      var span = document.createElement('span');
      span.textContent = item.label;
      card.appendChild(span);
      return card;
    }

    function scrollCarouselTo(card, smooth) {
      if (!card) return;
      card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    }

    function findCenteredCarouselCard() {
      if (!carouselTrack) return null;
      var trackCenter = carouselTrack.scrollLeft + carouselTrack.clientWidth / 2;
      var closest = null, closestDist = Infinity;
      carouselTrack.querySelectorAll('.rl-carousel-card').forEach(function (card) {
        var cardCenter = card.offsetLeft + card.offsetWidth / 2;
        var dist = Math.abs(cardCenter - trackCenter);
        if (dist < closestDist) { closestDist = dist; closest = card; }
      });
      return closest;
    }

    // Continuous scale/opacity driven directly by scroll position, recalculated
    // every animation frame while the track is moving. This is what makes
    // growth toward center feel buttery instead of laggy: the previous
    // approach only toggled a CSS class (with a .18s transition) once
    // scrolling settled, so cards visibly snapped from small to big instead
    // of growing smoothly as they approached center, and always lagged a
    // step behind a fast swipe. No CSS transition is applied to these
    // properties anymore (see .rl-carousel-card in styles.css) — the scroll
    // motion itself, which the browser already renders smoothly, is what
    // drives the animation now, so there's nothing for JS to race against.
    var CAROUSEL_MIN_SCALE = 0.65, CAROUSEL_MAX_SCALE = 1.75; // peak bumped 25% bigger (was 1.4) per instruction
    var CAROUSEL_MIN_OPACITY = 0.5, CAROUSEL_MAX_OPACITY = 1;
    // Distance (px) from track-center at which a card reaches minimum
    // scale/opacity — roughly one card-width-plus-gap out, so neighboring
    // cards are still visibly mid-transition rather than jumping straight
    // to their resting small size right next to the active one.
    var CAROUSEL_FALLOFF_PX = 170;
    var carouselRafId = null;

    function updateCarouselCardScales() {
      if (!carouselTrack) return;
      var trackRect = carouselTrack.getBoundingClientRect();
      var trackCenter = trackRect.left + trackRect.width / 2;
      carouselTrack.querySelectorAll('.rl-carousel-card').forEach(function (card) {
        var r = card.getBoundingClientRect();
        var cardCenter = r.left + r.width / 2;
        var realDist = Math.abs(cardCenter - trackCenter);
        var dist = Math.min(realDist, CAROUSEL_FALLOFF_PX);
        var t = 1 - dist / CAROUSEL_FALLOFF_PX; // 1 at dead-center, 0 at/beyond falloff
        var scale = CAROUSEL_MIN_SCALE + (CAROUSEL_MAX_SCALE - CAROUSEL_MIN_SCALE) * t;
        var opacity = CAROUSEL_MIN_OPACITY + (CAROUSEL_MAX_OPACITY - CAROUSEL_MIN_OPACITY) * t;
        card.style.transform = 'scale(' + scale.toFixed(3) + ')';
        card.style.opacity = opacity.toFixed(3);
        // Closer to center = higher z-index, so the enlarged active card
        // always paints above its neighbors instead of DOM order deciding
        // paint order (which was letting a later-in-DOM neighbor visually
        // cut into the larger active card).
        card.style.zIndex = String(Math.max(1, 100 - Math.round(realDist)));
      });
    }

    function carouselRafLoop() {
      updateCarouselCardScales();
      carouselRafId = requestAnimationFrame(carouselRafLoop);
    }
    function startCarouselRaf() {
      if (carouselRafId != null) return;
      carouselRafLoop();
    }
    function stopCarouselRaf() {
      if (carouselRafId == null) return;
      cancelAnimationFrame(carouselRafId);
      carouselRafId = null;
      // One final settle so scale/opacity land on their exact resting
      // values instead of whatever the last frame happened to compute.
      updateCarouselCardScales();
    }

    function setActiveCarouselCard(card) {
      if (!carouselTrack) return;
      // rl-carousel-active no longer drives scale/opacity (that's fully
      // continuous now, see above) — it's kept purely as a semantic marker
      // so the per-bird accent-color-on-label CSS rule still knows which
      // card is the selected one.
      carouselTrack.querySelectorAll('.rl-carousel-card').forEach(function (c) { c.classList.toggle('rl-carousel-active', c === card); });
    }

    function selectCarouselItem(code) {
      selectedChar = code;
      updateMenuBg(code);
      saveLastCharPref(code);
    }

    function renderCarousel() {
      if (!carouselTrack) return;
      var items = buildCarouselItems();
      carouselTrack.innerHTML = '';
      if (!items.length) return;

      var startSpacer = document.createElement('div');
      startSpacer.className = 'rl-carousel-spacer';
      carouselTrack.appendChild(startSpacer);

      // Two clones per end instead of one. With a small roster (this app
      // starts everyone with just 2-3 birds), a single clone sits close
      // enough to center to be visibly mid-scale-transition itself — so the
      // wraparound jump was swapping something the user could already see
      // animating, reading as "the clones getting moved around" rather than
      // a clean, invisible loop. A second clone pushes the swap point a
      // full card-width further from the visible falloff zone. Uses modulo
      // so this still works if the roster only has 1-2 real items.
      var cloneStarts = [
        buildCarouselCard(items[(items.length * 2 - 2) % items.length]),
        buildCarouselCard(items[items.length - 1])
      ];
      cloneStarts.forEach(function (c) { c.classList.add('rl-carousel-clone'); carouselTrack.appendChild(c); });

      var realCards = [];
      items.forEach(function (item) {
        var card = buildCarouselCard(item);
        realCards.push(card);
        carouselTrack.appendChild(card);
      });

      var cloneEnds = [
        buildCarouselCard(items[0]),
        buildCarouselCard(items[1 % items.length])
      ];
      cloneEnds.forEach(function (c) { c.classList.add('rl-carousel-clone'); carouselTrack.appendChild(c); });

      var endSpacer = document.createElement('div');
      endSpacer.className = 'rl-carousel-spacer';
      carouselTrack.appendChild(endSpacer);

      function wireCard(card, item) {
        card.addEventListener('click', function () {
          selectCarouselItem(item.code);
          scrollCarouselTo(card, true);
        });
      }
      wireCard(cloneStarts[0], items[(items.length * 2 - 2) % items.length]);
      wireCard(cloneStarts[1], items[items.length - 1]);
      realCards.forEach(function (card, i) { wireCard(card, items[i]); });
      wireCard(cloneEnds[0], items[0]);
      wireCard(cloneEnds[1], items[1 % items.length]);

      var suppressNextSettle = false;
      function jumpTo(card) {
        suppressNextSettle = true;
        carouselTrack.style.scrollSnapType = 'none';
        scrollCarouselTo(card, false);
        setTimeout(function () { carouselTrack.style.scrollSnapType = ''; }, 60);
      }

      function onSettle() {
        if (suppressNextSettle) { suppressNextSettle = false; return; }
        var centered = findCenteredCarouselCard();
        if (!centered) return;
        var startCloneIdx = cloneStarts.indexOf(centered);
        var endCloneIdx = cloneEnds.indexOf(centered);
        if (startCloneIdx !== -1) {
          // cloneStarts[0] depicts the second-to-last real item, [1] the
          // last — jump to whichever real card that specific clone
          // actually represents, not always the same one.
          var startTarget = startCloneIdx === 0
            ? realCards[(realCards.length * 2 - 2) % realCards.length]
            : realCards[realCards.length - 1];
          jumpTo(startTarget);
          centered = startTarget;
        } else if (endCloneIdx !== -1) {
          // cloneEnds[0] depicts the first real item, [1] the second.
          var endTarget = endCloneIdx === 0 ? realCards[0] : realCards[1 % realCards.length];
          jumpTo(endTarget);
          centered = endTarget;
        }
        var code = centered.getAttribute('data-rl-char');
        selectCarouselItem(code);
        setActiveCarouselCard(centered);
        // Recompute after any wraparound jump above repositions the track,
        // so resting scale/opacity always reflect the final layout rather
        // than whatever the last animation frame saw before the jump.
        updateCarouselCardScales();
      }

      carouselTrack.addEventListener('scroll', function () {
        startCarouselRaf();
        clearTimeout(carouselSettleTimer);
        // Was 120ms — that fixed wait before even checking whether the
        // clone-wraparound jump was needed was the actual source of the
        // "takes too long" lag at the carousel ends (the jump itself is
        // instant, behavior:'auto'). 50ms still reliably distinguishes
        // "still scrolling" from "stopped" without the noticeable pause.
        carouselSettleTimer = setTimeout(function () {
          // Stopping the RAF loop BEFORE onSettle() used to leave a real
          // gap if onSettle() then triggered a wraparound jump: the
          // continuous scale/opacity/z-index update had already halted and
          // had to wait for a fresh requestAnimationFrame callback to
          // resume (RAF doesn't fire synchronously), producing a brief
          // stutter right at the boundary. onSettle() now runs first, and
          // the loop is only stopped afterward — so it keeps running
          // uninterrupted through any jump it triggers.
          onSettle();
          stopCarouselRaf();
        }, 50);
      }, { passive: true });

      // Land centered on the resolved selection (selectedChar was already
      // set above — either the last-selected rebel from a previous
      // session, or OG as the final fallback) instead of always hardcoding
      // OG/index 0, which ignored that resolution entirely.
      requestAnimationFrame(function () {
        var startCard = null;
        for (var si = 0; si < realCards.length; si++) {
          if (realCards[si].getAttribute('data-rl-char') === selectedChar) { startCard = realCards[si]; break; }
        }
        if (!startCard) startCard = realCards[0];
        selectCarouselItem(startCard.getAttribute('data-rl-char'));
        setActiveCarouselCard(startCard);
        jumpTo(startCard);
        // One-off scale pass so the starting card is at full size instead
        // of sitting at resting-small scale until the first scroll/swipe.
        updateCarouselCardScales();
      });

      function stepCarousel(dir) {
        var current = findCenteredCarouselCard();
        if (!current) return;
        var target = dir > 0 ? current.nextElementSibling : current.previousElementSibling;
        while (target && !target.classList.contains('rl-carousel-card')) {
          target = dir > 0 ? target.nextElementSibling : target.previousElementSibling;
        }
        if (target) scrollCarouselTo(target, true);
      }
      if (carouselPrevBtn) carouselPrevBtn.onclick = function () { stepCarousel(-1); };
      if (carouselNextBtn) carouselNextBtn.onclick = function () { stepCarousel(1); };
    }

    function renderShopGrid() {
      if (!shopGrid) { devLog('shop: renderShopGrid called but shopGrid element missing'); return; }
      devLog('shop: renderShopGrid start (signedIn=' + isSignedIn() + ', identity=' + IDENTITY + ', rosterLen=' + roster.length + ')');
      // Visually reflects sign-in status every time the Shop screen
      // renders — grayed out but still tappable (prompts sign-in on tap,
      // handled inside openClaimModal itself).
      if (claimShopBtn) claimShopBtn.classList.toggle('rl-btn-gray', !isSignedIn());
      var owned = ownedRebelCodes();
      devLog('shop: owned codes = [' + owned.join(',') + ']');
      var candidates = roster.filter(function (ch) { return owned.indexOf(ch.code) === -1 && ch.isPurchasable; });
      devLog('shop: ' + candidates.length + ' candidate(s) after removing owned + non-purchasable');
      if (!candidates.length) {
        shopGrid.innerHTML = '<div class="rl-loading">You\'ve got the whole flock!</div>';
        return;
      }
      shopGrid.innerHTML = '<div class="rl-loading">Loading…</div>';
      var NativePurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases;
      if (!NativePurchases || !NativePurchases.getProducts) {
        devLog('shop: NativePurchases.getProducts unavailable — no billing on device');
        // No billing available at all (e.g. web) — nothing is purchasable,
        // so nothing should show as buyable.
        shopGrid.innerHTML = '<div class="rl-loading">Purchases aren\'t available on this device.</div>';
        return;
      }
      var productIds = candidates.map(function (ch) { return playProductIdForRebel(ch.code); })
        .filter(function (id) { return typeof id === 'string' && id.length > 0; });
      devLog('shop: calling getProducts for ' + productIds.length + ' id(s)');
      // Guard: the underlying billing client rejects (rather than returning
      // an empty list) when handed a zero-length product-identifier array.
      // If there are no candidate product IDs there is genuinely nothing to
      // show, so short-circuit to the friendly empty state instead of
      // letting getProducts throw and surface a "couldn't load" error.
      if (!productIds.length) {
        devLog('shop: no valid product IDs to query — showing empty state');
        shopGrid.innerHTML = '<div class="rl-loading">No rebels available to purchase right now.</div>';
        return;
      }

      // Render the resolved product list into the grid. Pulled out so both
      // the first attempt and the retry share one code path.
      function renderProducts(result) {
        var products = (result && result.products) || [];
        devLog('shop: getProducts resolved with ' + products.length + ' product(s)');
        products.forEach(function (p) { shopPriceCache[p.identifier] = p.priceString; });
        // Only show a bird if Google actually has a real, purchasable
        // product for it — a bird can exist fully in D1 (art, colors,
        // label) but simply not appear as buyable here until it's set
        // up in Play Console. That's the actual point of this filter.
        var available = candidates.filter(function (ch) {
          return !!shopPriceCache[playProductIdForRebel(ch.code)];
        });
        devLog('shop: ' + available.length + ' available after price-cache filter');
        if (!available.length) {
          shopGrid.innerHTML = '<div class="rl-loading">No rebels available to purchase right now.</div>';
          return;
        }
        shopGrid.innerHTML = '';
        available.forEach(function (ch) {
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'rl-char-card';
          card.setAttribute('data-rl-char', ch.code);
          if (ch.accentColor) card.style.setProperty('--tile-accent', ch.accentColor);
          var img = document.createElement('img');
          img.alt = ch.label;
          img.src = BASE + ch.src;
          var span = document.createElement('span');
          span.textContent = ch.label;
          var price = document.createElement('span');
          price.className = 'rl-shop-price';
          price.textContent = shopPriceCache[playProductIdForRebel(ch.code)];
          card.appendChild(img); card.appendChild(span); card.appendChild(price);
          card.addEventListener('click', function () {
            openShopDetail(ch);
          });
          shopGrid.appendChild(card);
        });
      }

      // getProducts (plural, one batched call) — never getProduct in a
      // loop, which the plugin's own docs warn causes a race condition
      // with the underlying native billing client.
      //
      // The native billing client can be transiently unready right after
      // sign-in (the connection is torn down and re-established around the
      // auth flow), so a single getProducts() call sometimes rejects even
      // though the catalog is fine. Retry once after a short delay before
      // giving up — the second attempt almost always lands once the client
      // has reconnected.
      function queryProducts(attempt) {
        return NativePurchases.getProducts({ productIdentifiers: productIds, productType: 'inapp' })
          .then(renderProducts)
          .catch(function (err) {
            var msg = (err && err.message ? err.message : String(err));
            devLog('shop: getProducts attempt ' + attempt + ' REJECTED — ' + msg);
            if (attempt < 2) {
              // Brief backoff to let the billing client reconnect, then retry once.
              return new Promise(function (resolve) { setTimeout(resolve, 900); })
                .then(function () { return queryProducts(attempt + 1); });
            }
            shopGrid.innerHTML = '<div class="rl-loading">Couldn\'t load the shop — check your connection and try again.</div>';
          });
      }
      queryProducts(1);
    }

    // Scenes reuse the .rl-char-card tile look for visual consistency with
    // rebel select/shop, but tap-to-highlight-then-Confirm instead of
    // tap-to-open-a-purchase-detail — same mechanic as the claim-code
    // picker (see claimPickerGrid below), just for scenes instead of a
    // multi-item coupon's options. Nothing is applied until Confirm is
    // tapped, so browsing/tapping around doesn't change gameplay mid-tap.
    var sceneConfirmBtn = mount.querySelector('[data-rl-scene-confirm]');
    function renderSceneGrid() {
      if (!sceneGrid) return;
      if (!sceneRoster.length) {
        sceneGrid.innerHTML = '<div class="rl-loading">Couldn\'t load scenes.</div>';
        return;
      }
      pendingSceneCode = selectedScene;
      sceneGrid.innerHTML = '';
      sceneRoster.forEach(function (sc) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'rl-char-card';
        card.setAttribute('data-rl-scene', sc.code);
        if (!sc.unlocked) card.classList.add('rl-char-shop-tile');
        if (sc.accentColor) card.style.setProperty('--tile-accent', sc.accentColor);
        if (sc.code === selectedScene) card.classList.add('rl-selected');
        var swatch = document.createElement('div');
        swatch.className = 'rl-scene-swatch';
        swatch.style.background = 'linear-gradient(135deg, ' + (sc.primaryColor || '#333') + ', ' + (sc.secondaryColor || sc.primaryColor || '#333') + ')';
        var span = document.createElement('span');
        span.textContent = sc.label;
        card.appendChild(swatch); card.appendChild(span);
        if (!sc.unlocked) {
          var lock = document.createElement('span');
          lock.className = 'rl-shop-price';
          lock.textContent = sc.priceCents ? '$' + (sc.priceCents / 100).toFixed(2) : 'Locked';
          card.appendChild(lock);
        }
        card.addEventListener('click', function () {
          // Locked scenes aren't selectable yet — no purchase flow exists
          // for scenes yet (this is the future-purchase scaffolding), so
          // tapping one is a no-op rather than a broken purchase attempt.
          if (!sc.unlocked) return;
          sceneGrid.querySelectorAll('.rl-char-card').forEach(function (c) { c.classList.toggle('rl-selected', c === card); });
          pendingSceneCode = sc.code;
          if (sceneConfirmBtn) sceneConfirmBtn.disabled = false;
        });
        sceneGrid.appendChild(card);
      });
      if (sceneConfirmBtn) sceneConfirmBtn.disabled = false;
    }

    function sceneByCode(code) {
      for (var i = 0; i < sceneRoster.length; i++) if (sceneRoster[i].code === code) return sceneRoster[i];
      return null;
    }

    // Syncs the main-menu scene button to whatever's currently selected —
    // the scene NAME is always shown as text (never relying on color alone
    // to communicate which scene is active), with the accent color applied
    // to the button's border/text as a secondary visual cue.
    function updateSceneButton() {
      var btn = mount.querySelector('[data-rl-scene-btn]');
      var nameEl = mount.querySelector('[data-rl-scene-btn-name]');
      var sc = sceneByCode(selectedScene);
      if (nameEl) nameEl.textContent = sc ? sc.label : 'Standard';
      if (btn) {
        btn.style.setProperty('--tile-accent', (sc && sc.accentColor) || 'var(--rl-accent)');
        // Rainbow Blizzard gets a rainbow gradient border instead of a
        // solid accent color — a plain border-color can't be a gradient,
        // so this is a dedicated class rather than something the
        // --tile-accent custom property alone can express.
        btn.classList.toggle('rl-scene-btn-rainbow', selectedScene === 'blizzard');
      }
    }

    mount.querySelector('[data-rl-scene-btn]').addEventListener('click', function () {
      renderSceneGrid();
      showScreen('scenes-from-start');
    });
    mount.querySelector('[data-rl-close-scenes]').addEventListener('click', function () { showScreen('scenes-close'); });
    if (sceneConfirmBtn) {
      sceneConfirmBtn.addEventListener('click', function () {
        if (pendingSceneCode) selectedScene = pendingSceneCode;
        updateSceneButton();
        showScreen('scenes-close');
      });
    }

    var shopDetailEl = mount.querySelector('[data-rl-shop-detail]');
    var shopDetailImg = mount.querySelector('[data-rl-shop-detail-img]');
    var shopDetailName = mount.querySelector('[data-rl-shop-detail-name]');
    var shopDetailBuy = mount.querySelector('[data-rl-shop-detail-buy]');
    var shopDetailBack = mount.querySelector('[data-rl-shop-detail-back]');
    var pendingPurchase = null;
    // Populated by renderShopGrid's batched getProducts() call — reused by
    // openShopDetail so tapping a card doesn't re-query Google a second
    // time for a price the grid already fetched.
    var shopPriceCache = {};

    function openShopDetail(ch) {
      if (!shopDetailEl) return;
      pendingPurchase = ch;
      shopDetailImg.src = BASE + ch.src;
      shopDetailImg.alt = ch.label;
      shopDetailName.textContent = ch.label;
      shopDetailEl.hidden = false;
      // Same gray-out treatment as the Shop grid's Claim button — reflects
      // sign-in status, stays clickable so a tap still routes to sign-in.
      var signedIn = isSignedIn();
      if (shopDetailBuy) shopDetailBuy.classList.toggle('rl-btn-gray', !signedIn);
      // Real, Google-provided price — priceString is already formatted
      // correctly for the user's own currency/region, so there's no
      // manual per-region price list to maintain on our end. Reuses the
      // price already fetched by renderShopGrid's batched call when
      // available, instead of re-querying Google a second time.
      var shopDetailPriceEl = mount.querySelector('[data-rl-shop-detail-price]');
      var productId = playProductIdForRebel(ch.code);
      var cachedPrice = shopPriceCache[productId];
      if (cachedPrice) {
        if (shopDetailPriceEl) shopDetailPriceEl.textContent = cachedPrice;
        return;
      }
      if (shopDetailPriceEl) shopDetailPriceEl.textContent = '…';
      var NativePurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases;
      if (NativePurchases && NativePurchases.getProduct) {
        NativePurchases.getProduct({ productIdentifier: productId, productType: 'inapp' })
          .then(function (result) {
            // Guard against the user backing out to the grid and opening a
            // DIFFERENT card before this resolves — only apply the price
            // if it's still the same rebel being shown.
            if (pendingPurchase !== ch || !shopDetailPriceEl) return;
            var price = result && result.product && result.product.priceString;
            if (price) shopPriceCache[productId] = price;
            shopDetailPriceEl.textContent = price || '—';
          })
          .catch(function () {
            if (pendingPurchase === ch && shopDetailPriceEl) shopDetailPriceEl.textContent = '—';
          });
      } else if (shopDetailPriceEl) {
        shopDetailPriceEl.textContent = '—';
      }
    }
    function closeShopDetail() {
      if (shopDetailEl) shopDetailEl.hidden = true;
    }
    if (shopDetailBack) shopDetailBack.addEventListener('click', function () { pendingPurchase = null; closeShopDetail(); });
    // Play Billing product IDs follow this pattern — must match exactly
    // what's registered as in-app products in Play Console, or
    // getProduct()/purchaseProduct() will fail to find them.
    function playProductIdForRebel(code) { return 'bird_' + code.toLowerCase(); }

    if (shopDetailBuy) {
      shopDetailBuy.addEventListener('click', function () {
        if (!pendingPurchase) return;
        if (!isSignedIn()) { promptSignIn(); return; }
        var ch = pendingPurchase;
        var NativePurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases;
        if (!NativePurchases) {
          toast('Purchases aren\'t available on this device.');
          return;
        }
        shopDetailBuy.disabled = true;
        shopDetailBuy.textContent = 'Purchasing…';
        var productId = playProductIdForRebel(ch.code);
        devLog('purchase: starting for ' + productId + ' (identity = ' + IDENTITY + ')');
        NativePurchases.purchaseProduct({ productIdentifier: productId, productType: 'inapp', quantity: 1 })
          .then(function (result) {
            devLog('purchase: purchaseProduct returned, purchaseToken present = ' + !!(result && result.purchaseToken) + ', purchaseState = ' + ((result && result.purchaseState) || 'n/a'));
            // Android-only field per the plugin's own docs — this is the
            // actual proof of purchase, sent to the Worker for real
            // verification against Google's API. Never trust it locally;
            // a modified client could fabricate this string.
            if (!result || !result.purchaseToken) throw new Error('no purchase token returned');
            return fetch(BASE + '/api/purchases/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                device: IDENTITY, itemType: 'rebel', itemCode: ch.code,
                productId: productId, purchaseToken: result.purchaseToken
              })
            });
          })
          .then(function (r) {
            devLog('purchase: /api/purchases/verify status = ' + r.status);
            if (!r.ok) {
              return r.text().then(function (bodyText) {
                devLog('purchase: error body = ' + bodyText);
                // 402 from the Worker means Google itself said this
                // purchase didn't check out (not just a network hiccup) —
                // treat that as a real failure, not a retry-and-hope case.
                throw new Error(r.status === 402 ? 'purchase_not_verified' : 'verify_request_failed');
              });
            }
            return r.json();
          })
          .then(function () {
            devLog('purchase: verified and granted — ' + ch.code + ' added to flock');
            // Server has now independently confirmed this purchase with
            // Google and recorded it — union it into the local flock
            // immediately so the UI updates without waiting on a fresh
            // /api/entitlements fetch.
            addToFlock(ch.code);
            toast(ch.label + ' added to your flock!');
            selectedChar = ch.code;
            pendingPurchase = null;
            closeShopDetail();
            renderCharGrid();
            showScreen('shop-close');
          })
          .catch(function (err) {
            devLog('purchase: caught error = ' + (err && err.message));
            // A user backing out of the Play purchase sheet isn't an error
            // worth alarming them about — just quietly reset the button.
            var msg = (err && err.message) || '';
            var userCancelled = /cancel/i.test(msg);
            if (!userCancelled) {
              toast('Purchase failed — check your connection and try again.');
            }
          })
          .finally(function () {
            shopDetailBuy.disabled = false;
            shopDetailBuy.textContent = 'Purchase';
          });
      });
    }

    // Re-verifies every Play purchase owned by whatever Google account is
    // currently active on the device against the Worker, re-granting each
    // one under the CURRENT IDENTITY. Returns a promise resolving to the
    // number of purchases actually restored. Callable from the Shop's
    // Restore Purchases button, or automatically right after a fresh
    // sign-in — same underlying operation either way.
    function restoreGooglePlayPurchases() {
      var NativePurchases = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativePurchases;
      devLog('restore: starting (identity = ' + IDENTITY + '), plugin found = ' + !!NativePurchases);
      if (!NativePurchases) return Promise.resolve(0);
      return NativePurchases.getPurchases({ productType: 'inapp' })
        .then(function (result) {
          var purchases = (result && result.purchases) || [];
          devLog('restore: getPurchases returned ' + purchases.length + ' item(s): [' +
            purchases.map(function (p) {
              return (p.productIdentifier || '?') + ' state=' + (p.purchaseState || '?');
            }).join(', ') + ']');
          var verifyOne = function (p) {
            // Android-only fields per the plugin's docs — skip anything
            // that isn't a confirmed, acknowledged real purchase.
            if (p.purchaseState !== '1') {
              devLog('restore: skipping ' + (p.productIdentifier || '?') + ' — purchaseState = ' + (p.purchaseState || 'n/a') + ' (not "1")');
              return Promise.resolve(false);
            }
            var code = null;
            if (p.productIdentifier && p.productIdentifier.indexOf('bird_') === 0) {
              code = p.productIdentifier.slice('bird_'.length).toUpperCase();
            }
            if (!code || !p.purchaseToken) {
              devLog('restore: skipping ' + (p.productIdentifier || '?') + ' — code = ' + (code || 'none') + ', purchaseToken present = ' + !!p.purchaseToken);
              return Promise.resolve(false);
            }
            devLog('restore: verifying ' + code + ' (productId = ' + p.productIdentifier + ')');
            return fetch(BASE + '/api/purchases/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                device: IDENTITY, itemType: 'rebel', itemCode: code,
                productId: p.productIdentifier, purchaseToken: p.purchaseToken
              })
            })
              .then(function (r) {
                devLog('restore: ' + code + ' verify status = ' + r.status);
                if (r.ok) { addToFlock(code); devLog('restore: ' + code + ' granted, added to flock'); return true; }
                return r.text().then(function (t) { devLog('restore: ' + code + ' error body = ' + t); return false; }).catch(function () { return false; });
              })
              .catch(function (err) { devLog('restore: ' + code + ' caught error = ' + (err && err.message)); return false; });
          };
          return Promise.all(purchases.map(verifyOne));
        })
        .then(function (results) {
          var count = results.filter(Boolean).length;
          devLog('restore: complete, ' + count + ' purchase(s) restored');
          return count;
        })
        .catch(function (err) { devLog('restore: getPurchases caught error = ' + (err && err.message)); return 0; });
    }

    if (shopEnabled) {
      var closeShopBtn = mount.querySelector('[data-rl-close-shop]');
      if (closeShopBtn) closeShopBtn.addEventListener('click', function () { closeShopDetail(); pendingPurchase = null; showScreen('shop-close'); });

      var closeInfoBtn = mount.querySelector('[data-rl-close-info]');
      if (closeInfoBtn) closeInfoBtn.addEventListener('click', function () { showScreen('info-close'); });
      var closeSettingsBtn = mount.querySelector('[data-rl-close-settings]');
      if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', function () { showScreen('settings-close'); });

      // ---- Setup screen: hamburger opens the full-screen megamenu
      // (About [includes Credits], Settings, Leaderboard) — tapping it
      // again while open closes it too, same as the Back button.
      var menuBtn = mount.querySelector('[data-rl-menu-btn]');
      if (menuBtn) {
        menuBtn.addEventListener('click', function () {
          var isOpen = screens.menu && !screens.menu.hidden;
          showScreen(isOpen ? 'menu-close' : 'menu-from-start');
        });
      }
      var closeMenuBtn = mount.querySelector('[data-rl-close-menu]');
      if (closeMenuBtn) closeMenuBtn.addEventListener('click', function () { showScreen('menu-close'); });
      var menuAboutBtn = mount.querySelector('[data-rl-menu-about]');
      var menuSettingsBtn = mount.querySelector('[data-rl-menu-settings]');
      var menuLeaderboardBtn = mount.querySelector('[data-rl-menu-leaderboard]');
      if (menuAboutBtn) menuAboutBtn.addEventListener('click', function () { showScreen('info-from-menu'); });
      if (menuSettingsBtn) menuSettingsBtn.addEventListener('click', function () { showScreen('settings-from-menu'); });
      if (menuLeaderboardBtn) {
        menuLeaderboardBtn.addEventListener('click', function () {
          lbTier = DEFAULT_TIER;
          lbSet = selectedScene === 'blizzard' ? 'blizzard' : 'normal';
          mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (t) { t.classList.toggle('rl-selected', t.getAttribute('data-rl-lb-tab') === lbTier); });
          loadLeaderboard(lbTier, lbSet, mount.querySelector('[data-rl-board-full]'), mount.querySelector('[data-rl-lb-set-note]'));
          showScreen('leaderboard-from-menu');
        });
      }
      var openLeaderboardBtn = mount.querySelector('[data-rl-open-leaderboard]');
      if (openLeaderboardBtn) {
        openLeaderboardBtn.addEventListener('click', function () {
          lbTier = DEFAULT_TIER;
          lbSet = selectedScene === 'blizzard' ? 'blizzard' : 'normal';
          mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (t) { t.classList.toggle('rl-selected', t.getAttribute('data-rl-lb-tab') === lbTier); });
          loadLeaderboard(lbTier, lbSet, mount.querySelector('[data-rl-board-full]'), mount.querySelector('[data-rl-lb-set-note]'));
          showScreen('leaderboard-from-start');
        });
      }

      // ---- Settings: SFX/Music volume, persisted ----
      var sfxSlider = mount.querySelector('[data-rl-sfx-volume]');
      var musicSlider = mount.querySelector('[data-rl-music-volume]');
      var VOLUME_KEY = 'rl_volume_v1';
      function loadVolumePrefs() {
        try { return JSON.parse(localStorage.getItem(VOLUME_KEY) || '{}'); } catch (e) { return {}; }
      }
      function saveVolumePrefs(prefs) {
        try { localStorage.setItem(VOLUME_KEY, JSON.stringify(prefs)); } catch (e) {}
      }
      var volumePrefs = loadVolumePrefs();
      var initialSfx = volumePrefs.sfx != null ? volumePrefs.sfx : 100;
      var initialMusic = volumePrefs.music != null ? volumePrefs.music : 100;
      if (sfxSlider) sfxSlider.value = initialSfx;
      if (musicSlider) musicSlider.value = initialMusic;
      soundPlayer.setVolume(initialSfx / 100);
      musicGain = initialMusic / 100;
      applyMusicVolume();
      if (sfxSlider) {
        sfxSlider.addEventListener('input', function () {
          soundPlayer.setVolume(sfxSlider.value / 100);
          var prefs = loadVolumePrefs(); prefs.sfx = Number(sfxSlider.value); saveVolumePrefs(prefs);
        });
      }
      if (musicSlider) {
        musicSlider.addEventListener('input', function () {
          musicGain = musicSlider.value / 100;
          applyMusicVolume();
          var prefs = loadVolumePrefs(); prefs.music = Number(musicSlider.value); saveVolumePrefs(prefs);
        });
      }

      // ---- Settings: language, persisted ----
      // Walks every element currently in the DOM tagged with data-i18n
      // (plain text swap) or data-i18n-html (innerHTML swap, for strings
      // that need to keep a nested element like a live-updating <b> score
      // or a <small> sub-line). Called once at boot with the saved/default
      // language, and again immediately whenever a language button is
      // tapped — no page reload needed.
      function applyLanguage(lang) {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
          el.textContent = t(el.getAttribute('data-i18n'), lang);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
          el.innerHTML = t(el.getAttribute('data-i18n-html'), lang);
        });
      }
      function loadLangPref() {
        try { return localStorage.getItem(LANG_KEY) || 'en'; } catch (e) { return 'en'; }
      }
      function saveLangPref(lang) {
        try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      }
      var currentLang = loadLangPref();
      applyLanguage(currentLang);
      mount.querySelectorAll('[data-rl-lang]').forEach(function (btn) {
        if (btn.getAttribute('data-rl-lang') === currentLang) btn.classList.add('rl-selected');
        else btn.classList.remove('rl-selected');
        btn.addEventListener('click', function () {
          currentLang = btn.getAttribute('data-rl-lang');
          saveLangPref(currentLang);
          mount.querySelectorAll('[data-rl-lang]').forEach(function (b) { b.classList.toggle('rl-selected', b === btn); });
          applyLanguage(currentLang);
        });
      });

      // ---- Settings: Vibration toggle, persisted ----
      var VIBRATION_KEY = 'rl_vibration_v1';
      var vibrationToggle = mount.querySelector('[data-rl-vibration]');
      function loadVibrationPref() {
        try { var v = localStorage.getItem(VIBRATION_KEY); return v === null ? true : v === '1'; } catch (e) { return true; }
      }
      function saveVibrationPref(on) {
        try { localStorage.setItem(VIBRATION_KEY, on ? '1' : '0'); } catch (e) {}
      }
      vibrationEnabled = loadVibrationPref();
      if (vibrationToggle) {
        vibrationToggle.checked = vibrationEnabled;
        vibrationToggle.addEventListener('change', function () {
          vibrationEnabled = vibrationToggle.checked;
          saveVibrationPref(vibrationEnabled);
        });
      }

      // ---- Account: Google Sign-In ----
      var accountStatusEl = mount.querySelector('[data-rl-account-status]');
      var signInBtn = mount.querySelector('[data-rl-signin-btn]');
      var signOutBtn = mount.querySelector('[data-rl-signout-btn]');
      var menuSignInBtn = mount.querySelector('[data-rl-menu-signin]');
      var menuSignOutBtn = mount.querySelector('[data-rl-menu-signout]');
      var GoogleSignIn = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleSignIn;
      // Real web client ID from Google Cloud Console — required by the
      // plugin on every platform, even Android (see its own docs on why).
      var GOOGLE_SIGNIN_CLIENT_ID = '1080299084827-jkc5h2gnn2v76q0gn1fvnvn20eec6bbv.apps.googleusercontent.com';

      function refreshAccountUi() {
        var signedIn = !!loadSignedInUserId();
        var email = loadSignedInEmail();
        if (accountStatusEl) {
          if (signedIn) {
            accountStatusEl.removeAttribute('data-i18n');
            accountStatusEl.textContent = email ? email : 'Signed in';
          } else {
            accountStatusEl.setAttribute('data-i18n', 'notSignedIn');
            accountStatusEl.textContent = t('notSignedIn', currentLang);
          }
        }
        if (signInBtn) signInBtn.hidden = signedIn;
        if (signOutBtn) signOutBtn.hidden = !signedIn;
        // Top-level menu buttons: sign-in shown when signed out, sign-out
        // shown when signed in — opposite states, mirrors Settings' own pair.
        if (menuSignInBtn) menuSignInBtn.hidden = signedIn;
        if (menuSignOutBtn) menuSignOutBtn.hidden = !signedIn;
      }
      refreshAccountUi();
      if (menuSignInBtn) {
        menuSignInBtn.addEventListener('click', function () {
          menuSignInBtn.disabled = true;
          doGoogleSignIn().then(function (ok) {
            menuSignInBtn.disabled = false;
            if (ok) {
              toast('Signed in!');
              restoreGooglePlayPurchases();
            } else {
              toast('Sign-in didn\'t complete — try again.');
            }
          });
        });
      }

      function doGoogleSignIn() {
        devLog('sign-in: starting');
        if (!GoogleSignIn) { devLog('sign-in: GoogleSignIn plugin not found'); return Promise.resolve(false); }
        return GoogleSignIn.initialize({ clientId: GOOGLE_SIGNIN_CLIENT_ID })
          .then(function () {
            devLog('sign-in: initialized, calling signIn()');
            return GoogleSignIn.signIn();
          })
          .then(function (result) {
            devLog('sign-in: signIn() returned, idToken present = ' + !!(result && result.idToken) + ', email = ' + ((result && result.email) || 'none'));
            if (!result || !result.idToken) return false;
            // Never trust the client-side idToken/userId directly — the
            // Worker verifies the token's signature against Google before
            // this identity is actually used for anything.
            return fetch(BASE + '/api/auth/google', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: result.idToken })
            })
              .then(function (r) {
                devLog('sign-in: /api/auth/google status = ' + r.status);
                if (!r.ok) return r.text().then(function (t) { devLog('sign-in: error body = ' + t); throw new Error('verify failed'); });
                return r.json();
              })
              .then(function (data) {
                devLog('sign-in: verify response ok = ' + !!(data && data.ok) + ', userId = ' + ((data && data.userId) || 'none'));
                if (!data || !data.ok) return false;
                IDENTITY = data.userId;
                saveSignedInIdentity(data.userId, result.email || null);
                refreshAccountUi();
                // IDENTITY just changed from the guest placeholder to the
                // real signed-in identity — anything already fetched
                // during boot (roster, coupon entitlements) used the OLD
                // value, so coupon-granted birds would stay invisible
                // until the app restarted without this. Re-run and
                // re-render now that IDENTITY is correct.
                return loadCouponEntitlements().then(function () { devLog('sign-in: coupon entitlements re-fetched, complete'); renderCharGrid(); return true; });
              });
          })
          .catch(function (err) { devLog('sign-in: caught error = ' + (err && err.message)); return false; });
      }
      triggerGoogleSignIn = doGoogleSignIn;

      if (signInBtn) {
        signInBtn.addEventListener('click', function () {
          signInBtn.disabled = true;
          doGoogleSignIn().then(function (ok) {
            signInBtn.disabled = false;
            if (ok) {
              toast('Signed in!');
              // Pull in anything already purchased on this Google account
              // (e.g. from a previous install) now that IDENTITY points
              // at the real account identity — reuses the same restore
              // flow as the Shop's own Restore Purchases button.
              restoreGooglePlayPurchases();
            } else {
              toast('Sign-in didn\'t complete — try again.');
            }
          });
        });
      }
      function doSignOut() {
        clearSignedInIdentity();
        IDENTITY = GUEST_IDENTITY;
        if (GoogleSignIn && GoogleSignIn.signOut) { try { GoogleSignIn.signOut(); } catch (e) {} }
        refreshAccountUi();
        renderCharGrid();
        toast('Signed out.');
      }
      if (signOutBtn) signOutBtn.addEventListener('click', doSignOut);
      if (menuSignOutBtn) menuSignOutBtn.addEventListener('click', doSignOut);
    }

    // Triggers the real Google sign-in flow directly from wherever the
    // user is (a gated purchase/coupon button), rather than navigating
    // into the megamenu/Settings first just to reach a Sign In button —
    // that's a confusing detour for something that should just be a
    // single native prompt.
    function promptSignIn() {
      triggerGoogleSignIn().then(function (ok) {
        if (ok) {
          toast('Signed in!');
          restoreGooglePlayPurchases();
          renderCharGrid();
        } else {
          toast('Sign-in didn\'t complete — try again.');
        }
      });
    }

    // ---- Hidden developer log (tap Settings heading 8x quickly) ----
    var devTapEl = mount.querySelector('[data-rl-dev-tap]');
    var devTapCount = 0;
    var devTapLastAt = 0;
    if (devTapEl) {
      devTapEl.addEventListener('click', function () {
        var now = Date.now();
        // Resets if more than 2s passes between taps — requires genuinely
        // quick, deliberate taps, not scattered accidental ones over time.
        if (now - devTapLastAt > 2000) devTapCount = 0;
        devTapLastAt = now;
        devTapCount++;
        if (devTapCount >= 8) {
          devTapCount = 0;
          renderDevLog();
          showScreen('devlog-from-settings');
        }
      });
    }
    var devLogOutputEl = mount.querySelector('[data-rl-devlog-output]');
    function renderDevLog() {
      if (!devLogOutputEl) return;
      var entries = [];
      try { entries = JSON.parse(localStorage.getItem(DEVLOG_KEY) || '[]'); } catch (e) {}
      if (!Array.isArray(entries) || !entries.length) {
        devLogOutputEl.textContent = '(empty — nothing logged yet this install)';
        return;
      }
      // Most recent first, matching "in the game that I can see" — no
      // scrolling to the bottom needed to see what just happened.
      devLogOutputEl.textContent = entries.slice().reverse().join('\n');
    }
    var devLogCopyBtn = mount.querySelector('[data-rl-devlog-copy]');
    if (devLogCopyBtn) {
      devLogCopyBtn.addEventListener('click', function () {
        var text = devLogOutputEl ? devLogOutputEl.textContent : '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('Copied!'); }).catch(function () { toast('Couldn\'t copy — select the text manually.'); });
        } else {
          toast('Copy not available — select the text manually.');
        }
      });
    }
    var devLogClearBtn = mount.querySelector('[data-rl-devlog-clear]');
    if (devLogClearBtn) {
      devLogClearBtn.addEventListener('click', function () {
        try { localStorage.removeItem(DEVLOG_KEY); } catch (e) {}
        renderDevLog();
        toast('Log cleared.');
      });
    }
    var closeDevLogBtn = mount.querySelector('[data-rl-close-devlog]');
    if (closeDevLogBtn) closeDevLogBtn.addEventListener('click', function () { showScreen('devlog-close'); });

    // ---- First-launch sign-in prompt ----
    var welcomeSignInModal = mount.querySelector('[data-rl-welcome-signin]');
    var welcomeSignInYes = mount.querySelector('[data-rl-welcome-signin-yes]');
    var welcomeSignInNo = mount.querySelector('[data-rl-welcome-signin-no]');
    function closeWelcomeSignIn() {
      markWelcomeSignInShown();
      if (welcomeSignInModal) welcomeSignInModal.hidden = true;
    }
    if (welcomeSignInYes) {
      welcomeSignInYes.addEventListener('click', function () {
        welcomeSignInYes.disabled = true;
        triggerGoogleSignIn().then(function (ok) {
          welcomeSignInYes.disabled = false;
          closeWelcomeSignIn();
          if (ok) {
            toast('Signed in!');
            restoreGooglePlayPurchases();
            renderCharGrid();
          } else {
            toast('Sign-in didn\'t complete — you can try again anytime from the menu.');
          }
        });
      });
    }
    if (welcomeSignInNo) welcomeSignInNo.addEventListener('click', closeWelcomeSignIn);

    // ---- Claim a Code ----
    // Unconditional (not gated by shopEnabled) so it's safely callable from
    // both the main-screen button and the shop's purchase-detail card. The
    // button/modal are hidden via CSS on web regardless, same as everywhere else.
    var getMoreBtn = mount.querySelector('[data-rl-get-more-rebels]');
    if (getMoreBtn) {
      getMoreBtn.addEventListener('click', function () {
        renderShopGrid();
        showScreen('shop-from-start');
      });
    }

    var claimShopBtn = mount.querySelector('[data-rl-shop-claim-code]');
    var claimModal = mount.querySelector('[data-rl-claim-modal]');
    var claimEntry = mount.querySelector('[data-rl-claim-entry]');
    var claimPicker = mount.querySelector('[data-rl-claim-picker]');
    var claimPickerGrid = mount.querySelector('[data-rl-claim-picker-grid]');
    var claimInput = mount.querySelector('[data-rl-claim-input]');
    var claimError = mount.querySelector('[data-rl-claim-error]');
    var claimSubmitBtn = mount.querySelector('[data-rl-claim-submit]');
    var claimCancelBtn = mount.querySelector('[data-rl-claim-cancel]');
    var claimPickerConfirmBtn = mount.querySelector('[data-rl-claim-picker-confirm]');
    var claimPickerCancelBtn = mount.querySelector('[data-rl-claim-picker-cancel]');
    var pendingClaimCode = null;
    var pendingPickItemCode = null;

    function openClaimModal() {
      if (!isSignedIn()) { promptSignIn(); return; }
      if (!claimModal) return;
      if (claimInput) claimInput.value = '';
      if (claimError) claimError.textContent = '';
      if (claimEntry) claimEntry.hidden = false;
      if (claimPicker) claimPicker.hidden = true;
      claimModal.hidden = false;
    }
    function closeClaimModal() {
      pendingClaimCode = null;
      pendingPickItemCode = null;
      if (claimModal) claimModal.hidden = true;
    }
    function grantedToast(granted) {
      var count = (granted || []).length;
      if (count > 1) { toast(count + ' rebels unlocked!'); return; }
      var g = granted && granted[0];
      if (!g) { toast('Unlocked!'); return; }
      var ch = g.itemType === 'rebel' ? rosterByCode(g.itemCode) : null;
      toast((ch ? ch.label : g.itemCode) + ' unlocked!');
    }
    function applyGranted(granted) {
      var needsRosterRefresh = false;
      (granted || []).forEach(function (g) {
        if (g.itemType === 'rebel') {
          if (couponRebels.indexOf(g.itemCode) === -1) couponRebels.push(g.itemCode);
          if (!rosterByCode(g.itemCode)) needsRosterRefresh = true;
        }
      });
      if (needsRosterRefresh) {
        fetch(BASE + '/api/characters' + (IDENTITY ? '?device=' + encodeURIComponent(IDENTITY) : ''))
          .then(function (r) { return r.json(); })
          .then(function (data) { roster = Array.isArray(data) ? data : roster; renderCharGrid(); })
          .catch(function () { renderCharGrid(); });
      } else {
        renderCharGrid();
      }
    }

    if (claimShopBtn) claimShopBtn.addEventListener('click', openClaimModal);
    if (claimCancelBtn) claimCancelBtn.addEventListener('click', closeClaimModal);
    if (claimPickerCancelBtn) claimPickerCancelBtn.addEventListener('click', closeClaimModal);
    if (claimSubmitBtn) {
      claimSubmitBtn.addEventListener('click', function () {
        var code = claimInput ? claimInput.value.trim() : '';
        if (!code) { if (claimError) claimError.textContent = 'Enter a code first.'; return; }
        fetch(BASE + '/api/entitlements/redeem', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: IDENTITY, code: code })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              if (claimError) claimError.textContent = (data && data.error) || 'That code didn\'t work.';
              return;
            }
            if (data.pick) {
              pendingClaimCode = code;
              pendingPickItemCode = null;
              if (claimPickerConfirmBtn) claimPickerConfirmBtn.disabled = true;
              if (!data.options || !data.options.length) {
                if (claimError) claimError.textContent = 'Nothing left to choose from for this code.';
                return;
              }
              claimPickerGrid.innerHTML = '';
              data.options.forEach(function (opt) {
                var ch = rosterByCode(opt.itemCode);
                var card = document.createElement('button');
                card.type = 'button';
                card.className = 'rl-char-card';
                if (charAccent[opt.itemCode]) card.style.setProperty('--tile-accent', charAccent[opt.itemCode]);
                var img = document.createElement('img');
                img.alt = opt.label;
                if (ch) img.src = BASE + ch.src;
                var span = document.createElement('span');
                span.textContent = opt.label;
                card.appendChild(img); card.appendChild(span);
                // Tapping only selects/highlights it — nothing is granted
                // until Confirm is tapped, so a wrong tap doesn't lock anything in.
                card.addEventListener('click', function () {
                  claimPickerGrid.querySelectorAll('.rl-char-card').forEach(function (c) { c.classList.toggle('rl-selected', c === card); });
                  pendingPickItemCode = opt.itemCode;
                  if (claimPickerConfirmBtn) claimPickerConfirmBtn.disabled = false;
                });
                claimPickerGrid.appendChild(card);
              });
              claimEntry.hidden = true;
              claimPicker.hidden = false;
            } else {
              grantedToast(data.granted);
              applyGranted(data.granted);
              closeClaimModal();
              showScreen('shop-close');
            }
          })
          .catch(function () { if (claimError) claimError.textContent = 'Couldn\'t reach the server — try again.'; });
      });
    }
    if (claimPickerConfirmBtn) {
      claimPickerConfirmBtn.addEventListener('click', function () {
        if (!pendingPickItemCode || !pendingClaimCode) return;
        fetch(BASE + '/api/entitlements/redeem-choice', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: IDENTITY, code: pendingClaimCode, itemCode: pendingPickItemCode })
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res && res.ok) {
              grantedToast(res.granted);
              applyGranted(res.granted);
              closeClaimModal();
              showScreen('shop-close');
            } else {
              if (claimError) claimError.textContent = (res && res.error) || 'That didn\'t work — try again.';
            }
          })
          .catch(function () { if (claimError) claimError.textContent = 'Couldn\'t reach the server — try again.'; });
      });
    }

    var splashEl = mount.querySelector('[data-rl-splash]');
    var splashLogoEl = mount.querySelector('.rl-splash-logo');
    var splashMinTimePassed = false;
    var splashLoadDone = false;
    function maybeHideSplash() {
      if (!splashEl || !splashMinTimePassed || !splashLoadDone) return;
      // Fade the logo out first, then fade the whole overlay away once
      // that's finished — "fade the logo out and the regular game session
      // in" as two beats, not an instant cut once loading's done.
      if (splashLogoEl) splashLogoEl.classList.remove('rl-splash-visible');
      setTimeout(function () {
        splashEl.classList.add('rl-splash-hide');
        // Actually detach after the fade transition finishes, so it isn't
        // sitting invisibly on top of the game intercepting taps.
        setTimeout(function () {
          splashEl.hidden = true;
          maybeShowWelcomeSignIn();
        }, 550);
      }, 350);
    }
    function maybeShowWelcomeSignIn() {
      if (!shopEnabled || hasShownWelcomeSignIn() || isSignedIn()) return;
      var modal = mount.querySelector('[data-rl-welcome-signin]');
      if (modal) modal.hidden = false;
    }
    if (shopEnabled && splashEl) {
      splashEl.hidden = false;
      // Starts on a plain black+texture frame (opacity:0 on the logo by
      // default in CSS), then fades the logo in shortly after boot.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (splashLogoEl) splashLogoEl.classList.add('rl-splash-visible');
        });
      });
      setTimeout(function () { splashMinTimePassed = true; maybeHideSplash(); }, 2000);
    } else {
      splashMinTimePassed = true;
      splashLoadDone = true;
    }

    Promise.all([
      loadCouponEntitlements(),
      fetch(BASE + '/api/characters' + (shopEnabled && IDENTITY ? '?device=' + encodeURIComponent(IDENTITY) : ''))
        .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); }),
      fetch(BASE + '/api/scenes' + (IDENTITY ? '?device=' + encodeURIComponent(IDENTITY) : ''))
        .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
        .catch(function () { return []; }) // scenes are non-essential to boot — fall back to just Standard rather than blocking the whole roster load
    ])
      .then(function (results) {
        roster = Array.isArray(results[1]) ? results[1] : [];
        renderCharGrid();
        sceneRoster = Array.isArray(results[2]) ? results[2] : [];
        renderSceneGrid();
        updateSceneButton();
        // Restore previously only ran at the exact moment of a successful
        // sign-in — someone ALREADY signed in on a later boot never got
        // Google's purchase records re-checked against D1 at all. That's
        // exactly how a purchase that succeeded on Google's side but never
        // made it into D1 (e.g. before the acknowledge fix went in) could
        // stay permanently stuck — nothing ever looked again. Fire-and-forget
        // here so it doesn't block/delay the roster showing up.
        if (isSignedIn()) {
          restoreGooglePlayPurchases().then(function (restoredCount) {
            if (restoredCount > 0) renderCharGrid();
          });
        }
      })
      .catch(function () {
        charGrid.innerHTML = '<div class="rl-loading">Couldn\'t load the character roster. Check the Worker is deployed and try refreshing.</div>';
      })
      .finally(function () { splashLoadDone = true; maybeHideSplash(); });

    // ---------- difficulty tier selector (full-screen overlay off the
    // Difficulty button, matching the Scene picker's shape) ----------
    var selectedTier = DEFAULT_TIER;
    var difficultyBtn = mount.querySelector('[data-rl-difficulty-btn]');
    var difficultyBtnName = mount.querySelector('[data-rl-difficulty-btn-name]');
    function updateDifficultyButton() {
      if (difficultyBtnName) difficultyBtnName.textContent = (TIERS[selectedTier] || TIERS[DEFAULT_TIER]).label;
    }
    if (difficultyBtn) {
      difficultyBtn.addEventListener('click', function () {
        showScreen('difficulty-from-start');
      });
    }
    mount.querySelector('[data-rl-close-difficulty]').addEventListener('click', function () { showScreen('difficulty-close'); });
    mount.querySelectorAll('[data-rl-tier]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedTier = btn.getAttribute('data-rl-tier');
        mount.querySelectorAll('[data-rl-tier]').forEach(function (b) { b.classList.toggle('rl-selected', b === btn); });
        updateDifficultyButton();
        // Stays open on tap (unlike before) — Casual Mode also lives on
        // this screen, so closing immediately on a tier tap made it
        // impossible to set both before leaving. Confirm now closes it.
      });
    });
    var difficultyConfirmBtn = mount.querySelector('[data-rl-confirm-difficulty]');
    if (difficultyConfirmBtn) difficultyConfirmBtn.addEventListener('click', function () { showScreen('difficulty-close'); });
    updateDifficultyButton();

    var kidModeEl = mount.querySelector('[data-rl-kidmode]');

    // ---------- leaderboard ----------
    // Same Easy/Medium/Hard tabs either way — which of the 6 underlying
    // boards they point at is decided by the Rainbow Blizzard toggle on the
    // main screen, not a separate switch here.
    var SET_LABELS = { normal: 'Normal scores', blizzard: 'Rainbow Blizzard scores' };
    var lbTier = DEFAULT_TIER;
    var lbSet = 'normal';
    var lbSort = 'score';
    var lastBoardArr = [];
    function boardKey(tier, set) { return set === 'blizzard' ? tier + '-blizzard' : tier; }
    function sortBoard(arr, key) {
      var copy = arr.slice();
      if (key === 'initials') copy.sort(function (a, b) { return a.initials.localeCompare(b.initials); });
      else if (key === 'ts') copy.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); // newest first
      else if (key === 'accuracy') copy.sort(function (a, b) { return (b.accuracy || 0) - (a.accuracy || 0); });
      else copy.sort(function (a, b) { return b.score - a.score; });
      return copy;
    }
    var LB_PAGE_SIZE = 20;
    var lbVisible = LB_PAGE_SIZE;

    function loadLeaderboard(tier, set, container, noteEl) {
      container.innerHTML = '<div class="rl-loading">Loading…</div>';
      if (noteEl) noteEl.textContent = SET_LABELS[set] || SET_LABELS.normal;
      lbVisible = LB_PAGE_SIZE;
      fetch(BASE + '/api/leaderboard?tier=' + encodeURIComponent(boardKey(tier, set)))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          // Server returns {rows, total}; fetched with no limit param, rows
          // is every stored entry for this tier (up to 1000). We keep the
          // full array client-side rather than fetching page-by-page,
          // because the sort dropdown (Accuracy/Name/Date) needs to sort
          // across ALL rows, not just whatever page happened to be
          // requested — sorting a partial page would silently hide
          // higher-ranked rows outside that page.
          lastBoardArr = (data && Array.isArray(data.rows)) ? data.rows : [];
          renderBoardPage(container, sortBoard(lastBoardArr, lbSort));
        })
        .catch(function () { container.innerHTML = '<div class="rl-loading">Couldn\'t load the leaderboard.</div>'; });
    }
    // visibleCount is optional — omitted (or null), every row in arr is
    // rendered, which is what the post-game inline mini-board wants.
    // Passed, only the first N rows render and the function returns
    // whether more rows exist beyond that, so the full leaderboard screen
    // can show/hide its Load More button accordingly.
    function renderBoard(container, arr, highlightTs, visibleCount) {
      if (!arr || !arr.length) {
        container.innerHTML = '<div class="rl-board-empty">No scores yet — be the first.</div>';
        return false;
      }
      var shown = (visibleCount == null) ? arr : arr.slice(0, visibleCount);
      var html = '';
      shown.forEach(function (row, i) {
        var mine = highlightTs && row.ts === highlightTs;
        var accPct = Math.round((row.accuracy || 0) * 100);
        // Theme this row by the character the player used that run, same
        // accent source as the rebel-select cards. Falls back to the brand
        // accent yellow when we don't have a color on record for that
        // character code (e.g. an older row from before accentColor
        // existed, or a code no longer in the roster).
        var rowAccent = (row.character && charAccent[row.character]) || 'var(--rl-accent)';
        html += '<div class="rl-board-row' + (mine ? ' rl-me' : '') + '" style="--row-accent:' + rowAccent + '">'
          + '<span class="rl-rank">' + (i + 1) + '</span>'
          + '<span class="rl-char-tag">' + (row.character || '—') + '</span>'
          + '<span class="rl-init">' + row.initials + '</span>'
          + '<span class="rl-acc-bar" title="' + accPct + '% accuracy"><span class="rl-acc-fill" style="width:' + accPct + '%"></span></span>'
          + '<span class="rl-pts">' + row.score + '</span>'
          + '</div>';
      });
      container.innerHTML = html;
      return shown.length < arr.length;
    }
    // Renders the current page (lbVisible rows) into the full leaderboard
    // screen specifically, and shows/hides the Load More button based on
    // whether more rows remain. Kept separate from renderBoard itself so
    // the post-game inline mini-board (which calls renderBoard directly,
    // unpaginated) is completely unaffected by this.
    function renderBoardPage(container, arr, highlightTs) {
      var hasMore = renderBoard(container, arr, highlightTs, lbVisible);
      var loadMoreBtn = mount.querySelector('[data-rl-lb-load-more]');
      if (loadMoreBtn) loadMoreBtn.hidden = !hasMore;
    }

    mount.querySelector('[data-rl-close-leaderboard]').addEventListener('click', function () { showScreen('leaderboard-close'); });
    mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        lbTier = tab.getAttribute('data-rl-lb-tab');
        mount.querySelectorAll('[data-rl-lb-tab]').forEach(function (t) { t.classList.toggle('rl-selected', t === tab); });
        loadLeaderboard(lbTier, lbSet, mount.querySelector('[data-rl-board-full]'), mount.querySelector('[data-rl-lb-set-note]'));
      });
    });
    mount.querySelector('[data-rl-lb-sort]').addEventListener('change', function () {
      lbSort = this.value;
      // Re-sorting keeps whatever page depth was already revealed (doesn't
      // reset to 20) — the person may have already clicked Load More a few
      // times and re-sorting shouldn't punish that by collapsing it back down.
      renderBoardPage(mount.querySelector('[data-rl-board-full]'), sortBoard(lastBoardArr, lbSort));
    });
    var lbLoadMoreBtn = mount.querySelector('[data-rl-lb-load-more]');
    if (lbLoadMoreBtn) {
      lbLoadMoreBtn.addEventListener('click', function () {
        lbVisible += LB_PAGE_SIZE;
        renderBoardPage(mount.querySelector('[data-rl-board-full]'), sortBoard(lastBoardArr, lbSort));
      });
    }

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
    var powerupLabelEl = mount.querySelector('[data-rl-powerup-label]');
    var powerupBarFillEl = mount.querySelector('[data-rl-powerup-bar-fill]');
    var blizzardBanner = mount.querySelector('[data-rl-blizzard-banner]');
    var finalScoreEl = mount.querySelector('[data-rl-final-score]');
    var finalAccuracyEl = mount.querySelector('[data-rl-final-accuracy]');
    var boardInlineNote = mount.querySelector('[data-rl-board-inline-note]');
    var initialInputs = mount.querySelectorAll('[data-rl-initial]');
    var boardInline = mount.querySelector('[data-rl-board-inline]');
    var submitError = mount.querySelector('[data-rl-submit-error]');
    var scoreSubmitBlock = mount.querySelector('[data-rl-score-submit]');
    var kidNote = mount.querySelector('[data-rl-kid-note]');
    var restartBtn = mount.querySelector('[data-rl-restart]');

    // ---------- gameover safety: protect an unsaved high score from a stray tap ----------
    var scoreSaved = false;       // true once the score has actually been POSTed successfully
    var gameoverLockUntil = 0;    // Play Again ignores taps until this timestamp (absorbs momentum taps from fast play)
    var restartArmed = false;     // true after a first confirm tap on Play Again while a score is unsaved
    var restartArmTimer = null;
    var GAMEOVER_INPUT_LOCK_MS = 700;
    var RESTART_CONFIRM_WINDOW_MS = 2500;

    function resetRestartConfirm() {
      restartArmed = false;
      if (restartArmTimer) { clearTimeout(restartArmTimer); restartArmTimer = null; }
      restartBtn.textContent = 'Play Again';
      restartBtn.classList.remove('rl-btn-confirm');
    }

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
      seedBgSpecks();
    }
    var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(layoutStage) : null;
    if (ro) ro.observe(stageOuter);
    window.addEventListener('resize', layoutStage);

    // ---------- game state ----------
    var S = null;
    function freshState() {
      var accentColor = charAccent[selectedChar] || null;
      var blizzard = selectedScene === 'blizzard'; // works on any difficulty tier
      var tierCfg = TIERS[selectedTier] || TIERS[DEFAULT_TIER];
      // Max wind velocity such that, if it stayed pinned at max the whole
      // fall, a cube would drift about WIND_MAX_RATIO of stage width by the
      // time it lands — real gusts vary, so actual drift is usually less.
      var windMaxPxPerSec = blizzard
        ? (WIND_MAX_RATIO[selectedTier] || 0.1) * W * tierCfg.speed / H
        : 0;
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
        shotsFired: 0,
        shotsHit: 0,
        accuracy: 0,
        cubes: [],
        snow: null,           // life-restore pickup
        bubble: null,         // weapon powerup pickup (type: 'triple'|'rocket'|'mega')
        powerupSeqIndex: 0,   // rotates which powerup the next bubble grants
        nextSnowAt: SNOWFLAKE_INTERVAL,
        nextBubbleAt: SNOWFLAKE_INTERVAL / 2,
        nextSpawnAt: 0,
        projectiles: [],
        particles: [],
        shards: [],
        blasts: [],
        shakeUntil: 0, shakeMag: 0, shakeDuration: 0,
        powerup: null,        // null | 'triple' | 'rocket' | 'mega'
        powerupUntil: 0,
        powerupWasActive: false,
        laserColors: computeLaserColors(accentColor),
        bgColors: computeBgColors(accentColor),
        wind: { bands: rollWindBands(windMaxPxPerSec), maxPxPerSec: windMaxPxPerSec, nextRollAt: 0, streaks: [] },
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

    var POWERUP_LABELS = { triple: '⚡ Triple Laser', rocket: '🚀 Rocket Barrage', mega: '💥 Mega Rocket' };
    function updateHud() {
      scoreEl.textContent = S.melted;
      escapedEl.textContent = S.escaped;
      if (S.paused) return; // freeze powerup timer/sound state while paused
      var now = performance.now();
      var active = now < S.powerupUntil;
      if (!active && S.powerupWasActive) playSound('powerdown');
      S.powerupWasActive = active;
      if (active) {
        tripleBanner.hidden = false;
        powerupLabelEl.textContent = POWERUP_LABELS[S.powerup] || POWERUP_LABELS.triple;
        var remainingMs = S.powerupUntil - now;
        tripleTimerEl.textContent = Math.ceil(remainingMs / 1000);
        powerupBarFillEl.style.transform = 'scaleX(' + clamp(remainingMs / POWERUP_MS, 0, 1) + ')';
      } else {
        tripleBanner.hidden = true;
      }
    }

    // ---------- eye position (one standard spot for every character) ----------
    function getEyePos() {
      var loonW = clamp(W * 0.34, 90, 170);
      var loonH = loonW * CHAR_ASPECT;
      var left = S.loonX - loonW / 2;
      var top = H - loonH;
      return {
        x: left + STANDARD_EYE.xr * loonW,
        y: top + STANDARD_EYE.yr * loonH,
        loonLeft: left, loonTop: top, loonW: loonW, loonH: loonH
      };
    }

    // ---------- spawning ----------
    // Play-area x-bounds: neither a cube's center nor the player's aim can
    // go past these, keeping a real margin at each screen edge (see
    // PLAY_AREA_EDGE_INSET_RATIO above) so nothing ever ends up in an
    // effectively untouchable strip along the sides. Computed fresh from
    // the current W each call since the stage can resize.
    function playAreaMinX() { return W * PLAY_AREA_EDGE_INSET_RATIO; }
    function playAreaMaxX() { return W * (1 - PLAY_AREA_EDGE_INSET_RATIO); }
    function spawnCube(size) {
      var margin = size / 2 + 4;
      var x = rand(Math.max(margin, playAreaMinX()), Math.min(W - margin, playAreaMaxX()));
      var speed = currentDifficulty(S.elapsed).speed;
      S.cubes.push({ x: x, y: -size, size: size, speed: speed * rand(0.85, 1.18), rot: rand(-0.12, 0.12) });
    }
    function spawnSnowflake() {
      var fromLeft = Math.random() < 0.5;
      var y = rand(H * 0.14, H * 0.42);
      S.snow = { x: fromLeft ? -20 : W + 20, y: y, vx: (fromLeft ? 1 : -1) * rand(34, 46), vy: rand(-4, 4), r: 11, wob: rand(0, Math.PI * 2) };
    }
    // Weapon powerups float through in a bubble and rotate through 3 kinds,
    // Same rotation in both modes now: Triple → Mega → Triple… "Triple" just
    // fans whatever the mode's default weapon is (lasers normally, rockets
    // in Rainbow Blizzard) rather than being laser-only. Regular Rocket is
    // no longer a standalone powerup — it's the default weapon in Rainbow
    // Blizzard Mode, so there's nothing left for it to power up FROM there.
    var POWERUP_SEQUENCE = ['triple', 'mega'];
    function spawnPowerupBubble() {
      var fromLeft = Math.random() < 0.5;
      var y = rand(H * 0.14, H * 0.42);
      var type = POWERUP_SEQUENCE[S.powerupSeqIndex % POWERUP_SEQUENCE.length];
      S.powerupSeqIndex++;
      S.bubble = { x: fromLeft ? -20 : W + 20, y: y, vx: (fromLeft ? 1 : -1) * rand(30, 42), vy: rand(-4, 4), r: 14, wob: rand(0, Math.PI * 2), type: type };
    }

    // ---------- weapon presets ----------
    // Speed/trail are expressed as ratios of stage height so they scale
    // sensibly across screen sizes, same spirit as "25vh" — computed to
    // actual px against the live H when a shot is fired.
    var WEAPONS = {
      laser:  { speedRatio: 3.2, pathWidth: 9,  trailRatio: 0.55, pierce: true  }, // default in normal mode — fast, narrow, long trail, passes through
      rocket: { speedRatio: 1.3, pathWidth: 24, trailRatio: 0.25, pierce: false }, // default in Rainbow Blizzard Mode — slower, wide, short trail, stops on impact
      mega:   { speedRatio: 1.05, pathWidth: 34, trailRatio: 0.3, pierce: false } // powerup in both modes — bigger, slower still, explodes in a radius
    };
    var TOY_COLORS = ['#ffb59e', '#7b3f8f', '#c8a2e0', '#ff8fb0', '#5b7fd4', '#9be08a', '#ffd36e'];
    // peach, eggplant, lavender, rose pink, blueberry, mint, butter

    function spawnProjectile(x0, y0, x1, y1, weaponKey, now, color) {
      var weapon = WEAPONS[weaponKey];
      var dx = x1 - x0, dy = y1 - y0;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      S.shotsFired++;
      S.projectiles.push({
        x0: x0, y0: y0, dirX: dx / dist, dirY: dy / dist, totalDist: dist,
        traveled: 0,
        weapon: weaponKey,
        speed: weapon.speedRatio * H,
        pathWidth: weapon.pathWidth,
        trailLength: weapon.trailRatio * H,
        pierce: weapon.pierce,
        color: color || null,
        impacted: false, impactAt: 0, fadeStart: 0, hitSomething: false,
        headX: x0, headY: y0, tailX: x0, tailY: y0
      });
    }

    // ---------- firing ----------
    // Laser is the default weapon in normal mode; Rainbow Blizzard Mode fires
    // regular rockets by default instead and never fires lasers at all.
    // Triple fans out 3 of whichever is currently the default. Mega is the
    // one powerup shared by both modes (reskinned per mode — see drawProjectiles).
    function fire(now) {
      if (now - S.lastFireAt < FIRE_COOLDOWN) return;
      S.lastFireAt = now;
      var active = (S.powerup && now < S.powerupUntil) ? S.powerup : null;
      var defaultWeapon = S.cfg.blizzard ? 'rocket' : 'laser';
      var weaponKey = active === 'mega' ? 'mega' : defaultWeapon;
      playSound(weaponKey === 'laser' ? 'laser' : 'squish');
      var eye = getEyePos();
      var offsets = active === 'triple' ? [-W / 4, 0, W / 4] : [0];
      offsets.forEach(function (off) {
        var topX = eye.x + off;
        var color = weaponKey !== 'laser' ? TOY_COLORS[Math.floor(rand(0, TOY_COLORS.length))] : null;
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
        if (ty < 0 || ty > 1) continue; // cube's Y isn't within the current tail..head segment yet — not reachable this frame
        var bx = lerp(x0, x1, ty);
        if (Math.abs(bx - c.x) < half + c.size / 2 && c.y > -c.size && c.y < H) {
          if (!pr.hitSomething) { pr.hitSomething = true; S.shotsHit++; }
          if (pr.weapon === 'mega') {
            detonateMega(pr, c.x, c.y);
          } else {
            spawnBurst(c.x, c.y, S.cfg.blizzard ? RAINBOW[Math.floor(rand(0, RAINBOW.length))] : '#bfe9ff');
            S.cubes.splice(i, 1);
            S.melted++;
            playSound('hit');
          }
          if (!pr.pierce) {
            pr.impacted = true; pr.impactAt = performance.now();
            if (pr.weapon !== 'mega') spawnBurst(c.x, c.y, pr.color || '#ffcf4d');
            return; // this weapon explodes on first contact — stop checking
          }
        }
      }
      if (S.snow) {
        var ty2 = dy !== 0 ? (S.snow.y - y0) / dy : 0;
        if (ty2 >= 0 && ty2 <= 1) {
          var bx2 = lerp(x0, x1, ty2);
          if (Math.abs(bx2 - S.snow.x) < half + S.snow.r) {
            if (!pr.hitSomething) { pr.hitSomething = true; S.shotsHit++; }
            onSnowflakeHit();
            if (!pr.pierce) { pr.impacted = true; pr.impactAt = performance.now(); return; }
          }
        }
      }
      if (S.bubble) {
        var ty3 = dy !== 0 ? (S.bubble.y - y0) / dy : 0;
        if (ty3 >= 0 && ty3 <= 1) {
          var bx3 = lerp(x0, x1, ty3);
          if (Math.abs(bx3 - S.bubble.x) < half + S.bubble.r) {
            if (!pr.hitSomething) { pr.hitSomething = true; S.shotsHit++; }
            onPowerupBubbleHit();
            if (!pr.pierce) { pr.impacted = true; pr.impactAt = performance.now(); return; }
          }
        }
      }
    }

    // Mega rocket: destroys every cube within MEGA_RADIUS_RATIO of stage
    // width around the impact point, plus a bigger, distinct blast effect —
    // white splatter in Rainbow Blizzard Mode, a red/orange/yellow explosion
    // otherwise.
    function triggerShake(magnitude, durationMs) {
      S.shakeMag = magnitude;
      S.shakeDuration = durationMs;
      S.shakeUntil = performance.now() + durationMs;
    }
    function detonateMega(pr, x, y) {
      var radius = W * MEGA_RADIUS_RATIO;
      var destroyed = 0;
      for (var j = S.cubes.length - 1; j >= 0; j--) {
        var cc = S.cubes[j];
        var dist = Math.hypot(cc.x - x, cc.y - y);
        if (dist <= radius + cc.size / 2) {
          spawnBurst(cc.x, cc.y, S.cfg.blizzard ? '#ffffff' : '#bfe9ff');
          S.cubes.splice(j, 1);
          destroyed++;
        }
      }
      S.melted += destroyed;
      playSound(destroyed ? 'hit' : 'explosion');
      spawnMegaBlast(x, y, radius);
      triggerShake(11, 340);
    }
    function spawnMegaBlast(x, y, radius) {
      S.blasts.push({ x: x, y: y, radius: radius, born: performance.now(), white: S.cfg.blizzard });
      var n = 22;
      for (var i = 0; i < n; i++) {
        var a = rand(0, Math.PI * 2), sp = rand(80, radius * 2.2);
        S.particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
          color: S.cfg.blizzard ? '#ffffff' : (Math.random() < 0.5 ? '#ff9a3d' : '#ffe066')
        });
      }
    }
    function updateBlasts(now) {
      for (var i = S.blasts.length - 1; i >= 0; i--) {
        if (now - S.blasts[i].born > 380) S.blasts.splice(i, 1);
      }
    }
    function drawBlasts(now) {
      S.blasts.forEach(function (b) {
        var t = clamp((now - b.born) / 380, 0, 1);
        var r = lerp(b.radius * 0.15, b.radius, t);
        var alpha = 1 - t;
        ctx.save();
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = b.white ? '#ffffff' : '#ffb238';
        ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = alpha * 0.22;
        ctx.fillStyle = b.white ? '#ffffff' : '#ff9a3d';
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
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
    // in Casual Mode (see loop()), since lives aren't tracked there.
    function onSnowflakeHit() {
      spawnBurst(S.snow.x, S.snow.y, '#ffffff');
      S.snow = null;
      setLives(S.lives + 1, { pulse: true });
    }

    // Weapon powerup bubble: grants whichever effect it's currently showing
    // (Triple Laser / Rocket / Mega Rocket), independent of lives — works in
    // Casual Mode too, same as the old triple-blast pickup did.
    function onPowerupBubbleHit() {
      spawnBurst(S.bubble.x, S.bubble.y, '#9de6ff');
      S.powerup = S.bubble.type;
      S.bubble = null;
      S.powerupUntil = performance.now() + POWERUP_MS;
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
          s: rand(size * 0.14, size * 0.32), life: 1,
          color: S.cfg.blizzard ? RAINBOW[Math.floor(rand(0, RAINBOW.length))] : null
        });
      }
    }

    function onCubeEscaped() {
      S.escaped++;
      playSound('explosion');
      triggerVibration();
      if (S.cfg.kidMode) return;
      setLives(S.lives - 1, { pulse: true });
      if (S.lives <= 0) endGame();
    }

    // ---------- input ----------
    function pointerXFromEvent(e) {
      var rect = stage.getBoundingClientRect();
      var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      return clamp(clientX - rect.left, playAreaMinX(), playAreaMaxX());
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
      else if (e.code === 'ArrowLeft') { S.aimX = clamp(S.aimX - 22, playAreaMinX(), playAreaMaxX()); }
      else if (e.code === 'ArrowRight') { S.aimX = clamp(S.aimX + 22, playAreaMinX(), playAreaMaxX()); }
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
        if (S.powerupUntil > 0) S.powerupUntil += pausedMs; // don't let an active powerup silently expire while paused
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
      blizzardBanner.hidden = !S.cfg.blizzard; // reflects whatever the Rainbow Blizzard toggle currently says
      showScreen('game');
    });
    var doReset = function () {
      if (S) S.running = false;
      stopBlizzardTheme();
      blizzardBanner.hidden = true;
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
    // Ambient background specks — slow, dim, non-interactive, just to keep
    // the gradient from reading flat. Regenerated whenever the stage resizes.
    var bgSpecks = [];
    function seedBgSpecks() {
      bgSpecks = [];
      var n = Math.round((W * H) / 9000);
      for (var i = 0; i < n; i++) {
        bgSpecks.push({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 1.8), speed: rand(4, 12), phase: rand(0, Math.PI * 2) });
      }
    }
    function drawBackground(now) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      if (S.cfg.blizzard) {
        // Slow, smooth hue drift (full rotation ~24s) — deliberately gentle,
        // never a fast flash/strobe. Kept dark and modestly saturated so it
        // doesn't fight with gameplay readability.
        var hue1 = (now / 66) % 360;
        var hue2 = (hue1 + 35) % 360;
        g.addColorStop(0, 'hsl(' + hue1 + ', 42%, 13%)');
        g.addColorStop(1, 'hsl(' + hue2 + ', 42%, 19%)');
      } else {
        var colors = S.bgColors || { top: '#0a1420', bottom: '#16283c' };
        g.addColorStop(0, colors.top); g.addColorStop(1, colors.bottom);
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // soft glow behind the loon, tinted by whatever's currently lighting
      // the scene (the cycling hue in Rainbow Blizzard, laser color otherwise)
      var glowColor;
      if (S.cfg.blizzard) {
        glowColor = 'hsl(' + ((now / 66) % 360) + ', 70%, 55%)';
      } else {
        glowColor = (S.laserColors && S.laserColors.outer) || '#2c4a63';
      }
      var glow = ctx.createRadialGradient(W / 2, H * 0.92, 4, W / 2, H * 0.92, H * 0.55);
      glow.addColorStop(0, colorToRgba(glowColor, 0.16));
      glow.addColorStop(1, colorToRgba(glowColor, 0));
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      ctx.save();
      bgSpecks.forEach(function (s) {
        var tw = 0.4 + 0.35 * Math.sin(now / 900 + s.phase);
        ctx.globalAlpha = tw * 0.5;
        ctx.fillStyle = '#dff1ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
    function updateBgSpecks(dt) {
      bgSpecks.forEach(function (s) {
        s.y += s.speed * dt;
        if (s.y > H) { s.y = -4; s.x = rand(0, W); }
      });
    }

    // ---------- wind (Rainbow Blizzard Mode only) ----------
    // 3 elevation bands (top/mid/bottom third of the stage), each carrying
    // its own horizontal gust velocity. Adjacent bands are constrained to
    // stay within 60% of the max of each other so the wind's direction
    // shifts gradually with elevation rather than snapping from a full
    // gust one way to a full gust the other. Falling cubes blend smoothly
    // between whichever two bands they're currently between.
    function rollWindBands(maxPxPerSec) {
      if (!maxPxPerSec) return [0, 0, 0];
      var bands = [rand(-maxPxPerSec, maxPxPerSec), 0, 0];
      for (var i = 1; i < 3; i++) {
        var step = maxPxPerSec * 0.6;
        var lo = Math.max(-maxPxPerSec, bands[i - 1] - step);
        var hi = Math.min(maxPxPerSec, bands[i - 1] + step);
        bands[i] = rand(lo, hi);
      }
      return bands;
    }
    function windAt(y) {
      var bands = S.wind.bands;
      var third = H / 3;
      var c0 = third * 0.5, c1 = third * 1.5, c2 = third * 2.5; // band centers
      if (y <= c0) return bands[0];
      if (y >= c2) return bands[2];
      if (y <= c1) return lerp(bands[0], bands[1], (y - c0) / (c1 - c0));
      return lerp(bands[1], bands[2], (y - c1) / (c2 - c1));
    }
    function spawnWindStreak() {
      var fromLeft = windAt(rand(0, H)) >= 0;
      S.wind.streaks.push({
        y: rand(H * 0.08, H * 0.92),
        x: fromLeft ? -30 : W + 30,
        vx: (fromLeft ? 1 : -1) * rand(90, 150),
        len: rand(28, 60), life: 1
      });
    }
    function updateWind(now, dt) {
      if (now >= S.wind.nextRollAt) {
        S.wind.bands = rollWindBands(S.wind.maxPxPerSec);
        S.wind.nextRollAt = now + rand(6000, 9000);
      }
      if (Math.random() < dt * 0.6) spawnWindStreak(); // roughly one every ~1.5s on average
      for (var i = S.wind.streaks.length - 1; i >= 0; i--) {
        var st = S.wind.streaks[i];
        st.x += st.vx * dt; st.life -= dt * 0.5;
        if (st.life <= 0 || st.x < -60 || st.x > W + 60) S.wind.streaks.splice(i, 1);
      }
    }
    function drawWindStreaks() {
      S.wind.streaks.forEach(function (st) {
        ctx.save();
        ctx.globalAlpha = clamp(st.life, 0, 1) * 0.22;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x - Math.sign(st.vx) * st.len, st.y);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Deliberately abstract "toy rocket" silhouette (rounded cap + shaft +
    // two base nubs) — a cartoonish nod to the Whipple Building protest
    // coverage, not anatomical detail. Shared by the regular and mega
    // rockets in every mode; only color/scale/stripe differ. Drawn pointing
    // "up" (−y); caller translates.
    var RAINBOW = ['#ff5f5f', '#ffab5f', '#ffe95f', '#5fe08a', '#5fb8ff', '#9d7bff', '#ff7be0'];
    function drawRocketBody(scale, bodyColor, stripeColor) {
      ctx.fillStyle = bodyColor;
      roundRect(ctx, -3.2 * scale, -9 * scale, 6.4 * scale, 15 * scale, 3.2 * scale);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-3 * scale, 6 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.arc(3 * scale, 6 * scale, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      if (stripeColor) {
        ctx.fillStyle = stripeColor;
        roundRect(ctx, -3.2 * scale, -1.3 * scale, 6.4 * scale, 2.4 * scale, 0.6 * scale);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      roundRect(ctx, -1.5 * scale, -7 * scale, 1.8 * scale, 8 * scale, 0.9 * scale);
      ctx.fill();
    }
    // Fire trail for normal-mode rockets — hot yellow-white near the rocket,
    // cooling toward the character's accent color at the tail (same "accent
    // tints it, doesn't have to carry it" idea as the laser core).
    function drawFireTrail(pr, fadeAlpha) {
      var accent = S.cfg.accentColor || '#ff6a00';
      var segs = 8;
      for (var i = 1; i <= segs; i++) {
        var t0 = (i - 1) / segs, t1 = i / segs;
        var ax = lerp(pr.tailX, pr.headX, t0), ay = lerp(pr.tailY, pr.headY, t0);
        var bx = lerp(pr.tailX, pr.headX, t1), by = lerp(pr.tailY, pr.headY, t1);
        var frac = i / segs;
        var col = frac > 0.72 ? '#fff3c4' : (frac > 0.4 ? '#ffb238' : accent);
        ctx.save();
        ctx.globalAlpha = fadeAlpha * (0.25 + 0.65 * frac);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5 + frac * pr.pathWidth * 0.45;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.restore();
      }
    }
    function drawRainbowTrail(pr, fadeAlpha, lineIntensity) {
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
    }

    // Renders every live projectile's CURRENT trail segment (tail..head) —
    // the visual trail IS the active kill-stripe, so what you see is exactly
    // what can hit something. Laser/Rocket/Mega share this one draw path,
    // branching on weapon type and Rainbow Blizzard Mode for color/sprite.
    function drawProjectiles(now) {
      var lineIntensity = S.cfg.tier === 'easy' ? 0.4 : (S.cfg.tier === 'medium' ? 0.7 : 1);
      S.projectiles.forEach(function (pr) {
        var fadeAlpha = pr.impacted
          ? clamp(1 - (now - pr.impactAt) / 220, 0, 1)
          : (pr.fadeStart ? clamp(1 - (now - pr.fadeStart) / 160, 0, 1) : 1);
        if (fadeAlpha <= 0) return;

        if (pr.weapon === 'rocket' || pr.weapon === 'mega') {
          var isMega = pr.weapon === 'mega';
          var scale = isMega ? 2.3 : 1.5; // mega is noticeably bigger
          if (S.cfg.blizzard) {
            drawRainbowTrail(pr, fadeAlpha, lineIntensity);
          } else {
            drawFireTrail(pr, fadeAlpha);
          }
          if (!pr.impacted || (now - pr.impactAt) < 150) {
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.translate(pr.headX, pr.headY);
            if (S.cfg.blizzard) {
              drawRocketBody(scale, pr.color, null); // silicone colors, no stripe — reads as a big rubber rocket either way
            } else if (isMega) {
              drawRocketBody(scale, '#e0332c', '#ffd23f'); // red body, yellow stripe
            } else {
              drawRocketBody(scale, '#c9d3da', null); // plain silver
            }
            ctx.restore();
          }
        } else {
          // laser — default weapon in both modes. Rainbow Blizzard recolors
          // it; otherwise it's the character's accent color (or classic red).
          ctx.save();
          if (S.cfg.blizzard) {
            var grad = ctx.createLinearGradient(pr.tailX, pr.tailY, pr.headX, pr.headY);
            RAINBOW.forEach(function (c, idx) { grad.addColorStop(idx / (RAINBOW.length - 1), c); });
            ctx.globalAlpha = fadeAlpha * 0.55; ctx.strokeStyle = grad; ctx.lineWidth = pr.pathWidth;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
            ctx.globalAlpha = fadeAlpha; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, pr.pathWidth * 0.3);
            ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
          } else {
            var colors = S.laserColors || { outer: '#9d2732', core: '#ff8a8a' };
            ctx.globalAlpha = fadeAlpha * 0.5; ctx.strokeStyle = colors.outer; ctx.lineWidth = pr.pathWidth;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
            ctx.globalAlpha = fadeAlpha; ctx.strokeStyle = colors.core; ctx.lineWidth = Math.max(2, pr.pathWidth * 0.35);
            ctx.beginPath(); ctx.moveTo(pr.tailX, pr.tailY); ctx.lineTo(pr.headX, pr.headY); ctx.stroke();
          }
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
    // Weapon powerup pickup — a translucent bubble with a small icon inside
    // telegraphing which of the 3 rotating effects it grants.
    function drawPowerupBubble(now) {
      if (!S.bubble) return;
      var b = S.bubble; var bob = Math.sin(now / 220 + b.wob) * 3;
      ctx.save();
      ctx.translate(b.x, b.y + bob);

      // bubble shell
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-b.r * 0.35, -b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();

      if (b.type === 'triple') {
        var col = '#ffcf4d';
        ctx.shadowColor = col; ctx.shadowBlur = 7;
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.95;
        [-0.42, 0, 0.42].forEach(function (off) {
          ctx.beginPath();
          ctx.moveTo(0, b.r * 0.3);
          ctx.lineTo(off * b.r * 1.15, -b.r * 0.6);
          ctx.stroke();
        });
      } else if (b.type === 'rocket') {
        ctx.save(); ctx.scale(0.6, 0.6); drawRocketBody(0.95, '#c9d3da', null); ctx.restore();
      } else if (b.type === 'mega') {
        ctx.save(); ctx.scale(0.6, 0.6); drawRocketBody(1.3, '#e0332c', '#ffd23f'); ctx.restore();
      }
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
        if (sh.color) {
          ctx.fillStyle = sh.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        } else {
          var g = ctx.createLinearGradient(-sh.s, -sh.s, sh.s, sh.s);
          g.addColorStop(0, '#eaf9ff'); g.addColorStop(1, '#8fd0ee');
          ctx.fillStyle = g;
          ctx.strokeStyle = 'rgba(79,143,184,0.8)'; ctx.lineWidth = 1;
        }
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
        S.loonX = clamp(S.loonX, playAreaMinX(), playAreaMaxX());

        var arrived = Math.abs(S.loonX - S.aimX) < 3;
        if (S.pendingFire && arrived) { fire(now); S.pendingFire = false; }
        else if (S.firing && arrived) { fire(now); }

        var diff = currentDifficulty(S.elapsed);
        if (now >= S.nextSpawnAt) {
          spawnCube(diff.size);
          S.nextSpawnAt = now + diff.interval * rand(0.8, 1.2);
        }
        // Life-restore pickup doesn't spawn in Casual Mode — lives aren't tracked there.
        if (!S.cfg.kidMode && !S.snow && (now - S.startedAt) >= S.nextSnowAt) {
          spawnSnowflake();
          S.nextSnowAt += SNOWFLAKE_INTERVAL;
        }
        // Weapon powerup bubble spawns regardless of Casual Mode — the rocket/
        // mega/triple effects are all fun independent of the life system.
        if (!S.bubble && (now - S.startedAt) >= S.nextBubbleAt) {
          spawnPowerupBubble();
          S.nextBubbleAt += SNOWFLAKE_INTERVAL;
        }

        var floorY = H - 6;
        for (var i = S.cubes.length - 1; i >= 0; i--) {
          var c = S.cubes[i];
          c.y += c.speed * dt;
          if (S.cfg.blizzard) c.x = clamp(c.x + windAt(c.y) * dt, Math.max(c.size / 2, playAreaMinX()), Math.min(W - c.size / 2, playAreaMaxX()));
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
        if (S.bubble) {
          S.bubble.x += S.bubble.vx * dt;
          if (S.bubble.x < -40 || S.bubble.x > W + 40) S.bubble = null;
        }
        updateProjectiles(dt, now);
        updateBlasts(now);
        updateBgSpecks(dt);
        if (S.cfg.blizzard) updateWind(now, dt);
      }

      var shakeX = 0, shakeY = 0;
      if (now < S.shakeUntil) {
        var shakeRemain = (S.shakeUntil - now) / S.shakeDuration; // 1 -> 0
        var mag = S.shakeMag * shakeRemain;
        shakeX = rand(-mag, mag); shakeY = rand(-mag, mag);
      }
      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawBackground(now);
      if (S.cfg.blizzard) drawWindStreaks();
      var eye = getEyePos();
      drawProjectiles(now);
      drawLoon(eye);
      drawCubes();
      drawSnowflake(now);
      drawPowerupBubble(now);
      drawBlasts(now);
      drawShards(S.paused ? 0 : dt);
      drawParticles(S.paused ? 0 : dt);
      ctx.restore();

      updateHud();
      requestAnimationFrame(loop);
    }

    function endGame() {
      if (!S.running) return;
      S.running = false;
      stopBlizzardTheme();
      blizzardBanner.hidden = true;
      S.accuracy = S.shotsFired > 0 ? S.shotsHit / S.shotsFired : 0;
      finalScoreEl.textContent = S.melted;
      finalAccuracyEl.textContent = Math.round(S.accuracy * 100) + '%';
      boardInline.hidden = true;
      boardInlineNote.hidden = true;
      submitError.textContent = '';
      initialInputs.forEach(function (inp) { inp.value = ''; });
      scoreSubmitBlock.hidden = S.cfg.kidMode;
      kidNote.hidden = !S.cfg.kidMode;
      scoreSaved = S.cfg.kidMode; // kid mode never submits, so there's nothing to protect
      resetRestartConfirm();
      showScreen('gameover');
      gameoverLockUntil = Date.now() + GAMEOVER_INPUT_LOCK_MS;
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
      var submitTier = S.cfg.blizzard ? (S.cfg.tier + '-blizzard') : S.cfg.tier;
      fetch(BASE + '/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initials: initials, tier: submitTier, score: S.melted, accuracy: S.accuracy, character: S.cfg.character })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            submitError.textContent = res.data && res.data.error ? res.data.error : 'Could not save score.';
            btn.removeAttribute('disabled'); btn.textContent = 'Save Score';
            return;
          }
          boardInline.hidden = false;
          boardInlineNote.hidden = false;
          boardInlineNote.textContent = SET_LABELS[S.cfg.blizzard ? 'blizzard' : 'normal'];
          renderBoard(boardInline, sortBoard(res.data.board, 'score'), res.data.submittedTs);
          btn.textContent = 'Saved';
          scoreSaved = true;
          resetRestartConfirm(); // score is safe now, Play Again goes back to a single tap
        })
        .catch(function () {
          submitError.textContent = 'Network error — try again.';
          btn.removeAttribute('disabled'); btn.textContent = 'Save Score';
        });
    });

    restartBtn.addEventListener('click', function () {
      // Absorb momentum taps that land right as the gameover screen appears —
      // these are the accidental hits that were wiping out unsaved scores.
      if (Date.now() < gameoverLockUntil) return;

      // If the score hasn't been saved yet, require a second confirming tap
      // instead of instantly discarding it.
      if (!scoreSaved) {
        if (!restartArmed) {
          restartArmed = true;
          restartBtn.textContent = 'Tap again to leave without saving';
          restartBtn.classList.add('rl-btn-confirm');
          restartArmTimer = setTimeout(resetRestartConfirm, RESTART_CONFIRM_WINDOW_MS);
          return;
        }
      }

      resetRestartConfirm();
      var submitBtn = mount.querySelector('[data-rl-submit-score]');
      submitBtn.removeAttribute('disabled'); submitBtn.textContent = 'Save Score';
      showScreen('start');
    });

    finishBtn.addEventListener('click', function () { endGame(); });

    // ---------- start ----------
    var loopStarted = false;
    mount.querySelector('[data-rl-start]').addEventListener('click', function () {
      soundPlayer.unlock();
      startError.textContent = '';
      if (!selectedChar) { startError.textContent = 'Pick a rebel first.'; return; }
      var wasRandom = selectedChar === RANDOM_CODE;
      if (wasRandom) {
        var pool = roster.map(function (ch) { return ch.code; });
        selectedChar = pool[Math.floor(Math.random() * pool.length)];
      }
      showScreen('game');
      layoutStage();
      S = freshState();
      if (wasRandom) selectedChar = RANDOM_CODE;
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

      stopBlizzardTheme();
      blizzardBanner.hidden = !S.cfg.blizzard;
      if (S.cfg.blizzard) {
        toast('🌀 RAINBOW BLIZZARD MODE', 2000);
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
