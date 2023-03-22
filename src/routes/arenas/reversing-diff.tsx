import {Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography, useMediaQuery} from '@suid/material';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, query, serverTimestamp, where} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getStorage, ref} from 'firebase/storage';
import last from 'lodash/last';
import remarkGfm from 'remark-gfm';
import {useDownloadURL, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, For, JSX, Match, onCleanup, Show, Switch} from 'solid-js';
import SolidMarkdown from 'solid-markdown';
import {A, useSearchParams} from 'solid-start';
import {setArenaTitle, setHeaderText, useAuthState} from '../arenas';
import styles from './reversing-diff.module.css';
import Doc from '~/components/Doc';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, ReversingDiffSubmission, TypingJapaneseSubmission, UseFireStoreReturn} from '~/lib/schema';

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
	rule?: string,
	files?: {
		filename: string,
		label: string,
		isMain: boolean,
	}[],
}

const DEFAULT_CODE = `
#include <iostream>
int main() {
  std::cout << "Hello, World!" << std::endl;
  return 0;
}
`.trim();

const ReversingDiff = () => {
	const [searchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);

	const authState = useAuthState();

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [code, setCode] = createSignal<string>(DEFAULT_CODE);
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [submission, setSubmission] = createSignal<UseFireStoreReturn<ReversingDiffSubmission | undefined> | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<ReversingDiffSubmission[] | undefined> | null>(null);

	setArenaTitle('diff');

	createEffect(() => {
		if (gameData.loading) {
			return;
		}

		if (!gameData.data || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data.rule.path !== 'gameRules/reversing-diff') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');
	});

	const handleClickSubmit = async () => {
		if (!gameData.data || !authState?.data) {
			return;
		}

		setSubmission(null);
		setSubmitStatus('executing');

		const submissionRef = await addDoc(
			collection(gameRef, 'submissions') as CollectionReference<ReversingDiffSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: authState.data.uid,
				status: 'pending',
				language: 'cpp',
				code: code(),
				stdout: null,
				stderr: null,
				duration: null,
				score: null,
				createdAt: serverTimestamp(),
				executedAt: null,
			},
		);

		setLastSubmissionTime(Date.now());
		setSubmission(useFirestore(submissionRef));
	};

	createEffect(() => {
		const submissionDoc = submission();
		if (submitStatus() === 'executing') {
			if (submissionDoc?.data?.status === 'success') {
				setSubmitStatus('throttled');
			}
		}
	});

	const intervalId = setInterval(() => {
		const lastSubmissionTimeData = lastSubmissionTime();
		if (lastSubmissionTimeData === null) {
			setThrottleTime(0);
			return;
		}

		const newThrottleTime = Math.max(0, 30000 - (Date.now() - lastSubmissionTimeData));
		setThrottleTime(newThrottleTime);
		if (newThrottleTime === 0 && submitStatus() === 'throttled') {
			setSubmitStatus('ready');
		}
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	createEffect(() => {
		if (authState?.data?.uid) {
			const submissionsData = useFirestore(
				query(
					collection(gameRef, 'submissions') as CollectionReference<ReversingDiffSubmission>,
					where('userId', '==', authState.data.uid),
				),
			);
			setSubmissions(submissionsData);
		}
	});

	createEffect(() => {
		const submissionsData = submissions();
		if (submissionsData && Array.isArray(submissionsData.data)) {
			const successSubmissions = submissionsData.data.filter(({status}) => status === 'success');
			if (successSubmissions.length === 0) {
				setHeaderText('スコア: -');
			} else {
				const minScore = Math.min(...successSubmissions.map(({score}) => score!));
				setHeaderText(`スコア: ${minScore}`);
			}
		}
	});

	return (
		<main class={styles.app}>
			<Container maxWidth="lg" sx={{py: 3}}>
				<Alert severity="info">
					与えられた実行ファイルを解析し、これになるべく近いファイルにビルドされるようなソースコードを提出してください。
				</Alert>
				<Doc data={gameData}>
					{(game) => {
						const config = game.configuration as Config;

						return (
							<>
								<Typography
									variant="body1"
								>
									<SolidMarkdown
										class={styles.rule}
										children={config.rule}
										remarkPlugins={[remarkGfm]}
										linkTarget="_blank"
									/>
								</Typography>
								<Stack spacing={2} direction="row">
									<For each={config.files}>
										{(file) => {
											const urlData = useDownloadURL(ref(storage, `assets/reversing-diff/${file.filename}`));

											return (
												<Show when={urlData.data} keyed>
													{(url) => (
														<Button
															variant={file.isMain ? 'contained' : 'outlined'}
															size="large"
															component={A}
															href={url}
															color="secondary"
														>
															{file.label}をダウンロードする
														</Button>
													)}
												</Show>
											);
										}}
									</For>
								</Stack>
								<TextField
									label="提出コード"
									multiline
									minRows={4}
									value={code()}
									onChange={(_event, value) => setCode(value)}
									disabled={submitStatus() === 'executing'}
									sx={{
										my: 5,
										width: '100%',
										'& textarea': {
											'font-family': 'monospace',
											'line-height': '1em',
										},
									}}
								/>
								<Switch>
									<Match when={submitStatus() === 'ready'}>
										<Button onClick={handleClickSubmit} variant="contained" size="large">
											送信
										</Button>
									</Match>
									<Match when={submitStatus() === 'executing'}>
										<Button variant="contained" disabled size="large">
											<CircularProgress color="secondary" sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}/>
											実行中
										</Button>
									</Match>
									<Match when={submitStatus() === 'throttled'}>
										<Button variant="contained" disabled size="large">
											<CircularProgress variant="determinate" value={(1 - throttleTime() / 30000) * 100} color="secondary" sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}/>
											待機中⋯⋯
										</Button>
									</Match>
								</Switch>
								<Show when={submitStatus() !== 'executing' && submission() !== null}>
									<Doc data={submission()}>
										{(submissionData) => (
											<Alert severity="info" sx={{my: 3}}>
												提出成功 - Diffスコア: {submissionData.score}
											</Alert>
										)}
									</Doc>
								</Show>
							</>
						);
					}}
				</Doc>
			</Container>
			<Show when={phase() === 'finished'}>
				<OnGameFinishedDialog text={code()} gameId={gameId}/>
			</Show>
		</main>
	);
};

export default ReversingDiff;
