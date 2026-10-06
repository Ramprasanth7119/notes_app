import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    // Env is fixed before any app module is loaded.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-not-used-anywhere-else',
      BCRYPT_SALT_ROUNDS: '4',
      UPLOAD_DIR: path.join(os.tmpdir(), 'notes-app-test-uploads')
    },
    coverage: {
      provider: 'v8',
      include: ['app.js', 'config/**', 'controllers/**', 'middleware/**', 'models/**', 'routes/**', 'scripts/**', 'utils/**', 'validation/**'],
      // The benchmark is a developer tool, not application code.
      exclude: ['scripts/benchmarkSearch.js'],
      reporter: ['text-summary', 'text']
    },
    testTimeout: 20000,
    hookTimeout: 120000
  }
});
