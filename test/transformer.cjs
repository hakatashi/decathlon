const babelJest = require('babel-jest');

module.exports = babelJest.default.createTransformer({
	presets: [
		'babel-preset-solid',
		'@babel/preset-typescript',
		[
			'@babel/preset-env',
			{
				targets: {
					node: 'current',
					esmodules: true,
				},
			},
		],
	],
});
