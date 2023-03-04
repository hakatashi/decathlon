import {Typography, Container, Breadcrumbs, Link, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, TextField, Box} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getDoc, getFirestore, orderBy, query, setDoc, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createSignal, For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import styles from './[ruleId].module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import {useStorageBytes} from '~/lib/firebase';
import type {Game, GameRule, Score} from '~/lib/schema';

interface Props {
	onClose: () => void,
	open: boolean,
	scoreInputNote: string,
	defaultValue?: number,
}

const ScoreRecordDialog = (props: Props) => (
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
					inputProps={{inputMode: 'numeric', pattern: '[0-9]*'}}
					defaultValue={props.defaultValue}
					required
				/>
			</DialogContentText>
		</DialogContent>
		<DialogActions>
			<Button onClick={props.onClose}>
				送信
			</Button>
		</DialogActions>
	</Dialog>
);

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

	const handleClose = () => {
		setOpen(false);
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

						return (
							<>
								<div style={{'white-space': 'pre-wrap'}}>{game.description}</div>
								<Doc
									data={scoreData}
									fallback={
										<ScoreRecordDialog
											open={open()}
											scoreInputNote={game.scoreInputNote}
											onClose={handleClose}
										/>
									}
								>
									{(score) => (
										<ScoreRecordDialog
											open={open()}
											scoreInputNote={game.scoreInputNote}
											onClose={handleClose}
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


