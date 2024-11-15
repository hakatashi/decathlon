import hakatashiEslintConfig from '@hakatashi/eslint-config/typescript.js';

export default [
	{
		ignores: ['.vinxi/', '.output/', 'dist/', '.solid/', 'test-results/', 'playwright-report/', 'functions/'],
	},
	...hakatashiEslintConfig,
	{
		languageOptions: {
			ecmaVersion: 2022,
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			sourceType: 'module',
		},
		rules: {
			'react/require-default-props': 'off',
		},
	},
];
