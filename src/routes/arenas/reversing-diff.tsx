import {Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography, useMediaQuery} from '@suid/material';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getStorage, ref} from 'firebase/storage';
import last from 'lodash/last';
import remarkGfm from 'remark-gfm';
import {useDownloadURL, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, For, Show} from 'solid-js';
import SolidMarkdown from 'solid-markdown';
import {A, useSearchParams} from 'solid-start';
import {setArenaTitle, useAuthState} from '../arenas';
import styles from './reversing-diff.module.css';
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

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [text, setText] = createSignal<string>('');
	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');

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

	return (
		<main class={styles.app}>
			<Container maxWidth="md">
				<Typography
					component="h1"
					variant="h4"
					my={6}
				>
					diff
				</Typography>
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
									defaultValue={DEFAULT_CODE}
									sx={{
										my: 5,
										width: '100%',
										'& textarea': {
											'font-family': 'monospace',
											'line-height': '1em',
										},
									}}
								/>
							</>
						);
					}}
				</Doc>
			</Container>
			<Show when={phase() === 'finished'}>
				<OnGameFinishedDialog text={text()} gameId={gameId}/>
			</Show>
		</main>
	);
};

export default ReversingDiff;
