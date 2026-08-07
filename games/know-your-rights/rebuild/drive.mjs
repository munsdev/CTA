import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://127.0.0.1:8791/rebuild/test.html';
const results = [];
function ok(name, cond, extra='') { results.push({ name, pass: !!cond, extra }); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 520, height: 900 } });
page.on('pageerror', e => results.push({ name: 'PAGE ERROR', pass: false, extra: e.message }));

async function boot() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 5000 });
  // set Practice so the timer never fires during scripted play
  await page.click('[data-diff="practice"]');
}

// advance the typewriter box until options appear (or the end screen shows)
async function drainToChoice() {
  for (let i = 0; i < 20; i++) {
    if (await page.locator('[data-el="result"]:not([hidden])').count()) return 'end';
    const optsVisible = await page.locator('[data-el="opts"]:not([hidden]) .pr-opt').count();
    if (optsVisible) return 'opts';
    await page.locator('[data-el="box"]').click();
    await page.waitForTimeout(120);
  }
  return 'stuck';
}

async function startDoor() {
  await page.click('.pr-row[data-slug="door"]');
  await page.waitForTimeout(120);
}

// pick the answer whose visible text starts with `prefix`
async function pickAnswer(prefix) {
  const state = await drainToChoice();
  if (state !== 'opts') throw new Error('no options (state=' + state + ') when expecting: ' + prefix);
  const btns = page.locator('[data-el="opts"] .pr-opt');
  const n = await btns.count();
  const clean = s => s.replace(/^▶\s*/, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < n; i++) {
    const txt = clean(await btns.nth(i).innerText());
    if (txt.startsWith(prefix)) { await btns.nth(i).click(); await page.waitForTimeout(120); return; }
  }
  const all = [];
  for (let i = 0; i < n; i++) all.push(clean(await btns.nth(i).innerText()));
  throw new Error('answer not found: "' + prefix + '" among ' + JSON.stringify(all));
}

async function readEnd() {
  // fatal `why` lines and end-card flavor lines wait for a box tap before finish() — drain them
  for (let i = 0; i < 12; i++) {
    if (await page.locator('[data-el="result"]:not([hidden])').count()) break;
    await page.locator('[data-el="box"]').click();
    await page.waitForTimeout(120);
  }
  await page.waitForSelector('[data-el="result"]:not([hidden])', { timeout: 4000 });
  const stamp = (await page.locator('[data-el="stamp"]').innerText()).trim();
  const truth = (await page.locator('[data-el="truth"]').innerText()).trim();
  const ticked = await page.locator('[data-el="list"] li.got').count();
  const total = await page.locator('[data-el="list"] li').count();
  const layers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-el="layers"] img'))
      .filter(im => !im.classList.contains('hide'))
      .map(im => im.getAttribute('src').split('/').pop()));
  return { stamp, truth, ticked, total, layers };
}
async function backToTitle() { await page.click('[data-el="btnTitle"]'); await page.waitForTimeout(100); }

// ---- CLEAN-ish: full shield line, never speaks a fact, records at the end ----
// knock -> peephole -> who -> warrant-claim -> warrant-read -> warrant-admin -> pressure -> record -> leave
// risk stays 0 the whole way, so the only way this isn't WALKED AWAY / clean truth
// is the scene's own ~20% forced-entry roll (floor 0, undamaged, risk 0) — accept both.
await boot();
await startDoor();
await pickAnswer('Look through the peephole');       // knock shield -> peephole
await pickAnswer('"Are you immigration? Are you ICE?"'); // peephole shield -> who
await pickAnswer('"Do you have a warrant');          // who shield -> warrant-claim
await pickAnswer('"Slide it under the door');        // warrant-claim shield -> warrant-read
await pickAnswer("Check the signature line");        // warrant-read shield -> warrant-admin
await pickAnswer('"That\'s signed by an officer');   // warrant-admin shield -> pressure
await pickAnswer('"Give me your names');             // pressure shield -> record
await pickAnswer('Write down the time');             // record shield -> leave (end)
{
  const e = await readEnd();
  const forced = e.truth.startsWith('You did everything right');
  ok('CLEAN-ish stamp is a valid ending', e.stamp === 'WALKED AWAY' || (forced && e.stamp === 'DETAINED'), e.stamp);
  ok('CLEAN-ish checklist ticks (warrant, no-consent, record = 3/6)', e.ticked === 3, `${e.ticked}/${e.total}`);
  ok('CLEAN-ish truth is clean or forced-entry line', e.truth.startsWith('You gave them nothing, and they had nothing') || forced, e.truth.slice(0, 40));
  ok('CLEAN-ish shows the door-closed-inside backdrop unless forced', forced || (e.layers.length === 1 && e.layers[0] === 'door-closed-inside.png'), e.layers.join(','));
}
await backToTitle();

// ---- DAMAGED path via the cracked-door recovery loop, then a true fatal ----
// knock -> who (nobody by that name, damaged) -> ruse -> crack (severe, continues) -> cracked
// -> push it shut (soft) -> pressure -> step outside (fatal) -> stepped-out
await startDoor();
await pickAnswer('Call through the door');       // knock shield -> who
await pickAnswer('"Nobody by that name lives here."'); // who soft, damaged -> ruse
await pickAnswer('Crack the door to see the phone.'); // ruse severe -> cracked (NOT an instant end — stays playable)
{
  const mid = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-el="layers"] img'))
      .filter(im => !im.classList.contains('hide')).map(im => im.getAttribute('src').split('/').pop()));
  ok('CRACK shows the door-cracked backdrop and offers choices (scene did not end)', mid.length === 1 && mid[0] === 'door-cracked.png', mid.join(','));
  const state = await drainToChoice(); // cracked has two dialogue lines before its choices appear
  const optsVisible = await page.locator('[data-el="opts"]:not([hidden]) .pr-opt').count();
  ok('CRACK is not a forced end — options are shown', state === 'opts' && optsVisible > 0, `${state}/${optsVisible}`);
}
await pickAnswer('Push it shut.');               // cracked soft -> pressure
await pickAnswer('Step outside.');               // pressure fatal -> stepped-out
{
  const e = await readEnd();
  ok('DAMAGED+FATAL stamp = DETAINED', e.stamp === 'DETAINED', e.stamp);
  ok('DAMAGED truth is damaged line', e.truth.startsWith('They took you, and they took what you gave'), e.truth.slice(0, 40));
  ok('FATAL shows the door-open backdrop', e.layers.length === 1 && e.layers[0] === 'door-open.png', e.layers.join(','));
}
await backToTitle();

// ---- RECORD note appears on the end screen when REC is pushed, on a fast fatal ----
// knock -> who -> "Open it. Two minutes and they're gone." (fatal) -> opened-invited
await startDoor();
await page.click('[data-el="btnRec"]');
ok('REC toggles on', (await page.locator('[data-el="btnRec"].on').count()) === 1);
await pickAnswer('Call through the door');
await pickAnswer("Open it. Two minutes and they're gone."); // who fatal -> opened-invited
{
  const e = await readEnd();
  ok('REC note appended to truth', e.truth.includes('You have it on video'), e.truth.slice(-60));
  ok('opened-invited also shows door-open backdrop', e.layers.length === 1 && e.layers[0] === 'door-open.png', e.layers.join(','));
}
await backToTitle();

// ---- INTACT-flavored path: silence + lawyer, still ends up detained by a later fatal ----
// covers the questions -> record loop and confirms the `intact`-style shield line
// (silence, lawyer credited, damaged never set) survives a forced fatal later on.
await startDoor();
await pickAnswer('Look through the peephole');
await pickAnswer('"Are you immigration? Are you ICE?"');
await pickAnswer('"I\'m not opening the door. Who are you looking for?"'); // who shield -> ruse
await pickAnswer('"I\'m going to remain silent."'); // ruse shield -> warrant-claim, credits: silence
await pickAnswer('Open the door. They have a warrant.'); // warrant-claim fatal -> opened-invited
{
  const e = await readEnd();
  ok('SILENT+FATAL stamp = DETAINED', e.stamp === 'DETAINED', e.stamp);
  ok('SILENT+FATAL is intact truth (no damaged flag was ever set)', e.truth.startsWith('They took you anyway. You gave them nothing'), e.truth.slice(0, 40));
}

await browser.close();

let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '  ::  ' + r.extra : '')); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
