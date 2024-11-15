import {A, useParams} from '@solidjs/router';
import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Stack, Chip} from '@suid/material';
import {blue} from '@suid/material/colors';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {floor} from 'lodash';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Show} from 'solid-js';
import {calculateGameRanking} from '~/../lib/scores';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import Username from '~/components/Username';
import type {Game, GameRule, Score} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const Leaderboard = () => {
	const param = useParams();
	const athlonData = useAthlon(param.id);
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
			<Doc data={athlonData}>
				{(athlon) => (
					<Doc data={ruleData}>
						{(rule) => (
							<PageTitle>[{athlon.name}] Leaderboard of {rule.name}</PageTitle>
						)}
					</Doc>
				)}
			</Doc>
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
							collection(db, 'games', game.id, 'scores') as CollectionReference<Score>,
						);

						return (
							<>
								<Typography variant="body2"><strong>作問者ボーナス</strong> ランキング上位{game.adminBonus.count}名の平均点</Typography>
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
													const rankedScores = calculateGameRanking(game, scores);
													const hasDecimalRawScore = scores.some((score) => !Number.isInteger(score.rawScore));

													return (
														<For each={rankedScores}>
															{(score) => {
																const isMe = authState?.data?.uid === score.id;

																return (
																	<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}}>
																		<TableCell>
																			<Show when={!score.isAuthor}>
																				{score.rank + 1}
																			</Show>
																		</TableCell>
																		<TableCell>
																			<Stack direction="row">
																				<Username userId={score.user}/>
																				<Show when={score.isAuthor}>
																					<Chip label="author" color="primary" variant="outlined" sx={{ml: 1}}/>
																				</Show>
																			</Stack>
																		</TableCell>
																		<TableCell align="right">
																			<Show when={!score.isAuthor}>
																				{hasDecimalRawScore ? floor(score.rawScore, 2).toFixed(2) : score.rawScore}
																			</Show>
																		</TableCell>
																		<TableCell align="right">
																			<Show when={!score.isAuthor}>
																				{score.tiebreakScore}
																			</Show>
																		</TableCell>
																		<TableCell align="right">
																			<strong>
																				{floor(score.point, 2).toFixed(2)}
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
							</>
						);
					}}
				</Collection>
			</Container>
		</main>
	);
};

export default Leaderboard;
