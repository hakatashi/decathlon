import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../../[id]';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import type {Game, GameRule, Score} from '~/lib/schema';

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
				<Collection data={gameData}>
					{(game) => {
						const scoresData = useFirestore(
							collection(db, 'games', game.id, 'scores') as CollectionReference<Score>,
						);
						return (
							<TableContainer component={Paper}>
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>#</TableCell>
											<TableCell>User</TableCell>
											<TableCell align="right">Raw Score</TableCell>
											<TableCell align="right">Tiebreak Score</TableCell>
											<TableCell align="right">Point</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										<Collection data={scoresData}>
											{(score, index) => (
												<TableRow>
													<TableCell>
														{index() + 1}
													</TableCell>
													<TableCell>
														{score.id}
													</TableCell>
													<TableCell align="right">
														{score.rawScore}
													</TableCell>
													<TableCell align="right">
														{score.tiebreakScore}
													</TableCell>
													<TableCell align="right">
														???
													</TableCell>
												</TableRow>
											)}
										</Collection>
									</TableBody>
								</Table>
							</TableContainer>
						);
					}}
				</Collection>
			</Container>
		</main>
	);
};

export default Leaderboard;
