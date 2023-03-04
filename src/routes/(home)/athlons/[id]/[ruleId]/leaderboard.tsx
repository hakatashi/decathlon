import {Typography, Container, Breadcrumbs, Link} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../../[id]';
import Doc from '~/components/Doc';
import type {Game, GameRule} from '~/lib/schema';

const Leaderboard = () => {
	const param = useParams();
	const athlonData = useAthlon();
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

	return (
		<main>
			<Container maxWidth="lg">
				<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
					<Link component={A} underline="hover" color="inherit" href="/">
						Decathlon
					</Link>
					<Doc data={athlonData}>
						{(athlon) => (
							<>
								<Link
									underline="hover"
									color="inherit"
									component={A}
									href={`/athlons/${athlon.id}`}
								>
									{athlon.name}
								</Link>
								<Doc data={ruleData}>
									{(rule) => (
										<Link
											underline="hover"
											color="inherit"
											component={A}
											href={`/athlons/${athlon.id}/${rule.id}`}
										>
											{rule.name}
										</Link>
									)}
								</Doc>
							</>
						)}
					</Doc>
					<Typography color="text.primary">Leaderboard</Typography>
				</Breadcrumbs>
			</Container>
		</main>
	);
};

export default Leaderboard;
