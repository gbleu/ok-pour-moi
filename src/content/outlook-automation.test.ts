/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, @typescript-eslint/no-non-null-assertion -- DOM test fixtures */
import { afterEach, describe, expect, test } from "vite-plus/test";

import { findButtonByName, findByRole } from "./outlook-automation.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findByRole", () => {
  test("finds element by role", () => {
    document.body.innerHTML = `<div role="main">Content</div>`;
    expect(findByRole("main")?.textContent).toBe("Content");
  });

  test("finds element by role and string name", () => {
    document.body.innerHTML = `
      <button role="tab" aria-label="Home">Home</button>
      <button role="tab" aria-label="Settings">Settings</button>`;

    expect(findByRole("tab", { name: "Settings" })?.textContent).toBe("Settings");
  });

  test("finds element by role and regex name", () => {
    document.body.innerHTML = `
      <button role="tab" aria-label="Home Tab">Home</button>
      <button role="tab" aria-label="Settings Tab">Settings</button>`;

    expect(findByRole("tab", { name: /settings/i })?.textContent).toBe("Settings");
  });

  test("returns undefined when no match", () => {
    document.body.innerHTML = `<div>No roles</div>`;
    expect(findByRole("main")).toBeUndefined();
  });

  test("scopes search to parent", () => {
    document.body.innerHTML = `
      <div id="a"><button role="tab">A</button></div>
      <div id="b"><button role="tab">B</button></div>`;

    const parent = document.querySelector("#b")!;
    expect(findByRole("tab", { parent })?.textContent).toBe("B");
  });
});

describe("findButtonByName", () => {
  test("finds button by text content", () => {
    document.body.innerHTML = `
      <button>Cancel</button>
      <button>Save</button>`;

    expect(findButtonByName("Save")?.textContent).toBe("Save");
  });

  test("finds button by aria-label", () => {
    document.body.innerHTML = `<button aria-label="Close dialog">X</button>`;
    expect(findButtonByName("Close")?.textContent).toBe("X");
  });

  test("matches case-insensitively", () => {
    document.body.innerHTML = `<button>See more messages</button>`;
    expect(findButtonByName("see more messages")).toBeDefined();
  });

  test("finds button by regex", () => {
    document.body.innerHTML = `<button>Reply All</button>`;
    expect(findButtonByName(/reply/i)).toBeDefined();
  });

  test("returns undefined when no match", () => {
    document.body.innerHTML = `<button>Other</button>`;
    expect(findButtonByName("Save")).toBeUndefined();
  });

  test("scopes search to parent", () => {
    document.body.innerHTML = `
      <div id="a"><button>Save</button></div>
      <div id="b"><button>Delete</button></div>`;

    const parent = document.querySelector("#b")!;
    expect(findButtonByName("Save", { parent })).toBeUndefined();
    expect(findButtonByName("Delete", { parent })).toBeDefined();
  });
});
