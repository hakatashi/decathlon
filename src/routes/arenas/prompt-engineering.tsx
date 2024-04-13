/* eslint-disable array-plural/array-plural */

import {useSearchParams} from '@solidjs/router';
import {Check} from '@suid/icons-material';
import {Switch as SwitchUi, Alert, Box, Button, ButtonGroup, Container, Stack, Link as LinkUi, TextField, Typography, CardContent, Card, Grid, Badge, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper} from '@suid/material';
import {blue} from '@suid/material/colors';
import dayjs from 'dayjs';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, setDoc, where} from 'firebase/firestore';
// import remarkGfm from 'remark-gfm';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {zip} from 'lodash';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, Show, Switch} from 'solid-js';
import {createStore, produce} from 'solid-js/store';
import {SolidMarkdown} from 'solid-markdown';
import {setArenaTitle, useUser} from '../arenas';
import styles from './reversing-diff.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, PromptEngineeringConfiguration, PromptEngineeringPhase, PromptEngineeringResult, PromptEngineeringSubmission, PromptEngineeringVote, UseFireStoreReturn} from '~/lib/schema';

interface SubmissionTabProps {
	submissions: UseFireStoreReturn<PromptEngineeringSubmission[] | null | undefined> | null,
	phase: 'loading' | PromptEngineeringPhase,
}

const SubmissionTab = (props: SubmissionTabProps) => {
	const [searchParams] = useSearchParams();

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [prompt, setPrompt] = createSignal<string | null>(null);
	const [submissionDate, setSubmissionDate] = createSignal<Date | null>(null);
	const [isDetailedRegulationShown, setIsDetailedRegulationShown] = createSignal(false);
	const [isParserScriptShown, setIsParserScriptShown] = createSignal(false);

	const handleClickSubmit = async () => {
		const userData = user();
		if (!gameData.data || !userData?.uid) {
			return;
		}

		let promptData = prompt();
		if (promptData === null) {
			promptData = gameData.data.configuration.promptTemplate;
			if (promptData === null) {
				return;
			}
		}

		await setDoc(
			doc(gameRef, 'submissions', userData.uid) as DocumentReference<PromptEngineeringSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: userData.uid,
				status: 'pending',
				prompt: promptData,
				result: null,
				parsedOutput: null,
				formatScore: null,
				rawVoteScore: null,
				voteScore: null,
				votes: [],
				score: null,
				updatedAt: serverTimestamp(),
			},
			{merge: true},
		);
	};

	createEffect(() => {
		if (!props.submissions?.data) {
			return;
		}

		const submission = props.submissions.data.find(({userId}) => user()?.uid === userId);
		if (!submission) {
			return;
		}

		if (prompt() === null) {
			setPrompt(submission.prompt);
		}

		if (submission.updatedAt) {
			setSubmissionDate(submission.updatedAt.toDate());
		}
	});

	return (
		<Doc data={gameData}>
			{(game) => {
				const config = game.configuration as PromptEngineeringConfiguration;

				return (
					<>
						<Typography variant="body1">
							<SolidMarkdown
								class="markdown"
								// eslint-disable-next-line react/no-children-prop
								children={config.briefRegulation}
								// remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</Typography>
						<SwitchUi
							checked={isDetailedRegulationShown()}
							onChange={
								(event, value) => setIsDetailedRegulationShown(value)
							}
						/> 詳細なルールを表示する
						<Show when={isDetailedRegulationShown()}>
							<Typography variant="body1">
								<SolidMarkdown
									class="markdown"
									// eslint-disable-next-line react/no-children-prop
									children={config.regulation}
									// remarkPlugins={[remarkGfm]}
									linkTarget="_blank"
								/>
							</Typography>
						</Show>
						<SwitchUi
							checked={isParserScriptShown()}
							onChange={
								(event, value) => setIsParserScriptShown(value)
							}
						/> パーサを表示する
						<Show when={isParserScriptShown()}>
							<Typography variant="body1">
								<pre>{config.parserScript}</pre>
							</Typography>
						</Show>
						<TextField
							label="プロンプト"
							multiline
							minRows={1}
							value={prompt() === null ? config.promptTemplate : prompt()}
							onChange={(_event, value) => setPrompt(value)}
							disabled={props.phase !== 'submission'}
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
						<Stack direction="row" spacing={2} alignItems="center">
							<Switch>
								<Match when={props.phase !== 'submission'}>
									<Button variant="contained" disabled size="large">
										提出は締め切られました
									</Button>
								</Match>
								<Match when>
									<Button onClick={handleClickSubmit} variant="contained" size="large">
										送信
									</Button>
								</Match>
							</Switch>
							<Switch >
								<Match when={submissionDate()}>
									{(date) => (
										<>
											<Check sx={{color: 'green'}}/> 提出済み: {dayjs(date()).format('YYYY-MM-DD HH:mm:ss')}
										</>
									)}
								</Match>
								<Match when>
									<Typography variant="body1" sx={{color: 'gray'}}>
										未提出
									</Typography>
								</Match>
							</Switch>
						</Stack>
					</>
				);
			}}
		</Doc>
	);
};

interface VoteTabProps {
	results: UseFireStoreReturn<PromptEngineeringResult[] | null | undefined> | null,
	voteRegulation: string | undefined,
	phase: 'loading' | PromptEngineeringPhase,
	isVoted: boolean,
}

const [choices, setChoices] = createStore<number[]>([]);

const VoteTab = (props: VoteTabProps) => {
	const [searchParams] = useSearchParams();
	const gameId = searchParams.gameId;

	const app = useFirebaseApp();

	const functions = getFunctions(app);
	const submitPromptEngineeringVote = httpsCallable(functions, 'submitPromptEngineeringVote');

	const handleClick = (index: number) => {
		if (props.phase !== 'vote') {
			return;
		}

		setChoices(produce((newChoices) => {
			if (newChoices.includes(index)) {
				newChoices.splice(newChoices.indexOf(index), 1);
			} else if (newChoices.length < 3) {
				newChoices.push(index);
			}
			return newChoices;
		}));
	};

	const handleClickSubmit = async () => {
		if (props.phase !== 'vote') {
			return;
		}

		await submitPromptEngineeringVote({
			gameId,
			choices: choices.map((index) => props.results?.data?.[index].id),
		});
	};

	return (
		<Switch>
			<Match when={props.phase === 'submission'}>
				<Typography
					variant="h3"
					component="p"
					textAlign="center"
					py={6}
				>
					投票開始までしばらくお待ち下さい。
				</Typography>
			</Match>
			<Match
				when={props.phase === 'vote' || props.phase === 'finished'}
			>
				<Box>
					<Typography variant="body1">
						以下の俳句を、好きなものから順番に3つクリックして選び、投票してください。
						<SolidMarkdown
							class="markdown"
							// eslint-disable-next-line react/no-children-prop
							children={props.voteRegulation}
							// remarkPlugins={[remarkGfm]}
							linkTarget="_blank"
						/>
					</Typography>
					<Grid container spacing={3}>
						<Collection data={props.results}>
							{(result, index) => {
								const components = zip(result.parsedOutput.haiku, result.parsedOutput.ruby);

								return (
									<Grid item xs="auto" maxWidth="100%">
										<Badge
											badgeContent={choices.indexOf(index()) + 1}
											color="secondary"
											showZero={false}
										>
											<Card
												sx={{
													minWidth: 275,
													maxWidth: '100%',
													cursor: 'pointer',
												}}
												style={{
													...(choices.includes(index()) ? {'background-color': blue[100]} : {}),
												}}
												onClick={[handleClick, index()]}
											>
												<CardContent>
													<Typography variant="h4">
														<For each={components}>
															{([haiku, ruby]) => (
																<ruby style={{display: 'inline-block', 'margin-inline-end': '2em'}}>
																	<span style={{'font-family': 'serif'}}>{haiku}</span>
																	<rp>(</rp>
																	<rt>{ruby}</rt>
																	<rp>)</rp>
																</ruby>
															)}
														</For>
													</Typography>
												</CardContent>
											</Card>
										</Badge>
									</Grid>
								);
							}}
						</Collection>
					</Grid>
					<Button
						disabled={choices.length !== 3 || props.phase !== 'vote' || props.isVoted}
						variant="contained"
						sx={{mt: 2}}
						onClick={handleClickSubmit}
						size="large"
					>
						<Switch>
							<Match when={props.isVoted}>
								投票済です
							</Match>
							<Match when={props.phase === 'vote'}>
								投票する
							</Match>
							<Match when>
								投票は終了しました
							</Match>
						</Switch>
					</Button>
				</Box>
			</Match>
		</Switch>
	);
};

interface ResultsTabProps {
	submissions: UseFireStoreReturn<PromptEngineeringSubmission[] | null | undefined> | null,
	phase: 'loading' | PromptEngineeringPhase,
}

const ResultsTab = (props: ResultsTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const handleClickSubmission = (submissionId: string, event: MouseEvent) => {
		event.preventDefault();
		setSearchParams({submissionId});
	};

	return (
		<Switch>
			<Match when={props.phase !== 'finished'}>
				<Typography
					variant="h3"
					component="p"
					textAlign="center"
					py={6}
				>
					投票終了までしばらくお待ち下さい。
				</Typography>
			</Match>
			<Match when={searchParams.submissionId} keyed>
				{(submissionId) => {
					const submission = createMemo(() => (
						props.submissions?.data?.find(({id}) => submissionId === id)
					));
					const resultDoc = useFirestore(doc(db, 'games', gameId!, 'results', submissionId) as DocumentReference<PromptEngineeringResult>);

					return (
						<div class={styles.submission}>
							<LinkUi
								href="#"
								underline="hover"
								onClick={() => setSearchParams({submissionId: undefined})}
							>
								提出一覧に戻る
							</LinkUi>
							<Typography variant="h4" component="h2" my={1}>ユーザー</Typography>
							<Show when={submission()} keyed>
								{({userId}) => (
									<Username userId={userId}/>
								)}
							</Show>
							<Typography variant="h4" component="h2" my={1}>提出日時</Typography>
							<Show when={submission()} keyed>
								{({updatedAt}) => (
									<p>{dayjs(updatedAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}</p>
								)}
							</Show>
							<Typography variant="h4" component="h2" my={1}>プロンプト</Typography>
							<pre>{submission()?.prompt}</pre>
							<Doc data={resultDoc}>
								{(result) => (
									<>
										<Typography variant="h4" component="h2" my={1}>AIによる出力</Typography>
										<pre>{result.output}</pre>
										<Typography variant="h4" component="h2" my={1}>パース結果</Typography>
										<pre>{JSON.stringify(result.parsedOutput, null, 2)}</pre>
										<Typography variant="h4" component="h2" my={1}>出力形式に関する採点結果</Typography>
										<pre>{JSON.stringify(result.points, null, 2)}</pre>
									</>
								)}
							</Doc>
							<Typography variant="h4" component="h2" my={1}>出力形式に関する得点</Typography>
							<p>{submission()?.formatScore ?? '-'} / 50</p>
							<Typography variant="h4" component="h2" my={1}>投票者一覧</Typography>
							<ul>
								<For each={submission()?.votes}>
									{(vote) => (
										<li>
											<Username userId={vote.userId}/>
											<ul>
												<li>
													{vote.order + 1}番目 (+{3 - vote.order}点)
												</li>
											</ul>
										</li>
									)}
								</For>
							</ul>
							<Typography variant="h4" component="h2" my={1}>投票による得点</Typography>
							<p>{submission()?.rawVoteScore ?? '-'}</p>
							<Typography variant="h4" component="h2" my={1}>投票による得点 (補正)</Typography>
							<p>{submission()?.voteScore?.toFixed?.(2) ?? '-'} / 50.00</p>
						</div>
					);
				 }}
			</Match>
			<Match when>
				<TableContainer component={Paper}>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>#</TableCell>
								<TableCell>User</TableCell>
								<TableCell align="right">Format Score</TableCell>
								<TableCell align="right">Vote Score</TableCell>
								<TableCell align="right">Score</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission, index) => (
									<TableRow>
										<TableCell>{index() + 1}</TableCell>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right">{submission.formatScore ?? '-'}</TableCell>
										<TableCell align="right">{submission.rawVoteScore ?? '-'}</TableCell>
										<TableCell align="right"><strong>{submission.score?.toFixed?.(2) ?? '-'}</strong></TableCell>
										<TableCell align="right">
											<LinkUi
												href="#"
												underline="hover"
												sx={{display: 'inline-box', whiteSpace: 'pre'}}
												onClick={(event) => handleClickSubmission(submission.id, event)}
											>
												{dayjs(submission.updatedAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}
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

const PromptEngineering = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();
	const [submissions, setSubmissions] = createSignal<UseFireStoreReturn<PromptEngineeringSubmission[] | null | undefined> | null>(null);
	const [vote, setVote] = createSignal<UseFireStoreReturn<PromptEngineeringVote | null | undefined> | null>(null);
	const [isVoted, setIsVoted] = createSignal(false);
	const [phase, setPhase] = createSignal<'loading' | PromptEngineeringPhase>('loading');

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const resultDocs = useFirestore(
		query(
			collection(gameRef, 'results') as CollectionReference<PromptEngineeringResult>,
			orderBy('seed', 'asc'),
		),
	);

	setArenaTitle('diff');

	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			if (phase() === 'finished') {
				const submissionsData = useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<PromptEngineeringSubmission>,
						orderBy('score', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			} else {
				const submissionsData = useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<PromptEngineeringSubmission>,
						where('userId', '==', userData.uid),
					),
				);
				setSubmissions(submissionsData);
			}
			setVote(useFirestore(doc(gameRef, 'votes', userData.uid) as DocumentReference<PromptEngineeringVote>));
		}
	});

	createEffect(() => {
		if (!(['submission', 'vote', 'results'] as (string | undefined)[]).includes(searchParams.tab)) {
			setSearchParams({tab: 'submission'});
		}
	});

	createEffect(() => {
		if (gameData.loading) {
			return;
		}

		if (!gameData.data || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data.rule.path !== 'gameRules/prompt-engineering') {
			throw new PageNotFoundError();
		}

		const config = gameData.data.configuration as PromptEngineeringConfiguration;
		setPhase(config.phase);
	});

	createEffect(() => {
		const voteData = vote();
		const resultsData = resultDocs.data;

		if (!voteData?.data || resultsData === undefined) {
			return;
		}

		setChoices(voteData.data.choices.map((choice) => (
			resultsData.findIndex(({id}) => id === choice)
		)));
		setIsVoted(true);
	});

	return (
		<Switch>
			<Match
				when={phase() !== 'loading'}
			>
				<main class={styles.app}>
					<Container maxWidth="lg" sx={{py: 3}}>
						<Alert severity="info">
							AIに所定のタスクを実行してもらうためのプロンプトを提出してください。
						</Alert>
						<Box textAlign="center" my={1}>
							<ButtonGroup variant="outlined" size="large">
								<Button
									variant={searchParams.tab === 'submission' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'submission', submissionId: undefined})}
								>
									提出画面
								</Button>
								<Button
									variant={searchParams.tab === 'vote' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'vote'})}
								>
									投票画面
								</Button>
								<Button
									variant={searchParams.tab === 'results' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'results', submissionId: undefined})}
								>
									最終結果
								</Button>
							</ButtonGroup>
						</Box>
						<Switch>
							<Match when={searchParams.tab === 'submission'}>
								<SubmissionTab submissions={submissions()} phase={phase()}/>
							</Match>
							<Match when={searchParams.tab === 'vote'}>
								<VoteTab
									results={resultDocs}
									voteRegulation={gameData.data?.configuration?.voteRegulation ?? undefined}
									phase={phase()}
									isVoted={isVoted()}
								/>
							</Match>
							<Match when={searchParams.tab === 'results'}>
								<ResultsTab submissions={submissions()} phase={phase()}/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default PromptEngineering;
