import baseConfig from '@hakatashi/eslint-config/typescript';

export default [
	baseConfig,
	{
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		rules: {
			'import/no-unresolved': 'off',
		},
		ignorePatterns: ['lib/**/*.js', 'temp.ts'],
	},
];
