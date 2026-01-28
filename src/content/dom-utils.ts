/* eslint-disable func-style, id-length, promise/avoid-new, promise/param-names, no-promise-executor-return, unicorn/prefer-global-this */
export const TIMING = {
  CONTENT_LOAD: 1000,
  DOWNLOAD_TIMEOUT: 30_000,
  ELEMENT_VISIBLE: 10_000,
  MENU_ANIMATION: 300,
  MOVE_MENU: 5000,
  UI_SETTLE: 500,
  UPLOAD_COMPLETE: 2000,
} as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitForElement(
  selector: string,
  options: { match?: (el: Element) => boolean; parent?: Document | Element; timeout?: number } = {},
): Promise<Element> {
  const { timeout = TIMING.ELEMENT_VISIBLE, parent = document, match } = options;

  return new Promise((resolve, reject) => {
    const check = (): Element | undefined => {
      const elements = parent.querySelectorAll(selector);
      for (const el of elements) {
        if (match === undefined || match(el)) {
          return el;
        }
      }
      return undefined;
    };

    const existing = check();
    if (existing !== undefined) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = check();
      if (el !== undefined) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent instanceof Document ? document.body : parent, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

export async function waitForHidden(
  element: Element,
  timeout = TIMING.ELEMENT_VISIBLE,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const isHidden = (): boolean =>
      !document.contains(element) || getComputedStyle(element).display === "none";

    if (isHidden()) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (isHidden()) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Timeout waiting for element to hide"));
    }, timeout);
  });
}

function getElementSearchText(el: Element): string {
  const ariaLabel = el.getAttribute("aria-label") ?? "";
  const textContent = el.textContent ?? "";
  const nameAttr = el.getAttribute("name") ?? "";
  return `${ariaLabel} ${textContent} ${nameAttr}`;
}

function matchesName(searchText: string, name: RegExp | string): boolean {
  return typeof name === "string"
    ? searchText.toLowerCase().includes(name.toLowerCase())
    : name.test(searchText);
}

export function getByRole(
  role: string,
  options: { name?: RegExp | string; parent?: Document | Element } = {},
): Element | undefined {
  const { name, parent = document } = options;
  const elements = parent.querySelectorAll(`[role="${role}"]`);

  for (const el of elements) {
    if (name === undefined || matchesName(getElementSearchText(el), name)) {
      return el;
    }
  }
  return undefined;
}

export function getAllByRole(
  role: string,
  options: { name?: RegExp | string; parent?: Document | Element } = {},
): Element[] {
  const { name, parent = document } = options;
  const elements = parent.querySelectorAll(`[role="${role}"]`);

  if (name === undefined) {
    return [...elements];
  }

  return [...elements].filter((el) => matchesName(getElementSearchText(el), name));
}

export function getButtonByName(
  name: RegExp | string,
  parent: Document | Element = document,
): HTMLButtonElement | undefined {
  const buttons = parent.querySelectorAll("button");
  for (const btn of buttons) {
    if (matchesName(getElementSearchText(btn), name)) {
      return btn;
    }
  }
  return undefined;
}

function createMouseOptions(element: Element, button: number, buttons: number): MouseEventInit {
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  return { bubbles: true, button, buttons, cancelable: true, clientX, clientY, view: window };
}

export function simulateClick(element: Element): void {
  const mouseOpts = createMouseOptions(element, 0, 1);
  const pointerOpts: PointerEventInit = {
    ...mouseOpts,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  };

  element.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
  element.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
  element.dispatchEvent(new PointerEvent("pointerup", { ...pointerOpts, buttons: 0 }));
  element.dispatchEvent(new MouseEvent("mouseup", { ...mouseOpts, buttons: 0 }));
  element.dispatchEvent(new MouseEvent("click", { ...mouseOpts, buttons: 0 }));
}

export function simulateRightClick(element: Element): void {
  const opts = createMouseOptions(element, 2, 2);
  element.dispatchEvent(new MouseEvent("mousedown", opts));
  element.dispatchEvent(new MouseEvent("contextmenu", opts));
}

export function simulateKeyPress(
  key: string,
  modifiers: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
): void {
  const options: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    code: key,
    ctrlKey: modifiers.ctrl,
    key,
    metaKey: modifiers.meta,
    shiftKey: modifiers.shift,
  };
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", options));
  document.activeElement?.dispatchEvent(new KeyboardEvent("keyup", options));
}

export function typeText(element: HTMLElement, text: string): void {
  if (element.isContentEditable) {
    element.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for contenteditable
    document.execCommand("insertText", false, text);
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
