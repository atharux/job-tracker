import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// jsdom has no real 2D canvas context (no `canvas` native package installed,
// deliberately — this repo avoids Node-only deps for Cloudflare Pages), so
// lottie-react's animation player crashes trying to draw frames. Animations
// aren't meaningful to assert on in a test environment anyway.
vi.mock('lottie-react', () => ({
  default: React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({ setSpeed: () => {}, play: () => {}, stop: () => {} }));
    return null;
  }),
}));

// Node's own native `localStorage` global shadows jsdom's with a non-functional
// stub (it requires a --localstorage-file to actually work), which breaks any
// code under test that calls localStorage.getItem/setItem. The real app only
// ever runs in a browser, where this collision doesn't exist — this is purely
// a test-environment fix.
function makeLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

// Stubbed at module load (not inside beforeEach) so it's already in place for
// suites that run setup work in beforeAll — beforeAll runs before any
// beforeEach, including this file's, so a hook-based stub would arrive too late.
vi.stubGlobal('localStorage', makeLocalStorageMock());
vi.stubGlobal('sessionStorage', makeLocalStorageMock());

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
