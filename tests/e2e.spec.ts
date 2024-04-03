import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/Decathlon/);
});

test('has h1 with text "TSG Decathlon Portal"', async ({page}) => {
	await page.goto('/');

	const h1 = await page.waitForSelector('main > h1');
	expect(h1).not.toBeNull();

	const text = await h1?.textContent();
	expect(text).toContain('TSG Decathlon Portal');
});
