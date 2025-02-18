import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://127.0.0.1:3000',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: {...devices['Desktop Chrome']},
		},
		{
			name: 'firefox',
			use: {...devices['Desktop Firefox']},
		},
		{
			name: 'webkit',
			use: {...devices['Desktop Safari']},
		},
		{
			name: 'iphone',
			use: {...devices['iPhone 15']},
		},
		{
			name: 'android',
			use: {...devices['Pixel 7']},
		},
	],
	webServer: {
		command: 'npm run serve',
		url: 'http://127.0.0.1:3000',
		reuseExistingServer: !process.env.CI,
		timeout: 600 * 1000,
	},
});
