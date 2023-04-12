import {Button, Container, TextField} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {CollectionReference, DocumentReference, collection, doc, getFirestore, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal} from 'solid-js';
import {useParams} from 'solid-start';
import Collection from '~/components/Collection';
import type {Game, GameRule} from '~/lib/schema';

const AthlonEdit = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
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

	const [description, setDescription] = createSignal<string>('');
	const [importScores, setImportScores] = createSignal<string>('');
	const [hasDescriptionChange, setHasDescriptionChange] = createSignal<boolean>(false);

	createEffect(() => {
		if (gameData.data?.[0]?.description) {
			setDescription(gameData.data[0].description);
		}
	});

	return (
		<Container maxWidth="lg" sx={{py: 3}}>
			<Collection data={gameData}>
				{() => (
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
