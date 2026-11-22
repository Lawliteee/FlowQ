import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Добавляем frontend/node_modules в пути поиска модулей для tests/e2e
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.resolve(__dirname, 'node_modules');
if (!process.env.NODE_PATH) {
  process.env.NODE_PATH = nodeModules;
} else if (!process.env.NODE_PATH.includes(nodeModules)) {
  process.env.NODE_PATH = `${nodeModules}${path.delimiter}${process.env.NODE_PATH}`;
}
createRequire(import.meta.url)('module').Module._initPaths();

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  timeout: 30000,
  fullyParallel: false, // по очереди для корректного состояния очередей
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    channel: 'chrome', // Использовать установленный в системе Google Chrome
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'Google Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
});
