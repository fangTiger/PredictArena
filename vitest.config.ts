import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  },
  test: {
    globals: true,
    // 默认 node 环境，组件测试通过 environmentMatchGlobs 切换为 jsdom
    environment: 'node',
    environmentMatchGlobs: [
      ['test/components/**/*.test.tsx', 'jsdom'],
      ['test/unit/components/**/*.test.tsx', 'jsdom']
    ],
    setupFiles: ['./test/setup/jest-dom.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    exclude: ['test/contracts/**']
  }
});
