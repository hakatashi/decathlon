import {A, useParams} from '@solidjs/router';
import {ElectricBolt, Star} from '@suid/icons-material';
import {Typography, Container, Breadcrumbs, Link, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, Stack, FormControlLabel, Switch as SwitchControl} from '@suid/material';
import {blue, orange, red, yellow} from '@suid/material/colors';
import dayjs from 'dayjs';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {floor, filter} from 'remeda';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo, createSignal, For, Match, onCleanup, Show, Switch} from 'solid-js';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import Username from '~/components/Username';
import type {Game, RankingEntry} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const transpose = <T, >(array: T[][]): T[][] => (
	array.length === 0 ? [] : array[0].map((_, i) => array.map((row) => row[i]))
);

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

	const participants = createMemo(() => (
		transpose(
			props.ranking.map((user) => (
				user.games.map((game) => game.hasScore && game.point > 0 && !game.isAuthor)
			)),
		).map((users) => filter(users, (user) => user === true).length)
	));

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
								<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}}>
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

												return floor(game.point, 2).toFixed(2);
											};

											return (
												<TableCell align="right">
													<Stack direction="row" justifyContent="flex-end">
														<Switch>
															<Match when={game.isAuthor}>
																<ElectricBolt
																	sx={{
																		color: blue[500],
																		width: '16px',
																		height: '16px',
																		mr: 0.3,
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
											{floor(userEntry.point, 2).toFixed(2)}
										</strong>
									</TableCell>
								</TableRow>
							);
						}}
					</For>
					<TableRow sx={{backgroundColor: yellow[50]}}>
						<TableCell size="small"><strong>参加者数</strong></TableCell>
						<TableCell size="small"/>
						<For each={participants()}>
							{(participant) => (
								<TableCell size="small" align="right"><strong>{participant}</strong></TableCell>
							)}
						</For>
						<TableCell size="small" align="right"><strong>{props.ranking.length}</strong></TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const Leaderboard = () => {
	const param = useParams();
	const athlonData = useAthlon(param.id);
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonRankingsData = useFirestore(
		query(
			collection(db, 'athlons', param.id, 'rankings') as CollectionReference<RankingEntry>,
			orderBy('rank'),
		),
	);

	const [showRawScore, setShowRawScore] = createSignal<boolean>(false);
	const [now, setNow] = createSignal<number>(Date.now());

	const intervalId = setInterval(() => {
		setNow(Date.now());
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	const endAt = createMemo(() => athlonData?.data && dayjs(athlonData.data.endAt.toDate()));
	const isEnded = createMemo(() => endAt()?.isBefore(now()));

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
				<Show when={isEnded() && endAt()} keyed>
					{(day) => (
						<Typography
							component="p"
							variant="body2"
							my={1}
						>
							コンテスト終了時 ({day.format('YYYY/MM/DD HH:mm:ss')}) のランキングを表示しています。
						</Typography>
					)}
				</Show>
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
				<Doc data={athlonRankingsData}>
					{(athlonRankings) => (
						<RankingTable
							ranking={athlonRankings}
							athlonId={param.id}
							showRawScore={showRawScore()}
						/>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default Leaderboard;

