module.exports = {
	root: true,
	extends: '@hakatashi/eslint-config/typescript',
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
	},
	rules: {
		'import/no-unresolved': 'off',
	},
};
