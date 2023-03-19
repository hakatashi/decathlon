import {createWindowSize} from '@solid-primitives/resize-observer';
import {createEffect, createMemo, createSignal, onMount} from 'solid-js';
import {Link} from 'solid-start';
import styles from './typing-japanese.module.css';

const TypingJapanese = () => {
	const zoom = createMemo(() => {
		const size = createWindowSize();
		return (size.width / 2 - 50) / 800;
	});

	const [text, setText] = createSignal<string>('');

	onMount(() => {
		const savedText = localStorage.getItem('typing-japanese_autosave');
		if (savedText !== null) {
			setText(savedText);
		}
	});

	createEffect(() => {
		localStorage.setItem('typing-japanese_autosave', text());
	});

	return (
		<main class={styles.app}>
			<Link
				href="https://fonts.googleapis.com/css2?family=BIZ+UDGothic&display=swap"
				rel="stylesheet"
			/>

			{/* eslint-disable-next-line react/iframe-missing-sandbox -- https://github.com/whatwg/html/issues/3958 */}
			<iframe
				class={styles.pdf}
				src={`https://www.goukaku.ne.jp/image/sample/0307kfng4ysd/65-BSJ-Q.pdf#zoom=${Math.floor(zoom() * 100)}&scrollbar=0&pagemode=none&toolbar=0&navpanes=0`}
			/>

			<div class={styles.inputAreaWrap}>
				<textarea
					class={styles.inputArea}
					spellcheck={false}
					placeholder="ここに入力します"
					onInput={(event) => setText(event.currentTarget.value)}
					value={text()}
				/>
			</div>
		</main>
	);
};

export default TypingJapanese;

