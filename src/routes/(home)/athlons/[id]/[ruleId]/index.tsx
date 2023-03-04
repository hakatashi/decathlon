import {EmojiEvents} from '@suid/icons-material';
import {Typography, Container, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, TextField, Box, Icon} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getDoc, getFirestore, orderBy, query, setDoc, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createSignal, For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../../[id]';
import styles from './index.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import {useStorageBytes} from '~/lib/firebase';
import type {Athlon, Game, GameRule, Score} from '~/lib/schema';

interface Props {
	onSubmit: (score: number) => void,
	open: boolean,
	scoreInputNote: string,
	defaultValue?: number,
}

const ScoreRecordDialog = (props: Props) => {
	const [score, setScore] = createSignal<string>('');

	return (
		<Dialog
			open={props.open}
			onClose={props.onSubmit}
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
						inputProps={{inputMode: 'numeric', pattern: '[0-9]*'}}
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
						props.onSubmit(score());
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

	const handleClickOpen = () => {
		setOpen(true);
	};

	return (
		<main>
			<div class={styles.header}>
				<Container maxWidth="lg">
					<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
						<Link component={A} underline="hover" color="inherit" href="/">
							Decathlon
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
				</Container>
				<Doc data={ruleData}>
					{(rule) => {
						const iconData = useStorageBytes(ref(storage, `assets/icons/${rule.icon}.svg`));
						const textDecoder = new TextDecoder();

						return (
							<div class={styles.ruleArea}>
								<div class={styles.ruleDescription}>
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
									<Stack direction="raw">
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
															sx={{mr: 1}}
														>
															{link.label}
														</Button>
													)}
												</For>
											)}
										</Collection>
										<Button
											size="large"
											variant="contained"
											color="secondary"
											onClick={handleClickOpen}
										>
											スコアを記録する
										</Button>
									</Stack>
								</div>
								<span class={styles.ruleIcon}>
									<Show when={iconData.data} keyed>
										{(data) => (
											<span innerHTML={textDecoder.decode(data)}/>
										)}
									</Show>
								</span>
							</div>
						);
					}}
				</Doc>
			</div>
			<Container maxWidth="lg">
				<Collection data={gameData}>
					{(game) => {
						const uid = authState.data?.uid;
						if (!uid) {
							return <span>Loading...</span>;
						}
						const scoreRef = doc(db, 'games', game.id, 'scores', uid) as DocumentReference<Score>;
						const scoreData = useFirestore(scoreRef);

						const handleScoreSubmit = async (score: number) => {
							if (athlonData?.data?.id) {
								console.log(db, 'games', game.id, 'scores', uid);
								await setDoc(scoreRef, {
									athlon: doc(db, 'athlons', athlonData?.data?.id),
									rawScore: parseFloat(score),
									tiebreakScore: 0,
								});
							}
							setOpen(false);
						};

						return (
							<>
								<Button size="large" sx={{my: 3}} variant="contained" component={A} href="./leaderboard">
									<EmojiEvents sx={{mr: 1}}/>
									Show Leaderboard
								</Button>
								<div style={{'white-space': 'pre-wrap'}}>{game.description}</div>
								<Doc
									data={scoreData}
									fallback={
										<ScoreRecordDialog
											open={open()}
											scoreInputNote={game.scoreInputNote}
											onSubmit={handleScoreSubmit}
										/>
									}
								>
									{(score) => (
										<ScoreRecordDialog
											open={open()}
											scoreInputNote={game.scoreInputNote}
											onSubmit={handleScoreSubmit}
											defaultValue={score.rawScore}
										/>
									)}
								</Doc>
							</>
						);
					}}
				</Collection>
			</Container>
		</main>
	);
};

export default AthlonGame;


