import type {Config} from 'jest';

const config: Config = {
	transform: {
		'\\.tsx': require.resolve('./test/transformer.cjs'),
	},
	transformIgnorePatterns: ['node_modules/(?!solid-js.*|.*(?<=.[tj]sx))$'],
	resolver: require.resolve('solid-jest/preset/browser/resolver'),
	testEnvironment: 'jsdom',
};

export default config;
