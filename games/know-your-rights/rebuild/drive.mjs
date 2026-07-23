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
  // a fatal `why` line waits for a box tap before finish() — drain it
  for (let i = 0; i < 10; i++) {
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

// ---- CLEAN: the full shield line, refuse everything, ask for a lawyer ----
await boot();
await startDoor();
await pickAnswer('Stay where you are');          // r1 shield -> r2
await pickAnswer('“Is it signed by a judge?”');  // r2 shield -> r3
await pickAnswer('“Slide it under');             // r3 shield (warrantShown) -> r4
await pickAnswer('“I do not consent to entry.”');// r4 shield -> narration -> r5
await pickAnswer('“That is not signed');         // r5 shield -> r6
await pickAnswer('Say nothing.');                // r6 shield -> r7
await pickAnswer('“I want a lawyer.');           // r7 shield -> end
{
  const e = await readEnd();
  ok('CLEAN stamp = WALKED AWAY', e.stamp === 'WALKED AWAY', e.stamp);
  ok('CLEAN checklist ticks (closed,judge,slide,refused,read,silent,lawyer = 7/8)', e.ticked === 7, `${e.ticked}/${e.total}`);
  ok('CLEAN truth is clean line', e.truth.startsWith('You gave them nothing, and they had nothing'), e.truth.slice(0,40));
}
await backToTitle();

// ---- DAMAGED path via recovery loop, then a fatal to force DETAINED ----
// r1 harmful (crack) -> ruse1 ; ruse1 shield push shut -> r2 ; then fatal
await startDoor();
await pickAnswer('Open it a crack');             // r1 harmful (damaged, door cracked) -> ruse1
{
  // after the crack, the door art should be the cracked door + agent at door
  const mid = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-el="layers"] img'))
      .filter(im => !im.classList.contains('hide')).map(im => im.getAttribute('src').split('/').pop()));
  ok('CRACK shows cracked door art', mid.includes('5-door-cracked.svg'), mid.join(','));
  ok('CRACK shows agent-at-door (agentDoor1)', mid.includes('2-agent-1-at-door.svg'), mid.join(','));
  ok('CRACK risk>=30 pulls agentDoor2', mid.includes('3-agent-2-at-door.svg'), mid.join(','));
}
await pickAnswer('Push it shut');                // ruse1 shield -> r2 (door closed again)
await pickAnswer('“Then come in.”');             // r2 fatal -> end-fatal
{
  const e = await readEnd();
  ok('DAMAGED+FATAL stamp = DETAINED', e.stamp === 'DETAINED', e.stamp);
  ok('DAMAGED truth is damaged line', e.truth.startsWith('They took you, and they took what you gave'), e.truth.slice(0,40));
  ok('FATAL door swings open (art)', e.layers.includes('5-door-open.svg'), e.layers.join(','));
}
await backToTitle();

// ---- RECORD note appears on the end screen when REC pushed ----
await startDoor();
await page.click('[data-el="btnRec"]');
ok('REC toggles on', (await page.locator('[data-el="btnRec"].on').count()) === 1);
await pickAnswer('Open the door. Refusing');     // r1 fatal -> end-fatal
{
  const e = await readEnd();
  ok('REC note appended to truth', e.truth.includes('You have it on video'), e.truth.slice(-60));
}
await backToTitle();

// ---- name1 recovery loop reaches r4 and can still finish clean-ish ----
await startDoor();
await pickAnswer('Stay where you are');
await pickAnswer('“Is it signed by a judge?”');
await pickAnswer('Tell them your name');         // r3 harmful (damaged) -> name1
await pickAnswer('“Confirming a name is not');   // name1 shield -> r4
await pickAnswer('“I do not consent to entry.”');// r4 shield -> r5
await pickAnswer('“That is not signed');         // r5 shield -> r6
await pickAnswer('Say nothing.');                // r6 -> r7
await pickAnswer('“Come back with a warrant');   // r7 steady -> end
{
  const e = await readEnd();
  ok('NAME-LOOP reaches an end', e.stamp === 'WALKED AWAY' || e.stamp === 'DETAINED', e.stamp);
  ok('NAME-LOOP damaged => lucky/damaged truth', /luck|took what you gave/.test(e.truth), e.truth.slice(0,40));
}

await browser.close();

let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra ? '  ::  ' + r.extra : '')); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
