/* eslint-disable array-plural/array-plural */
import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Stack} from '@suid/material';
import {blue} from '@suid/material/colors';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../../[id]';
import {calculateScore} from '~/../lib/scores';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import type {Game, GameRule, Score, User} from '~/lib/schema';

interface RankedScore extends Score {
	rank: number,
}

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
					<Link component={A} underline="hover" color="inherit" href="/athlons">
						Athlons
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
				<Typography
					component="h1"
					variant="h2"
					my={1}
				>
					Leaderboard
				</Typography>
				<Collection data={gameData}>
					{(game) => {
						const scoresData = useFirestore(
							query(
								collection(db, 'games', game.id, 'scores') as CollectionReference<Score>,
								orderBy('rawScore', 'desc'),
							),
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
										<Show when={scoresData.data} keyed>
											{(scores) => {
												let previousRawScore: number | null = null;
												let previousTiebreakScore: number | null = null;
												let previousRank = 0;
												const rankedScores = scores.map((score, index) => {
													let rank = index;
													if (score.rawScore === previousRawScore && score.tiebreakScore === previousTiebreakScore) {
														rank = previousRank;
													} else {
														previousRank = index;
													}

													previousRawScore = score.rawScore;
													previousTiebreakScore = score.tiebreakScore;

													return {...score, id: score.id, rank} as RankedScore;
												});

												return (
													<For each={rankedScores}>
														{(score) => {
															const userRef = doc(db, 'users', score.id) as DocumentReference<User>;
															const userData = useFirestore(userRef);
															const isMe = authState?.data?.uid === score.id;

															return (
																<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}} >
																	<TableCell>
																		{score.rank + 1}
																	</TableCell>
																	<TableCell>
																		<Doc data={userData}>
																			{(user) => (
																				<Stack direction="row" alignItems="center">
																					<Avatar
																						alt={user.displayName}
																						src={user.photoURL}
																						sx={{width: 30, height: 30, mr: 1}}
																					/>
																					<span>{user.displayName}</span>
																				</Stack>
																			)}
																		</Doc>
																	</TableCell>
																	<TableCell align="right">
																		{score.rawScore}
																	</TableCell>
																	<TableCell align="right">
																		{score.tiebreakScore}
																	</TableCell>
																	<TableCell align="right">
																		<strong>
																			{calculateScore(
																				score.rawScore,
																				score.rank,
																				game.maxPoint,
																				game.scoreConfiguration,
																			).toFixed(2)}
																		</strong>
																	</TableCell>
																</TableRow>
															);
														 }}
													</For>
												);
											}}
										</Show>
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
