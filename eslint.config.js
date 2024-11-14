import baseConfig from '@hakatashi/eslint-config/typescript';

export default [
	baseConfig,
	{
		"parserOptions": {
			"ecmaVersion": 2022,
			"ecmaFeatures": {
				"jsx": true
			},
			"sourceType": "module"
		},
		"rules": {
			"no-console": "off",
			"no-unused-vars": "off",
			"prefer-destructuring": "off",
			"require-jsdoc": "off",
			"import/extensions": "off",
			"import/prefer-default-export": "off",
			"react/forbid-component-props": "off",
			"react/jsx-no-bind": "off",
			"react/no-unknown-property": "off",
			"react/no-children-prop": "off",
			"react/prop-types": "off",
			"react/react-in-jsx-scope": "off",
			"react/require-default-props": "off",
			"@typescript-eslint/no-unused-vars": "error"
		}
	},
];
