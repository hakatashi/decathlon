import {Link} from '@solidjs/meta';
import {useSearchParams} from '@solidjs/router';
import {Alert, Box, Button, ButtonGroup, Card, CardContent, CircularProgress, Container, FormControl, Grid, InputLabel, Link as LinkUi, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography} from '@suid/material';
import {SelectChangeEvent} from '@suid/material/Select';
import {blue, green, red} from '@suid/material/colors';
import {stripIndent} from 'common-tags';
import dayjs from 'dayjs';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, where} from 'firebase/firestore';
import {floor} from 'lodash';
import zip from 'lodash/zip';
// import remarkGfm from 'remark-gfm';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {setArenaTitle, useUser} from '../arenas';
import styles from './reversing-diff.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {codegolfLanguageAllowList} from '~/lib/const';
import {CodegolfSubmission, Game, CodegolfRanking, UseFireStoreReturn, CodegolfConfiguration} from '~/lib/schema';

const DEFAULT_CODES = {
	'c-gcc': stripIndent`
		#include <stdio.h>
		int main() {
		  printf("%s\\n", "Hello, World!");
		  return 0;
		}
	`,
	python3: stripIndent`
		print('Hello, World!')
	`,
} as Record<string, string>;

interface MainTabProps {
	submissions: UseFireStoreReturn<CodegolfSubmission[] | null | undefined> | null,
	phase: 'loading' | 'waiting' | 'playing' | 'finished',
}

const MainTab = (props: MainTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [code, setCode] = createSignal<string>('');
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [submission, setSubmission] = createSignal<UseFireStoreReturn<CodegolfSubmission | null | undefined> | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);
	const [selectedLanguage, setSelectedLanguage] = createSignal<string | null>(null);
	const [selectedAnyLanguage, setSelectedAnyLanguage] = createSignal<string | null>(null);
	const [languageInfos, setLanguageInfos] = createSignal<{shortestSize: number | null}[]>([]);

	let descriptionEl!: HTMLElement;

	const executionLanguage = createMemo(() => {
		if (selectedLanguage() !== 'anything') {
			return selectedLanguage();
		}
		return selectedAnyLanguage();
	});

	createEffect(async () => {
		// @ts-expect-error: URL import
		// eslint-disable-next-line import/no-unresolved
		const {default: renderMathInElement} = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
		renderMathInElement(descriptionEl, {
			delimiters: [
				{left: '$$', right: '$$', display: true},
				{left: '$', right: '$', display: false},
			],
		});
	});

	const handleClickSubmit = async () => {
		const language = executionLanguage();
		const userData = user();
		if (!gameData.data || !userData?.uid || code().length === 0 || language === null) {
			return;
		}

		setSubmission(null);
		setSubmitStatus('executing');

		const submissionRef = await addDoc(
			collection(gameRef, 'submissions') as CollectionReference<CodegolfSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: userData.uid,
				status: 'pending',
				language,
				code: code(),
				size: code().length,
				createdAt: serverTimestamp(),
				executedAt: null,
				testcases: [],
			},
		);

		setLastSubmissionTime(Date.now());
		setSubmission(useFirestore(submissionRef));
	};

	createEffect(() => {
		const submissionDoc = submission();
		if (submitStatus() === 'executing') {
			if ((['success', 'failed', 'error'] as (string | undefined)[]).includes(submissionDoc?.data?.status)) {
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
		const userData = user();
		if (submissionsData && Array.isArray(submissionsData.data) && gameData.data) {
			const successSubmissions = submissionsData.data.filter(({status, userId}) => (
				status === 'success' && userId === userData?.uid
			));
			const config = gameData.data.configuration as CodegolfConfiguration;
			const newLanguageInfos = config.languages.map((language) => {
				const filteredSubmissions =
					language.id === 'anything'
						? successSubmissions
						: successSubmissions.filter((s) => s.language === language.id);
				const shortestSize = filteredSubmissions.length === 0 ? null : Math.min(...filteredSubmissions.map(({size}) => size));
				return {shortestSize};
			});
			setLanguageInfos(newLanguageInfos);
		}
	});

	const handleChangeAnyLanguage = (event: SelectChangeEvent) => {
		setSelectedAnyLanguage(event.target.value);
	};

	const isTestcaseLarge = (testcase: {input: string, output: string}) => {
		const maxLineLength = Math.max(
			...testcase.input.trim().split('\n').map((line) => line.length),
			...testcase.output.trim().split('\n').map((line) => line.length),
		);
		return maxLineLength >= 40;
	};

	return (
		<Doc data={gameData}>
			{(game) => {
				const config = game.configuration as CodegolfConfiguration;

				return (
					<>
						<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
						<Typography variant="body1" ref={descriptionEl}>
							<SolidMarkdown
								class="markdown"
								children={config.description}
								// remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</Typography>
						<Grid container spacing={2} class={styles.rule}>
							<For each={config.testcases}>
								{(testcase, i) => (
									<Grid item xs={12} md={isTestcaseLarge(testcase) ? 12 : 3}>
										<Typography variant="h4" component="h2">Test case {i() + 1}</Typography>
										<Typography variant="h5" component="h3">Input</Typography>
										<pre>{testcase.input}</pre>
										<Typography variant="h5" component="h3">Output</Typography>
										<pre>{testcase.output}</pre>
									</Grid>
								)}
							</For>
						</Grid>
						<Stack direction="row" gap={3} flexWrap="wrap">
							<For each={zip(config.languages, languageInfos())}>
								{([language, languageInfo]) => (
									<Card
										sx={{
											flexGrow: 1,
											cursor: 'pointer',
											...(selectedLanguage() === language?.id ? {backgroundColor: blue[50]} : {}),
										}}
										onClick={() => language && setSelectedLanguage(language.id)}
									>
										<CardContent>
											<Typography variant="h5" component="div">{language?.label}</Typography>
											<Typography color="text.secondary">
												Score: {languageInfo?.shortestSize ?? '-'} bytes
											</Typography>
										</CardContent>
									</Card>
								)}
							</For>
						</Stack>
						<Show when={selectedLanguage()} keyed>
							{(language) => (
								<Box my={3}>
									<Show when={selectedLanguage() === 'anything'}>
										<FormControl
											sx={{
												width: '100%',
											}}
										>
											<InputLabel>Language</InputLabel>
											<Select
												value={selectedAnyLanguage()}
												onChange={handleChangeAnyLanguage}
												label="Language"
												required
											>
												<For each={codegolfLanguageAllowList}>
													{([languageId, languageName]) => (
														<MenuItem value={languageId}>{languageName}</MenuItem>
													)}
												</For>
											</Select>
										</FormControl>
									</Show>
									<Show when={executionLanguage()}>
										<Typography variant="body1" sx={{mt: 1}}>
											Environment:{' '}
											<LinkUi
												target="_blank"
												href={`https://hub.docker.com/r/esolang/${executionLanguage()}`}
											>
												esolang/{executionLanguage()}
											</LinkUi>
										</Typography>
									</Show>
									<TextField
										label="提出コード"
										multiline
										minRows={4}
										value={code()}
										onChange={(_event, value) => setCode(value)}
										disabled={props.phase === 'finished' || submitStatus() === 'executing'}
										placeholder={DEFAULT_CODES[language]}
										// @ts-expect-error: type error
										sx={{
											my: 2,
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
												<Alert severity={submissionData.status === 'success' ? 'info' : 'error'} sx={{my: 2}}>
													<Switch>
														<Match when={submissionData.status === 'success'}>
															提出成功
														</Match>
														<Match when>
															提出失敗
														</Match>
													</Switch>
													{' - '}
													<LinkUi
														href="#"
														underline="hover"
														onClick={() => setSearchParams({tab: 'submissions', submissionId: submissionData.id})}
													>
														詳細を見る
													</LinkUi>
												</Alert>
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
											<Button
												onClick={handleClickSubmit}
												variant="contained"
												size="large"
												disabled={executionLanguage() === null}
											>
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
								</Box>
							)}
						</Show>
					</>
				);
			}}
		</Doc>
	);
};

interface SubmissionsTabProps {
	submissions: UseFireStoreReturn<CodegolfSubmission[] | null | undefined> | null,
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
							<Typography variant="h4" component="h2" my={1}>Status</Typography>
							<p>{submission()?.status}</p>
							<Typography variant="h4" component="h2" my={1}>Size</Typography>
							<p>{submission()?.size}bytes</p>
							<Typography variant="h4" component="h2" my={1}>Code</Typography>
							<pre>{submission()?.code}</pre>
							<Show when={submission()?.errorMessage}>
								<Typography variant="h4" component="h2" my={1}>Validation Message</Typography>
								<pre>{submission()?.errorMessage}</pre>
							</Show>
							<For each={submission()?.testcases}>
								{(testcase, i) => (
									<>
										<Typography variant="h4" component="h2" my={1}>Test Case {i() + 1}</Typography>
										<Typography variant="h5" component="h3" my={1}>Execution Time</Typography>
										<p>{testcase.duration}ms</p>
										<Typography variant="h5" component="h3" my={1}>stdin</Typography>
										<pre>{testcase.stdin}</pre>
										<Typography variant="h5" component="h3" my={1}>stdout</Typography>
										<pre>{testcase.stdout}</pre>
										<Typography variant="h5" component="h3" my={1}>stderr</Typography>
										<pre>{testcase.stderr}</pre>
									</>
								)}
							</For>
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
								<TableCell align="right">Language</TableCell>
								<TableCell align="right">Size</TableCell>
								<TableCell align="right">Status</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission) => (
									<TableRow sx={{backgroundColor: submission.status === 'success' ? green[50] : red[50]}}>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right"><strong>{submission.language}</strong></TableCell>
										<TableCell align="right"><strong>{submission.size}</strong> bytes</TableCell>
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
	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const rankingRef = collection(db, `games/${gameId}/ranking`) as CollectionReference<CodegolfRanking>;
	const rankingDocs = useFirestore(query(rankingRef, orderBy('score', 'desc'), orderBy('updatedAt', 'asc')));

	return (
		<TableContainer component={Paper}>
			<Table>
				<TableHead>
					<TableRow>
						<TableCell>#</TableCell>
						<TableCell>User</TableCell>
						<Doc data={gameData}>
							{(game) => (
								<For each={(game.configuration as CodegolfConfiguration).languages}>
									{(language) => (
										<TableCell>{language.label}</TableCell>
									)}
								</For>
							)}
						</Doc>
						<TableCell align="right">Score</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					<Collection data={rankingDocs}>
						{(ranking, i) => {
							const userData = user();
							const isMe = userData?.uid === ranking.userId;

							return (
								<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}}>
									<TableCell>{i() + 1}</TableCell>
									<TableCell><Username userId={ranking.userId}/></TableCell>
									<For each={ranking.languages}>
										{(language) => (
											<TableCell>
												<Show when={language.hasScore}>
													<strong>{language.size}</strong>B ({floor(language.score, 2).toFixed(2)})
												</Show>
											</TableCell>
										)}
									</For>
									<TableCell align="right"><strong>{floor(ranking.score, 2).toFixed(2)}</strong></TableCell>
								</TableRow>
							);
						}}
					</Collection>
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const Codegolf = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<CodegolfSubmission[] | null | undefined> | null>(null);
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	setArenaTitle('コードゴルフ');

	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			if (phase() === 'playing') {
				const submissionsData = useFirestore(
					query(
					collection(gameRef, 'submissions') as CollectionReference<CodegolfSubmission>,
					where('userId', '==', userData.uid),
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			} else if (phase() === 'finished') {
				const submissionsData = useFirestore(
					query(
					collection(gameRef, 'submissions') as CollectionReference<CodegolfSubmission>,
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			}
		}
	});

	createEffect(() => {
		const tab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
		if (!(['main', 'submissions', 'ranking'] as (string | undefined)[]).includes(tab)) {
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

		if (gameData.data.rule.path !== 'gameRules/codegolf') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');

		if ((gameData.data.configuration as CodegolfConfiguration).enabled) {
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
							与えられた問題を解く、なるべく短いプログラムを提出してください。
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
								<MainTab submissions={submissions()} phase={phase()}/>
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
			</Match>
		</Switch>
	);
};

export default Codegolf;
