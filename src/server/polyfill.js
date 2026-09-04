/* eslint-disable @typescript-eslint/no-require-imports */
const { AsyncLocalStorage } = require("node:async_hooks");

if (!globalThis.AsyncLocalStorage) {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}
