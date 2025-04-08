/* eslint-disable react/jsx-key */
import {Link} from '@solidjs/meta';
import {useSearchParams} from '@solidjs/router';
import {Alert, Box, Button, ButtonGroup, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, FormLabel, Link as LinkUi, Paper, Radio, RadioGroup, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography} from '@suid/material';
import dayjs from 'dayjs';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, where} from 'firebase/firestore';
import remarkGfm from 'remark-gfm';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import type {QueryExecResult} from 'sql.js';
import {setArenaTitle, useUser} from '../arenas';
import styles from './reversing-diff.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, SqlConfiguration, SqlSubmission, UseFireStoreReturn} from '~/lib/schema';

interface MainTabProps {
	phase: 'loading' | 'waiting' | 'playing' | 'finished',
}

interface LocalExecutionResult {
	status: 'success' | 'failed' | 'error' | 'none',
	results: QueryExecResult[],
	errorMessage: string,
}

const isResultMatching = (results: QueryExecResult[], expected: SqlConfiguration['sampleOutput']) => {
	if (results.length !== 1) {
		return false;
	}

	const result = results[0];
	if (result.columns.length !== expected.columnNames.length) {
		return false;
	}
	if (result.values.length !== expected.rows.length) {
		return false;
	}
	if (result.columns.some((column, index) => column !== expected.columnNames[index])) {
		return false;
	}
	if (result.values.some((row, rowIndex) => (
		row.some((value, columnIndex) => (
			value !== expected.rows[rowIndex][expected.columnNames[columnIndex]]
		))
	))) {
		return false;
	}
	return true;
};

const MainTab = (props: MainTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [code, setCode] = createSignal<string | null>(null);
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [submission, setSubmission] = createSignal<UseFireStoreReturn<SqlSubmission | null | undefined> | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);
	const [isExecutingLocally, setIsExecutingLocally] = createSignal(false);
	const [localExecutionQuery, setLocalExecutionQuery] = createSignal<string | null>(null);
	const [localExecutionResult, setLocalExecutionResult] = createSignal<LocalExecutionResult>({
		status: 'none',
		results: [],
		errorMessage: '',
	});
	const [sqlEngine, setSqlEngine] = createSignal<'mysql' | 'postgresql' | 'sqlite'>('sqlite');

	let descriptionEl!: HTMLElement;

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
		const userData = user();
		if (!gameData.data || !userData?.uid) {
			return;
		}

		const codeData = code();

		setSubmission(null);
		setSubmitStatus('executing');

		const submissionRef = await addDoc(
			collection(gameRef, 'submissions') as CollectionReference<SqlSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: userData.uid,
				status: 'pending',
				engine: 'mysql',
				results: [],
				code: codeData ?? '',
				size: codeData?.length ?? 0,
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
			if (
				submissionDoc?.data?.status === 'success' ||
				submissionDoc?.data?.status === 'error' ||
				submissionDoc?.data?.status === 'failed'
			) {
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
				const config = game.configuration as SqlConfiguration;

				const handleClickExecute = async () => {
					setIsExecutingLocally(true);
					const currentCode = code();

					if (!currentCode) {
						return;
					}

					setLocalExecutionQuery(currentCode);
					const {default: initSqlJs} = await import('sql.js');
					const SQL = await initSqlJs({
						locateFile: (file) => `https://sql.js.org/dist/${file}`,
					});
					const sql = new SQL.Database();

					const tableCreationStatements = config.tableSchemas.map((schema) => `
						CREATE TABLE ${schema.name} (
							${schema.columns.map((column) => `${column.name} ${column.type}`).join(', ')}
						);
					`);

					sql.run(tableCreationStatements.join('\n'));

					const dataInsertionStatements = config.sampleInput.map((input) => {
						const schema = config.tableSchemas.find((s) => s.name === input.name);
						if (!schema) {
							return '';
						}
						return `
							INSERT INTO ${schema.name} (${schema.columns.map((column) => column.name).join(', ')})
							VALUES ${input.rows.map((row) => `(${schema.columns.map((column) => `'${row[column.name]}'`).join(', ')})`).join(', ')};
						`;
					});

					sql.run(dataInsertionStatements.join('\n'));

					try {
						const res = sql.exec(currentCode);
						setLocalExecutionResult({
							status: isResultMatching(res, config.sampleOutput) ? 'success' : 'failed',
							results: res,
							errorMessage: '',
						});
					} catch (error) {
						setLocalExecutionResult({
							status: 'error',
							results: [],
							errorMessage: (error as Error).message,
						});
					}

					setIsExecutingLocally(false);
				};

				return (
					<>
						<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
						<Dialog
							open={localExecutionResult().status !== 'none'}
							onClose={() => setLocalExecutionResult({
								status: 'none',
								results: [],
								errorMessage: '',
							})}
						>
							<DialogTitle>
								実行結果
							</DialogTitle>
							<DialogContent>
								<DialogContentText>
									<pre style={{'min-width': '300px', margin: '1rem 0'}}>
										{localExecutionQuery()}
									</pre>
									<p>
										結果:
										<Switch>
											<Match when={localExecutionResult().status === 'success'}>
												<span style={{color: 'green'}}>ACCEPTED</span>
											</Match>
											<Match when={localExecutionResult().status === 'failed'}>
												<span style={{color: 'red'}}>WRONG ANSWER</span>
											</Match>
											<Match when={localExecutionResult().status === 'error'}>
												<span style={{color: 'red'}}>ERROR</span>
											</Match>
										</Switch>
									</p>
									<Switch>
										<Match
											when={localExecutionResult().status === 'success' || localExecutionResult().status === 'failed'}
										>
											<For each={localExecutionResult().results}>
												{(result) => (
													<TableContainer component={Paper}>
														<Table size="small">
															<TableHead>
																<TableRow>
																	<For each={result.columns}>
																		{(column) => (
																			<TableCell>{column}</TableCell>
																		)}
																	</For>
																</TableRow>
															</TableHead>
															<TableBody>
																<For each={result.values}>
																	{(row) => (
																		<TableRow>
																			<For each={row}>
																				{(value) => (
																					<TableCell>{value?.toString()}</TableCell>
																				)}
																			</For>
																		</TableRow>
																	)}
																</For>
															</TableBody>
														</Table>
													</TableContainer>
												)}
											</For>
										</Match>
										<Match when={localExecutionResult().status === 'error'}>
											<Typography variant="body1" color="error.main">
												{localExecutionResult().errorMessage}
											</Typography>
										</Match>
									</Switch>
								</DialogContentText>
							</DialogContent>
							<DialogActions sx={{color: 'primary.main'}}>
								<Button
									onClick={() => setLocalExecutionResult({
										status: 'none',
										results: [],
										errorMessage: '',
									})}
								>
									閉じる
								</Button>
							</DialogActions>
						</Dialog>
						<Typography variant="body1" ref={descriptionEl}>
							<SolidMarkdown
								class="markdown"
								children={config.description}
								remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</Typography>
						<Typography variant="h4" component="h2">テーブルスキーマ</Typography>
						{config.tableSchemas.map((schema) => (
							<TableContainer component={Paper} sx={{display: 'inline-block', width: 'auto'}}>
								<Typography variant="h6" component="h3" sx={{mt: 2}}>{schema.name} テーブル</Typography>
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>カラム名</TableCell>
											<TableCell>型</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{schema.columns.map((column) => (
											<TableRow>
												<TableCell>
													<strong style={{'font-weight': 500}}>
														{column.name}
													</strong>
												</TableCell>
												<TableCell>{column.type}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						))}
						<Typography variant="h4" component="h2" sx={{mt: 5}}>サンプル入力</Typography>
						{config.sampleInput.map((input) => {
							const schema = config.tableSchemas.find((s) => s.name === input.name);
							if (!schema) {
								return null;
							}

							return (
								<>
									<Typography variant="h6" component="h3" sx={{mt: 2}}>{schema.name} テーブル</Typography>
									<TableContainer component={Paper} sx={{display: 'inline-block', width: 'auto'}}>
										<Table>
											<TableHead>
												<TableRow>
													{schema.columns.map((column) => (
														<TableCell>{column.name}</TableCell>
													))}
												</TableRow>
											</TableHead>
											<TableBody>
												{input.rows.map((row) => (
													<TableRow>
														{schema.columns.map((column) => (
															<TableCell>{row[column.name]}</TableCell>
														))}
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								</>
							);
						})}
						<Typography variant="h4" component="h2" sx={{mt: 5}}>サンプル出力</Typography>
						<TableContainer component={Paper} sx={{display: 'inline-block', width: 'auto'}}>
							<Table>
								<TableHead>
									<TableRow>
										{config.sampleOutput.columnNames.map((column) => (
											<TableCell>{column}</TableCell>
										))}
									</TableRow>
								</TableHead>
								<TableBody>
									{config.sampleOutput.rows.map((row) => (
										<TableRow>
											{config.sampleOutput.columnNames.map((column) => (
												<TableCell>{row[column]}</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
						<Box sx={{mt: 5}}>
							<FormControl>
								<FormLabel>SQLエンジン</FormLabel>
								<RadioGroup
									row
									defaultValue="sqlite"
									value={sqlEngine()}
									onChange={(_event, value) => setSqlEngine(value as 'mysql' | 'postgresql' | 'sqlite')}
								>
									<FormControlLabel value="mysql" control={<Radio/>} label="MySQL"/>
									<FormControlLabel value="postgresql" control={<Radio/>} label="PostgreSQL"/>
									<FormControlLabel value="sqlite" control={<Radio/>} label="SQLite"/>
								</RadioGroup>
							</FormControl>
						</Box>
						<TextField
							label="提出コード"
							multiline
							minRows={4}
							value={code()}
							placeholder="SELECT * FROM table_name;"
							onChange={(_event, value) => setCode(value)}
							disabled={props.phase === 'finished' || submitStatus() === 'executing'}
							// @ts-expect-error: type error
							sx={{
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
										<Match when={submissionData.status === 'failed'}>
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
						<Button
							disabled={sqlEngine() !== 'sqlite' || isExecutingLocally()}
							onClick={handleClickExecute}
							variant="contained"
							size="large"
							sx={{mr: 2}}
						>
							サンプルケースを実行
						</Button>
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
	submissions: UseFireStoreReturn<SqlSubmission[] | null | undefined> | null,
	phase: 'loading' | 'waiting' | 'playing' | 'finished',
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
							<Show when={submission()} keyed>
								{({status}) => (
									<div style={{'font-weight': 'bold'}}>
										<Switch>
											<Match when={status === 'pending'}>
												<span style={{color: 'gray'}}>WJ</span>
											</Match>
											<Match when={status === 'executing'}>
												<span style={{color: 'gray'}}>Running...</span>
											</Match>
											<Match when={status === 'failed'}>
												<span style={{color: 'red'}}>WA</span>
											</Match>
											<Match when={status === 'success'}>
												<span style={{color: 'green'}}>AC</span>
											</Match>
											<Match when={status === 'error'}>
												<span style={{color: 'red'}}>Error</span>
											</Match>
										</Switch>
									</div>
								)}
							</Show>
							<Typography variant="h4" component="h2" my={1}>Execution Time</Typography>
							<p>{submission()?.duration}ms</p>
							<Typography variant="h4" component="h2" my={1}>Engine</Typography>
							<p>{submission()?.engine}</p>
							<Typography variant="h4" component="h2" my={1}>Code</Typography>
							<pre>{submission()?.code}</pre>
							<Show when={props.phase === 'finished'}>
								<Typography variant="h4" component="h2" my={1}>Results</Typography>
								<TableContainer component={Paper} sx={{display: 'inline-block', width: 'auto'}}>
									<Table>
										<TableHead>
											<TableRow>
												<TableCell>Testcase</TableCell>
												<TableCell>Status</TableCell>
												<TableCell>Message</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											<For each={submission()?.results ?? []}>
												{(result) => (
													<TableRow>
														<TableCell>{result.testcase}</TableCell>
														<TableCell>{result.status}</TableCell>
														<TableCell>{result.detailed_error}</TableCell>
													</TableRow>
												)}
											</For>
										</TableBody>
									</Table>
								</TableContainer>
								<Show when={submission()?.errorMessage}>
									<Typography variant="h4" component="h2" my={1}>Validation Message</Typography>
									<pre>{submission()?.errorMessage}</pre>
								</Show>
								<Show when={submission()?.stderr}>
									<Typography variant="h4" component="h2" my={1}>Execution Log</Typography>
									<pre>{submission()?.stderr}</pre>
								</Show>
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
								<TableCell align="right">Status</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission) => (
									<TableRow>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right" sx={{fontWeight: 'bold'}}>
											<Switch>
												<Match when={submission.status === 'pending'}>
													<span style={{color: 'gray'}}>WJ</span>
												</Match>
												<Match when={submission.status === 'executing'}>
													<span style={{color: 'gray'}}>Running...</span>
												</Match>
												<Match when={submission.status === 'failed'}>
													<span style={{color: 'red'}}>WA</span>
												</Match>
												<Match when={submission.status === 'success'}>
													<span style={{color: 'green'}}>AC</span>
												</Match>
											</Switch>
										</TableCell>
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

const SqlContest = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<SqlSubmission[] | null | undefined> | null>(null);
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
					collection(gameRef, 'submissions') as CollectionReference<SqlSubmission>,
					where('userId', '==', userData.uid),
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			} else if (phase() === 'finished') {
				const submissionsData = useFirestore(
					query(
					collection(gameRef, 'submissions') as CollectionReference<SqlSubmission>,
					orderBy('createdAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			}
		}
	});

	createEffect(() => {
		const tab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
		if (!(['main', 'submissions'] as (string | undefined)[]).includes(tab)) {
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

		if (gameData.data.rule.path !== 'gameRules/sql') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');

		if ((gameData.data.configuration as SqlConfiguration).enabled) {
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
							与えられたテーブルデータを、指示されたとおりに変換するSQL文を提出してください。
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
								<SubmissionsTab submissions={submissions()} phase={phase()}/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default SqlContest;
