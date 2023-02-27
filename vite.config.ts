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
		],
	},
});
