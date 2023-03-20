import {createWindowSize} from '@solid-primitives/resize-observer';
import TextareaAutosize from '@suid/base/TextareaAutosize';
import {Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, useMediaQuery} from '@suid/material';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
import last from 'lodash/last';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount, Show} from 'solid-js';
import {A, Link, useSearchParams} from 'solid-start';
import {setArenaTitle, setHeaderText, useAuthState} from '../arenas';
import styles from './typing-japanese.module.css';
import Doc from '~/components/Doc';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, TypingJapaneseSubmission, UseFireStoreReturn} from '~/lib/schema';

interface onGameFinishedDialogProps {
	text: string,
	gameId: string,
}

const OnGameFinishedDialog = (props: onGameFinishedDialogProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const functions = getFunctions();
	const submitTypingJapaneseScore = httpsCallable(functions, 'submitTypingJapaneseScore');

	const [submissionData, setSubmissionData] = createSignal<UseFireStoreReturn<TypingJapaneseSubmission | null | undefined> | null>(null);

	createEffect(() => {
		const authState = useAuthState();
		if (authState?.data?.uid) {
			const submissionRef = doc(db, 'games', props.gameId, 'submissions', authState.data.uid) as DocumentReference<TypingJapaneseSubmission>;
			setSubmissionData(useFirestore(submissionRef));
		}
	});

	createEffect(async () => {
		if (submissionData() !== null && !submissionData()?.error && submissionData()?.data === null) {
			await submitTypingJapaneseScore({
				submissionText: props.text,
				gameId: props.gameId,
			});
		}
	});

	return (
		<Dialog open class={styles.onGameFinishedDialog}>
			<DialogTitle>
				競技は終了しました
			</DialogTitle>
			<DialogContent>
				<DialogContentText>
					<Doc
						data={submissionData()}
						fallback={
							<>
								<CircularProgress color="primary"/>
								<p>スコアを送信しています⋯⋯</p>
							</>
						}
					>
						{(submission) => (
							<>
								<Typography variant="h5" component="p">
									スコア: {submission.score}
								</Typography>
								<Box mt={1}>
									<For each={submission.diffTokens}>
										{(diff) => (
											<span class={styles[diff.type]}>{diff.token}</span>
										)}
									</For>
								</Box>
							</>
						)}
					</Doc>
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Doc data={submissionData()}>
					{(submission) => (
						<Button
							component={A}
							href={`/athlons/${last(submission.athlon.path.split('/'))}/typing-japanese`}
						>
							競技ページに戻る
						</Button>
					)}
				</Doc>
			</DialogActions>
		</Dialog>
	);
};

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

	const isMobileLayout = useMediaQuery('(max-width: 480px)');

	const zoom = createMemo(() => {
		const size = createWindowSize();
		return (size.width * (isMobileLayout() ? 1 : 0.5) - 50) / 800;
	});

	const [text, setText] = createSignal<string>('');
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
	const [config, setConfig] = createSignal<Config>({});
	const [textareaEl, setTextareaEl] = createSignal<HTMLTextAreaElement | null>(null);

	setArenaTitle('タイピング (日本語)');

	onMount(() => {
		const savedText = localStorage.getItem(`typing-japanese_${gameId}_autosave`);
		if (savedText !== null) {
			setText(savedText);
			textareaEl()?.focus();
		}
	});

	const [submissionData, setSubmissionData] = createSignal<UseFireStoreReturn<TypingJapaneseSubmission | null | undefined> | null>(null);

	createEffect(() => {
		const authState = useAuthState();
		if (authState?.data?.uid) {
			const submissionRef = doc(db, 'games', gameId, 'submissions', authState.data.uid) as DocumentReference<TypingJapaneseSubmission>;
			setSubmissionData(useFirestore(submissionRef));
		}
	});

	createEffect(() => {
		if (gameData.data === null || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data && submissionData() && !submissionData()?.loading) {
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

			if (submissionData()?.data !== null) {
				setPhase('finished');
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

	const handleStartGame = () => {
		if (phase() !== 'waiting' || !config().enabled) {
			return;
		}

		const now = Date.now();

		setPhase('playing');
		localStorage.setItem(`typing-japanese_${gameId}_startTime`, now.toString());

		textareaEl()?.focus();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && phase() === 'waiting') {
			event.preventDefault();
			handleStartGame();
		}
	};

	window.addEventListener('keydown', handleKeydown);
	onCleanup(() => {
		window.removeEventListener('keydown', handleKeydown);
	});

	const pdfUrl = createMemo(() => {
		const url = config()?.textUrl ?? '';
		if (isMobileLayout()) {
			return `https://drive.google.com/viewerng/viewer?${new URLSearchParams({
				embedded: 'true',
				url,
			})}`;
		}
		return url;
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
				style={{visibility: phase() === 'playing' || phase() === 'finished' ? 'visible' : 'hidden'}}
				src={`${pdfUrl()}#${new URLSearchParams({
					zoom: Math.floor(zoom() * 100).toString(),
					scrollbar: '0',
					pagemode: 'none',
					toolbar: '0',
					navpanes: '0',
				})}()`}
			/>

			<div class={styles.inputAreaWrap}>
				<Show when={phase() === 'waiting'}>
					<Button
						class={styles.startButton}
						disabled={!config().enabled}
						onClick={handleStartGame}
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

			<Show when={phase() === 'finished'}>
				<OnGameFinishedDialog text={text()} gameId={gameId}/>
			</Show>
		</main>
	);
};

export default TypingJapanese;
