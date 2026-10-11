/** Injected at build time via Vite `define` (see vite.config.ts). */
declare const __APP_VERSION__: string;

export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "0.1.1+dev";
