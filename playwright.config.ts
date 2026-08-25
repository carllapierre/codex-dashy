import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:8789',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'npm run start',
        reuseExistingServer: true,
        timeout: 30_000,
        url: 'http://127.0.0.1:8789/api/health',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
