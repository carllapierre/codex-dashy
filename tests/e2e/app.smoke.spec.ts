import { expect, test } from '@playwright/test';

test('serves the dashboard shell and reports API health', async ({ page, request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    await page.goto('/');
    await expect(page).toHaveTitle('Codex Dashy');
    await expect(page.getByRole('heading', { name: 'Codex usage' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Global overview')).not.toBeVisible();
    await expect(page.getByText('Time window')).toBeVisible();
});
