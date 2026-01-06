export function getElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.querySelector(`#${id}`);
  if (element === null) {
    throw new Error(`Element #${id} not found`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DOM query returns Element
  return element as TElement;
}
