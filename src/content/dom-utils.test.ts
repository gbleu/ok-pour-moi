/// <reference lib="dom" />
/* eslint-disable unicorn/no-null, @typescript-eslint/no-non-null-assertion, import/no-unassigned-import -- DOM test fixtures */
import "./happy-dom.setup.js";
import { afterEach, describe, expect, test } from "bun:test";
import { getButtonByName, getByRole } from "./dom-utils.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getByRole", () => {
  test("finds element by role", () => {
    document.body.innerHTML = `<div role="main">Content</div>`;
    expect(getByRole("main")?.textContent).toBe("Content");
  });

  test("finds element by role and string name", () => {
    document.body.innerHTML = `
      <button role="tab" aria-label="Home">Home</button>
      <button role="tab" aria-label="Settings">Settings</button>`;

    expect(getByRole("tab", { name: "Settings" })?.textContent).toBe("Settings");
  });

  test("finds element by role and regex name", () => {
    document.body.innerHTML = `
      <button role="tab" aria-label="Home Tab">Home</button>
      <button role="tab" aria-label="Settings Tab">Settings</button>`;

    expect(getByRole("tab", { name: /settings/i })?.textContent).toBe("Settings");
  });

  test("returns undefined when no match", () => {
    document.body.innerHTML = `<div>No roles</div>`;
    expect(getByRole("main")).toBeUndefined();
  });

  test("scopes search to parent", () => {
    document.body.innerHTML = `
      <div id="a"><button role="tab">A</button></div>
      <div id="b"><button role="tab">B</button></div>`;

    const parent = document.querySelector("#b")!;
    expect(getByRole("tab", { parent })?.textContent).toBe("B");
  });
});

describe("getButtonByName", () => {
  test("finds button by text content", () => {
    document.body.innerHTML = `
      <button>Cancel</button>
      <button>Save</button>`;

    expect(getButtonByName("Save")?.textContent).toBe("Save");
  });

  test("finds button by aria-label", () => {
    document.body.innerHTML = `<button aria-label="Close dialog">X</button>`;
    expect(getButtonByName("Close")?.textContent).toBe("X");
  });

  test("matches case-insensitively", () => {
    document.body.innerHTML = `<button>See more messages</button>`;
    expect(getButtonByName("see more messages")).toBeDefined();
  });

  test("finds button by regex", () => {
    document.body.innerHTML = `<button>Reply All</button>`;
    expect(getButtonByName(/reply/i)).toBeDefined();
  });

  test("returns undefined when no match", () => {
    document.body.innerHTML = `<button>Other</button>`;
    expect(getButtonByName("Save")).toBeUndefined();
  });

  test("scopes search to parent", () => {
    document.body.innerHTML = `
      <div id="a"><button>Save</button></div>
      <div id="b"><button>Delete</button></div>`;

    const parent = document.querySelector("#b")!;
    expect(getButtonByName("Save", { parent })).toBeUndefined();
    expect(getButtonByName("Delete", { parent })).toBeDefined();
  });
});
