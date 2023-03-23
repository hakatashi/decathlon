/* eslint-disable array-plural/array-plural */

import {Alert, Avatar, Box, Button, ButtonGroup, CircularProgress, Container, Link as LinkUi, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography} from '@suid/material';
import {blue} from '@suid/material/colors';
import dayjs from 'dayjs';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import remarkGfm from 'remark-gfm';
import {useDownloadURL, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch} from 'solid-js';
import SolidMarkdown from 'solid-markdown';
import {A, Link, useSearchParams} from 'solid-start';
import {setArenaTitle, setHeaderText, useAuthState} from '../arenas';
import styles from './reversing-diff.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, ReversingDiffRanking, ReversingDiffSubmission, UseFireStoreReturn, User} from '~/lib/schema';

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

interface Props {
	submissions: UseFireStoreReturn<ReversingDiffSubmission[] | null | undefined> | null,
}

const MainTab = (props: Props) => {
	const [searchParams, setSearchParams] = useSearchParams();

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
	const [submission, setSubmission] = createSignal<UseFireStoreReturn<ReversingDiffSubmission | null | undefined> | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);

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

	createEffect(() => {
		const submissionsData = props.submissions;
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
								// eslint-disable-next-line react/no-children-prop
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
												提出成功 - Diffスコア: {submissionData.score}
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

const SubmissionsTab = (props: Props) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

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
										<TableCell align="right"><strong>{submission.score}</strong></TableCell>
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

const RankingTab = () => {
	const [searchParams] = useSearchParams();
	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const authState = useAuthState();

	const rankingRef = collection(db, `games/${gameId}/ranking`) as CollectionReference<ReversingDiffRanking>;
	const rankingDocs = useFirestore(query(rankingRef, orderBy('score', 'asc'), orderBy('createdAt', 'asc')));

	return (
		<TableContainer component={Paper}>
			<Table>
				<TableHead>
					<TableRow>
						<TableCell>#</TableCell>
						<TableCell>User</TableCell>
						<TableCell align="right">Score</TableCell>
						<TableCell align="right">Date</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					<Collection data={rankingDocs}>
						{(ranking, i) => {
							const isMe = authState?.data?.uid === ranking.userId;

							return (
								<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}}>
									<TableCell>{i() + 1}</TableCell>
									<TableCell><Username userId={ranking.userId}/></TableCell>
									<TableCell align="right"><strong>{ranking.score}</strong></TableCell>
									<TableCell align="right">{dayjs(ranking.createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}</TableCell>
								</TableRow>
							);
						 }}
					</Collection>
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const ReversingDiff = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const authState = useAuthState();
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<ReversingDiffSubmission[] | null | undefined> | null>(null);

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;

	createEffect(() => {
		if (authState?.data?.uid) {
			const submissionsData = useFirestore(
				query(
					collection(gameRef, 'submissions') as CollectionReference<ReversingDiffSubmission>,
					where('userId', '==', authState.data.uid),
				),
			);
			console.log(submissionsData);
			setSubmissions(submissionsData);
		}
	});

	createEffect(() => {
		if (!['main', 'submissions', 'ranking'].includes(searchParams.tab)) {
			setSearchParams({tab: 'main'});
		}
	});

	return (
		<main class={styles.app}>
			<Container maxWidth="lg" sx={{py: 3}}>
				<Alert severity="info">
					与えられた実行ファイルを解析し、これになるべく近いファイルにビルドされるようなソースコードを提出してください。
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
						<Button
							variant={searchParams.tab === 'ranking' ? 'contained' : 'outlined'}
							onClick={() => setSearchParams({tab: 'ranking', submissionId: undefined})}
						>
							ランキング
						</Button>
					</ButtonGroup>
				</Box>
				<Switch>
					<Match when={searchParams.tab === 'main'}>
						<MainTab submissions={submissions()}/>
					</Match>
					<Match when={searchParams.tab === 'submissions'}>
						<SubmissionsTab submissions={submissions()}/>
					</Match>
					<Match when={searchParams.tab === 'ranking'}>
						<RankingTab/>
					</Match>
				</Switch>
			</Container>
		</main>
	);
};

export default ReversingDiff;
