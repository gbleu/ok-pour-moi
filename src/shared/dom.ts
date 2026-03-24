// eslint-disable-next-line typescript-eslint/no-unnecessary-type-parameters -- Generic enables typed DOM access at call sites
export function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);
  if (element === null) {
    throw new Error(`Element #${id} not found`);
  }
  return element;
}
