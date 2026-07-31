import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
// Note: NOT `import "@testing-library/jest-dom/vitest"` — see
// src/types/jestDomMatchers.d.ts for why that would both register matchers
// on the wrong `expect` singleton AND augment the wrong "vitest" module's
// types in this monorepo (two vitest versions, jest-dom hoisted to root).

// Not `import "@testing-library/jest-dom/vitest"` — this monorepo has two
// vitest versions (apps/api pins 1.6.0, apps/mobile pins 4.1.10). npm hoists
// @testing-library/jest-dom to the root node_modules, so its internal
// require("vitest") resolves the *root-hoisted* 1.6.0, extending a different
// `expect` singleton than the one this workspace's tests actually use.
// Extending the `expect` imported here (correctly resolved to apps/mobile's
// own nested vitest@4.1.10) sidesteps that mismatch entirely.
function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length(): number {
      return values.size;
    },
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.has(String(key)) ? values.get(String(key)) ?? null : null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(String(key));
    },
    setItem(key: string, value: string): void {
      values.set(String(key), String(value));
    },
  };
}

const memoryLocalStorage = createMemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryLocalStorage,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: memoryLocalStorage,
  });
}

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
