/* On the List — built from munsdev/games src/. Do not edit here;
   edit src/ and run tools/build-cta.js. */
/* ==== palette.js ==== */
/* Shared colour tables. Everything the game draws pulls from here so the
   whole thing reads as one palette. */
window.PW = window.PW || {};

(function (PW) {
  'use strict';

  PW.INK = '#0b0e14';

  // Board / chrome.
  PW.UI = {
    void: '#0a0d13',
    frame: '#161c26',
    frameEdge: '#0b0e14',
    lotA: '#232b36',
    lotB: '#1e2530',
    grit: ['#28313d', '#1b222c'],
    barBg: '#141a23',
    text: '#e6ebf3',
    textDim: '#7d8798',
    accent: '#f5b942',
    danger: '#d9534f',
    cuff: '#c9ced8',
    cuffShade: '#8f97a5'
  };

  // Ordered light to dark, so a roster can be spread across the range.
  PW.SKIN = {
    porcelain: { base: '#f7e2d0', shade: '#d9bfa8' },
    pale:      { base: '#f0d0b4', shade: '#d3ab8c' },
    rose:      { base: '#efc3ae', shade: '#cf9d85' },
    peach:     { base: '#e2b189', shade: '#c08e69' },
    amber:     { base: '#d9a45f', shade: '#b5813f' },
    olive:     { base: '#c99a63', shade: '#a67a47' },
    tan:       { base: '#b07a45', shade: '#8d5c30' },
    brown:     { base: '#7e4a26', shade: '#5f3419' },
    umber:     { base: '#6a3a1f', shade: '#4d2814' },
    deep:      { base: '#523020', shade: '#3a2015' },
    ebony:     { base: '#3d2418', shade: '#2a1810' }
  };

  // Multiply a hex colour toward black, for seams and shading.
  PW.shade = function (hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * k);
    var g = Math.round(((n >> 8) & 255) * k);
    var b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  PW.HAIR = {
    black:  '#1d1b1a',
    dark:   '#2f2622',
    brown:  '#4a3524',
    ginger: '#b5541c',
    blonde: '#c9a34e',
    grey:   '#9aa0a8',
    white:  '#dfe3ea'
  };
})(window.PW);

/* ==== pixel.js ==== */
/* A low-resolution drawing surface that gets blown up to fill its container
   at a whole-number scale, so pixels stay square and crisp. */
(function (PW) {
  'use strict';

  PW.createScreen = function (host, opts) {
    var W = opts.width;
    var H = opts.height;
    var background = opts.background || '#000';

    // Everything is drawn at native resolution here...
    var buffer = document.createElement('canvas');
    buffer.width = W;
    buffer.height = H;
    var bctx = buffer.getContext('2d');
    bctx.imageSmoothingEnabled = false;

    // ...then blitted, scaled, onto the visible canvas.
    var view = document.createElement('canvas');
    var vctx = view.getContext('2d');
    vctx.imageSmoothingEnabled = false;
    host.appendChild(view);

    var scale = 1;
    var offX = 0;
    var offY = 0;

    function resize() {
      var box = host.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var pxW = Math.max(1, Math.floor(box.width * dpr));
      var pxH = Math.max(1, Math.floor(box.height * dpr));

      view.width = pxW;
      view.height = pxH;
      view.style.width = box.width + 'px';
      view.style.height = box.height + 'px';
      vctx.imageSmoothingEnabled = false;

      scale = Math.max(1, Math.floor(Math.min(pxW / W, pxH / H)));
      offX = Math.floor((pxW - W * scale) / 2);
      offY = Math.floor((pxH - H * scale) / 2);
    }

    function present(shakeX, shakeY) {
      vctx.fillStyle = background;
      vctx.fillRect(0, 0, view.width, view.height);
      vctx.drawImage(
        buffer,
        offX + Math.round(shakeX || 0) * scale,
        offY + Math.round(shakeY || 0) * scale,
        W * scale,
        H * scale
      );
    }

    // Screen coordinates -> buffer coordinates, for click-to-steer.
    function toBuffer(clientX, clientY) {
      var box = view.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      return {
        x: ((clientX - box.left) * dpr - offX) / scale,
        y: ((clientY - box.top) * dpr - offY) / scale
      };
    }

    resize();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(resize).observe(host);
    } else {
      window.addEventListener('resize', resize);
    }

    return { ctx: bctx, width: W, height: H, present: present, toBuffer: toBuffer };
  };

  /* Fixed-timestep-ish loop: update gets real elapsed seconds, capped so a
     backgrounded tab doesn't fast-forward the whole game on return. */
  PW.runLoop = function (update, render) {
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
})(window.PW);

/* ==== font.js ==== */
/* A 5x7 bitmap font. Uppercase only, which suits the signage look. */
(function (PW) {
  'use strict';

  var G = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
    B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.####',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#####/..#../..#../..#../..#../..#../#####',
    J: '####./...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#...#/#...#/#...#/#...#',
    N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    1: '..#../.##../..#../..#../..#../..#../#####',
    2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '#####/...#./..##./....#/....#/#...#/.###.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.',
    5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '.###./#...#/#..../####./#...#/#...#/.###.',
    7: '#####/....#/...#./..#../.#.../.#.../.#...',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/#...#/.###.',
    ' ': '...../...../...../...../...../...../.....',
    '-': '...../...../...../#####/...../...../.....',
    '.': '...../...../...../...../...../..#../..#..',
    ',': '...../...../...../...../..#../..#../.#...',
    ':': '...../..#../..#../...../..#../..#../.....',
    "'": '..#../..#../...../...../...../...../.....',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    '+': '...../..#../..#../#####/..#../..#../.....',
    '*': '...../.#.#./..#../#####/..#../.#.#./.....'
  };

  var GW = 5, GH = 7, GAP = 1;
  var cache = {};

  function bits(ch) {
    if (cache[ch]) return cache[ch];
    var src = G[ch] || G['?'];
    var rows = src.split('/');
    cache[ch] = rows;
    return rows;
  }

  PW.textWidth = function (str, scale) {
    var s = scale || 1;
    if (str.length === 0) return 0;
    return (str.length * (GW + GAP) - GAP) * s;
  };

  PW.text = function (ctx, str, x, y, color, scale) {
    var s = scale || 1;
    var up = String(str).toUpperCase();
    ctx.fillStyle = color;
    for (var i = 0; i < up.length; i += 1) {
      var rows = bits(up[i]);
      var ox = x + i * (GW + GAP) * s;
      for (var r = 0; r < GH; r += 1) {
        var row = rows[r];
        for (var c = 0; c < GW; c += 1) {
          if (row[c] === '#') ctx.fillRect(ox + c * s, y + r * s, s, s);
        }
      }
    }
    return PW.textWidth(up, s);
  };

  PW.textCentered = function (ctx, str, cx, y, color, scale) {
    var w = PW.textWidth(String(str), scale || 1);
    return PW.text(ctx, str, Math.round(cx - w / 2), y, color, scale);
  };
})(window.PW);

/* ==== sprites.js ==== */
/* Parametric character art.

   Rather than hand-authoring ~50 pixel sprites, a character is described as a
   small object (skin, build, hair, clothes, prop) and drawn from shared parts.
   Every sprite is rendered once at boot into its own 24x24 canvas and cached.

   Shapes are collected before they are painted: body parts get stroked with a
   dark outline (drawn inflated by 1px underneath the fill), details are laid
   flat on top. That gives clean edges without drawing them by hand. */
(function (PW) {
  'use strict';

  var S = 24;
  PW.SPRITE = S;

  // Vertical layout, shared by every facing.
  var HEAD_Y = 3, HEAD_H = 8;
  var NECK_Y = 11;
  var TORSO_Y = 12, TORSO_H = 6;
  var HIP_Y = 18, HIP_H = 2;
  var LEG_Y = 20, LEG_H = 3;
  var SHOE_Y = 23, SHOE_H = 1;

  // Horizontal proportions per build.
  var BUILDS = {
    normal: { torsoX: 6, torsoW: 12, armL: 4, armR: 18, hipX: 7, hipW: 10, legLX: 7, legRX: 13, legW: 4 },
    heavy:  { torsoX: 5, torsoW: 14, armL: 3, armR: 19, hipX: 6, hipW: 12, legLX: 6, legRX: 13, legW: 5 },
    lean:   { torsoX: 7, torsoW: 10, armL: 5, armR: 17, hipX: 8, hipW: 8,  legLX: 8, legRX: 13, legW: 3 }
  };

  function Shapes() {
    this.body = [];
    this.flat = [];
  }
  Shapes.prototype.add = function (x, y, w, h, c) {
    if (w > 0 && h > 0 && c) this.body.push([x, y, w, h, c]);
  };
  Shapes.prototype.det = function (x, y, w, h, c) {
    if (w > 0 && h > 0 && c) this.flat.push([x, y, w, h, c]);
  };
  Shapes.prototype.paint = function (ctx) {
    var i, s;
    ctx.fillStyle = PW.INK;
    for (i = 0; i < this.body.length; i += 1) {
      s = this.body[i];
      ctx.fillRect(s[0] - 1, s[1] - 1, s[2] + 2, s[3] + 2);
    }
    for (i = 0; i < this.body.length; i += 1) {
      s = this.body[i];
      ctx.fillStyle = s[4];
      ctx.fillRect(s[0], s[1], s[2], s[3]);
    }
    for (i = 0; i < this.flat.length; i += 1) {
      s = this.flat[i];
      ctx.fillStyle = s[4];
      ctx.fillRect(s[0], s[1], s[2], s[3]);
    }
  };

  // ---------------------------------------------------------------- hair ---

  function hairFront(s, o, hc, style) {
    if (!hc || style === 'bald') return;
    if (style === 'swoop') {
      // Fringe sweeping across the forehead, thick on the left.
      s.add(o + 7, 1, 10, 3, hc);
      s.add(o + 7, 4, 3, 2, hc);
      s.add(o + 10, 4, 5, 1, hc);
      s.add(o + 16, 3, 1, 3, hc);
    } else if (style === 'pomp') {
      s.add(o + 8, 0, 8, 2, hc);
      s.add(o + 7, 2, 10, 2, hc);
      s.add(o + 7, 4, 1, 2, hc);
      s.add(o + 16, 4, 1, 2, hc);
    } else if (style === 'afro') {
      // Drawn as a ring around the face, so the mass reads round rather than
      // as a crown with blocks stuck to the sides.
      s.add(o + 7, 0, 10, 1, hc);
      s.add(o + 6, 1, 12, 1, hc);
      s.add(o + 5, 2, 14, 1, hc);
      s.add(o + 5, 3, 3, 3, hc);
      s.add(o + 16, 3, 3, 3, hc);
      s.add(o + 6, 6, 2, 2, hc);
      s.add(o + 16, 6, 2, 2, hc);
    } else if (style === 'curls') {
      s.add(o + 7, 1, 10, 3, hc);
      s.add(o + 6, 3, 1, 3, hc);
      s.add(o + 17, 3, 1, 3, hc);
      s.det(o + 7, 0, 2, 1, hc);
      s.det(o + 11, 0, 2, 1, hc);
      s.det(o + 15, 0, 2, 1, hc);
    } else if (style === 'bun') {
      s.add(o + 10, 0, 4, 2, hc);
      s.add(o + 8, 2, 8, 2, hc);
      s.add(o + 7, 3, 1, 3, hc);
      s.add(o + 16, 3, 1, 3, hc);
    } else if (style === 'rough') {
      s.add(o + 7, 1, 10, 3, hc);
      s.add(o + 6, 3, 1, 4, hc);
      s.add(o + 17, 3, 1, 4, hc);
      s.det(o + 8, 0, 2, 1, hc);
      s.det(o + 12, 0, 2, 1, hc);
      s.det(o + 15, 0, 1, 1, hc);
    } else if (style === 'long') {
      s.add(o + 7, 2, 10, 3, hc);
      s.add(o + 6, 4, 2, 7, hc);
      s.add(o + 16, 4, 2, 7, hc);
    } else if (style === 'slick') {
      s.add(o + 8, 2, 8, 2, hc);
      s.add(o + 7, 3, 1, 3, hc);
      s.add(o + 16, 3, 1, 3, hc);
      s.det(o + 9, 3, 5, 1, PW.UI.frame);
    } else { // buzz / crop
      s.add(o + 8, 2, 8, 2, hc);
      s.add(o + 7, 3, 1, 3, hc);
      s.add(o + 16, 3, 1, 3, hc);
    }
  }

  function hairSide(s, o, hc, style) {
    if (!hc || style === 'bald') return;
    if (style === 'swoop') {
      // The fringe sweeps forward past the face rather than stopping flat.
      s.add(o + 9, 2, 7, 2, hc);
      s.add(o + 8, 3, 2, 4, hc);
      s.add(o + 12, 4, 5, 1, hc);
      s.add(o + 16, 3, 2, 2, hc);
    } else if (style === 'pomp') {
      s.add(o + 10, 0, 6, 2, hc);
      s.add(o + 9, 2, 7, 2, hc);
      s.add(o + 8, 3, 1, 4, hc);
      s.add(o + 15, 0, 3, 3, hc);
      s.add(o + 17, 2, 1, 2, hc);
    } else if (style === 'afro') {
      s.add(o + 8, 0, 9, 1, hc);
      s.add(o + 7, 1, 11, 1, hc);
      s.add(o + 6, 2, 12, 1, hc);
      s.add(o + 6, 3, 4, 5, hc);
      s.add(o + 16, 3, 2, 3, hc);
    } else if (style === 'curls') {
      s.add(o + 9, 1, 7, 3, hc);
      s.add(o + 8, 3, 1, 4, hc);
      s.det(o + 9, 0, 2, 1, hc);
      s.det(o + 13, 0, 2, 1, hc);
    } else if (style === 'bun') {
      s.add(o + 7, 3, 3, 3, hc);
      s.add(o + 9, 2, 7, 2, hc);
    } else if (style === 'rough') {
      s.add(o + 8, 1, 8, 3, hc);
      s.add(o + 8, 3, 2, 5, hc);
      s.det(o + 9, 0, 2, 1, hc);
      s.det(o + 13, 0, 2, 1, hc);
    } else if (style === 'long') {
      s.add(o + 8, 2, 8, 3, hc);
      s.add(o + 8, 4, 3, 7, hc);
    } else {
      s.add(o + 9, 2, 7, 2, hc);
      s.add(o + 8, 3, 1, 4, hc);
    }
  }

  function hairBack(s, o, hc, style) {
    if (!hc || style === 'bald') return;
    if (style === 'long') s.add(o + 7, 2, 10, 8, hc);
    else if (style === 'rough' || style === 'curls') s.add(o + 7, 1, 10, 7, hc);
    else if (style === 'afro') {
      s.add(o + 7, 0, 10, 1, hc); s.add(o + 6, 1, 12, 1, hc);
      s.add(o + 5, 2, 14, 6, hc); s.add(o + 6, 8, 12, 1, hc);
    }
    else if (style === 'bun') { s.add(o + 8, 2, 8, 6, hc); s.add(o + 10, 0, 4, 2, hc); }
    else if (style === 'pomp') s.add(o + 8, 1, 8, 7, hc);
    else if (style === 'swoop') s.add(o + 7, 2, 10, 6, hc);
    else s.add(o + 8, 2, 8, 6, hc);
  }


  /* Head silhouettes, one [x, width] pair per row from HEAD_Y down. Feature
     positions stay fixed, so a shape change never shifts the eyes. */
  var FACES = {
    square:  [[8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8]],
    round:   [[9, 6], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [9, 6]],
    tapered: [[8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [9, 6], [9, 6]],
    slim:    [[9, 6], [9, 6], [9, 6], [9, 6], [9, 6], [9, 6], [9, 6], [9, 6]],
    broad:   [[8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [7, 10], [7, 10], [7, 10]]
  };

  function head(s, o, def, sk) {
    var rows = FACES[def.face] || FACES.square;
    for (var i = 0; i < rows.length; i += 1) {
      s.add(o + rows[i][0], HEAD_Y + i, rows[i][1], 1, sk);
    }
  }

  function brows(s, o, def, hc, skin) {
    var kind = def.brows;
    if (!kind || kind === 'none') return;
    var c = def.browColor || hc || skin.shade;
    if (kind === 'thin') {
      s.det(o + 8, 4, 3, 1, c); s.det(o + 13, 4, 3, 1, c);
    } else if (kind === 'thick') {
      s.det(o + 8, 4, 3, 1, c); s.det(o + 13, 4, 3, 1, c);
      s.det(o + 8, 3, 2, 1, c); s.det(o + 14, 3, 2, 1, c);
    } else if (kind === 'arched') {
      s.det(o + 8, 4, 1, 1, c); s.det(o + 9, 3, 2, 1, c);
      s.det(o + 13, 3, 2, 1, c); s.det(o + 15, 4, 1, 1, c);
    } else if (kind === 'angled') {
      // Inner ends dropped toward the nose.
      s.det(o + 8, 3, 2, 1, c); s.det(o + 10, 4, 1, 1, c);
      s.det(o + 13, 4, 1, 1, c); s.det(o + 14, 3, 2, 1, c);
    }
  }

  /* The eyes and the lenses share one geometry: each eye sits at the centre of
     a 3x4 cell, so a makeup ring and a spectacle frame occupy the same box. */
  var EYE_L = 9, EYE_R = 14, EYE_Y = 6;
  var FRAME = '#8a93a6';   // frames must contrast with the eye they surround

  var LEGACY_MAKEUP = { shadow: ['top'], liner: ['bottom', 'outer'], full: ['top', 'bottom', 'outer'] };

  function makeupParts(def) {
    var m = def.makeup;
    if (!m || m === 'none') return null;
    if (typeof m === 'string') m = LEGACY_MAKEUP[m] || null;
    return m && m.length ? m : null;
  }

  /* Each edge of the ring toggles on its own; switch them all on and the eye
     is fully enclosed, which is what reads as tired or bruised. */
  function makeup(s, o, def) {
    var parts = makeupParts(def);
    if (!parts) return;
    var top = def.makeupColor || '#8a4a7a';
    var bottom = def.makeupColor2 || top;
    var has = function (k) { return parts.indexOf(k) !== -1; };
    [[EYE_L, -1, 1], [EYE_R, 1, -1]].forEach(function (eye) {
      var ex = eye[0], outer = eye[1], inner = eye[2];
      if (has('top')) s.det(o + ex - 1, EYE_Y - 1, 3, 1, top);
      if (has('bottom')) s.det(o + ex - 1, EYE_Y + 2, 3, 1, bottom);
      if (has('outer')) s.det(o + ex + outer, EYE_Y, 1, 2, top);
      if (has('inner')) s.det(o + ex + inner, EYE_Y, 1, 2, top);
    });
  }

  function makeupSide(s, o, def) {
    var parts = makeupParts(def);
    if (!parts) return;
    var top = def.makeupColor || '#8a4a7a';
    var bottom = def.makeupColor2 || top;
    var has = function (k) { return parts.indexOf(k) !== -1; };
    if (has('top')) s.det(o + EYE_R - 1, EYE_Y - 1, 3, 1, top);
    if (has('bottom')) s.det(o + EYE_R - 1, EYE_Y + 2, 3, 1, bottom);
    if (has('outer')) s.det(o + EYE_R + 1, EYE_Y, 1, 2, top);
    if (has('inner')) s.det(o + EYE_R - 1, EYE_Y, 1, 2, top);
  }

  // Older characters put eyewear in `eyes`; honour that.
  function specsOf(def) {
    if (def.glasses) return def.glasses === 'none' ? null : def.glasses;
    if (def.eyes === 'round') return 'round';
    if (def.eyes === 'shades') return 'shades';
    return null;
  }

  function tinted(kind) {
    return kind === 'shades' || kind === 'roundShades' || kind === 'aviator';
  }

  /* Front lenses are the 3x3 box around each eye, bridged across the nose. */
  function glasses(s, o, kind, frameColor, lensColor) {
    if (!kind) return;
    var fr = frameColor || FRAME;
    var tint = lensColor || '#181c24';
    var L = EYE_L - 1, R = EYE_R - 1, Y = EYE_Y - 1;

    if (kind === 'round') {
      // Compass points only: a full ring is indistinguishable from a square
      // one at this size.
      [EYE_L, EYE_R].forEach(function (ex) {
        s.det(o + ex, Y, 1, 1, fr); s.det(o + ex, Y + 2, 1, 1, fr);
        s.det(o + ex - 1, EYE_Y, 1, 1, fr); s.det(o + ex + 1, EYE_Y, 1, 1, fr);
      });
      s.det(o + 11, EYE_Y, 2, 1, fr);
    } else if (kind === 'square') {
      [L, R].forEach(function (x) {
        s.det(o + x, Y, 3, 1, fr); s.det(o + x, Y + 2, 3, 1, fr);
        s.det(o + x, EYE_Y, 1, 1, fr); s.det(o + x + 2, EYE_Y, 1, 1, fr);
      });
      s.det(o + 11, EYE_Y, 2, 1, fr);
    } else if (kind === 'halfRim') {
      // Brow bar only, with the bridge dropped a row so it stays two lenses.
      s.det(o + L, Y, 3, 1, fr); s.det(o + R, Y, 3, 1, fr);
      s.det(o + 11, EYE_Y, 2, 1, fr);
      s.det(o + L, EYE_Y, 1, 1, fr); s.det(o + R + 2, EYE_Y, 1, 1, fr);
    } else if (kind === 'shades') {
      s.det(o + L, Y, 8, 3, tint);
      s.det(o + L, Y - 1, 8, 1, fr);
      s.det(o + L + 1, EYE_Y, 1, 1, '#5a6478');
    } else if (kind === 'roundShades') {
      [EYE_L, EYE_R].forEach(function (ex) {
        s.det(o + ex - 1, EYE_Y, 3, 1, tint);
        s.det(o + ex, Y, 1, 1, tint); s.det(o + ex, Y + 2, 1, 1, tint);
      });
      s.det(o + 11, EYE_Y, 2, 1, fr);
    } else if (kind === 'aviator') {
      [L, R].forEach(function (x) {
        s.det(o + x, Y, 3, 2, tint);
        s.det(o + x + 1, Y + 2, 1, 1, tint);
      });
      s.det(o + L, Y - 1, 8, 1, fr);
      s.det(o + 11, Y, 2, 1, fr);
    }
  }

  /* In profile only the near lens shows, and it needs a temple arm running
     back to the ear or it reads as loose pixels on the cheek. */
  /* In profile only the near lens shows, and it needs a temple arm running
     back to the ear or it reads as loose pixels on the cheek. */
  function glassesSide(s, o, kind, frameColor, lensColor) {
    if (!kind) return;
    var fr = frameColor || FRAME;
    var tint = lensColor || '#181c24';
    var x = EYE_R - 1, Y = EYE_Y - 1;

    s.det(o + 11, EYE_Y, 2, 1, fr);   // temple arm, back to the ear

    if (kind === 'round') {
      s.det(o + EYE_R, Y, 1, 1, fr); s.det(o + EYE_R, Y + 2, 1, 1, fr);
      s.det(o + x, EYE_Y, 1, 1, fr); s.det(o + x + 2, EYE_Y, 1, 1, fr);
    } else if (kind === 'square') {
      s.det(o + x, Y, 3, 1, fr); s.det(o + x, Y + 2, 3, 1, fr);
      s.det(o + x, EYE_Y, 1, 1, fr); s.det(o + x + 2, EYE_Y, 1, 1, fr);
    } else if (kind === 'halfRim') {
      s.det(o + x, Y, 3, 1, fr);
      s.det(o + x + 2, EYE_Y, 1, 1, fr);
    } else if (kind === 'shades') {
      s.det(o + x, Y, 3, 3, tint);
      s.det(o + x, Y - 1, 3, 1, fr);
    } else if (kind === 'roundShades') {
      s.det(o + x, EYE_Y, 3, 1, tint);
      s.det(o + EYE_R, Y, 1, 1, tint); s.det(o + EYE_R, Y + 2, 1, 1, tint);
    } else if (kind === 'aviator') {
      s.det(o + x, Y, 3, 2, tint);
      s.det(o + EYE_R, Y + 2, 1, 1, tint);
      s.det(o + x, Y - 1, 3, 1, fr);
    }
  }

  /* Chest graphics: 6 wide, 5 tall, centred on the torso like a printed tee. */
  var GRAPHICS = {
    smiley:   ['......', '.#..#.', '......', '#....#', '.####.'],
    thumbsup: ['..#...', '.##...', '#####.', '#####.', '.####.'],
    heart:    ['.#..#.', '######', '######', '.####.', '..##..'],
    star:     ['..##..', '######', '.####.', '..##..', '.#..#.'],
    flower:   ['.#..#.', '..##..', '.####.', '..##..', '.#..#.'],
    snake:    ['.####.', '#.....', '.###..', '....#.', '.####.'],
    spider:   ['#....#', '.#..#.', '#.##.#', '.#..#.', '#....#'],
    skull:    ['.####.', '######', '#.##.#', '.####.', '.#.#..'],
    bolt:     ['...##.', '..##..', '.####.', '..##..', '.##...']
  };

  function graphic(s, x, y, kind, color) {
    var g = GRAPHICS[kind];
    if (!g || !color) return;
    for (var r = 0; r < g.length; r += 1) {
      for (var c = 0; c < g[r].length; c += 1) {
        if (g[r][c] === '#') s.det(x + c, y + r, 1, 1, color);
      }
    }
  }

  // ---------------------------------------------------------------- hats ---

  function hat(s, o, kind, c, facing) {
    if (!kind) return;
    var accent = PW.UI.accent;
    if (kind === 'cowboy') {
      s.add(o + 4, 3, 16, 1, c);
      s.add(o + 9, 0, 6, 3, c);
    } else if (kind === 'beanie') {
      s.add(o + 7, 1, 10, 4, c);
      s.det(o + 7, 4, 10, 1, '#ffffff22');
    } else if (kind === 'cap') {
      s.add(o + 8, 1, 8, 3, c);
      if (facing !== 'back') s.add(o + 16, 3, 4, 1, c);
      else s.add(o + 4, 3, 4, 1, c);
    } else if (kind === 'police') {
      s.add(o + 7, 1, 10, 3, c);          // crown
      s.add(o + 6, 4, 12, 1, '#12151d');  // brim
      if (facing !== 'back') {
        s.det(o + 11, 1, 2, 2, accent);   // shield
        s.det(o + 11, 3, 2, 1, '#c9a24e');
      }
    }
  }

  // ---------------------------------------------------------------- props ---

  function prop(s, o, b, kind, skin) {
    if (!kind) return;
    var hx = o + b.armR;             // just outside the right hand
    if (kind === 'briefcase') {
      s.add(hx, 17, 5, 5, '#5c3d21');
      s.det(hx + 1, 19, 3, 1, '#c9a24e');
      s.det(hx + 1, 16, 3, 1, '#3b2714');
    } else if (kind === 'laptop') {
      s.add(hx - 1, 16, 6, 4, '#8d99ad');
      s.det(hx, 17, 4, 2, '#39435a');
    } else if (kind === 'cup') {
      s.add(hx + 1, 16, 3, 4, '#e8edf5');
      s.det(hx + 1, 17, 3, 3, '#6fae4b');
      s.det(hx + 2, 14, 1, 2, '#e8edf5');
    } else if (kind === 'phone') {
      s.add(hx + 1, 16, 2, 4, '#22262f');
      s.det(hx + 1, 17, 2, 2, '#7fd4ff');
    } else if (kind === 'pills') {
      s.add(hx + 1, 17, 3, 4, '#e8edf5');
      s.det(hx + 1, 17, 3, 1, '#d9534f');
    } else if (kind === 'keyring') {
      s.det(hx + 1, 17, 3, 1, '#c9a24e');
      s.det(hx + 1, 18, 1, 2, '#c9a24e');
      s.det(hx + 3, 18, 1, 2, '#9aa0a8');
    } else if (kind === 'cigar') {
      s.det(o + 16, 9, 4, 1, '#6b4a2a');
      s.det(o + 20, 9, 1, 1, '#f0803a');
    } else if (kind === 'derrick') {
      s.add(hx, 14, 1, 8, '#4a5262');
      s.add(hx + 3, 14, 1, 8, '#4a5262');
      s.det(hx, 17, 4, 1, '#4a5262');
      s.det(hx, 13, 4, 1, '#4a5262');
    }
  }


  /* Shirt patterns are laid flat over the torso, so they follow the garment
     colour without disturbing its outline. */
  function shirtPattern(s, x, y, w, h, kind, color) {
    if (!kind || kind === 'none' || !color) return;
    var i, j;
    if (kind === 'stripes') {
      for (i = x + 1; i < x + w - 1; i += 3) s.det(i, y, 1, h, color);
    } else if (kind === 'bands') {
      for (j = y; j < y + h; j += 2) s.det(x, j, w, 1, color);
    } else if (kind === 'check') {
      for (j = 0; j < h; j += 1) {
        for (i = 0; i < w; i += 1) {
          if ((Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0) s.det(x + i, y + j, 1, 1, color);
        }
      }
    } else if (kind === 'dots') {
      for (j = 1; j < h; j += 2) {
        for (i = 1; i < w - 1; i += 3) {
          s.det(x + i + (j % 4 === 1 ? 0 : 1), y + j, 1, 1, color);
        }
      }
    }
  }

  function patternOf(def) {
    return def.pattern || (def.pinstripe ? 'stripes' : null);
  }

  function patternColorOf(def) {
    return def.patternColor || def.pinstripe || null;
  }

  // ------------------------------------------------------------- torso art --

  function torsoDetail(s, o, b, def, facing) {
    var cx = o + b.torsoX + Math.floor(b.torsoW / 2);
    // Seam between sleeve and body, so a matching-colour arm still reads.
    s.det(o + b.torsoX, TORSO_Y, 1, TORSO_H, PW.shade(def.shirt, 0.72));
    s.det(o + b.torsoX + b.torsoW - 1, TORSO_Y, 1, TORSO_H, PW.shade(def.shirt, 0.72));
    shirtPattern(s, o + b.torsoX, TORSO_Y, b.torsoW, TORSO_H, patternOf(def), patternColorOf(def));
    if (facing === 'back') {
      if (def.backText) {
        s.det(o + b.torsoX + 2, TORSO_Y + 2, b.torsoW - 4, 1, def.backText);
        s.det(o + b.torsoX + 3, TORSO_Y + 4, b.torsoW - 6, 1, def.backText);
      }
      return;
    }
    if (def.tie) {
      s.det(cx - 1, TORSO_Y, 2, 1, '#ffffff');
      s.det(cx - 1, TORSO_Y + 1, 2, 4, def.tie);
    }
    if (def.lapels) {
      s.det(o + b.torsoX + 1, TORSO_Y, 2, 4, def.lapels);
      s.det(o + b.torsoX + b.torsoW - 3, TORSO_Y, 2, 4, def.lapels);
    }
    if (def.chain) s.det(cx - 2, TORSO_Y + 1, 4, 1, '#e4c06a');
    if (def.badge) s.det(o + b.torsoX + b.torsoW - 3, TORSO_Y + 1, 2, 2, PW.UI.accent);
  }


  function belt(s, o, b, def) {
    if (!def.belt) return;
    s.det(o + b.hipX, HIP_Y, b.hipW, 1, def.belt);
    s.det(o + b.hipX + Math.floor(b.hipW / 2) - 1, HIP_Y, 2, 1, '#e4c06a');
  }

  // ------------------------------------------------------------- assembly --

  function drawFront(s, def, cuffed) {
    var o = def.offsetX || 0;
    var b = BUILDS[def.build || 'normal'];
    var skin = PW.SKIN[def.skin] || PW.SKIN.tan;
    var sk = skin.base;
    var sleeve = def.sleeves === 'short' ? sk : def.shirt;
    var hc = def.hair && PW.HAIR[def.hair];

    s.add(o + b.hipX, HIP_Y, b.hipW, HIP_H, def.pants);
    s.add(o + b.legLX, LEG_Y, b.legW, LEG_H, def.pants);
    s.add(o + b.legRX, LEG_Y, b.legW, LEG_H, def.pants);
    s.add(o + b.legLX, SHOE_Y, b.legW, SHOE_H, def.shoes);
    s.add(o + b.legRX, SHOE_Y, b.legW, SHOE_H, def.shoes);
    belt(s, o, b, def);

    s.add(o + b.torsoX, TORSO_Y, b.torsoW, TORSO_H, def.shirt);
    torsoDetail(s, o, b, def, 'front');
    if (def.graphic && def.graphic !== 'none') {
      graphic(s, o + b.torsoX + Math.floor(b.torsoW / 2) - 3, TORSO_Y + 1,
        def.graphic, def.graphicColor || '#f2f4f8');
    }

    if (cuffed) {
      // Upper arms hang, forearms fold in, wrists meet at the belt line.
      var cx = o + b.torsoX + Math.floor(b.torsoW / 2);
      s.add(o + b.armL, TORSO_Y, 2, 4, sleeve);
      s.add(o + b.armR, TORSO_Y, 2, 4, sleeve);
      s.add(o + b.armL + 2, TORSO_Y + 3, 3, 2, sleeve);
      s.add(o + b.armR - 3, TORSO_Y + 3, 3, 2, sleeve);
      s.add(cx - 2, TORSO_Y + 4, 4, 3, sk);
      s.det(cx - 2, TORSO_Y + 4, 4, 1, PW.UI.cuff);
      s.det(cx - 1, TORSO_Y + 5, 2, 1, PW.UI.cuffShade);
    } else {
      s.add(o + b.armL, TORSO_Y, 2, 5, sleeve);
      s.add(o + b.armR, TORSO_Y, 2, 5, sleeve);
      s.add(o + b.armL, TORSO_Y + 5, 2, 2, sk);
      s.add(o + b.armR, TORSO_Y + 5, 2, 2, sk);
      prop(s, o, b, def.prop, sk);
    }

    s.add(o + 11, NECK_Y, 2, 1, sk);
    head(s, o, def, sk);

    if (def.beard) {
      var bc = PW.HAIR[def.beard.color] || PW.HAIR.brown;
      if (def.beard.style === 'full') {
        s.add(o + 8, 7, 8, 4, bc);
        s.add(o + 7, 6, 1, 4, bc);
        s.add(o + 16, 6, 1, 4, bc);
        s.det(o + 10, 8, 4, 1, skin.shade);
      } else if (def.beard.style === 'goatee') {
        s.det(o + 10, 8, 4, 3, bc);
      } else {
        s.det(o + 9, 8, 6, 2, bc + '');
      }
    } else {
      s.det(o + 11, 9, 2, 1, skin.shade);
    }

    var specs = specsOf(def);
    if (!tinted(specs)) {
      makeup(s, o, def);
      var iris = def.eyeColor || '#1f2430';
      var eh = specs ? 1 : 2;
      s.det(o + EYE_L, EYE_Y, 1, eh, iris);
      s.det(o + EYE_R, EYE_Y, 1, eh, iris);
    }
    glasses(s, o, specs, def.glassesColor, def.lensColor);
    brows(s, o, def, hc, skin);

    hairFront(s, o, hc, def.hairStyle);
    hat(s, o, def.hat, def.hatColor, 'front');
  }

  function drawSide(s, def, cuffed) {
    var o = def.offsetX || 0;
    var b = BUILDS[def.build || 'normal'];
    var skin = PW.SKIN[def.skin] || PW.SKIN.tan;
    var sk = skin.base;
    var sleeve = def.sleeves === 'short' ? sk : def.shirt;
    var hc = def.hair && PW.HAIR[def.hair];
    var narrow = Math.max(6, b.torsoW - 4);
    var tx = o + 12 - Math.floor(narrow / 2);

    s.add(tx, HIP_Y, narrow, HIP_H, def.pants);
    s.add(tx + 1, LEG_Y, narrow - 2, LEG_H, def.pants);
    s.add(tx, SHOE_Y, narrow + 1, SHOE_H, def.shoes);
    if (def.belt) s.det(tx, HIP_Y, narrow, 1, def.belt);

    s.add(tx, TORSO_Y, narrow, TORSO_H, def.shirt);
    shirtPattern(s, tx, TORSO_Y, narrow, TORSO_H, patternOf(def), patternColorOf(def));

    if (cuffed) {
      // Arms out in front, wrists banded.
      s.add(tx + narrow - 2, TORSO_Y + 1, 4, 2, sleeve);
      s.add(tx + narrow + 2, TORSO_Y + 1, 3, 3, sk);
      s.det(tx + narrow + 2, TORSO_Y + 1, 3, 1, PW.UI.cuff);
    } else {
      s.add(tx + 2, TORSO_Y, 3, 5, sleeve);
      s.add(tx + 2, TORSO_Y + 5, 3, 2, sk);
      prop(s, o, b, def.prop, sk);
    }

    s.add(o + 11, NECK_Y, 3, 1, sk);
    var slim = def.face === 'slim';
    s.add(o + (slim ? 10 : 9), HEAD_Y, slim ? 6 : 7, HEAD_H, sk);
    if (def.face === 'broad') s.add(o + 9, 8, 8, 3, sk);
    s.add(o + 16, 6, 1, 2, sk);          // nose

    if (def.beard) {
      var bc = PW.HAIR[def.beard.color] || PW.HAIR.brown;
      s.add(o + 13, 7, 4, 4, bc);
      s.add(o + 9, 6, 1, 4, bc);
    }

    var sspecs = specsOf(def);
    if (!tinted(sspecs)) {
      makeupSide(s, o, def);
      s.det(o + EYE_R, EYE_Y, 1, sspecs ? 1 : 2, def.eyeColor || '#1f2430');
    }
    glassesSide(s, o, sspecs, def.glassesColor, def.lensColor);
    if (def.brows && def.brows !== 'none') {
      s.det(o + EYE_R - 1, 4, 3, 1, def.browColor || hc || skin.shade);
    }

    hairSide(s, o, hc, def.hairStyle);
    hat(s, o, def.hat, def.hatColor, 'side');
  }

  function drawBack(s, def, cuffed) {
    var o = def.offsetX || 0;
    var b = BUILDS[def.build || 'normal'];
    var skin = PW.SKIN[def.skin] || PW.SKIN.tan;
    var sk = skin.base;
    var sleeve = def.sleeves === 'short' ? sk : def.shirt;
    var hc = def.hair && PW.HAIR[def.hair];

    s.add(o + b.hipX, HIP_Y, b.hipW, HIP_H, def.pants);
    s.add(o + b.legLX, LEG_Y, b.legW, LEG_H, def.pants);
    s.add(o + b.legRX, LEG_Y, b.legW, LEG_H, def.pants);
    s.add(o + b.legLX, SHOE_Y, b.legW, SHOE_H, def.shoes);
    s.add(o + b.legRX, SHOE_Y, b.legW, SHOE_H, def.shoes);
    belt(s, o, b, def);

    s.add(o + b.torsoX, TORSO_Y, b.torsoW, TORSO_H, def.shirt);
    torsoDetail(s, o, b, def, 'back');

    if (cuffed) {
      // Hands are hidden from behind, so the read is hunched shoulders plus a
      // glint of steel at each wrist.
      s.add(o + b.armL, TORSO_Y - 1, 2, 6, sleeve);
      s.add(o + b.armR, TORSO_Y - 1, 2, 6, sleeve);
      s.det(o + b.armL, TORSO_Y + 5, 2, 1, PW.UI.cuff);
      s.det(o + b.armR, TORSO_Y + 5, 2, 1, PW.UI.cuff);
    } else {
      s.add(o + b.armL, TORSO_Y, 2, 5, sleeve);
      s.add(o + b.armR, TORSO_Y, 2, 5, sleeve);
      s.add(o + b.armL, TORSO_Y + 5, 2, 2, sk);
      s.add(o + b.armR, TORSO_Y + 5, 2, 2, sk);
      prop(s, o, b, def.prop, sk);
    }

    s.add(o + 11, NECK_Y, 2, 1, sk);
    head(s, o, def, sk);
    hairBack(s, o, hc, def.hairStyle);
    hat(s, o, def.hat, def.hatColor, 'back');
  }

  function render(def, facing, cuffed) {
    var cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var s = new Shapes();
    if (facing === 'side') drawSide(s, def, cuffed);
    else if (facing === 'back') drawBack(s, def, cuffed);
    else drawFront(s, def, cuffed);
    s.paint(ctx);
    return cv;
  }

  /* Bake every sprite a character needs. Players are never cuffed; executives
     only ever appear loose (holding their prop) or cuffed. */
  PW.bake = function (def, opts) {
    var cuffed = !!(opts && opts.cuffed);
    return {
      front: render(def, 'front', cuffed),
      side: render(def, 'side', cuffed),
      back: render(def, 'back', cuffed),
      loose: render(def, 'front', false)
    };
  };

  PW.blit = function (ctx, img, x, y, flip) {
    if (!flip) { ctx.drawImage(img, x, y); return; }
    ctx.save();
    ctx.translate(x + S, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };
})(window.PW);

/* ==== charedit.js ==== */
/* The character editor, as a drop-in panel.

   Both the standalone forge and the game's own "make your own" panel mount this,
   so the field list, the state shape and the emitted source all live in one
   place. Styles are injected once under prefixed class names, so a host page
   only has to provide a container. */
(function (PW) {
  'use strict';

  var C = {};
  PW.CHAR = C;

  C.SKINS = ['porcelain', 'pale', 'rose', 'peach', 'amber', 'olive',
             'tan', 'brown', 'umber', 'deep', 'ebony'];
  C.HAIRS = ['black', 'dark', 'brown', 'ginger', 'blonde', 'grey', 'white'];
  C.HAIR_STYLES = ['buzz', 'crop', 'slick', 'swoop', 'pomp', 'rough', 'curls', 'afro', 'bun', 'long', 'bald'];
  C.FACES = ['square', 'round', 'tapered', 'slim', 'broad'];
  C.BROWS = ['none', 'thin', 'thick', 'arched', 'angled'];
  C.BEARDS = ['none', 'full', 'goatee', 'stubble'];
  C.MAKEUP_EDGES = ['top', 'bottom', 'outer', 'inner'];
  C.GLASSES = ['none', 'round', 'square', 'halfRim', 'shades', 'roundShades', 'aviator'];
  C.HATS = ['none', 'cap', 'beanie', 'cowboy', 'police'];
  C.BUILDS = ['normal', 'heavy', 'lean'];
  C.SLEEVES = ['long', 'short'];
  C.PATTERNS = ['none', 'stripes', 'bands', 'check', 'dots'];
  C.GRAPHICS = ['none', 'smiley', 'thumbsup', 'heart', 'star', 'flower', 'snake', 'spider', 'skull', 'bolt'];
  C.PROPS = ['none', 'briefcase', 'laptop', 'cup', 'phone', 'pills', 'keyring', 'cigar', 'derrick'];

  // Fields that are only written when switched on.
  var OPT_COLORS = ['eyeColor', 'browColor', 'makeupColor2', 'glassesColor',
                    'lensColor', 'tie', 'lapels', 'belt', 'backText'];

  var GROUPS = [
    ['Identity', [{ k: 'name', t: 'text' }]],
    ['Body', [
      { k: 'skin', t: 'select', opts: C.SKINS },
      { k: 'build', t: 'select', opts: C.BUILDS },
      { k: 'face', t: 'select', opts: C.FACES }
    ]],
    ['Hair', [
      { k: 'hairStyle', t: 'select', opts: C.HAIR_STYLES },
      { k: 'hair', t: 'select', opts: C.HAIRS },
      { k: 'beardStyle', t: 'select', opts: C.BEARDS },
      { k: 'beardColor', t: 'select', opts: C.HAIRS },
      { k: 'hat', t: 'select', opts: C.HATS },
      { k: 'hatColor', t: 'color' }
    ]],
    ['Eyes', [
      { k: 'brows', t: 'select', opts: C.BROWS },
      { k: 'browColor', t: 'optcolor' },
      { k: 'eyeColor', t: 'optcolor' },
      { k: 'makeupTop', t: 'bool' },
      { k: 'makeupBottom', t: 'bool' },
      { k: 'makeupOuter', t: 'bool' },
      { k: 'makeupInner', t: 'bool' },
      { k: 'makeupColor', t: 'color' },
      { k: 'makeupColor2', t: 'optcolor' }
    ]],
    ['Glasses', [
      { k: 'glasses', t: 'select', opts: C.GLASSES },
      { k: 'glassesColor', t: 'optcolor' },
      { k: 'lensColor', t: 'optcolor' }
    ]],
    ['Clothes', [
      { k: 'shirt', t: 'color' },
      { k: 'pattern', t: 'select', opts: C.PATTERNS },
      { k: 'patternColor', t: 'color' },
      { k: 'graphic', t: 'select', opts: C.GRAPHICS },
      { k: 'graphicColor', t: 'color' },
      { k: 'sleeves', t: 'select', opts: C.SLEEVES },
      { k: 'pants', t: 'color' },
      { k: 'shoes', t: 'color' }
    ]],
    ['Details', [
      { k: 'tie', t: 'optcolor' },
      { k: 'lapels', t: 'optcolor' },
      { k: 'belt', t: 'optcolor' },
      { k: 'backText', t: 'optcolor' },
      { k: 'chain', t: 'bool' },
      { k: 'badge', t: 'bool' }
    ]],
    ['Prop', [{ k: 'prop', t: 'select', opts: C.PROPS }]]
  ];

  var LABELS = {
    name: 'Name', skin: 'Skin', build: 'Build', face: 'Face shape',
    hairStyle: 'Hair', hair: 'Hair colour', beardStyle: 'Beard', beardColor: 'Beard colour',
    hat: 'Hat', hatColor: 'Hat colour',
    brows: 'Brows', browColor: 'Brow colour', eyeColor: 'Eye colour',
    makeupTop: 'Ring: top', makeupBottom: 'Ring: bottom', makeupOuter: 'Ring: outer',
    makeupInner: 'Ring: inner', makeupColor: 'Ring colour', makeupColor2: 'Lower colour',
    glasses: 'Glasses', glassesColor: 'Frames', lensColor: 'Lenses',
    shirt: 'Shirt', pattern: 'Pattern', patternColor: 'Pattern colour',
    graphic: 'Graphic', graphicColor: 'Graphic colour', sleeves: 'Sleeves',
    pants: 'Trousers', shoes: 'Shoes', tie: 'Tie', lapels: 'Lapels', belt: 'Belt',
    backText: 'Back marks', chain: 'Chain', badge: 'Badge', prop: 'Prop'
  };

  C.defaults = function () {
    return {
      name: 'MY OFFICER', skin: 'olive', build: 'normal', face: 'square',
      hairStyle: 'swoop', hair: 'brown', beardStyle: 'none', beardColor: 'brown',
      hat: 'none', hatColor: '#2b3a4a',
      brows: 'thin', browColor: null, eyeColor: null,
      makeupTop: false, makeupBottom: false, makeupOuter: false, makeupInner: false,
      makeupColor: '#8a4a7a', makeupColor2: null,
      glasses: 'none', glassesColor: null, lensColor: null,
      shirt: '#33436b', pattern: 'none', patternColor: '#5a6a8c',
      graphic: 'none', graphicColor: '#f2f4f8', sleeves: 'long',
      pants: '#232c42', shoes: '#141821',
      tie: null, lapels: null, belt: '#141821', backText: null,
      chain: false, badge: true, prop: 'none'
    };
  };

  function slug(name) {
    var v = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return v || 'character';
  }

  // Editor state -> the object the sprite renderer consumes.
  C.toDef = function (S) {
    var d = {
      id: slug(S.name), name: String(S.name).toUpperCase(),
      skin: S.skin, build: S.build, face: S.face, hairStyle: S.hairStyle,
      shirt: S.shirt, sleeves: S.sleeves, pants: S.pants, shoes: S.shoes
    };
    if (S.hairStyle !== 'bald') d.hair = S.hair;
    if (S.beardStyle !== 'none') d.beard = { style: S.beardStyle, color: S.beardColor };
    if (S.hat !== 'none') { d.hat = S.hat; d.hatColor = S.hatColor; }
    if (S.brows !== 'none') d.brows = S.brows;
    var ring = C.MAKEUP_EDGES.filter(function (e) {
      return S['makeup' + e.charAt(0).toUpperCase() + e.slice(1)];
    });
    if (ring.length) { d.makeup = ring; d.makeupColor = S.makeupColor; }
    if (S.glasses !== 'none') d.glasses = S.glasses;
    if (S.pattern !== 'none') { d.pattern = S.pattern; d.patternColor = S.patternColor; }
    if (S.graphic !== 'none') { d.graphic = S.graphic; d.graphicColor = S.graphicColor; }
    OPT_COLORS.forEach(function (k) { if (S[k]) d[k] = S[k]; });
    if (S.chain) d.chain = true;
    if (S.badge) d.badge = true;
    if (S.prop !== 'none') d.prop = S.prop;
    return d;
  };

  // ...and back again, tolerating eyewear held in `eyes` and the old `pinstripe`.
  C.fromDef = function (d) {
    var S = C.defaults();
    S.name = d.name || 'CHARACTER';
    S.skin = d.skin || 'tan';
    S.build = d.build || 'normal';
    S.face = d.face || 'square';
    S.hairStyle = d.hairStyle || 'buzz';
    S.hair = d.hair || 'black';
    S.beardStyle = d.beard ? d.beard.style : 'none';
    S.beardColor = (d.beard && d.beard.color) || 'brown';
    S.hat = d.hat || 'none';
    S.hatColor = d.hatColor || '#2b3a4a';
    S.brows = d.brows || 'none';
    // Accepts the edge list, or the older shadow/liner/full names.
    var LEGACY = { shadow: ['top'], liner: ['bottom', 'outer'], full: ['top', 'bottom', 'outer'] };
    var ring = d.makeup;
    if (typeof ring === 'string') ring = LEGACY[ring] || [];
    if (!ring) ring = [];
    C.MAKEUP_EDGES.forEach(function (e) {
      S['makeup' + e.charAt(0).toUpperCase() + e.slice(1)] = ring.indexOf(e) !== -1;
    });
    S.makeupColor = d.makeupColor || '#8a4a7a';
    S.glasses = d.glasses || (d.eyes === 'round' ? 'round' : d.eyes === 'shades' ? 'shades' : 'none');
    S.shirt = d.shirt || '#33436b';
    S.pattern = d.pattern || (d.pinstripe ? 'stripes' : 'none');
    S.patternColor = d.patternColor || d.pinstripe || '#5a6a8c';
    S.graphic = d.graphic || 'none';
    S.graphicColor = d.graphicColor || '#f2f4f8';
    S.sleeves = d.sleeves || 'long';
    S.pants = d.pants || '#232c42';
    S.shoes = d.shoes || '#141821';
    OPT_COLORS.forEach(function (k) { S[k] = d[k] || null; });
    S.chain = !!d.chain;
    S.badge = !!d.badge;
    S.prop = d.prop || 'none';
    return S;
  };


  /* Every key toDef can emit. The consistency test checks this against what
     the sprite renderer actually reads. */
  C.KEYS = ['id', 'name', 'skin', 'build', 'face', 'hair', 'hairStyle', 'beard',
            'hat', 'hatColor', 'brows', 'browColor', 'eyeColor', 'makeup',
            'makeupColor', 'makeupColor2', 'glasses', 'glassesColor', 'lensColor',
            'shirt', 'sleeves', 'pattern', 'patternColor', 'graphic', 'graphicColor',
            'tie', 'lapels', 'belt', 'backText', 'chain', 'badge', 'pants', 'shoes', 'prop'];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function hue() {
    var h = Math.floor(Math.random() * 360);
    var sat = (25 + Math.random() * 45) / 100;
    var lum = (22 + Math.random() * 45) / 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = sat * Math.min(lum, 1 - lum);
    var f = function (n) { return lum - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1)); };
    var hx = function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); };
    return '#' + hx(f(0)) + hx(f(8)) + hx(f(4));
  }

  /* Lives here rather than in the page, so it can only ever produce values the
     schema actually knows about. */
  C.randomState = function () {
    var S = C.defaults();
    S.name = 'DRAFT';
    S.skin = pick(C.SKINS);
    S.build = pick(C.BUILDS);
    S.face = pick(C.FACES);
    S.hairStyle = pick(C.HAIR_STYLES);
    S.hair = pick(C.HAIRS);
    S.beardStyle = pick(['none', 'none', 'full', 'goatee', 'stubble']);
    S.beardColor = S.hair;
    S.hat = pick(['none', 'none'].concat(C.HATS.slice(1)));
    S.hatColor = hue();
    S.brows = pick(C.BROWS);
    S.browColor = Math.random() < 0.2 ? hue() : null;
    S.eyeColor = Math.random() < 0.4 ? hue() : null;
    C.MAKEUP_EDGES.forEach(function (e) {
      S['makeup' + e.charAt(0).toUpperCase() + e.slice(1)] = Math.random() < 0.25;
    });
    S.makeupColor = hue();
    S.makeupColor2 = Math.random() < 0.2 ? hue() : null;
    S.glasses = pick(['none', 'none'].concat(C.GLASSES.slice(1)));
    S.glassesColor = Math.random() < 0.25 ? hue() : null;
    S.lensColor = Math.random() < 0.15 ? hue() : null;
    S.shirt = hue();
    S.pattern = pick(['none', 'none'].concat(C.PATTERNS.slice(1)));
    S.patternColor = hue();
    S.graphic = pick(['none', 'none'].concat(C.GRAPHICS.slice(1)));
    S.graphicColor = hue();
    S.sleeves = pick(['long', 'long', 'short']);
    S.pants = hue();
    S.shoes = '#181c24';
    S.tie = Math.random() < 0.3 ? hue() : null;
    S.lapels = Math.random() < 0.3 ? hue() : null;
    S.belt = Math.random() < 0.3 ? '#141821' : null;
    S.backText = null;
    S.chain = Math.random() < 0.25;
    S.badge = Math.random() < 0.2;
    S.prop = pick(C.PROPS);
    return S;
  };

  C.GROUPS = GROUPS;
  C.LABELS = LABELS;

  function q(v) { return typeof v === 'string' ? "'" + v + "'" : String(v); }

  C.source = function (d) {
    function line(pairs) { return '  ' + pairs.filter(Boolean).join(', ') + ','; }
    var L = [];
    L.push(line(['id: ' + q(d.id), 'name: ' + q(d.name)]));
    L.push(line([
      'skin: ' + q(d.skin), 'build: ' + q(d.build), 'face: ' + q(d.face),
      d.hair && 'hair: ' + q(d.hair), 'hairStyle: ' + q(d.hairStyle)
    ]));
    if (d.beard) L.push('  beard: { style: ' + q(d.beard.style) + ', color: ' + q(d.beard.color) + ' },');
    if (d.hat) L.push(line(['hat: ' + q(d.hat), 'hatColor: ' + q(d.hatColor)]));
    var eye = [
      d.brows && 'brows: ' + q(d.brows),
      d.browColor && 'browColor: ' + q(d.browColor),
      d.eyeColor && 'eyeColor: ' + q(d.eyeColor),
      d.makeup && 'makeup: [' + d.makeup.map(q).join(', ') + ']',
      d.makeup && 'makeupColor: ' + q(d.makeupColor),
      d.makeupColor2 && 'makeupColor2: ' + q(d.makeupColor2)
    ].filter(Boolean);
    if (eye.length) L.push(line(eye));
    var spec = [
      d.glasses && 'glasses: ' + q(d.glasses),
      d.glassesColor && 'glassesColor: ' + q(d.glassesColor),
      d.lensColor && 'lensColor: ' + q(d.lensColor)
    ].filter(Boolean);
    if (spec.length) L.push(line(spec));
    var wear = ['shirt: ' + q(d.shirt), 'sleeves: ' + q(d.sleeves)];
    if (d.pattern) wear.push('pattern: ' + q(d.pattern), 'patternColor: ' + q(d.patternColor));
    if (d.graphic) wear.push('graphic: ' + q(d.graphic), 'graphicColor: ' + q(d.graphicColor));
    ['tie', 'lapels', 'belt', 'backText'].forEach(function (k) {
      if (d[k]) wear.push(k + ': ' + q(d[k]));
    });
    if (d.chain) wear.push('chain: true');
    if (d.badge) wear.push('badge: true');
    L.push(line(wear));
    var tail = ['pants: ' + q(d.pants), 'shoes: ' + q(d.shoes)];
    if (d.prop) tail.push('prop: ' + q(d.prop));
    L.push('  ' + tail.join(', '));
    return '{\n' + L.join('\n') + '\n},';
  };

  /* Normalise a JS object literal into JSON and parse it, rather than
     evaluating whatever was pasted in. Throws on anything malformed. */
  C.parse = function (text) {
    var raw = String(text).trim().replace(/,\s*$/, '');
    var json = raw
      .replace(/'/g, '"')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,(\s*[}\]])/g, '$1');
    var d = JSON.parse(json);
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('not an object');
    return d;
  };

  var CSS = [
    '.pwed-group{border-top:1px solid var(--pwed-edge,#232d3c);margin:0;padding:12px 0 0}',
    '.pwed-group:first-child{border-top:0;padding-top:0}',
    '.pwed-legend{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--pwed-label,#c9ced8);padding:0 0 8px}',
    '.pwed-field{display:grid;grid-template-columns:92px 1fr;align-items:center;gap:8px;margin-bottom:6px}',
    '.pwed-field>label{font-size:11px;color:var(--pwed-dim,#78849a)}',
    '.pwed-pair{display:flex;align-items:center;gap:6px}',
    '.pwed input[type=text],.pwed select{width:100%;font:inherit;font-size:12px;color:var(--pwed-text,#dfe6f2);background:var(--pwed-sunk,#0b0f16);border:1px solid var(--pwed-edge,#232d3c);border-radius:3px;padding:4px 6px}',
    '.pwed input[type=color]{width:34px;height:26px;padding:0;background:var(--pwed-sunk,#0b0f16);border:1px solid var(--pwed-edge,#232d3c);border-radius:3px;cursor:pointer}',
    '.pwed input[type=checkbox]{accent-color:var(--pwed-accent,#f5b942);width:15px;height:15px}',
    '.pwed-hex{font-size:11px;color:var(--pwed-dim,#78849a);font-variant-numeric:tabular-nums}'
  ].join('\n');

  var styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    var el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* Mount the control panel. Returns { get, set } — `get` yields a character
     def, `set` takes one. `onChange` fires on every edit with the current def. */
  PW.createEditor = function (mount, opts) {
    injectStyle();
    opts = opts || {};
    var S = opts.value ? C.fromDef(opts.value) : C.defaults();
    var inputs = {};
    mount.classList.add('pwed');
    mount.textContent = '';

    function emit() { if (opts.onChange) opts.onChange(C.toDef(S)); }

    function row(labelText, control) {
      var d = document.createElement('div');
      d.className = 'pwed-field';
      var l = document.createElement('label');
      l.textContent = labelText;
      d.appendChild(l);
      d.appendChild(control);
      return d;
    }

    GROUPS.forEach(function (grp) {
      var fs = document.createElement('div');
      fs.className = 'pwed-group';
      var lg = document.createElement('div');
      lg.className = 'pwed-legend';
      lg.textContent = grp[0];
      fs.appendChild(lg);

      grp[1].forEach(function (f) {
        var control, el;
        if (f.t === 'text') {
          el = document.createElement('input');
          el.type = 'text';
          el.value = S[f.k];
          el.addEventListener('input', function () { S[f.k] = el.value; emit(); });
          control = el;
        } else if (f.t === 'select') {
          el = document.createElement('select');
          f.opts.forEach(function (o) {
            var op = document.createElement('option');
            op.value = o; op.textContent = o;
            el.appendChild(op);
          });
          el.value = S[f.k];
          el.addEventListener('change', function () { S[f.k] = el.value; emit(); });
          control = el;
        } else if (f.t === 'color') {
          control = document.createElement('div');
          control.className = 'pwed-pair';
          el = document.createElement('input');
          el.type = 'color';
          el.value = S[f.k];
          var hex = document.createElement('span');
          hex.className = 'pwed-hex';
          hex.textContent = S[f.k];
          el.addEventListener('input', function () {
            S[f.k] = el.value; hex.textContent = el.value; emit();
          });
          control.appendChild(el);
          control.appendChild(hex);
          el.hexLabel = hex;
        } else if (f.t === 'optcolor') {
          control = document.createElement('div');
          control.className = 'pwed-pair';
          var on = document.createElement('input');
          on.type = 'checkbox';
          on.checked = !!S[f.k];
          el = document.createElement('input');
          el.type = 'color';
          el.value = S[f.k] || '#8a94a6';
          el.disabled = !on.checked;
          var hx = document.createElement('span');
          hx.className = 'pwed-hex';
          hx.textContent = on.checked ? S[f.k] : 'off';
          var sync = function () {
            el.disabled = !on.checked;
            S[f.k] = on.checked ? el.value : null;
            hx.textContent = on.checked ? el.value : 'off';
            emit();
          };
          on.addEventListener('change', sync);
          el.addEventListener('input', sync);
          control.appendChild(on);
          control.appendChild(el);
          control.appendChild(hx);
          el.toggle = on;
          el.hexLabel = hx;
        } else {
          el = document.createElement('input');
          el.type = 'checkbox';
          el.checked = !!S[f.k];
          el.addEventListener('change', function () { S[f.k] = el.checked; emit(); });
          control = el;
        }
        inputs[f.k] = el;
        fs.appendChild(row(LABELS[f.k] || f.k, control));
      });

      mount.appendChild(fs);
    });

    function refresh() {
      Object.keys(inputs).forEach(function (k) {
        var el = inputs[k];
        if (el.type === 'color') {
          var v = S[k];
          if (el.toggle) {
            el.toggle.checked = !!v;
            el.disabled = !v;
            if (v) el.value = v;
            el.hexLabel.textContent = v || 'off';
          } else {
            el.value = v;
            el.hexLabel.textContent = v;
          }
        } else if (el.type === 'checkbox') {
          el.checked = !!S[k];
        } else {
          el.value = S[k];
        }
      });
    }

    emit();

    return {
      get: function () { return C.toDef(S); },
      state: function () { return S; },
      set: function (def) { S = C.fromDef(def); refresh(); emit(); },
      replaceState: function (next) { S = next; refresh(); emit(); }
    };
  };
})(window.PW);

/* ==== roster.js ==== */
/* Who is in the game.

   PLAYERS are pickable before a shift and are never cuffed.
   EXECS are the pickups. Each one is baked twice: loose (holding whatever
   prop they carry) for when they're standing in the lot, and cuffed for once
   they've joined the line behind you. Their clothes stay the same either way,
   so the line reads as a row of recognisable individuals. */
(function (PW) {
  'use strict';

  /* One officer, no picker: plain municipal police so the role reads at a
     glance - navy uniform, capped shield, duty belt. Skin tone, build and
     colours are all single-value changes here. */
  /* Four people who might plausibly be serving a warrant. Each leans on a
     different silhouette cue so they stay apart at 24px: cap, swoop, wide hat,
     shades. None is ever cuffed. */
  PW.PLAYERS = [
    {
      id: 'officer', name: 'OFFICER',
      skin: 'tan', build: 'normal', hair: 'dark', hairStyle: 'buzz',
      hat: 'police', hatColor: '#1f2942', brows: 'thin',
      shirt: '#33436b', sleeves: 'long', belt: '#141821', badge: true,
      pants: '#232c42', shoes: '#141821'
    },
    {
      id: 'detective', name: 'DETECTIVE',
      skin: 'peach', build: 'normal', face: 'tapered', hair: 'brown', hairStyle: 'swoop',
      brows: 'arched',
      shirt: '#8a7550', lapels: '#6d5b3c', sleeves: 'long', tie: '#7a2f3a',
      belt: '#3b2f22', badge: true,
      pants: '#4a4034', shoes: '#2a231b',
      eyeColor: '#3f6b52', makeup: ['top', 'bottom', 'outer'], makeupColor: '#6b4a72', makeupColor2: '#3d2a40'
    },
    {
      id: 'marshal', name: 'MARSHAL',
      skin: 'brown', build: 'heavy', face: 'broad', hair: 'black', hairStyle: 'crop',
      hat: 'cowboy', hatColor: '#4a3a28', brows: 'thick',
      shirt: '#5d6b52', sleeves: 'long', belt: '#2d2318', badge: true,
      pants: '#3b4235', shoes: '#2a231b'
    },
    {
      id: 'agent', name: 'AGENT',
      skin: 'pale', build: 'lean', face: 'slim', hair: 'black', hairStyle: 'slick',
      brows: 'angled', glasses: 'aviator',
      shirt: '#1f242e', lapels: '#141821', sleeves: 'long', tie: '#2b3550',
      pants: '#1f242e', shoes: '#141821'
    }
  ];

  // Kept as a name for the default, for anything that wants just the one.
  PW.OFFICER = PW.PLAYERS[0];

  PW.EXECS = [
    {
      id: 'pharma', name: 'PHARMA BRO',
      skin: 'pale', build: 'lean', face: 'slim', hair: 'dark', hairStyle: 'slick',
      brows: 'angled',
      shirt: '#26324f', lapels: '#1a2338', sleeves: 'long',
      pants: '#4a5262', shoes: '#22262f', prop: 'pills'
    },
    {
      id: 'crypto', name: 'CRYPTO FOUNDER',
      skin: 'peach', build: 'normal', hair: 'brown', hairStyle: 'crop',
      hat: 'beanie', hatColor: '#5b6478',
      shirt: '#1d2129', sleeves: 'short', graphic: 'bolt', graphicColor: '#e4c06a',
      pants: '#39404f', shoes: '#e8edf5', prop: 'laptop'
    },
    {
      id: 'oil', name: 'OIL BARON',
      skin: 'tan', build: 'heavy', face: 'broad', hair: 'grey', hairStyle: 'crop',
      hat: 'cowboy', hatColor: '#c6a677', brows: 'thick',
      shirt: '#d8c8a4', lapels: '#b8a67e', sleeves: 'long', chain: true,
      pants: '#6b5334', shoes: '#5c3d21'
    },
    {
      id: 'equity', name: 'PE VULTURE',
      skin: 'pale', build: 'lean', face: 'slim', hair: 'grey', hairStyle: 'slick',
      brows: 'thin', glasses: 'halfRim',
      shirt: '#2d323d', pattern: 'stripes', patternColor: '#454b59', sleeves: 'long', tie: '#8e2b3a',
      pants: '#2d323d', shoes: '#181c24', prop: 'briefcase'
    },
    {
      id: 'slumlord', name: 'SLUMLORD',
      skin: 'olive', build: 'heavy', face: 'broad', hairStyle: 'bald',
      brows: 'thick',
      shirt: '#8e4a4a', sleeves: 'short', graphic: 'smiley', graphicColor: '#e4c06a',
      pants: '#4a5262', shoes: '#3b2f22', prop: 'keyring'
    },
    {
      id: 'tobacco', name: 'TOBACCO LOBBYIST',
      skin: 'pale', build: 'normal', hair: 'white', hairStyle: 'slick',
      brows: 'thin', glasses: 'square',
      shirt: '#6a7183', sleeves: 'long', tie: '#8e2b3a', lapels: '#565d6d',
      pants: '#565d6d', shoes: '#22262f', prop: 'cigar'
    },
    {
      id: 'payday', name: 'PAYDAY LENDER',
      skin: 'brown', build: 'normal', hair: 'black', hairStyle: 'crop',
      hat: 'cap', hatColor: '#c0392b',
      shirt: '#c9a24e', sleeves: 'long', chain: true,
      pants: '#2d323d', shoes: '#e8edf5', prop: 'phone'
    },
    {
      id: 'wellness', name: 'WELLNESS GRIFTER',
      skin: 'olive', build: 'lean', face: 'round', hair: 'blonde', hairStyle: 'long',
      brows: 'arched', makeup: ['top'], makeupColor: '#8a7a4a',
      shirt: '#e6dcc4', sleeves: 'long', graphic: 'flower', graphicColor: '#6fae4b',
      pants: '#cbbfa2', shoes: '#8a6948', prop: 'cup'
    },
    {
      id: 'defense', name: 'DEFENSE CONTRACTOR',
      skin: 'deep', build: 'normal', hair: 'black', hairStyle: 'crop',
      brows: 'thick',
      shirt: '#565d6d', lapels: '#454b59', sleeves: 'long', badge: true,
      pants: '#454b59', shoes: '#181c24', prop: 'briefcase'
    },
    {
      id: 'con-man', name: 'CON MAN',
      skin: 'amber', build: 'normal', face: 'square', hair: 'blonde', hairStyle: 'swoop',
      brows: 'thin', makeup: ['bottom', 'inner'], makeupColor: '#d2b8a7',
      shirt: '#1a2d5b', sleeves: 'long', tie: '#b80000',
      pants: '#1a2d5b', shoes: '#141821'
    },
    {
      id: 'casino', name: 'CASINO BOSS',
      skin: 'peach', build: 'heavy', face: 'broad', hair: 'black', hairStyle: 'slick',
      brows: 'thick', glasses: 'roundShades',
      shirt: '#6d2436', lapels: '#4e1926', sleeves: 'long', chain: true,
      pants: '#1d2129', shoes: '#181c24', prop: 'cigar'
    }
  ];

  PW.art = { players: [], execs: [] };

  PW.bakeAll = function () {
    PW.art.players = PW.PLAYERS.map(function (d) { return PW.bake(d, { cuffed: false }); });
    PW.art.execs = PW.EXECS.map(function (d) {
      return {
        loose: PW.bake(d, { cuffed: false }).front,
        cuffed: PW.bake(d, { cuffed: true })
      };
    });
  };
})(window.PW);

/* ==== audio.js ==== */
/* Four short blips and a mute toggle. Nothing is created until the first
   input, so the browser's autoplay policy stays happy. */
(function (PW) {
  'use strict';

  PW.createAudio = function (button, label) {
    var ctx = null;
    var on = true;

    function ensure() {
      if (!on) return null;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, endFreq, dur, type, gain) {
      var ac = ensure();
      if (!ac) return;
      var osc = ac.createOscillator();
      var amp = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + dur);
      amp.gain.setValueAtTime(gain, ac.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(amp).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    }

    function paint() {
      if (!button) return;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (label) label.textContent = on ? 'Sound on' : 'Sound off';
    }

    var api = {
      steer: function () { tone(620, null, 0.03, 'square', 0.012); },
      arrest: function () {
        tone(760, null, 0.06, 'triangle', 0.05);
        setTimeout(function () { tone(1140, null, 0.09, 'triangle', 0.04); }, 55);
      },
      stopped: function () { tone(320, 80, 0.35, 'sawtooth', 0.06); },
      start: function () {
        tone(520, null, 0.07, 'square', 0.035);
        setTimeout(function () { tone(800, null, 0.1, 'square', 0.03); }, 70);
      },
      toggle: function () { on = !on; paint(); if (on) api.start(); },
      wake: function () { ensure(); }
    };

    if (button) button.addEventListener('click', function () { api.toggle(); });
    paint();
    return api;
  };
})(window.PW);

/* ==== game.js ==== */
/* Pure game state. Knows nothing about canvases or sprites — it holds cells,
   a direction, and a list of who is in the line, and it emits events that the
   presentation layer reacts to. */
(function (PW) {
  'use strict';

  var COLS = 16;
  var ROWS = 16;
  var TICK_SLOW = 0.30;   // seconds per step at score 0
  var TICK_FAST = 0.11;   // ...and once the ramp tops out
  var RAMP = 30;          // score at which we hit TICK_FAST
  var QUEUE_MAX = 2;      // buffered turns, so fast double-taps register

  PW.COLS = COLS;
  PW.ROWS = ROWS;

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  PW.DIRS = DIRS;

  function shuffled(n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i += 1) a.push(i);
    for (i = a.length - 1; i > 0; i -= 1) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  PW.stepDuration = function (score) {
    var t = Math.min(1, score / RAMP);
    return TICK_SLOW + (TICK_FAST - TICK_SLOW) * t;
  };

  // 0..1 through the current step, for smooth movement between cells.
  PW.stepProgress = function (g) {
    if (g.phase !== 'playing') return 1;
    return Math.min(1, g.acc / PW.stepDuration(g.score));
  };

  function occupied(g, x, y) {
    for (var i = 0; i < g.body.length; i += 1) {
      if (g.body[i].x === x && g.body[i].y === y) return true;
    }
    return false;
  }

  /* Bag randomisation: deal the whole roster out in a random order, then
     reshuffle and deal again. Guarantees variety without runs of repeats. */
  function drawFromBag(g) {
    if (g.bag.length === 0) g.bag = shuffled(PW.EXECS.length);
    return g.bag.pop();
  }

  function spawnTarget(g) {
    var free = [];
    for (var y = 0; y < ROWS; y += 1) {
      for (var x = 0; x < COLS; x += 1) {
        if (!occupied(g, x, y)) free.push({ x: x, y: y });
      }
    }
    if (free.length === 0) {
      g.target = null;
      g.phase = 'docket';
      g.t = 0;
      g.events.push({ type: 'docket', score: g.score });
      return;
    }
    var cell = free[Math.floor(Math.random() * free.length)];
    g.target = { x: cell.x, y: cell.y, exec: drawFromBag(g) };
  }

  PW.newGame = function () {
    var g = {
      phase: 'ready',
      body: [],
      execs: [],
      dir: { x: DIRS.right.x, y: DIRS.right.y },
      queue: [],
      bag: [],
      target: null,
      score: 0,
      acc: 0,
      t: 0,
      elapsed: 0,
      events: []
    };
    var sx = Math.floor(COLS / 3);
    var sy = Math.floor(ROWS / 2);
    g.body.push({ x: sx, y: sy, px: sx, py: sy });
    spawnTarget(g);
    return g;
  };

  PW.begin = function (g) {
    if (g.phase !== 'ready') return false;
    g.phase = 'playing';
    g.t = 0;
    g.acc = 0;
    return true;
  };

  /* Returns true if the input did something, so the caller knows to click. */
  PW.steer = function (g, dx, dy) {
    if (g.phase === 'dead' || g.phase === 'docket') return false;
    var last = g.queue.length > 0 ? g.queue[g.queue.length - 1] : g.dir;
    if (dx === -last.x && dy === -last.y) return false;   // no instant reversal
    if (g.phase === 'ready') {
      g.dir = { x: dx, y: dy };
      return PW.begin(g);
    }
    if (dx === last.x && dy === last.y) return false;     // already going that way
    if (g.queue.length >= QUEUE_MAX) return false;
    g.queue.push({ x: dx, y: dy });
    g.events.push({ type: 'steer' });
    return true;
  };

  function stop(g, cause, x, y) {
    g.phase = 'dead';
    g.t = 0;
    g.acc = 0;
    g.events.push({ type: 'stopped', cause: cause, x: x, y: y, score: g.score });
  }

  function step(g) {
    if (g.queue.length > 0) g.dir = g.queue.shift();

    var head = g.body[0];
    var nx = head.x + g.dir.x;
    var ny = head.y + g.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      stop(g, 'fence', nx, ny);
      return;
    }

    var grows = !!(g.target && nx === g.target.x && ny === g.target.y);
    // The last cell empties this step unless we're growing into it.
    var limit = grows ? g.body.length : g.body.length - 1;
    for (var i = 0; i < limit; i += 1) {
      if (g.body[i].x === nx && g.body[i].y === ny) {
        stop(g, 'column', nx, ny);
        return;
      }
    }

    var vacated = g.body[g.body.length - 1];
    var vx = vacated.x, vy = vacated.y;
    var captured = grows ? g.target.exec : -1;

    g.body.unshift({ x: nx, y: ny, px: head.x, py: head.y });
    if (grows) {
      g.execs.unshift(captured);
      g.score += 1;
    } else {
      g.body.pop();
    }

    // Each segment came from wherever the segment behind it now sits.
    for (var k = 0; k < g.body.length - 1; k += 1) {
      g.body[k].px = g.body[k + 1].x;
      g.body[k].py = g.body[k + 1].y;
    }
    var tail = g.body[g.body.length - 1];
    if (grows) { tail.px = tail.x; tail.py = tail.y; }
    else { tail.px = vx; tail.py = vy; }

    if (grows) {
      g.events.push({ type: 'arrest', x: nx, y: ny, exec: captured, score: g.score });
      spawnTarget(g);
    }
  }

  PW.advance = function (g, dt) {
    g.t += dt;
    if (g.phase !== 'playing') return;
    g.elapsed += dt;
    g.acc += dt;
    var span = PW.stepDuration(g.score);
    while (g.phase === 'playing' && g.acc >= span) {
      g.acc -= span;
      step(g);
      span = PW.stepDuration(g.score);
    }
  };
})(window.PW);

/* ==== render.js ==== */
/* Everything that puts pixels on the buffer: the plaza, the column, the HUD
   and the full-screen states (who's serving, shift start, shift over). */
(function (PW) {
  'use strict';

  var CELL = 24;
  var BORDER = 5;
  var HUD_H = 26;
  var FOOT_H = 6;

  var PLAY_W = PW.COLS * CELL;
  var PLAY_H = PW.ROWS * CELL;

  PW.VIEW = {
    cell: CELL,
    width: PLAY_W + BORDER * 2,
    height: HUD_H + PLAY_H + BORDER * 2 + FOOT_H,
    px: BORDER,
    py: HUD_H + BORDER
  };

  var V = PW.VIEW;
  var lotTile = null;

  // ------------------------------------------------------------- the lot ---

  function buildLot() {
    var cv = document.createElement('canvas');
    cv.width = PLAY_W + BORDER * 2;
    cv.height = PLAY_H + BORDER * 2;
    var c = cv.getContext('2d');

    c.fillStyle = PW.UI.frame;
    c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = PW.UI.frameEdge;
    c.fillRect(0, 0, cv.width, 1);
    c.fillRect(0, cv.height - 1, cv.width, 1);
    c.fillRect(0, 0, 1, cv.height);
    c.fillRect(cv.width - 1, 0, 1, cv.height);

    for (var y = 0; y < PW.ROWS; y += 1) {
      for (var x = 0; x < PW.COLS; x += 1) {
        c.fillStyle = (x + y) % 2 === 0 ? PW.UI.lotA : PW.UI.lotB;
        c.fillRect(BORDER + x * CELL, BORDER + y * CELL, CELL, CELL);
      }
    }

    // A light scatter of grit so the asphalt isn't a flat checkerboard.
    for (var i = 0; i < PLAY_W * PLAY_H * 0.04; i += 1) {
      var gx = BORDER + Math.floor(Math.random() * PLAY_W);
      var gy = BORDER + Math.floor(Math.random() * PLAY_H);
      c.fillStyle = PW.UI.grit[Math.random() < 0.5 ? 0 : 1];
      c.fillRect(gx, gy, 1, 1);
    }

    c.fillStyle = PW.UI.frameEdge;
    c.fillRect(BORDER - 1, BORDER - 1, PLAY_W + 2, 1);
    c.fillRect(BORDER - 1, BORDER + PLAY_H, PLAY_W + 2, 1);
    c.fillRect(BORDER - 1, BORDER - 1, 1, PLAY_H + 2);
    c.fillRect(BORDER + PLAY_W, BORDER - 1, 1, PLAY_H + 2);

    return cv;
  }

  // ----------------------------------------------------------- particles ---

  PW.createDust = function () {
    var bits = [];
    return {
      burst: function (x, y, color, power) {
        var n = Math.round(8 * (power || 1));
        for (var i = 0; i < n; i += 1) {
          var a = Math.random() * Math.PI * 2;
          var sp = (20 + Math.random() * 60) * (power || 1);
          bits.push({
            x: x, y: y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 20,
            life: 0.3 + Math.random() * 0.4,
            age: 0,
            color: color
          });
        }
      },
      update: function (dt) {
        for (var i = bits.length - 1; i >= 0; i -= 1) {
          var b = bits[i];
          b.age += dt;
          if (b.age >= b.life) { bits.splice(i, 1); continue; }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += 140 * dt;
        }
      },
      clear: function () { bits.length = 0; },
      draw: function (ctx) {
        for (var i = 0; i < bits.length; i += 1) {
          var b = bits[i];
          ctx.fillStyle = b.color;
          ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
        }
      }
    };
  };

  // ------------------------------------------------------------ helpers ---

  function cellX(x) { return V.px + x * CELL; }
  function cellY(y) { return V.py + y * CELL; }

  function facingFor(seg, fallbackDir) {
    var dx = seg.x - seg.px;
    var dy = seg.y - seg.py;
    if (dx === 0 && dy === 0) { dx = fallbackDir.x; dy = fallbackDir.y; }
    if (dx !== 0) return { key: 'side', flip: dx < 0 };
    if (dy < 0) return { key: 'back', flip: false };
    return { key: 'front', flip: false };
  }

  function panel(ctx, y, h) {
    ctx.fillStyle = 'rgba(8, 11, 17, 0.86)';
    ctx.fillRect(V.px, y, PLAY_W, h);
    ctx.fillStyle = PW.UI.frameEdge;
    ctx.fillRect(V.px, y, PLAY_W, 1);
    ctx.fillRect(V.px, y + h - 1, PLAY_W, 1);
  }

  // -------------------------------------------------------------- pieces ---

  function drawTarget(ctx, g, clock) {
    if (!g.target) return;
    var art = PW.art.execs[g.target.exec];
    var x = cellX(g.target.x);
    var y = cellY(g.target.y);
    var bob = Math.round(Math.sin(clock * 5) * 1.4);
    var alpha = 0.42 + Math.sin(clock * 6) * 0.26;

    // Corner brackets, so the next pickup is easy to spot mid-run.
    ctx.fillStyle = 'rgba(245, 185, 66, ' + alpha.toFixed(2) + ')';
    var L = 5, e = CELL;
    var marks = [
      [-1, -1, L, 1], [-1, -1, 1, L],
      [e + 1 - L, -1, L, 1], [e, -1, 1, L],
      [-1, e, L, 1], [-1, e + 1 - L, 1, L],
      [e + 1 - L, e, L, 1], [e, e + 1 - L, 1, L]
    ];
    for (var i = 0; i < marks.length; i += 1) {
      ctx.fillRect(x + marks[i][0], y + marks[i][1], marks[i][2], marks[i][3]);
    }
    PW.blit(ctx, art.loose, x, y + bob, false);
  }

  function drawLine(ctx, g, officer) {
    var t = PW.stepProgress(g);
    // Back to front, so each figure overlaps the one behind it.
    for (var i = g.body.length - 1; i >= 0; i -= 1) {
      var seg = g.body[i];
      var x = V.px + (seg.px + (seg.x - seg.px) * t) * CELL;
      var y = V.py + (seg.py + (seg.y - seg.py) * t) * CELL;
      var f = facingFor(seg, g.dir);
      var art = i === 0 ? officer : PW.art.execs[g.execs[i - 1]].cuffed;
      PW.blit(ctx, art[f.key], Math.round(x), Math.round(y), f.flip);
    }
  }

  function drawHud(ctx, g, best, pop) {
    ctx.fillStyle = PW.UI.barBg;
    ctx.fillRect(0, 0, V.width, HUD_H);
    ctx.fillStyle = PW.UI.frameEdge;
    ctx.fillRect(0, HUD_H - 1, V.width, 1);

    PW.text(ctx, 'ARRESTS', 8, 12, PW.UI.textDim, 1);
    var lift = Math.round(pop * 2);
    PW.text(ctx, String(g.score), 8 + PW.textWidth('ARRESTS', 1) + 6, 8 - lift, PW.UI.text, 2);

    if (best > 0) {
      var label = 'BEST ' + best;
      PW.text(ctx, label, V.width - 8 - PW.textWidth(label, 1), 12, PW.UI.accent, 1);
    }
  }

  // ------------------------------------------------------------- screens ---

  function drawSelect(ctx, entries, index, clock, best) {
    ctx.fillStyle = 'rgba(8, 11, 17, 0.92)';
    ctx.fillRect(V.px, V.py, PLAY_W, PLAY_H);

    var cx = V.px + PLAY_W / 2;
    PW.textCentered(ctx, 'ON THE LIST', cx, V.py + 44, PW.UI.text, 3);
    PW.textCentered(ctx, 'WHO IS SERVING THE WARRANT', cx, V.py + 84, PW.UI.textDim, 1);

    var slot = PLAY_W / entries.length;
    var rowY = V.py + 142;

    for (var i = 0; i < entries.length; i += 1) {
      var mid = V.px + slot * i + slot / 2;
      var sx = Math.round(mid - PW.SPRITE);
      var chosen = i === index;

      if (chosen) {
        var pulse = 0.5 + Math.sin(clock * 6) * 0.25;
        ctx.fillStyle = 'rgba(245, 185, 66, ' + pulse.toFixed(2) + ')';
        ctx.fillRect(sx - 6, rowY - 6, PW.SPRITE * 2 + 12, 1);
        ctx.fillRect(sx - 6, rowY + PW.SPRITE * 2 + 5, PW.SPRITE * 2 + 12, 1);
        ctx.fillRect(sx - 6, rowY - 6, 1, PW.SPRITE * 2 + 12);
        ctx.fillRect(sx + PW.SPRITE * 2 + 5, rowY - 6, 1, PW.SPRITE * 2 + 12);
      }

      ctx.save();
      if (!chosen) ctx.globalAlpha = 0.62;
      ctx.drawImage(entries[i].art.front, sx, rowY, PW.SPRITE * 2, PW.SPRITE * 2);
      ctx.restore();

      PW.textCentered(ctx, entries[i].name, mid, rowY + PW.SPRITE * 2 + 16,
        chosen ? PW.UI.accent : PW.UI.textDim, 1);
    }

    PW.textCentered(ctx, 'LEFT / RIGHT TO CHOOSE', cx, V.py + PLAY_H - 84, PW.UI.textDim, 1);
    PW.textCentered(ctx, 'PRESS ENTER TO BEGIN', cx, V.py + PLAY_H - 64, PW.UI.text, 1);
  }

  function drawReady(ctx) {
    // Sits high on the board so it never covers the officer's start cell.
    var cx = V.px + PLAY_W / 2;
    var top = V.py + 46;
    panel(ctx, top, 88);
    PW.textCentered(ctx, 'SHIFT START', cx, top + 12, PW.UI.text, 2);
    PW.textCentered(ctx, 'EVERY NAME ON THE LIST IS OUT HERE', cx, top + 38, PW.UI.textDim, 1);
    PW.textCentered(ctx, 'THE COLUMN BEHIND YOU BLOCKS THE WAY', cx, top + 52, PW.UI.textDim, 1);
    PW.textCentered(ctx, 'STEER TO BEGIN', cx, top + 72, PW.UI.accent, 1);
  }

  function drawOver(ctx, g, best, fresh) {
    var cx = V.px + PLAY_W / 2;
    panel(ctx, V.py + PLAY_H / 2 - 34, 68);
    PW.textCentered(ctx, g.score + ' ARRESTS', cx, V.py + PLAY_H / 2 - 24, PW.UI.text, 2);
    PW.textCentered(
      ctx,
      fresh ? 'NEW BEST' : 'BEST ' + best,
      cx, V.py + PLAY_H / 2 + 2,
      fresh ? PW.UI.accent : PW.UI.textDim, 1
    );
    PW.textCentered(ctx, 'SPACE FOR ANOTHER SHIFT', cx, V.py + PLAY_H / 2 + 18, PW.UI.textDim, 1);
  }

  function drawCleared(ctx, g) {
    var cx = V.px + PLAY_W / 2;
    panel(ctx, V.py + PLAY_H / 2 - 26, 52);
    PW.textCentered(ctx, 'FULL DOCKET', cx, V.py + PLAY_H / 2 - 16, PW.UI.accent, 2);
    PW.textCentered(ctx, 'ALL ' + g.score + ' BOOKED', cx, V.py + PLAY_H / 2 + 8, PW.UI.text, 1);
  }

  // --------------------------------------------------------------- entry ---

  PW.draw = function (ctx, g, ui) {
    if (!lotTile) lotTile = buildLot();

    ctx.fillStyle = PW.UI.void;
    ctx.fillRect(0, 0, V.width, V.height);
    ctx.drawImage(lotTile, 0, HUD_H);

    if (ui.screen === 'select') {
      drawSelect(ctx, ui.entries, ui.selectIndex, ui.clock, ui.best);
      ctx.fillStyle = PW.UI.barBg;
      ctx.fillRect(0, 0, V.width, HUD_H);
      ctx.fillStyle = PW.UI.frameEdge;
      ctx.fillRect(0, HUD_H - 1, V.width, 1);
      PW.text(ctx, 'ON THE LIST', 8, 10, PW.UI.textDim, 1);
      if (ui.best > 0) {
        var lbl = 'BEST ' + ui.best;
        PW.text(ctx, lbl, V.width - 8 - PW.textWidth(lbl, 1), 10, PW.UI.accent, 1);
      }
      return;
    }

    drawTarget(ctx, g, ui.clock);
    drawLine(ctx, g, ui.playerArt);
    ui.dust.draw(ctx);
    drawHud(ctx, g, ui.best, ui.pop);

    /* Hosts that provide their own chrome (the CTA embed puts title, pause and
       result in DOM overlays) switch the in-canvas panels off. */
    if (ui.chrome === false) return;
    if (g.phase === 'ready') drawReady(ctx);
    else if (g.phase === 'dead') drawOver(ctx, g, ui.best, ui.fresh);
    else if (g.phase === 'docket') drawCleared(ctx, g);
  };
})(window.PW);

/* ==== embed.js ==== */
/* On the List — Casey The American embed controller.

   The standalone page has src/main.js; this is its counterpart for the CTA
   embed, built against the minigame contract: the canvas is the machine, and
   the title, pause and result screens are DOM overlays inside .gm-root.

   window.OnTheList.init(root, base) — guards on root.dataset.booted, finds
   elements via [data-el], reads its palette from the CSS tokens so a CMS theme
   override reaches the canvas too. */
(function (PW) {
  'use strict';

  var BEST_KEY = 'otl.best';
  var CUSTOM_KEY = 'otl.custom';
  var RETRY_DELAY = 0.6;

  window.OnTheList = window.OnTheList || {};

  window.OnTheList.init = function (root, base) {
    if (!root || root.dataset.booted) return;
    root.dataset.booted = '1';

    var CONFIG = {
      /* CMS-bound: Webflow fills the ''; empty falls through to the default. */
      rewardCode: '' /*CMS:reward-code*/ || '',
      rewardLink: '' /*CMS:reward-link*/ || '',
      rewardDesc: '' /*CMS:reward-desc*/ || '',
      copiedMsg:  '' /*CMS:copied-msg*/  || 'Code copied'
    };

    var el = function (name) { return root.querySelector('[data-el="' + name + '"]'); };

    /* The canvas draws in JS, so it reads the same tokens the stylesheet sets.
       A CMS colour override therefore reaches the playfield, not just chrome. */
    var css = getComputedStyle(root);
    function token(name, fallback) {
      var v = css.getPropertyValue(name);
      return (v && v.trim()) || fallback;
    }
    PW.UI.void = token('--ol-void', PW.UI.void);
    PW.UI.frame = token('--ol-frame', PW.UI.frame);
    PW.UI.frameEdge = token('--ol-frame-edge', PW.UI.frameEdge);
    PW.UI.lotA = token('--ol-plaza-a', PW.UI.lotA);
    PW.UI.lotB = token('--ol-plaza-b', PW.UI.lotB);
    PW.UI.grit = [token('--ol-grit-a', PW.UI.grit[0]), token('--ol-grit-b', PW.UI.grit[1])];
    PW.UI.barBg = token('--ol-bar', PW.UI.barBg);
    PW.UI.text = token('--gm-ink', PW.UI.text);
    PW.UI.textDim = token('--gm-dim', PW.UI.textDim);
    PW.UI.accent = token('--gm-primary', PW.UI.accent);
    PW.UI.danger = token('--gm-bad', PW.UI.danger);

    PW.bakeAll();

    /* The RichText embed nests the game several levels deep; each wrapper has
       to become a full-height flex column or the stage collapses to a sliver. */
    (function () {
      var node = root.parentElement;
      for (var i = 0; node && i < 8; i += 1) {
        var tag = (node.tagName || '').toUpperCase();
        if (tag === 'BODY' || tag === 'HTML') break;
        node.style.display = 'flex';
        node.style.flexDirection = 'column';
        node.style.minHeight = '0';
        node.style.height = '100%';
        if (node.classList && node.classList.contains('games-script')) break;
        node = node.parentElement;
      }
    })();

    var stage = el('stage');

    /* The Webflow column has to have a real height of its own — 100% of nothing
       is nothing. Fall back to 80vh rather than collapsing to a sliver. */
    if (stage.getBoundingClientRect().height < 80) root.style.height = '80vh';

    var screen = PW.createScreen(stage, {
      width: PW.VIEW.width,
      height: PW.VIEW.height,
      background: PW.UI.void
    });
    var ctx = screen.ctx;
    var audio = PW.createAudio(null, null);
    var dust = PW.createDust();

    function readBest() {
      try {
        var v = parseInt(window.localStorage.getItem(BEST_KEY), 10);
        return isFinite(v) && v > 0 ? v : 0;
      } catch (e) { return 0; }
    }
    function writeBest(v) {
      try { window.localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* private mode */ }
    }

    function readCustom() {
      try {
        var raw = window.localStorage.getItem(CUSTOM_KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        return d && typeof d === 'object' && d.shirt ? d : null;
      } catch (e) { return null; }
    }

    var custom = readCustom();

    /* The presets, plus whatever the player built. */
    function buildEntries() {
      var list = PW.PLAYERS.map(function (d, i) {
        return { name: d.name, art: PW.art.players[i] };
      });
      if (custom) list.push({ name: custom.name || 'MINE', art: PW.bake(custom, { cuffed: false }) });
      return list;
    }

    var entries = buildEntries();

    var ui = {
      screen: 'game',
      chrome: false,        // title, pause and result are DOM overlays here
      entries: entries,
      selectIndex: 0,
      playerArt: entries[0].art,
      best: readBest(),
      clock: 0,
      pop: 0,
      shake: 0,
      fresh: false,
      dust: dust
    };

    var game = PW.newGame();
    var phase = 'title';       // title | playing | paused | over
    var lastPhase = '';

    // ------------------------------------------------------------ officers ---

    var pickWrap = el('officers');

    function renderOfficers() {
      pickWrap.innerHTML = '';
      entries.forEach(function (entry, i) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ol-officer' + (i === ui.selectIndex ? ' is-on' : '');
        var cv = document.createElement('canvas');
        cv.width = PW.SPRITE * 2;
        cv.height = PW.SPRITE * 2;
        var c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(entry.art.front, 0, 0, cv.width, cv.height);
        var name = document.createElement('span');
        name.textContent = entry.name;
        btn.appendChild(cv);
        btn.appendChild(name);
        btn.addEventListener('click', function () {
          ui.selectIndex = i;
          ui.playerArt = entry.art;
          pickWrap.querySelectorAll('.ol-officer').forEach(function (b) { b.classList.remove('is-on'); });
          btn.classList.add('is-on');
          audio.steer();
        });
        pickWrap.appendChild(btn);
      });
    }

    // -------------------------------------------------------------- overlays ---

    function show(name, on) {
      var node = el(name);
      if (node) node.hidden = !on;
    }

    /* The same editor the standalone page and the forge mount, in an overlay
       sized to the embed. Saving writes to this origin's localStorage, so a
       character survives between visits to the page. */
    var maker = null;
    function openMaker() {
      audio.wake();
      show('ovTitle', false);
      show('ovMaker', true);
      if (maker) return;
      var box = el('myFacings');
      maker = PW.createEditor(el('myControls'), {
        value: custom || undefined,
        onChange: function (def) {
          var art = PW.bake(def, { cuffed: false });
          box.innerHTML = '';
          ['front', 'side', 'back'].forEach(function (f) {
            var wrap = document.createElement('div');
            var cv = document.createElement('canvas');
            cv.width = PW.SPRITE * 3;
            cv.height = PW.SPRITE * 3;
            var c = cv.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(art[f], 0, 0, cv.width, cv.height);
            wrap.appendChild(cv);
            box.appendChild(wrap);
          });
        }
      });
    }

    function closeMaker() {
      show('ovMaker', false);
      show('ovTitle', true);
    }

    function note(msg) {
      var n = el('myNote');
      if (n) n.textContent = msg || '';
    }

    function saveCustom() {
      var def = maker.get();
      custom = def;
      try { window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(def)); }
      catch (e) { note('This browser will not keep them, but they are in the line-up for now.'); }
      entries = buildEntries();
      ui.selectIndex = entries.length - 1;
      ui.playerArt = entries[ui.selectIndex].art;
      renderOfficers();
      note(def.name + ' is in the line-up.');
      closeMaker();
    }

    function clearCustom() {
      custom = null;
      try { window.localStorage.removeItem(CUSTOM_KEY); } catch (e) { /* private mode */ }
      entries = buildEntries();
      if (ui.selectIndex >= entries.length) ui.selectIndex = 0;
      ui.playerArt = entries[ui.selectIndex].art;
      renderOfficers();
      note('Removed.');
    }

    function toTitle() {
      phase = 'title';
      show('ovMaker', false);
      game = PW.newGame();
      dust.clear();
      ui.fresh = false;
      show('ovTitle', true); show('ovPause', false); show('ovEnd', false);
      el('btnPause').hidden = true;
    }

    function startRun() {
      audio.wake();
      phase = 'playing';
      ui.fresh = false;
      ui.playerArt = entries[ui.selectIndex].art;
      game = PW.newGame();
      dust.clear();
      lastPhase = '';
      show('ovTitle', false); show('ovPause', false); show('ovEnd', false);
      el('btnPause').hidden = false;
      audio.start();
    }

    function pause(on) {
      if (phase !== 'playing' && phase !== 'paused') return;
      phase = on ? 'paused' : 'playing';
      show('ovPause', on);
    }

    /* Result screen, per the contract: stamp, truth, plain, receipts, reward,
       replay. Engines fill the words; the shape stays the same everywhere. */
    function finish() {
      phase = 'over';
      el('btnPause').hidden = true;
      var cleared = game.phase === 'docket';
      var n = game.score;
      el('stamp').textContent = cleared ? 'FULL DOCKET' : 'SHIFT OVER';
      el('truth').textContent = cleared
        ? 'Every name on the list is booked.'
        : 'You made ' + n + (n === 1 ? ' arrest.' : ' arrests.');
      el('plain').textContent = cleared
        ? 'There was no one left to find, which is the only way this ends.'
        : 'The column behind you is what stopped you. Every arrest made it longer.';
      var receipts = el('receipts');
      receipts.innerHTML = '';
      function receipt(label, value) {
        var s = document.createElement('span');
        s.innerHTML = label + ' <b>' + value + '</b>';
        receipts.appendChild(s);
      }
      receipt('Arrests', n);
      receipt('Best', ui.best);
      if (ui.fresh) receipt('', 'New best');
      renderReward();
      show('ovEnd', true);
    }

    /* Renders only what the CMS actually filled in; with nothing set, the
       player never learns the slot was there. */
    function renderReward() {
      var box = el('reward');
      box.innerHTML = '';
      if (!CONFIG.rewardCode && !CONFIG.rewardLink) { box.hidden = true; return; }
      box.hidden = false;
      if (CONFIG.rewardDesc) {
        var d = document.createElement('div');
        d.className = 'gm-reward-desc';
        d.textContent = CONFIG.rewardDesc;
        box.appendChild(d);
      }
      if (CONFIG.rewardCode) {
        var wrap = document.createElement('div');
        wrap.className = 'gm-code';
        wrap.appendChild(document.createTextNode(CONFIG.rewardCode));
        var copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.addEventListener('click', function () {
          try { navigator.clipboard.writeText(CONFIG.rewardCode); } catch (e) { /* denied */ }
          toast(CONFIG.copiedMsg);
        });
        wrap.appendChild(copy);
        box.appendChild(wrap);
      }
      if (CONFIG.rewardLink) {
        var a = document.createElement('a');
        a.className = 'gm-btn';
        a.href = CONFIG.rewardLink;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.textDecoration = 'none';
        a.textContent = CONFIG.rewardCode ? 'Shop with it applied' : 'Shop';
        box.appendChild(a);
      }
    }

    var toastTimer = null;
    function toast(msg) {
      var t = el('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1400);
    }

    // ----------------------------------------------------------------- input ---

    function steer(dx, dy) {
      if (phase !== 'playing') return;
      audio.wake();
      if (game.phase === 'dead' || game.phase === 'docket') return;
      var wasReady = game.phase === 'ready';
      if (PW.steer(game, dx, dy) && wasReady) audio.start();
    }

    var KEYS = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
    };

    /* Only claim the arrow keys while a shift is actually running, so the embed
       never fights the page's own scrolling. */
    document.addEventListener('keydown', function (ev) {
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      var key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (phase === 'playing' && KEYS[key]) {
        ev.preventDefault();
        if (!ev.repeat) steer(KEYS[key][0], KEYS[key][1]);
        return;
      }
      if (key === 'Escape' && (phase === 'playing' || phase === 'paused')) pause(phase === 'playing');
    });

    stage.addEventListener('pointerdown', function (ev) {
      if (phase !== 'playing') return;
      ev.preventDefault();
      audio.wake();
      var p = screen.toBuffer(ev.clientX, ev.clientY);
      if (game.phase !== 'playing') { if (PW.begin(game)) audio.start(); return; }
      var head = game.body[0];
      var hx = PW.VIEW.px + head.x * PW.VIEW.cell + PW.VIEW.cell / 2;
      var hy = PW.VIEW.py + head.y * PW.VIEW.cell + PW.VIEW.cell / 2;
      var dx = p.x - hx, dy = p.y - hy;
      if (Math.abs(dx) < PW.VIEW.cell / 2 && Math.abs(dy) < PW.VIEW.cell / 2) return;
      if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
      else steer(0, Math.sign(dy));
    });
    stage.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

    el('btnStart').addEventListener('click', startRun);
    el('btnMake').addEventListener('click', openMaker);
    el('btnMakerBack').addEventListener('click', closeMaker);
    el('btnSaveMine').addEventListener('click', saveCustom);
    el('btnClearMine').addEventListener('click', clearCustom);
    el('btnPause').addEventListener('click', function () { pause(phase === 'playing'); });
    el('btnResume').addEventListener('click', function () { pause(false); });
    el('btnQuit').addEventListener('click', toTitle);
    el('btnReplay').addEventListener('click', startRun);
    el('btnChange').addEventListener('click', toTitle);

    root.otlReset = toTitle;
    root.otlPause = function () { pause(phase === 'playing'); };

    // ------------------------------------------------------------------ loop ---

    function consumeEvents() {
      for (var i = 0; i < game.events.length; i += 1) {
        var e = game.events[i];
        if (e.type === 'steer') {
          audio.steer();
        } else if (e.type === 'arrest') {
          audio.arrest();
          ui.pop = 1;
          dust.burst(
            PW.VIEW.px + e.x * PW.VIEW.cell + PW.VIEW.cell / 2,
            PW.VIEW.py + e.y * PW.VIEW.cell + PW.VIEW.cell / 2,
            PW.UI.accent, 1.2
          );
          if (e.score > ui.best) { ui.best = e.score; writeBest(e.score); ui.fresh = true; }
        } else if (e.type === 'stopped') {
          audio.stopped();
          if (!calm) ui.shake = 4;
          dust.burst(
            PW.VIEW.px + Math.max(0, Math.min(PW.COLS - 1, e.x)) * PW.VIEW.cell + PW.VIEW.cell / 2,
            PW.VIEW.py + Math.max(0, Math.min(PW.ROWS - 1, e.y)) * PW.VIEW.cell + PW.VIEW.cell / 2,
            PW.UI.danger, 1.8
          );
        } else if (e.type === 'docket') {
          audio.arrest();
        }
      }
      game.events.length = 0;
    }

    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var last = performance.now();

    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ui.clock += dt;

      if (phase === 'playing') {
        PW.advance(game, dt);
        consumeEvents();
        if (game.phase !== lastPhase) {
          lastPhase = game.phase;
          if (game.phase === 'dead' || game.phase === 'docket') {
            setTimeout(function () { if (phase === 'playing') finish(); }, RETRY_DELAY * 1000);
          }
        }
      }

      dust.update(dt);
      ui.pop = Math.max(0, ui.pop - dt * 3.5);
      ui.shake *= Math.max(0, 1 - 9 * dt);
      if (ui.shake < 0.05) ui.shake = 0;

      PW.draw(ctx, game, ui);
      var sx = ui.shake > 0 ? (Math.random() - 0.5) * 2 * ui.shake : 0;
      var sy = ui.shake > 0 ? (Math.random() - 0.5) * 2 * ui.shake : 0;
      screen.present(sx, sy);
      requestAnimationFrame(frame);
    }

    renderOfficers();
    toTitle();
    requestAnimationFrame(frame);
  };
})(window.PW);
