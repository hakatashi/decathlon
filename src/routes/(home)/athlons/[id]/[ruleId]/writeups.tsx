import {Link} from '@solidjs/meta';
import {A, useParams} from '@solidjs/router';
import {Breadcrumbs, Button, Container, Link as LinkUi, Dialog, TextField, Typography, DialogContent, DialogContentText, DialogActions} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {CollectionReference, DocumentReference, collection, deleteDoc, doc, getFirestore, query, serverTimestamp, setDoc, updateDoc, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import type {Game, GameRule, Writeup} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

interface WriteupProps {
	title: string;
	content: string;
	id: string;
}

const AthlonWriteup = (props: WriteupProps) => {
	let ref: HTMLDivElement;

	createEffect(async () => {
		console.log(`Writeup content was updated: ${props.content}`);

		// @ts-expect-error: URL import
		// eslint-disable-next-line import/no-unresolved
		const {default: renderMathInElement} = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
		renderMathInElement(ref, {
			delimiters: [
				{left: '$$', right: '$$', display: true},
				{left: '$', right: '$', display: false},
			],
		});
	});

	return (
		<div>
			<Typography variant="h4" component="h2">
				{props.title} by <Username userId={props.id} display="inline" size={64}/>
			</Typography>
			<div ref={ref}>
				<SolidMarkdown
					class="markdown"
					children={props.content}
					// remarkPlugins={[remarkGfm]}
					linkTarget="_blank"
				/>
			</div>
		</div>
	);
};

const AthlonWriteups = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);
	const authState = useAuth(auth);
	const athlonData = useAthlon(param.id);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;
	const ruleData = useFirestore(ruleRef);

	const [myWriteup, setMyWriteup] = createSignal<{content: string, title: string}>({content: '', title: ''});
	const [hasMyWriteupChange, setHasMyWriteupChange] = createSignal<boolean>(false);
	const [isMyWriteupExist, setIsMyWriteupExist] = createSignal<boolean>(false);
	const [isDeletionDialogOpen, setIsDeletionDialogOpen] = createSignal<boolean>(false);

	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);

	const handleClickSubmit = async (gameId: string) => {
		if (authState.data === null) {
			return;
		}

		const writeupRef = doc(db, 'games', gameId, 'writeups', authState.data.uid) as DocumentReference<Writeup>;

		if (isMyWriteupExist()) {
			await updateDoc(writeupRef, {
				content: myWriteup().content,
				title: myWriteup().title,
				updatedAt: serverTimestamp(),
			});
		} else {
			await setDoc(writeupRef, {
				content: myWriteup().content,
				title: myWriteup().title,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});
		}

		setHasMyWriteupChange(false);
	};

	const handleClickDelete = async (gameId: string) => {
		if (authState.data === null) {
			return;
		}

		const writeupRef = doc(db, 'games', gameId, 'writeups', authState.data.uid) as DocumentReference<Writeup>;
		await deleteDoc(writeupRef);

		setHasMyWriteupChange(false);
	};

	return (
		<Container maxWidth="lg" sx={{py: 3}}>
			<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
			<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
				<LinkUi component={A} underline="hover" color="inherit" href="/athlons">
					Athlons
				</LinkUi>
				<Doc data={athlonData}>
					{(athlon) => (
						<>
							<LinkUi
								underline="hover"
								color="inherit"
								component={A}
								href={`/athlons/${athlon.id}`}
							>
								{athlon.name}
							</LinkUi>
							<Doc data={ruleData}>
								{(rule) => (
									<LinkUi
										underline="hover"
										color="inherit"
										component={A}
										href={`/athlons/${athlon.id}/${rule.id}`}
									>
										{rule.name}
									</LinkUi>
								)}
							</Doc>
						</>
					)}
				</Doc>
				<Typography color="text.primary">解説</Typography>
			</Breadcrumbs>
			<Collection data={gameData}>
				{(game) => {
					const writeupsData = useFirestore(
						collection(db, 'games', game.id, 'writeups') as CollectionReference<Writeup>,
					);

					const myWriteupData = createMemo(() => {
						if (authState.data === null) {
							return null;
						}

						return useFirestore(
							doc(db, 'games', game.id, 'writeups', authState.data.uid) as DocumentReference<Writeup>,
						);
					});

					createEffect(() => {
						const data = myWriteupData();
						if (data === null || data.data === null || data.data === undefined) {
							return;
						}

						setIsMyWriteupExist(true);
						setMyWriteup({
							content: data.data.content ?? '',
							title: data.data.title ?? '',
						});
					});

					return (
						<>
							<Collection
								data={writeupsData}
								empty={
									<div>
										解説がまだ投稿されていません。
									</div>
								}
							>
								{(writeup) => (
									<AthlonWriteup title={writeup.title} content={writeup.content} id={writeup.id}/>
								)}
							</Collection>
							<Typography variant="h4" component="h2" sx={{mt: 6}}>
								解説を投稿する
							</Typography>
							<TextField
								fullWidth
								required
								label="タイトル"
								value={myWriteup()?.title ?? ''}
								sx={{mt: 2}}
								onChange={(_event, value) => {
									setMyWriteup((prev) => ({
										...prev,
										title: value,
									}));
									setHasMyWriteupChange(true);
								}}
							/>
							<TextField
								multiline
								fullWidth
								required
								minRows={3}
								label="解説"
								value={myWriteup()?.content ?? ''}
								sx={{mt: 2}}
								onChange={(_event, value) => {
									setMyWriteup((prev) => ({
										...prev,
										content: value,
									}));
									setHasMyWriteupChange(true);
								}}
							/>
							<Button
								disabled={
									!authState.data ||
									!hasMyWriteupChange() ||
									myWriteup().content === '' ||
									myWriteup().title === ''
								}
								onClick={() => handleClickSubmit(game.id)}
								variant="contained"
								sx={{my: 2, mr: 2}}
							>
								投稿
							</Button>
							{/* 削除ボタン */}
							<Button
								disabled={!isMyWriteupExist()}
								onClick={() => setIsDeletionDialogOpen(true)}
								variant="contained"
								color="error"
								sx={{my: 2, mr: 2}}
							>
								削除
							</Button>
							<Dialog
								open={isDeletionDialogOpen()}
								onClose={() => setIsDeletionDialogOpen(false)}
							>
								<DialogContent>
									<DialogContentText id="alert-dialog-description">
										解説を削除しますか？
									</DialogContentText>
								</DialogContent>
								<DialogActions>
									<Button
										onClick={() => {
											handleClickDelete(game.id);
											setIsDeletionDialogOpen(false);
											setIsMyWriteupExist(false);
										}}
										color="error"
									>
										削除
									</Button>
								</DialogActions>
							</Dialog>
						</>
					);
				}}
			</Collection>
		</Container>
	);
};

export default AthlonWriteups;
