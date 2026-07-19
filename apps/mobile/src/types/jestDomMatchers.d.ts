import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

/**
 * Augments vitest's `Assertion` with jest-dom matchers (toBeInTheDocument,
 * toHaveAttribute, ...).
 *
 * NOT using @testing-library/jest-dom's own `types/vitest.d.ts` re-export:
 * this monorepo has two vitest versions (apps/api pins 1.6.0, apps/mobile
 * pins 4.1.10) and @testing-library/jest-dom is npm-hoisted to the root
 * node_modules. Its own `declare module "vitest"` augmentation resolves
 * "vitest" relative to ITS location, landing on the root-hoisted 1.6.0 —
 * a different type identity than the "vitest" apps/mobile's test files
 * actually import. Declaring the same augmentation from a file living
 * inside apps/mobile/src resolves "vitest" correctly, against this
 * workspace's own nested vitest@4.1.10.
 */
declare module "vitest" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
