import { expect, test } from '@playwright/test';

test('serves the dashboard shell and reports API health', async ({ page, request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    await page.goto('/');
    await expect(page).toHaveTitle('Codex Dashy');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(
        page.getByText('Token history will appear here after collection starts.'),
    ).toBeVisible();
});
