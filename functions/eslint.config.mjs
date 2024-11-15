import hakatashiEslintConfig from '../../eslint-config/typescript.js';

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
			'import/no-unresolved': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
		},
	},
];
