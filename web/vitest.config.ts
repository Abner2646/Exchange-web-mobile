import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Real next/font/google loader stalls esbuild during collection under
      // vitest; alias to a stub so it is never resolved/transformed.
      'next/font/google': path.resolve(__dirname, './test/next-font-google.stub.ts'),
    },
  },
});
