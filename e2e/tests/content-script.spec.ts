import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/outlook-message.html",
);

test.describe("Content Script DOM Queries", () => {
  test("findLastMessageFromOthers skips own messages", async ({ page }) => {
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
        const textContent = el.textContent?.trim() ?? "";

        const fromText =
          [ariaLabel, nameAttr].find((text) => text.startsWith("From:")) ?? textContent;

        const emailElement = el.querySelector<HTMLElement>("[data-email]");
        const elementEmail = emailElement?.dataset.email ?? "";

        const isOwnMessage =
          textContent.toLowerCase() === "you" || textContent.toLowerCase() === "moi";

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

  test("getPdfOptions filters to PDF files only", async ({ page }) => {
    // Given: page with mixed attachments
    await page.goto(`file://${FIXTURE_PATH}`);

    // When: getting PDF options from first attachment listbox
    const pdfCount = await page.evaluate(() => {
      const listbox = document.querySelector('[role="listbox"][aria-label*="attachment" i]');
      if (!listbox) {
        return 0;
      }

      const options = listbox.querySelectorAll('[role="option"]');
      return [...options].filter((opt) => (opt.textContent ?? "").toLowerCase().includes(".pdf"))
        .length;
    });

    // Then: only PDF files are counted (Q4_Report.pdf, not summary.xlsx)
    expect(pdfCount).toBe(1);
  });

  test("finds attachment listbox within message", async ({ page }) => {
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

  test("extracts email subject from heading", async ({ page }) => {
    await page.goto(`file://${FIXTURE_PATH}`);

    const subject = await page
      .locator('[role="main"] [role="heading"][aria-level="2"]')
      .textContent();

    expect(subject?.trim()).toBe("Quarterly Report Review");
  });
});
