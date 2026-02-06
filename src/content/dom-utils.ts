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

export async function sleep(ms: number): Promise<void> {
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

    const observeTarget = parent instanceof Document ? document.body : parent;
    const observerOptions: MutationObserverInit = { childList: true, subtree: true };
    if (!(parent instanceof Document)) {
      observerOptions.attributes = true;
    }
    observer.observe(observeTarget, observerOptions);

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

function matchesName(el: Element, name: RegExp | string): boolean {
  const searchText = [el.getAttribute("aria-label"), el.textContent, el.getAttribute("name")].join(
    " ",
  );

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
    if (name === undefined || matchesName(el, name)) {
      return el;
    }
  }
  return undefined;
}

export function getButtonByName(
  name: RegExp | string,
  parent: Document | Element = document,
): HTMLButtonElement | undefined {
  const buttons = parent.querySelectorAll("button");
  for (const btn of buttons) {
    if (matchesName(btn, name)) {
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
