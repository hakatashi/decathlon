/* eslint-disable array-plural/array-plural */

import {useSearchParams} from '@solidjs/router';
import {Check} from '@suid/icons-material';
import {Switch as SwitchEl, Alert, Box, Button, ButtonGroup, Container, Stack, TextField, Typography} from '@suid/material';

import dayjs from 'dayjs';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, setDoc, where} from 'firebase/firestore';
// import remarkGfm from 'remark-gfm';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, Match, onCleanup, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {setArenaTitle, useUser} from '../arenas';
import styles from './reversing-diff.module.css';
import Doc from '~/components/Doc';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Game, PromptEngineeringConfiguration, PromptEngineeringPhase, PromptEngineeringSubmission, UseFireStoreReturn} from '~/lib/schema';

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
				updatedAt: serverTimestamp(),
			},
			{merge: true},
		);
	};

	createEffect(() => {
		console.log(props.submissions);

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
						<SwitchEl
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
						<TextField
							label="プロンプト"
							multiline
							minRows={1}
							value={prompt() === null ? config.promptTemplate : prompt()}
							onChange={(_event, value) => setPrompt(value)}
							disabled={props.phase === 'finished'}
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
	submissions: UseFireStoreReturn<PromptEngineeringSubmission[] | null | undefined> | null,
}

const VoteTab = (props: VoteTabProps) => (
	'未実装です'
);

const ResultsTab = () => (
	'未実装です'
);

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
	const [phase, setPhase] = createSignal<'loading' | PromptEngineeringPhase>('loading');

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	setArenaTitle('diff');

	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			if (phase() === 'submission') {
				const submissionsData = useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<PromptEngineeringSubmission>,
						where('userId', '==', userData.uid),
						orderBy('updatedAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			} else if (phase() === 'finished') {
				const submissionsData = useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<PromptEngineeringSubmission>,
						orderBy('updatedAt', 'desc'),
					),
				);
				setSubmissions(submissionsData);
			}
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

		setPhase('submission');

		if (gameData.data.endAt && gameData.data.endAt.toDate() <= new Date()) {
			setPhase('finished');
		}
	});

	return (
		<Switch>
			<Match
				when={phase() === 'submission' || phase() === 'finished'}
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
								<VoteTab submissions={submissions()}/>
							</Match>
							<Match when={searchParams.tab === 'results'}>
								<ResultsTab/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default PromptEngineering;
