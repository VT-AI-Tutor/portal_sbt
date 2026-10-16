import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Globs chạy jsdom mặc định; test ngoài các glob này giữ default 'node' và
// opt-in DOM per-file bằng docblock `// @vitest-environment jsdom`.
const JSDOM_GLOBS = [
  'src/core/exercise/**/*.test.{ts,tsx}',
  'src/core/rich-text/**/*.test.{ts,tsx}',
  'src/core/math/**/*.test.{ts,tsx}',
  'src/core/question-schema/**/*.test.{ts,tsx}',
];

const shared = {
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
};

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', ...JSDOM_GLOBS],
        },
      },
      {
        ...shared,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          include: [...JSDOM_GLOBS],
        },
      },
    ],
  },
});
