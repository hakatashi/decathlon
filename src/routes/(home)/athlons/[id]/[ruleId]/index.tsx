import {A, useParams} from '@solidjs/router';
import {Typography, Container, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, TextField, Grid, Box, Checkbox, FormControlLabel} from '@suid/material';
import dayjs from 'dayjs';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, setDoc, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
// import remarkGfm from 'remark-gfm';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {tippy} from 'solid-tippy';
import styles from './index.module.scss';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import {useStorageBytes} from '~/lib/firebase';
import type {Game, GameRule, Score} from '~/lib/schema';
import 'tippy.js/dist/tippy.css';
import useAthlon from '~/lib/useAthlon';

interface Props {
	onSubmit: (score: number, tiebreakScore: number) => void,
	onClose: () => void,
	open: boolean,
	maxRawScore: number,
	scoreInputNote: string,
	scoreConfigurationType: string,
	defaultValue?: number,
	defaultTiebreakValue?: number,
}

declare module 'solid-js' {
	namespace JSX {
		interface Directives {
			tippy: {
				hidden?: boolean,
				disabled?: boolean,
				props?: {
					content?: string | null,
				},
			},
		}
	}
}

const ScoreRecordDialog = (props: Props) => {
	const [score, setScore] = createSignal<number>(props.defaultValue ?? 0);
	const [tiebreakScore, setTiebreakScore] = createSignal<number>(props.defaultTiebreakValue ?? 0);
	const [isSolved, setIsSolved] = createSignal<boolean>(props.defaultValue === props.maxRawScore);

	const handleClickSubmit = () => {
		props.onSubmit(score(), tiebreakScore());
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
		>
			<DialogTitle id="alert-dialog-title">
				スコアを記録する
			</DialogTitle>
			<DialogContent>
				<DialogContentText id="alert-dialog-description">
					<p>{props.scoreInputNote}</p>
					<Switch>
						<Match when={props.scoreConfigurationType === 'timestamp'}>
							<Box>
								<FormControlLabel
									control={
										<Checkbox
											checked={isSolved()}
											onChange={(_event, checked) => {
												setIsSolved(checked);
												if (checked) {
													setScore(props.maxRawScore);
												} else {
													setScore(0);
													setTiebreakScore(0);
												}
											}}
										/>
									}
									label="解けた"
								/>
							</Box>
							<Show when={isSolved()}>
								<input
									class={styles.timestampInput}
									type="time"
									step="1"
									value={dayjs(tiebreakScore() || 0).format('HH:mm:ss')}
									onChange={(event) => {
										const time = event.currentTarget.value;
										const [hours, minutes, seconds] = time.split(':').map((component) => parseInt(component));
										const timeData = dayjs().set('hours', hours).set('minutes', minutes).set('seconds', seconds);

										setTiebreakScore(timeData.valueOf());
									}}
								/>
							</Show>
						</Match>
						<Match when>
							<TextField
								label="Score"
								variant="standard"
								type="number"
								inputProps={{inputMode: 'numeric', pattern: '[0-9]*', max: props.maxRawScore, min: 0}}
								defaultValue={props.defaultValue}
								required
								value={score()}
								onChange={(event, value) => {
									setScore(parseInt(value));
									setTiebreakScore(0);
								}}
							/>
						</Match>
					</Switch>
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClickSubmit}>
					送信
				</Button>
			</DialogActions>
		</Dialog>
	);
};

const AthlonGame = () => {
	const param = useParams();
	const athlonData = useAthlon(param.id);
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);
	const auth = getAuth(app);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const [myScore, setMyScore] = createSignal<string>('N/A');
	const [dialogOpen, setDialogOpen] = createSignal<boolean>(false);

	const ruleData = useFirestore(ruleRef);
	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);
	const authState = useAuth(auth);

	const scoreRecordErrorMessage = createMemo(() => {
		if (!gameData.data?.[0]?.isScoreUserEditable) {
			return 'この競技はスコアを手動入力できません';
		}

		if (!authState.data?.uid) {
			return 'ログインしてください';
		}

		return null;
	});

	const tippyProps = createMemo(() => ({
		disabled: scoreRecordErrorMessage() === null,
		hidden: true,
		props: {
			content: scoreRecordErrorMessage(),
		},
	}));

	// XXX: https://www.solidjs.com/guides/typescript#use___
	false && tippy;

	return (
		<main>
			<Doc data={athlonData}>
				{(athlon) => (
					<Doc data={ruleData}>
						{(rule) => (
							<PageTitle>[{athlon.name}] {rule.name}</PageTitle>
						)}
					</Doc>
				)}
			</Doc>
			<div class={styles.header}>
				<Container maxWidth="lg">
					<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
						<Link component={A} underline="hover" color="inherit" href="/athlons">
							Athlons
						</Link>
						<Doc data={athlonData}>
							{(athlon) => (
								<Link
									underline="hover"
									color="inherit"
									component={A}
									href={`/athlons/${athlon.id}`}
								>
									{athlon.name}
								</Link>
							)}
						</Doc>
						<Doc data={ruleData}>
							{(rule) => (
								<Typography color="text.primary">{rule.name}</Typography>
							)}
						</Doc>
					</Breadcrumbs>
					<Doc data={ruleData}>
						{(rule) => {
							const iconData = useStorageBytes(ref(storage, `assets/icons/${rule.icon}.svg`));
							const textDecoder = new TextDecoder();

							return (
								<Grid
									container
									spacing={2}
									pb={2}
									justifyContent="center"
									alignItems="center"
									flexDirection="row-reverse"
								>
									<Grid item xs={6} md={4} class={styles.ruleIcon}>
										<Show when={iconData.data} keyed>
											{(data) => (
												<div style={{width: '100%', height: '100%'}} innerHTML={textDecoder.decode(data)}/>
											)}
										</Show>
									</Grid>
									<Grid item xs={12} md={8}>
										<Typography
											color="text.primary"
											variant="h3"
											component="h2"
											fontWeight="bold"
										>
											{rule.name}
										</Typography>
										<Typography
											color="text.primary"
											variant="body1"
											my={3}
										>
											{rule.description}
										</Typography>
										<Stack direction="row" flexWrap="wrap" gap={1}>
											<Collection data={gameData}>
												{(game) => (
													<For each={game.links}>
														{(link) => (
															<Button
																size="large"
																variant={link.isMain ? 'contained' : 'outlined'}
																component="a"
																target="_blank"
																rel="noopener noreferer"
																href={link.url}
															>
																{link.label}
															</Button>
														)}
													</For>
												)}
											</Collection>
											<div use:tippy={tippyProps()}>
												<Button
													size="large"
													variant="contained"
													color="secondary"
													disabled={scoreRecordErrorMessage() !== null}
													onClick={() => setDialogOpen(true)}
												>
													スコアを記録する
												</Button>
											</div>
										</Stack>
										<Typography
											variant="body2"
											my={2}
										>
											Your score: {myScore()}
										</Typography>
										<Box sx={{mb: 3}} >
											<Link component={A} href="./leaderboard">
												ランキングを表示する
											</Link>
										</Box>
									</Grid>
								</Grid>
							);
						}}
					</Doc>
				</Container>
			</div>
			<Container maxWidth="lg">
				<Collection data={gameData}>
					{(game) => (
						<SolidMarkdown
							class="markdown"
							children={game.description}
							// remarkPlugins={[remarkGfm]}
							linkTarget="_blank"
						/>
					)}
				</Collection>
				<Collection data={gameData}>
					{(game) => {
						const uid = authState.data?.uid;
						if (!uid) {
							return null;
						}
						const scoreRef = doc(db, 'games', game.id, 'scores', uid) as DocumentReference<Score>;
						const scoreData = useFirestore(scoreRef);

						const handleScoreSubmit = async (score: number, tiebreakScore: number) => {
							if (athlonData?.data?.id) {
								await setDoc(scoreRef, {
									athlon: doc(db, 'athlons', athlonData?.data?.id),
									rawScore: score,
									user: uid,
									tiebreakScore,
								});
							}
							setDialogOpen(false);
						};

						const handleCloseDialog = () => {
							setDialogOpen(false);
						};

						createEffect(() => {
							if (typeof scoreData.data?.rawScore === 'number') {
								setMyScore(scoreData.data.rawScore.toString());
							}
						});

						return (
							<Doc
								data={scoreData}
								fallback={
									<ScoreRecordDialog
										open={dialogOpen()}
										scoreInputNote={game.scoreInputNote}
										scoreConfigurationType={game.scoreConfiguration.type}
										maxRawScore={game.maxRawScore}
										onSubmit={handleScoreSubmit}
										onClose={handleCloseDialog}
									/>
								}
							>
								{(score) => (
									<ScoreRecordDialog
										open={dialogOpen()}
										scoreInputNote={game.scoreInputNote}
										scoreConfigurationType={game.scoreConfiguration.type}
										maxRawScore={game.maxRawScore}
										onSubmit={handleScoreSubmit}
										onClose={handleCloseDialog}
										defaultValue={score.rawScore}
										defaultTiebreakValue={score.tiebreakScore}
									/>
								)}
							</Doc>
						);
					}}
				</Collection>
			</Container>
		</main>
	);
};

export default AthlonGame;


