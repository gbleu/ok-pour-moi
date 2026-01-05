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

export const sleep = async (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

export function simulateClick(element: Element): void {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const pointerOptions: PointerEventInit = {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
    view: window,
  };

  const mouseOptions: MouseEventInit = {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: x,
    clientY: y,
    view: window,
  };

  // Dispatch pointer events (React 17+ listens to these)
  element.dispatchEvent(new PointerEvent("pointerdown", pointerOptions));
  element.dispatchEvent(new MouseEvent("mousedown", mouseOptions));
  element.dispatchEvent(new PointerEvent("pointerup", { ...pointerOptions, buttons: 0 }));
  element.dispatchEvent(new MouseEvent("mouseup", { ...mouseOptions, buttons: 0 }));
  element.dispatchEvent(new MouseEvent("click", { ...mouseOptions, buttons: 0 }));
}

export function simulateRightClick(element: Element): void {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // Some applications need mousedown before contextmenu
  element.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      button: 2,
      buttons: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
    }),
  );

  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      button: 2,
      buttons: 2,
      cancelable: true,
      clientX: x,
      clientY: y,
      view: window,
    }),
  );
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
