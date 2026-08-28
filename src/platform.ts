/**
 * Which of the two builds this is, and nothing else.
 *
 * The same test already lived in `engine/client.ts` as `isTauri()`, and three
 * modules that have no business knowing about the engine now need the answer:
 * the router (whether `/` is the front page or the board), the navigation rail
 * (whether "Trang chủ" is a destination or a no-op), and `main.tsx`. Importing
 * it from `engine/client` would drag the worker, the WebAssembly glue and the
 * whole search client into the shell's chunk to read one property off `window`.
 *
 * A file with one constant in it is the cheapest way to say something that
 * several unrelated parts of the app need to agree on. `engine/client` keeps
 * its own copy rather than importing this one, because that module is also
 * loaded inside a worker where this file's assumptions about `window` are the
 * wrong ones to make.
 */

/**
 * True inside the Tauri desktop shell.
 *
 * A constant rather than a function: the answer cannot change while the page is
 * open, and calling it in a render was how it ended up being read a few hundred
 * times a second on the board.
 */
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
