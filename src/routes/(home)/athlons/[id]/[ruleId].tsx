import {Typography, Container, Breadcrumbs, Link} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import type {Game, GameRule} from '~/lib/schema';

const AthlonGame = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const ruleData = useFirestore(ruleRef);
	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);

	return (
		<main>
			<Container maxWidth="lg">
				<Breadcrumbs aria-label="breadcrumb" sx={{mt: 3, mb: 3}}>
					<Link component={A} underline="hover" color="inherit" href="/">
						Decathlon
					</Link>
					<Doc data={athlonData}>
						{(athlon) => (
							<Link
								underline="hover"
								color="inherit"
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
				<Collection data={gameData}>
					{(game) => (
						<div style={{'white-space': 'pre-wrap'}}>{game.description}</div>
					)}
				</Collection>
			</Container>
		</main>
	);
};

export default AthlonGame;


