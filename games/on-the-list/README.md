# Editing the cast without a rebuild

The embed reads `window.OTL_ROSTER` before it bakes any art, so the whole cast
can be changed from the CMS embed field. Nothing here is player-facing: the
block lives in the page source, so only someone who can edit the page can
change it.

Put the block **above** the `loader.js` script tag:

```html
<div data-on-the-list></div>
<script>
  window.OTL_ROSTER = {
    editExecs: { pharma: { name: 'PILL BARON' } },
    removeExecs: ['casino'],
    addExecs: [
      { id: 'landlord', name: 'MEGA LANDLORD', skin: 'tan', shirt: 'wine',
        pants: 'charcoal', shoes: 'black', hairStyle: 'slick', hair: 'grey' }
    ]
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/munsdev/CTA@SHA/games/on-the-list/loader.js"></script>
```

## Operations

Two casts: `officers` (who you play as) and `execs` (who you arrest). Each
takes the same four keys.

| Key | Effect |
| --- | --- |
| `officers` / `execs` | replace the whole cast |
| `addOfficers` / `addExecs` | append |
| `editOfficers` / `editExecs` | object keyed by `id`; the fields given are merged over the existing character |
| `removeOfficers` / `removeExecs` | array of `id`s to drop |

They apply in that order, so a replace-then-edit in one block works. The first
entry of `officers` is the default player.

Character fields are documented in [characters.md](characters.md). A character
needs at least `name` and `shirt`; a missing `id` is derived from the name.

## Getting the current cast

Open the game and run `OnTheList.roster()` in the browser console. It prints
every officer and executive as source you can paste into the block above,
edit, and put back.

## When something is wrong

The game never breaks on a bad roster — it warns in the console and carries on:
a character missing a name or shirt is skipped, an `id` that matches nothing is
reported, and a removal that would empty a cast is refused.
