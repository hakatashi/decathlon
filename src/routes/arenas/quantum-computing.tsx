/* eslint-disable array-plural/array-plural */

import {useSearchParams} from '@solidjs/router';
import {Alert, Box, Button, ButtonGroup, CircularProgress, Container, Link as LinkUi, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography} from '@suid/material';
import {blue} from '@suid/material/colors';
import dayjs from 'dayjs';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, where} from 'firebase/firestore';
// import remarkGfm from 'remark-gfm';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, Match, onCleanup, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {setArenaTitle, useUser} from '../arenas';
import styles from './reversing-diff.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, QuantumComputingConfiguration, QuantumComputingSubmission, UseFireStoreReturn} from '~/lib/schema';

interface MainTabProps {
	phase: 'loading' | 'waiting' | 'playing' | 'finished',
}

const MainTab = (props: MainTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [code, setCode] = createSignal<string | null>(null);
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [submission, setSubmission] = createSignal<UseFireStoreReturn<QuantumComputingSubmission | null | undefined> | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);

	const handleClickSubmit = async () => {
		const userData = user();
		if (!gameData.data || !userData?.uid) {
			return;
		}

		const codeData = code();
		if (codeData === null) {
			return;
		}

		setSubmission(null);
		setSubmitStatus('executing');

		const submissionRef = await addDoc(
			collection(gameRef, 'submissions') as CollectionReference<QuantumComputingSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: userData.uid,
				status: 'pending',
				code: codeData,
				size: codeData.length,
				stdout: null,
				stderr: null,
				duration: null,
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
			if (submissionDoc?.data?.status === 'success' || submissionDoc?.data?.status === 'error') {
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

	return (
		<Doc data={gameData}>
			{(game) => {
				const config = game.configuration as QuantumComputingConfiguration;

				return (
					<>
						<Typography variant="body1">
							<SolidMarkdown
								class="markdown"
								// eslint-disable-next-line react/no-children-prop
								children={config.description}
								// remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</Typography>
						<Typography variant="h4" component="h2">判定プログラム</Typography>
						<pre>{config.judgeCode}</pre>
						<TextField
							label="提出コード"
							multiline
							minRows={4}
							value={code() === null ? config.submissionTemplate : code()}
							onChange={(_event, value) => setCode(value)}
							disabled={props.phase === 'finished' || submitStatus() === 'executing'}
							// @ts-expect-error: type error
							sx={{
								mt: 5,
								mb: 2,
								width: '100%',
								'& textarea': {
									'font-family': 'monospace',
									'line-height': '1em',
								},
							}}
						/>
						<Show when={submitStatus() !== 'executing' && submission() !== null}>
							<Doc data={submission()}>
								{(submissionData) => (
									<Switch>
										<Match when={submissionData.status === 'success'}>
											<Alert severity="info" sx={{my: 2}}>
												提出成功
											</Alert>
										</Match>
										<Match when={submissionData.status === 'error'}>
											<Alert severity="error" sx={{my: 2}}>
												提出失敗
												{' - '}
												<LinkUi
													href="#"
													underline="hover"
													onClick={() => setSearchParams({tab: 'submissions', submissionId: submissionData.id})}
												>
													詳細を見る
												</LinkUi>
											</Alert>
										</Match>
									</Switch>
								)}
							</Doc>
						</Show>
						<Switch>
							<Match when={props.phase === 'finished'}>
								<Button variant="contained" disabled size="large">
									競技は終了しました
								</Button>
							</Match>
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
					</>
				);
			}}
		</Doc>
	);
};

interface SubmissionsTabProps {
	submissions: UseFireStoreReturn<QuantumComputingSubmission[] | null | undefined> | null,
}

const SubmissionsTab = (props: SubmissionsTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const handleClickSubmission = (submissionId: string, event: MouseEvent) => {
		event.preventDefault();
		setSearchParams({submissionId});
	};

	return (
		<Switch>
			<Match when={searchParams.submissionId} keyed>
				{(submissionId) => {
					const submission = createMemo(() => (
						props.submissions?.data?.find(({id}) => submissionId === id)
					));

					return (
						<div class={styles.submission}>
							<LinkUi
								href="#"
								underline="hover"
								onClick={() => setSearchParams({submissionId: undefined})}
							>
								提出一覧に戻る
							</LinkUi>
							<Typography variant="h4" component="h2" my={1}>Author</Typography>
							<Show when={submission()} keyed>
								{({userId}) => (
									<Username userId={userId}/>
								)}
							</Show>
							<Typography variant="h4" component="h2" my={1}>Date</Typography>
							<Show when={submission()} keyed>
								{({createdAt}) => (
									<p>{dayjs(createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}</p>
								)}
							</Show>
							<Typography variant="h4" component="h2" my={1}>Execution Time</Typography>
							<p>{submission()?.duration}ms</p>
							<Typography variant="h4" component="h2" my={1}>Score</Typography>
							<p>{submission()?.score ?? '-'}</p>
							<Typography variant="h4" component="h2" my={1}>Code</Typography>
							<pre>{submission()?.code}</pre>
							<Show when={submission()?.errorMessage}>
								<Typography variant="h4" component="h2" my={1}>Validation Message</Typography>
								<pre>{submission()?.errorMessage}</pre>
							</Show>
							<Show when={submission()?.stderr}>
								<Typography variant="h4" component="h2" my={1}>Error</Typography>
								<pre>{submission()?.stderr}</pre>
							</Show>
						</div>
					);
				 }}
			</Match>
			<Match when>
				<TableContainer component={Paper}>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>User</TableCell>
								<TableCell align="right">Score</TableCell>
								<TableCell align="right">Status</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission) => (
									<TableRow>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right"><strong>{submission.score ?? '-'}</strong></TableCell>
										<TableCell align="right">{submission.status}</TableCell>
										<TableCell align="right">
											<LinkUi
												href="#"
												underline="hover"
												sx={{display: 'inline-box', whiteSpace: 'pre'}}
												onClick={(event) => handleClickSubmission(submission.id, event)}
											>
												{dayjs(submission.createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}
											</LinkUi>
										</TableCell>
									</TableRow>
								)}
							</Collection>
						</TableBody>
					</Table>
				</TableContainer>
			</Match>
		</Switch>
	);
};

const QuantumComputing = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<QuantumComputingSubmission[] | null | undefined> | null>(null);
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	setArenaTitle('diff');

	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			if (phase() === 'playing') {
				const submissionsData = useFirestore(
					query(
					collection(gameRef, 'submissions') as CollectionReference<QuantumComputingSubmission>,
					where('userId', '==', userData.uid),
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			} else if (phase() === 'finished') {
				const submissionsData = useFirestore(
					query(
					collection(gameRef, 'submissions') as CollectionReference<QuantumComputingSubmission>,
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			}
		}
	});

	createEffect(() => {
		if (!(['main', 'submissions'] as (string | undefined)[]).includes(searchParams.tab)) {
			setSearchParams({tab: 'main'});
		}
	});

	createEffect(() => {
		if (gameData.loading) {
			return;
		}

		if (!gameData.data || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data.rule.path !== 'gameRules/quantum-computing') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');

		if (gameData.data.configuration.enabled) {
			setPhase('playing');

			if (gameData.data.endAt && gameData.data.endAt.toDate() <= new Date()) {
				setPhase('finished');
			}
		}
	});

	const intervalId = setInterval(() => {
		if (
			phase() === 'playing' &&
			gameData.data?.endAt &&
			gameData.data.endAt.toDate() <= new Date()
		) {
			setPhase('finished');
		}
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	return (
		<Switch>
			<Match when={phase() === 'waiting'}>
				<Typography
					variant="h3"
					component="p"
					textAlign="center"
					py={6}
				>
					競技開始までしばらくお待ち下さい。
				</Typography>
			</Match>
			<Match
				when={phase() === 'playing' || phase() === 'finished'}
			>
				<main class={styles.app}>
					<Container maxWidth="lg" sx={{py: 3}}>
						<Alert severity="info">
							与えられた条件を満たす量子回路を設計し、Pythonコードとして提出してください。
						</Alert>
						<Box textAlign="center" my={1}>
							<ButtonGroup variant="outlined" size="large">
								<Button
									variant={searchParams.tab === 'main' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'main', submissionId: undefined})}
								>
									問題
								</Button>
								<Button
									variant={searchParams.tab === 'submissions' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'submissions'})}
								>
									提出一覧
								</Button>
							</ButtonGroup>
						</Box>
						<Switch>
							<Match when={searchParams.tab === 'main'}>
								<MainTab phase={phase()}/>
							</Match>
							<Match when={searchParams.tab === 'submissions'}>
								<SubmissionsTab submissions={submissions()}/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default QuantumComputing;
