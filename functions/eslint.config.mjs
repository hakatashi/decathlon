import hakatashiEslintConfig from '@hakatashi/eslint-config/typescript.js';

export default [
	{
		ignores: ['lib/**/*.js', 'temp.ts'],
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
			radix: 'off',
			'import/no-unresolved': 'off',
			'import/order': 'off',
			'react/forward-ref-uses-ref': 'off',
			'react/jsx-filename-extension': 'off',
		},
	},
];
