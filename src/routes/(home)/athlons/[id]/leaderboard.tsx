/* eslint-disable array-plural/array-plural */
import {Star} from '@suid/icons-material';
import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Stack, FormControlLabel, Switch as SwitchControl} from '@suid/material';
import {blue, orange, red} from '@suid/material/colors';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createSignal, For, Match, Switch} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import Username from '~/components/Username';
import type {Game, RankingEntry} from '~/lib/schema';

const RankingTable = (props: {ranking: RankingEntry[], athlonId: string, showRawScore: boolean}) => {
	const param = useParams();
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
													href={`/athlons/${props.athlonId}/${rule.id}`}
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
					<For each={props.ranking}>
						{(userEntry) => {
							const isMe = authState?.data?.uid === userEntry.userId;

							return (
								<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}} >
									<TableCell>
										{userEntry.rank + 1}
									</TableCell>
									<TableCell>
										<Username userId={userEntry.userId}/>
									</TableCell>
									<For each={userEntry.games}>
										{(game) => {
											const getScore = () => {
												if (!game.hasScore) {
													return '';
												}

												if (props.showRawScore) {
													return game.rawScore.toString();
												}

												return game.point.toFixed(2);
											};

											return (
												<TableCell align="right">
													<Stack direction="row" justifyContent="flex-end">
														<Switch>
															<Match when={game.isAuthor}>
																<img
																	src="https://firebasestorage.googleapis.com/v0/b/tsg-decathlon.appspot.com/o/assets%2Ftax-office.png?alt=media&token=f42b3170-c6c3-48e7-909e-88fbb1ffcc0e"
																	style={{
																		width: '24px',
																		height: '24px',
																		'margin-right': '0.3rem',
																	}}
																/>
															</Match>
															<Match when={game.rank === 0}>
																<Star
																	sx={{
																		color: red[600],
																		width: '16px',
																		height: '16px',
																		mr: 0.3,
																	}}
																/>
															</Match>
															<Match when={game.rank !== null && game.rank > 0 && game.rank < 5}>
																<Star
																	sx={{
																		color: orange[200],
																		width: '16px',
																		height: '16px',
																		mr: 0.3,
																	}}
																/>
															</Match>
														</Switch>
														<span>{getScore()}</span>
													</Stack>
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
};

const Leaderboard = () => {
	const athlonData = useAthlon();

	const [showRawScore, setShowRawScore] = createSignal<boolean>(false);

	return (
		<main>
			<Doc data={athlonData}>
				{(athlon) => (
					<PageTitle>[{athlon.name}] Leaderboard</PageTitle>
				)}
			</Doc>
			<Container maxWidth={false}>
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
						<SwitchControl
							checked={showRawScore()}
							onChange={(_event, value) => {
								setShowRawScore(value);
							}}
						/>
					}
					label="Show Raw Score"
				/>
				<Doc data={athlonData}>
					{(athlon) => (
						<RankingTable
							ranking={athlon.ranking}
							athlonId={athlon.id}
							showRawScore={showRawScore()}
						/>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default Leaderboard;

