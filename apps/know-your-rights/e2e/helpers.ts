import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Collect console errors and page errors; assert none at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return () => expect(errors).toEqual([]);
}

export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/** Step through lines until answers (or the result) appear. */
export async function skipToChoices(page: Page) {
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole("group", { name: /what do you do/i }).isVisible()) return;
    if (await page.getByRole("heading", { level: 1, name: /walked away|detained/i }).isVisible()) return;
    await page.getByRole("button", { name: "Continue" }).click();
  }
  throw new Error("never reached a choice");
}

export async function choose(page: Page, text: string | RegExp) {
  await skipToChoices(page);
  await page
    .getByRole("group", { name: /what do you do/i })
    .getByRole("button", { name: text })
    .click();
}
