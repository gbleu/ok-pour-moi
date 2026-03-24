/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, @typescript-eslint/no-non-null-assertion, import/no-unassigned-import -- DOM test fixtures */
import "./happy-dom.setup.js";
import { afterEach, describe, expect, test } from "bun:test";
import {
  findAttachmentListbox,
  findLastMessageFromOthers,
  getPdfOptions,
} from "./outlook-actions.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findLastMessageFromOthers", () => {
  test("returns last message from someone else", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: DUPONT Jean &lt;jean.dupont@example.com&gt;">
          <span data-email="jean.dupont@example.com">DUPONT Jean</span>
        </button>
      </div>`;

    const result = findLastMessageFromOthers("me@example.com");

    expect([result?.senderEmail, result?.senderLastname]).toEqual([
      "jean.dupont@example.com",
      "DUPONT",
    ]);
  });

  test("skips own messages by email match", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: Me &lt;me@example.com&gt;">
          <span data-email="me@example.com">Me</span>
        </button>
      </div>`;

    expect(findLastMessageFromOthers("me@example.com")).toBeUndefined();
  });

  test("skips own messages by 'you' text", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: You">You</button>
      </div>`;

    expect(findLastMessageFromOthers("me@example.com")).toBeUndefined();
  });

  test("skips own messages by 'moi' text", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: Moi">Moi</button>
      </div>`;

    expect(findLastMessageFromOthers("me@example.com")).toBeUndefined();
  });

  test("returns last non-own message when mixed", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: Alice &lt;alice@example.com&gt;">
          <span data-email="alice@example.com">Alice</span>
        </button>
        <button role="button" aria-label="From: Me &lt;me@example.com&gt;">
          <span data-email="me@example.com">Me</span>
        </button>
        <button role="button" aria-label="From: Bob &lt;bob@example.com&gt;">
          <span data-email="bob@example.com">Bob</span>
        </button>
      </div>`;

    const result = findLastMessageFromOthers("me@example.com");
    expect(result?.senderEmail).toBe("bob@example.com");
  });

  test("returns undefined when no reading pane", () => {
    document.body.innerHTML = "<div>No main role</div>";
    expect(findLastMessageFromOthers("me@example.com")).toBeUndefined();
  });

  test("returns undefined when only own messages", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: Me">
          <span data-email="me@example.com">Me</span>
        </button>
      </div>`;

    expect(findLastMessageFromOthers("me@example.com")).toBeUndefined();
  });

  test("extracts email from title attribute fallback", () => {
    document.body.innerHTML = `
      <div role="main">
        <button role="button" aria-label="From: Someone">
          <span title="someone@example.com">Someone</span>
        </button>
      </div>`;

    const result = findLastMessageFromOthers("me@example.com");
    expect(result?.senderEmail).toBe("someone@example.com");
  });

  test("uses button name attribute for From: detection", () => {
    document.body.innerHTML = `
      <div role="main">
        <button name="From: MARTIN Sophie &lt;sophie@example.com&gt;">
          <span data-email="sophie@example.com">MARTIN Sophie</span>
        </button>
      </div>`;

    const result = findLastMessageFromOthers("me@example.com");

    expect([result?.senderEmail, result?.senderLastname]).toEqual(["sophie@example.com", "MARTIN"]);
  });
});

describe("getPdfOptions", () => {
  test("filters to PDF attachments only", () => {
    document.body.innerHTML = `
      <div role="listbox" aria-label="Attachments">
        <div role="option">report.pdf</div>
        <div role="option">photo.jpg</div>
        <div role="option">invoice.PDF</div>
        <div role="option">notes.txt</div>
      </div>`;

    const listbox = document.querySelector('[role="listbox"]')!;
    const pdfs = getPdfOptions(listbox);

    expect(pdfs.map((el) => el.textContent)).toEqual(["report.pdf", "invoice.PDF"]);
  });

  test("returns empty array when no PDFs", () => {
    document.body.innerHTML = `
      <div role="listbox" aria-label="Attachments">
        <div role="option">photo.jpg</div>
      </div>`;

    const listbox = document.querySelector('[role="listbox"]')!;
    expect(getPdfOptions(listbox)).toEqual([]);
  });
});

describe("findAttachmentListbox", () => {
  test("finds listbox after message button in ancestor tree", () => {
    document.body.innerHTML = `
      <div>
        <div>
          <button role="button" aria-label="From: Someone" id="msg">Someone</button>
          <div role="listbox" aria-label="Attachments" id="attachments">
            <div role="option">file.pdf</div>
          </div>
        </div>
      </div>`;

    const msgBtn = document.querySelector("#msg")!;
    const result = findAttachmentListbox(msgBtn);
    expect(result?.id).toBe("attachments");
  });

  test("returns undefined when no listbox in ancestor tree", () => {
    document.body.innerHTML = `
      <div>
        <button role="button" aria-label="From: Someone" id="msg">Someone</button>
      </div>`;

    const msgBtn = document.querySelector("#msg")!;
    expect(findAttachmentListbox(msgBtn)).toBeUndefined();
  });
});
