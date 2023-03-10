/* eslint-disable array-plural/array-plural */
import {Star} from '@suid/icons-material';
import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Avatar, Stack, FormControlLabel, Switch} from '@suid/material';
import {blue} from '@suid/material/colors';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createSignal, For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import type {Game, User} from '~/lib/schema';

const Leaderboard = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);

	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			orderBy('order'),
		),
	);

	const authState = useAuth(auth);

	const [showRawScore, setShowRawScore] = createSignal<boolean>(false);

	return (
		<main>
			<Doc data={athlonData}>
				{(athlon) => (
					<PageTitle>[{athlon.name}] Leaderboard</PageTitle>
				)}
			</Doc>
			<Container maxWidth="lg">
				<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
					<Link component={A} underline="hover" color="inherit" href="/athlons">
						Athlons
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
					<Typography color="text.primary">Leaderboard</Typography>
				</Breadcrumbs>
				<Typography
					component="h1"
					variant="h2"
					my={1}
				>
					Leaderboard
				</Typography>
				<FormControlLabel
					control={
						<Switch
							checked={showRawScore()}
							onChange={(_event, value) => {
								setShowRawScore(value);
							}}
						/>
					}
					label="Show Raw Score"
				/>
				<Doc data={athlonData}>
					{(athlon) => {
						const ranking = athlon.ranking;

						return (
							<TableContainer component={Paper}>
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>#</TableCell>
											<TableCell>User</TableCell>
											<Collection data={gamesData}>
												{(game) => {
													const ruleData = useFirestore(game.rule);
													return (
														<TableCell align="right">
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
														</TableCell>
													);
												}}
											</Collection>
											<TableCell align="right">Point</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										<For each={ranking}>
											{(userEntry) => {
												const userRef = doc(db, 'users', userEntry.userId) as DocumentReference<User>;
												const userData = useFirestore(userRef);
												const isMe = authState?.data?.uid === userEntry.userId;

												return (
													<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}} >
														<TableCell>
															{userEntry.rank + 1}
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
														<For each={userEntry.games}>
															{(game) => {
																const getScore = () => {
																	if (!game.hasScore) {
																		return '-';
																	}

																	if (showRawScore()) {
																		return game.rawScore.toString();
																	}

																	return game.point.toFixed(2);
																};

																return (
																	<TableCell align="right">
																		<Show when={game.rank === 0}>
																			<Star
																				color="secondary"
																				sx={{
																					verticalAlign: 'text-bottom',
																					width: 0.07,
																					height: 0.07,
																					mr: 0.3,
																				}}
																			/>
																		</Show>
																		{getScore()}
																	</TableCell>
																);
															}}
														</For>
														<TableCell align="right">
															<strong>
																{userEntry.point.toFixed(2)}
															</strong>
														</TableCell>
													</TableRow>
												);
											}}
										</For>
									</TableBody>
								</Table>
							</TableContainer>
						);
					}}
				</Doc>
			</Container>
		</main>
	);
};

export default Leaderboard;

