import path from 'path';
import suid from '@suid/vite-plugin';
import solid from 'solid-start/vite';
import {defineConfig} from 'vite';

export default defineConfig({
	plugins: [suid(), solid({ssr: false})],
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
});
