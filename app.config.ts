import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from '@solidjs/start/config';
import suidPlugin from '@suid/vite-plugin';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

export default defineConfig({
	vite: {
		plugins: [
			suidPlugin(),
		],
		build: {target: 'esnext'},
		optimizeDeps: {
			exclude: [
				'firebase/firestore',
				'@firebase/firestore',
				'firebase/auth',
				'@firebase/auth',
				'firebase/storage',
				'@firebase/storage',
				'firebase/functions',
				'@firebase/functions',
			],
			include: [
				// CJS modules depended on by ES modules (solid-markdown) should be explicitly included
				// https://vite.dev/config/dep-optimization-options#optimizedeps-exclude
				'solid-markdown > debug',
				'solid-markdown > extend',
			],
		},
		resolve: {
			// https://github.com/wobsoriano/solid-firebase/issues/11#issuecomment-1467538235
			alias: {
				'@firebase/auth': path.resolve(
					__dirname,
					'node_modules/@firebase/auth/dist/esm2017/index.js',
				),
				'@firebase/app': path.resolve(
					__dirname,
					'node_modules/@firebase/app/dist/esm/index.esm2017.js',
				),
			},
		},
	},
	ssr: false,
});
