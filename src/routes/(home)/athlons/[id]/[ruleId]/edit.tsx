import {Navigate, useParams} from '@solidjs/router';
import {Button, Container, TextField} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {CollectionReference, DocumentReference, collection, doc, getFirestore, query, updateDoc, where, writeBatch} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {Show, createEffect, createMemo, createSignal} from 'solid-js';
import Collection from '~/components/Collection';
import type {Game, GameRule, Score} from '~/lib/schema';

const AthlonEdit = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);
	const authState = useAuth(auth);

	const [description, setDescription] = createSignal<string>('');
	const [importScores, setImportScores] = createSignal<string>('');
	const [hasDescriptionChange, setHasDescriptionChange] = createSignal<boolean>(false);

	createEffect(() => {
		if (gameData.data?.[0]?.description) {
			setDescription(gameData.data[0].description);
		}
	});

	const unauthorized = createMemo(() => (
		authState.data?.uid &&
		Array.isArray(gameData.data?.[0]?.admins) &&
		!gameData.data?.[0]?.admins.includes(authState.data.uid)
	));

	const handleClickSubmit = async (gameId: string) => {
		const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
		await updateDoc(gameRef, {
			description: description(),
		});
		setHasDescriptionChange(false);
	};

	const handleClickImport = async (game: Game) => {
		const scores: Score[] = [];

		for (const line of importScores().split(/\r?\n/)) {
			const [userId, rawScoreText, tiebreakScoreText] = line.split(/[\t,]/);
			if (userId.length !== 28) {
				console.error(`Invalid userId: ${userId}`);
				return;
			}
			const rawScore = parseFloat(rawScoreText);
			if (!Number.isFinite(rawScore)) {
				console.error(`Invalid rawScore: ${rawScoreText}`);
				return;
			}
			const tiebreakScore = parseFloat(tiebreakScoreText);
			if (!Number.isFinite(tiebreakScore)) {
				console.error(`Invalid tiebreakScore: ${tiebreakScoreText}`);
				return;
			}
			scores.push({
				athlon: game.athlon,
				user: userId,
				rawScore,
				tiebreakScore,
			});
		}

		const gameScoresRef = collection(db, 'games', game.id, 'scores') as CollectionReference<Score>;
		const batch = writeBatch(db);
		for (const score of scores) {
			batch.set(doc(gameScoresRef, score.user), score, {merge: true});
		}
		await batch.commit();
	};

	return (
		<Container maxWidth="lg" sx={{py: 3}}>
			<Show when={unauthorized()}>
				<Navigate href={`/athlons/${param.id}/${param.ruleId}`}/>;
			</Show>
			<Collection data={gameData}>
				{(game) => (
					<>
						<TextField
							multiline
							fullWidth
							label="Description"
							value={description()}
							onChange={(_event, value) => {
								setDescription(value);
								setHasDescriptionChange(true);
							}}
						/>
						<Button
							disabled={!hasDescriptionChange()}
							onClick={() => handleClickSubmit(game.id)}
							variant="contained"
							sx={{my: 2}}
						>
							Submit
						</Button>
						<TextField
							multiline
							fullWidth
							label="Import scores (userId, rawScore, tiebreakScore)"
							value={importScores()}
							minRows={3}
							onChange={(_event, value) => {
								setImportScores(value);
							}}
						/>
						<Button
							variant="contained"
							sx={{my: 2}}
							onClick={() => handleClickImport(game)}
						>
							Import Scores
						</Button>
					</>
				)}
			</Collection>
		</Container>
	);
};

export default AthlonEdit;
