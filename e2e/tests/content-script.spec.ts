import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type Page, expect, test } from "@playwright/test";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const FIXTURE_PATH = join(FIXTURES_DIR, "outlook-message.html");

// DOM query smoke tests against HTML fixtures. Algorithm logic is tested in outlook-actions.test.ts.
test.describe("Content Script DOM Queries", () => {
  test("findLastMessageFromOthers skips own messages", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with messages including own message
    await page.goto(`file://${FIXTURE_PATH}`);

    // When: searching for last message from others (mimics outlook-actions.ts logic)
    const result = await page.evaluate(() => {
      const readingPane = document.querySelector('[role="main"]');
      if (!readingPane) {
        return { email: "", found: false };
      }

      const senderElements = [
        ...readingPane.querySelectorAll<HTMLElement>(
          '[role="button"][aria-label^="From:"], button[name^="From:"]',
        ),
      ];

      for (const el of senderElements.toReversed()) {
        const ariaLabel = el.getAttribute("aria-label") ?? "";
        const nameAttr = el.getAttribute("name") ?? "";
        const textContent = el.textContent.trim();

        const fromText =
          [ariaLabel, nameAttr].find((text) => text.startsWith("From:")) ?? textContent;

        const emailElement = el.querySelector<HTMLElement>("[data-email]");
        const elementEmail = emailElement?.dataset.email ?? "";

        // Simplified from production isOwnMessage — see outlook-actions.test.ts for full coverage
        const isOwnMessage = ["you", "moi"].includes(textContent.toLowerCase());

        if (!isOwnMessage) {
          return { email: elementEmail, found: true, fromText };
        }
      }
      return { email: "", found: false };
    });

    // Then: returns Sarah Connor (the last non-own message)
    expect(result.found).toBe(true);
    expect(result.email).toBe("sarah.connor@cyberdyne.com");
  });

  test("findPdfOptions filters to PDF files only", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with mixed attachments
    await page.goto(`file://${FIXTURE_PATH}`);

    // When: getting PDF options from first attachment listbox
    const pdfCount = await page.evaluate(() => {
      const listbox = document.querySelector('[role="listbox"][aria-label*="attachment" i]');
      if (!listbox) {
        return 0;
      }

      const options = listbox.querySelectorAll('[role="option"]');
      return [...options].filter((opt) => opt.textContent.toLowerCase().includes(".pdf")).length;
    });

    // Then: only PDF files are counted (Q4_Report.pdf, not summary.xlsx)
    expect(pdfCount).toBe(1);
  });

  test("finds attachment listbox within message", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with messages containing attachments
    await page.goto(`file://${FIXTURE_PATH}`);

    // When: looking for attachment listbox
    const hasAttachments = await page.evaluate(() => {
      const listboxes = document.querySelectorAll('[role="listbox"][aria-label*="attachment" i]');
      return listboxes.length;
    });

    // Then: finds attachment listboxes
    expect(hasAttachments).toBeGreaterThan(0);
  });

  test("extracts email subject from heading", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    await page.goto(`file://${FIXTURE_PATH}`);

    const subject = await page
      .locator('[role="main"] [role="heading"][aria-level="2"]')
      .textContent();

    expect(subject?.trim()).toBe("Quarterly Report Review");
  });

  test("returns not found when only own messages exist", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with only own messages
    await page.goto(`file://${join(FIXTURES_DIR, "outlook-only-own-messages.html")}`);

    // When: searching for last message from others
    const result = await page.evaluate(() => {
      const readingPane = document.querySelector('[role="main"]');
      if (!readingPane) {
        return { found: false };
      }

      const senderElements = [
        ...readingPane.querySelectorAll<HTMLElement>(
          '[role="button"][aria-label^="From:"], button[name^="From:"]',
        ),
      ];

      for (const el of senderElements.toReversed()) {
        const textContent = el.textContent.trim();
        // Simplified from production isOwnMessage — see outlook-actions.test.ts for full coverage
        const isOwnMessage = ["you", "moi"].includes(textContent.toLowerCase());
        if (!isOwnMessage) {
          return { found: true };
        }
      }
      return { found: false };
    });

    // Then
    expect(result.found).toBe(false);
  });

  test("handles message without subject heading", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with no heading element
    await page.goto(`file://${join(FIXTURES_DIR, "outlook-no-subject.html")}`);

    // When
    const heading = await page.locator('[role="main"] [role="heading"][aria-level="2"]').count();

    // Then
    expect(heading).toBe(0);
  });

  test("finds multiple attachment listboxes across messages", async ({
    page,
  }: Readonly<{ page: Readonly<Page> }>) => {
    // Given: page with attachments in multiple messages
    await page.goto(`file://${FIXTURE_PATH}`);

    // When
    const listboxCount = await page.evaluate(() => {
      const listboxes = document.querySelectorAll(
        '[role="main"] [role="listbox"][aria-label*="attachment" i]',
      );
      return listboxes.length;
    });

    // Then: outlook-message.html has 2 messages with attachments
    expect(listboxCount).toBe(2);
  });
});
