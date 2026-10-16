import '@testing-library/jest-dom/vitest';

// next/font/google is handled by a resolve alias to test/next-font-google.stub.ts
// (see vitest.config.ts). The real loader only exists under the Next build
// pipeline and stalls esbuild during collection, so it is aliased, not mocked.
