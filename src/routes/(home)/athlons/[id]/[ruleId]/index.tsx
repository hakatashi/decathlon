import {EmojiEvents} from '@suid/icons-material';
import {Typography, Container, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, TextField, Box, Icon, Grid} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getDoc, getFirestore, orderBy, query, setDoc, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import remarkGfm from 'remark-gfm';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, For, Show} from 'solid-js';
import SolidMarkdown from 'solid-markdown';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../../[id]';
import styles from './index.module.scss';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import {useStorageBytes} from '~/lib/firebase';
import type {Game, GameRule, Score} from '~/lib/schema';

interface Props {
	onSubmit: (score: number) => void,
	onClose: () => void,
	open: boolean,
	maxRawScore: number,
	scoreInputNote: string,
	defaultValue?: number,
}

const ScoreRecordDialog = (props: Props) => {
	const [score, setScore] = createSignal<string>(props.defaultValue?.toString() ?? '');

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
					<TextField
						label="Score"
						variant="standard"
						type="number"
						inputProps={{inputMode: 'numeric', pattern: '[0-9]*', max: props.maxRawScore, min: 0}}
						defaultValue={props.defaultValue}
						required
						value={score()}
						onChange={(event, value) => {
							setScore(value);
						}}
					/>
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button
					onClick={() => {
						props.onSubmit(parseFloat(score()));
					}}
				>
					送信
				</Button>
			</DialogActions>
		</Dialog>
	);
};

const AthlonGame = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);
	const auth = getAuth(app);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const [myScore, setMyScore] = createSignal<string>('N/A');

	const ruleData = useFirestore(ruleRef);
	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);
	const authState = useAuth(auth);

	const [open, setOpen] = createSignal<boolean>(false);

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
										</Stack>
										<Typography
											variant="body2"
											my={3}
										>
											Your score: {myScore()}
										</Typography>
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
						<>
							<Button size="large" sx={{my: 3}} variant="contained" component={A} href="./leaderboard">
								<EmojiEvents sx={{mr: 1}}/>
								Show Leaderboard
							</Button>
							<SolidMarkdown
								class={styles.gameDescription}
								children={game.description}
								remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</>
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

						const handleScoreSubmit = async (score: number) => {
							if (athlonData?.data?.id) {
								await setDoc(scoreRef, {
									athlon: doc(db, 'athlons', athlonData?.data?.id),
									rawScore: score,
									user: uid,
									tiebreakScore: 0,
								});
							}
							setOpen(false);
						};

						const handleCloseDialog = () => {
							setOpen(false);
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
										open={open()}
										scoreInputNote={game.scoreInputNote}
										maxRawScore={game.maxRawScore}
										onSubmit={handleScoreSubmit}
										onClose={handleCloseDialog}
									/>
								}
							>
								{(score) => (
									<ScoreRecordDialog
										open={open()}
										scoreInputNote={game.scoreInputNote}
										maxRawScore={game.maxRawScore}
										onSubmit={handleScoreSubmit}
										onClose={handleCloseDialog}
										defaultValue={score.rawScore}
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


