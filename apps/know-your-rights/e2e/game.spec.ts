import { expect, test } from "@playwright/test";
import { choose, expectAccessible, skipToChoices, watchErrors } from "./helpers";

const BEST = [
  /Look through the peephole/,
  /Are you immigration/,
  /warrant signed by a judge/,
  /Slide it under the door/,
  /Check the signature line/,
  /signed by an officer, not a judge/,
  /I'm not coming out/,
  /I want to speak to a lawyer/,
  /Write down the time/,
];

test("every screen passes axe and logs no errors", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/know/i);
  await expectAccessible(page);

  await page.getByRole("button", { name: /at the door/i }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
  await expectAccessible(page);

  await skipToChoices(page);
  await expectAccessible(page);

  for (const step of BEST) await choose(page, step);
  await skipToChoices(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/walked away|detained/i);
  await expect(page.getByText(/^Verified/)).toHaveCount(0);
  await expectAccessible(page);
  noErrors();
});

test("the whole scene can be played with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /at the door/i })).toBeFocused();
  await page.keyboard.press("Enter");
  const focusedText = () => page.evaluate(() => document.activeElement?.textContent ?? "");
  // Lines: Continue has focus, Enter moves on. Choices: the first answer takes focus; Tab to the one we want.
  for (const step of BEST) {
    for (let i = 0; i < 12 && !step.test(await focusedText()); i++) {
      await page.keyboard.press(/Continue/.test(await focusedText()) ? "Enter" : "Tab");
    }
    await expect.poll(focusedText).toMatch(step);
    await page.keyboard.press("Enter");
  }
  for (let i = 0; i < 6 && /Continue/.test(await focusedText()); i++) await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/walked away|detained/i);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("letting the timer run out presses you, then the same choices return", async ({ page }) => {
  const noErrors = watchErrors(page);
  await page.goto("/");
  await page.getByText("5s", { exact: true }).click();
  await page.getByRole("button", { name: /at the door/i }).click();
  await skipToChoices(page);
  const before = await page
    .getByRole("group", { name: /what do you do/i })
    .getByRole("button")
    .allTextContents();
  await expect(page.getByText(/ask again|Answer me|running out of time/).first()).toBeAttached({
    timeout: 7000,
  });
  await skipToChoices(page);
  const after = await page
    .getByRole("group", { name: /what do you do/i })
    .getByRole("button")
    .allTextContents();
  expect(after).toEqual(before);
  noErrors();
});

test("opening the door for 'police' never ends with walking away", async ({ page }) => {
  await page.goto("/");
  for (let run = 0; run < 3; run++) {
    if (run === 0) await page.getByRole("button", { name: /at the door/i }).click();
    else await page.getByRole("button", { name: /play it again/i }).click();
    await choose(page, /They said police/);
    await skipToChoices(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/detained/i);
  }
});

test("hint points at the strongest answer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /at the door/i }).click();
  for (const step of BEST.slice(0, 6)) await choose(page, step);
  await skipToChoices(page);
  await page.getByRole("button", { name: "Hint" }).click();
  await expect(page.getByText(/^Hint: /)).toHaveText(/I'm not coming out|names and badge numbers/);
});
