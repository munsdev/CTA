# Editing the cast without a rebuild

Two ways in: a hidden panel inside the game, and the `window.OTL_ROSTER` block
in the CMS. The panel is for building and trying characters; the block is what
makes them public. The panel writes the block for you.

## The panel in the game

On the start screen, tap the small line at the top — **Warrant service · day
shift** — **nine times**. A pause of about two and a half seconds between taps
resets the count, so nobody opens it by fidgeting. Then the password:
`listed4now`. You stay signed in for the rest of that browser tab.

The panel has both casts behind the two tabs at the top left: **Officers** (who
you play as) and **On the list** (who you arrest). Pick someone to load them
into the editor; the buttons at the bottom do the rest.

| Button | What it does |
| --- | --- |
| **Save** | writes your edit into the running cast |
| **Add someone** | appends a blank character to the open cast |
| **Remove** | drops the selected character |
| **Copy roster block** | puts the whole cast on your clipboard as the paste block below |
| **Reset to published** | clears your local copy; reload to get the published cast back |

**Two things worth being clear about.** The password is a latch, not a lock —
the game's whole source is public, so anyone determined enough can read it.
And a save changes *your browser only*. Neither matters much, because the panel
cannot publish: nothing another visitor sees changes until you paste the block
into the CMS.

So the loop is: build in the panel → play it until it's right → **Copy roster
block** → paste into the CMS → publish.

## The block in the CMS

The embed reads `window.OTL_ROSTER` before it bakes any art, so the whole cast
can be changed from the CMS embed field. Put the block **above** the
`loader.js` script tag — this is what Copy roster block gives you, and you can
also write it by hand:

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

Either **Copy roster block** in the panel, or run `OnTheList.roster()` in the
browser console — both print every officer and executive as the block above.

## When something is wrong

The game never breaks on a bad roster — it warns in the console and carries on:
a character missing a name or shirt is skipped, an `id` that matches nothing is
reported, and a removal that would empty a cast is refused. The panel refuses
to remove the last character in a cast for the same reason.

If a browser is blocking storage (a private window, say), the panel still works
for that session and says so — it just will not remember the cast on reload.
