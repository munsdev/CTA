import type { Scene } from "./types";

/**
 * Content checks for a scene. Returns human-readable problems; an empty list
 * means the scene is safe to ship. Runs in the unit tests, so a broken scene
 * fails CI instead of reaching players.
 */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  const cards = scene.cards;
  const ids = Object.keys(cards);
  const backdrops = new Set(scene.backdrops.map((b) => b.id));
  const speakers = new Set(scene.speakers.map((s) => s.id));
  const creditKeys = new Set(scene.credits.map((c) => c.key));

  if (!cards[scene.start]) errors.push(`start card "${scene.start}" does not exist`);
  if (!scene.law.trim()) errors.push("law line is empty");
  if (/^verified\b/i.test(scene.law.trim()))
    errors.push("law line reads like an internal note; it is shown to players");
  if (scene.forcedEntry && !backdrops.has(scene.forcedEntry.backdrop))
    errors.push(`forcedEntry backdrop "${scene.forcedEntry.backdrop}" does not exist`);

  for (const id of ids) {
    const c = cards[id];
    if (!backdrops.has(c.backdrop)) errors.push(`${id}: backdrop "${c.backdrop}" does not exist`);
    for (const l of c.lines) {
      if (!l.texts.length || l.texts.some((t) => !t.trim())) errors.push(`${id}: a line has empty text`);
      if (l.speaker && !speakers.has(l.speaker)) errors.push(`${id}: speaker "${l.speaker}" does not exist`);
    }
    if (c.end) {
      for (const k of c.credits ?? [])
        if (!creditKeys.has(k)) errors.push(`${id}: credit "${k}" is not declared`);
      continue;
    }
    if (!c.answers.length) errors.push(`${id}: play card has no answers`);
    // A recovery card (after a mistake) may have no shield answer, but there must always be a way to limit the damage.
    if (c.answers.length && !c.answers.some((a) => ["shield", "steady", "soft"].includes(a.grade)))
      errors.push(`${id}: every answer is harmful or worse`);
    c.answers.forEach((a, i) => {
      const where = `${id} answer ${i + 1}`;
      const next = cards[a.goto];
      if (!a.text.trim()) errors.push(`${where}: empty text`);
      if (!next) {
        errors.push(`${where}: goto "${a.goto}" does not exist`);
        return;
      }
      for (const k of a.credits ?? [])
        if (!creditKeys.has(k)) errors.push(`${where}: credit "${k}" is not declared`);
      if (a.grade === "fatal" && !(next.end && next.fatal))
        errors.push(`${where}: a fatal answer must lead to a fatal end card`);
      // An answer that ends the scene badly must not be able to roll "walked away, gave nothing".
      if (next.end && !next.fatal && (a.grade === "severe" || a.grade === "harmful") && !a.damaged)
        errors.push(
          `${where}: a ${a.grade} answer ends the scene on a non-fatal card without marking it damaged`,
        );
    });
  }

  // Every card reachable from the start.
  const reached = walk(scene, scene.start, () => true);
  for (const id of ids) if (!reached.has(id)) errors.push(`${id}: unreachable from the start`);

  // Every card can still reach an ending (no traps).
  const canEnd = new Set(ids.filter((id) => cards[id].end));
  for (let grew = true; grew;) {
    grew = false;
    for (const id of ids) {
      const c = cards[id];
      if (!canEnd.has(id) && !c.end && c.answers.some((a) => canEnd.has(a.goto))) {
        canEnd.add(id);
        grew = true;
      }
    }
  }
  for (const id of ids) if (!canEnd.has(id)) errors.push(`${id}: no path from here reaches an ending`);

  // Every credit can be earned by a player who only picks the best answers.
  const earnable = new Set<string>();
  for (const id of walk(scene, scene.start, (g) => g === "shield")) {
    const c = cards[id];
    if (c.end) (c.credits ?? []).forEach((k) => earnable.add(k));
    else
      c.answers
        .filter((a) => a.grade === "shield")
        .forEach((a) => (a.credits ?? []).forEach((k) => earnable.add(k)));
  }
  for (const k of creditKeys)
    if (!earnable.has(k)) errors.push(`credit "${k}" cannot be earned on an all-shield run`);

  return errors;
}

function walk(scene: Scene, from: string, follow: (grade: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    const c = scene.cards[id];
    if (!c || seen.has(id)) continue;
    seen.add(id);
    if (!c.end) for (const a of c.answers) if (follow(a.grade)) queue.push(a.goto);
  }
  return seen;
}
