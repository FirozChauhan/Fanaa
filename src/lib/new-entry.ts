/** "An entry is being created" signals shared between the header
 * New entry button and the `o` hotkeys (list + calendar). They live in
 * different subtrees, so they coordinate through window events. */

export const CREATE_START = "fanaa:new-entry:start";
export const CREATE_END = "fanaa:new-entry:end";

export function emitCreateStart(): void {
  window.dispatchEvent(new CustomEvent(CREATE_START));
}

export function emitCreateEnd(): void {
  window.dispatchEvent(new CustomEvent(CREATE_END));
}
