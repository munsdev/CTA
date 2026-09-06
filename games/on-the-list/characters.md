# Character format

Produce character objects for a pixel game. Each is pure data — no art.

## Fields

Required: `id`, `name`, `skin`, `shirt`, `pants`, `shoes`. Everything else optional.

**Values outside these lists fail silently and render wrong. Do not invent any.**

| Field | Values |
| --- | --- |
| `id` | lowercase slug, unique |
| `name` | uppercase, max 18 chars |
| `skin` | `porcelain` `pale` `rose` `peach` `amber` `olive` `tan` `brown` `umber` `deep` `ebony` (light to dark) |
| `build` | `normal` `heavy` `lean` |
| `face` | `square` `round` `tapered` `slim` `broad` |

### Hair

| Field | Values |
| --- | --- |
| `hairStyle` | `buzz` `crop` `slick` `swoop` `pomp` `rough` `curls` `afro` `bun` `long` `bald` |
| `hair` | `black` `dark` `brown` `ginger` `blonde` `grey` `white` |
| `beard` | `{ style: 'full'\|'goatee'\|'stubble', color: <hair value> }` |
| `hat` | `cap` `beanie` `cowboy` `police` — requires `hatColor` |
| `hatColor` | hex |

### Eyes

| Field | Values |
| --- | --- |
| `brows` | `thin` `thick` `arched` `angled` |
| `browColor` | hex — defaults to the hair colour |
| `eyeColor` | hex — iris colour |
| `makeup` | array of ring edges: `'top'` `'bottom'` `'outer'` `'inner'` |
| `makeupColor` | hex — the ring colour |
| `makeupColor2` | hex — overrides the lower edge only; defaults to `makeupColor` |
| `glasses` | `round` `square` `halfRim` `shades` `roundShades` `aviator` |
| `glassesColor` | hex — frames |
| `lensColor` | hex — tint, on the three sunglasses kinds |

`shades`, `roundShades` and `aviator` are opaque: they hide the eyes and any makeup.

Each eye sits at the centre of a 3x4 cell, and `makeup` switches on the edges of
that cell one at a time. All four gives a closed ring, which is what reads as
tired or bruised; `['top']` alone is eyeshadow, `['bottom']` alone is a shadow
under the eye.

### Clothes

| Field | Values |
| --- | --- |
| `shirt` | hex |
| `sleeves` | `long` `short` |
| `pattern` | `stripes` `bands` `check` `dots` — needs `patternColor` |
| `patternColor` | hex |
| `graphic` | `smiley` `thumbsup` `heart` `star` `flower` `snake` `spider` `skull` `bolt` |
| `graphicColor` | hex |
| `pants` | hex |
| `shoes` | hex |
| `tie` | hex |
| `lapels` | hex |
| `belt` | hex |
| `backText` | hex — two marks across the shoulder blades, visible only from behind |
| `chain` | `true` |
| `badge` | `true` |
| `prop` | `briefcase` `laptop` `cup` `phone` `pills` `keyring` `cigar` `derrick` |

A `prop` is held in the right hand and dropped once the character is handcuffed;
`graphic` is printed on the chest and stays.

## Rules

- Sprites are 24px. Each character gets about three legible features: silhouette
  (build + face + hat + hair), one signature colour (`shirt`), one prop, graphic
  or torso detail.
- Assign `shirt` colours across the whole set at once. Similar build + similar
  shirt colour = indistinguishable in motion.
- Types, not real people. No likenesses of actual individuals.
- Signal wealth or status through costume and props, never facial features.

## Output

Emit only this, one object per character, comma-separated. No prose.

```js
{
  id: 'shipping', name: 'PORT MAGNATE',
  skin: 'olive', build: 'heavy', face: 'broad', hair: 'grey', hairStyle: 'slick',
  hat: 'cap', hatColor: '#2b3a4a',
  brows: 'thick', glasses: 'square',
  makeup: ['bottom'], makeupColor: '#5a4048',
  shirt: '#3d5a6c', sleeves: 'long', pattern: 'stripes', patternColor: '#2c4351',
  lapels: '#2c4351', chain: true,
  pants: '#2b3340', shoes: '#181c24', prop: 'briefcase'
},
```
