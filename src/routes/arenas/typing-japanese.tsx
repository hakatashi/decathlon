import {createWindowSize} from '@solid-primitives/resize-observer';
import TextareaAutosize from '@suid/base/TextareaAutosize';
import {Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Modal, Typography} from '@suid/material';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, JSX, onCleanup, onMount, Show} from 'solid-js';
import {Link, useSearchParams} from 'solid-start';
import {setHeaderText} from '../arenas';
import styles from './typing-japanese.module.css';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game} from '~/lib/schema';

interface Config {
	enabled?: boolean,
	duration?: number,
	textUrl?: string,
}

const TypingJapanese = () => {
	const [searchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);


	const zoom = createMemo(() => {
		const size = createWindowSize();
		return (size.width / 2 - 50) / 800;
	});

	const [text, setText] = createSignal<string>('こんにちは');
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
	const [config, setConfig] = createSignal<Config>({});
	const [textareaEl, setTextareaEl] = createSignal<HTMLTextAreaElement | null>(null);

	onMount(() => {
		const savedText = localStorage.getItem(`typing-japanese_${gameId}_autosave`);
		if (savedText !== null) {
			setText(savedText);
			textareaEl()?.focus();
		}
	});

	createEffect(() => {
		if (gameData.data === null || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data) {
			if (gameData.data.rule.path !== 'gameRules/typing-japanese') {
				throw new PageNotFoundError();
			}

			const currentTime = Date.now();

			const savedConfig: Config = gameData.data.configuration;
			setConfig(savedConfig);

			setPhase('waiting');

			const startTimeString = localStorage.getItem(`typing-japanese_${gameId}_startTime`);
			const startTime = startTimeString ? parseFloat(startTimeString) : null;
			if (savedConfig.enabled && startTime !== null) {
				setPhase('playing');
			}

			if (
				savedConfig.duration &&
				startTime &&
				startTime + savedConfig.duration <= currentTime
			) {
				setPhase('finished');
			}
		}
	});

	const intervalId = setInterval(() => {
		const startTimeString = localStorage.getItem(`typing-japanese_${gameId}_startTime`);
		const startTime = startTimeString ? parseFloat(startTimeString) : null;
		const now = Date.now();
		const duration = config().duration;

		if (startTime && duration && now >= startTime) {
			const remainingSeconds = Math.max(Math.floor((duration - (now - startTime)) / 1000), 0);
			const minutes = Math.floor(remainingSeconds / 60);
			const seconds = remainingSeconds % 60;

			setHeaderText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

			if (remainingSeconds === 0) {
				setPhase('finished');
			}
		}
	}, 1000);

	onCleanup(() => {
		clearInterval(intervalId);
	});

	createEffect(() => {
		localStorage.setItem(`typing-japanese_${gameId}_autosave`, text());
	});

	const handleClickStart: JSX.EventHandler<HTMLButtonElement, MouseEvent> = () => {
		if (phase() !== 'waiting' || !config().enabled) {
			return;
		}

		const now = Date.now();

		setPhase('playing');
		localStorage.setItem(`typing-japanese_${gameId}_startTime`, now.toString());

		textareaEl()?.focus();
	};

	return (
		<main class={styles.app}>
			<Link
				href="https://fonts.googleapis.com/css2?family=BIZ+UDGothic&display=swap"
				rel="stylesheet"
			/>

			{/* eslint-disable-next-line react/iframe-missing-sandbox -- https://github.com/whatwg/html/issues/3958 */}
			<iframe
				class={styles.pdf}
				style={{visibility: phase() === 'playing' || phase() === 'finished' ? 'visible' : 'hidden'}}
				src={`https://www.goukaku.ne.jp/image/sample/0307kfng4ysd/65-BSJ-Q.pdf#zoom=${Math.floor(zoom() * 100)}&scrollbar=0&pagemode=none&toolbar=0&navpanes=0`}
			/>

			<div class={styles.inputAreaWrap}>
				<Show when={phase() === 'waiting'}>
					<Button
						class={styles.startButton}
						disabled={!config().enabled}
						onClick={handleClickStart}
						variant="contained"
						size="large"
						sx={{position: 'absolute'}}
					>
						{config().enabled
							? 'クリック or Enterキーで開始'
							: '競技開始まで少々お待ちください'}
					</Button>
				</Show>
				<div class={styles.inputScrollArea}>
					<TextareaAutosize
						ref={(textarea) => {
							setTextareaEl(textarea);
						}}
						class={styles.inputArea}
						disabled={phase() !== 'playing'}
						spellcheck={false}
						placeholder="ここに入力します"
						onInput={(event) => setText(event.currentTarget.value)}
						value={text()}
					>
						{text()}
					</TextareaAutosize>
				</div>
			</div>

			<Dialog
				open={phase() === 'finished'}
			>
				<DialogTitle>
					競技は終了しました
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						<CircularProgress color="primary"/>
						スコアを送信しています⋯⋯
					</DialogContentText>
				</DialogContent>
			</Dialog>
		</main>
	);
};

export default TypingJapanese;
