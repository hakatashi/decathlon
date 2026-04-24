import {A, useParams} from '@solidjs/router';
import {ElectricBolt, Star} from '@suid/icons-material';
import {
	Avatar, Box, Card, CardContent, Chip, Container,
	Paper, Stack, Table, TableBody, TableCell, TableContainer,
	TableHead, TableRow, Typography,
} from '@suid/material';
import {blue, grey, orange, red, yellow} from '@suid/material/colors';
import {
	collection, collectionGroup, CollectionReference, doc,
	DocumentReference, getFirestore, orderBy, Query, query, where,
} from 'firebase/firestore';
import {floor} from 'remeda';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo, For, Match, Show, Switch} from 'solid-js';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import type {Athlon, AthlonRanking, Game, GameRule, User} from '~/lib/schema';

const getRankColor = (rank: number) => {
	if (rank === 0) return yellow[700];
	if (rank === 1) return grey[500];
	if (rank === 2) return orange[700];
	return undefined;
};

const getRankLabel = (rank: number) => {
	if (rank === 0) return '🥇 1位';
	if (rank === 1) return '🥈 2位';
	if (rank === 2) return '🥉 3位';
	return `${rank + 1}位`;
};

interface AthlonResultCardProps {
	ranking: AthlonRanking,
}

const AthlonResultCard = (props: AthlonResultCardProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const athlonData = useFirestore(
		doc(db, 'athlons', props.ranking.athlonId) as DocumentReference<Athlon>,
	);

	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', props.ranking.athlonId)),
			orderBy('order'),
		),
	);

	const matchedGames = createMemo(() => {
		if (!gamesData.data) return [];
		return gamesData.data.map((game) => ({
			game,
			rankGame: props.ranking.games.find((g) => g.gameId === game.id),
		}));
	});

	const rankColor = createMemo(() => getRankColor(props.ranking.rank));

	return (
		<Card
			sx={{
				mb: 3,
				border: props.ranking.rank < 3
					? `2px solid ${getRankColor(props.ranking.rank)}`
					: '1px solid rgba(0,0,0,0.12)',
			}}
		>
			<Doc data={athlonData}>
				{(athlon) => (
					<CardContent>
						<Stack
							direction="row"
							justifyContent="space-between"
							alignItems="center"
							mb={2}
						>
							<Typography
								variant="h6"
								component={A}
								href={`/athlons/${props.ranking.athlonId}`}
								sx={{
									textDecoration: 'none',
									color: 'inherit',
									'&:hover': {textDecoration: 'underline'},
								}}
							>
								{athlon.name}
							</Typography>
							<Stack direction="row" spacing={1} alignItems="center">
								<Chip
									label={getRankLabel(props.ranking.rank)}
									size="small"
									sx={{
										fontWeight: 'bold',
										...(rankColor() !== undefined ? {
											backgroundColor: rankColor(),
											color: 'white',
										} : {}),
									}}
								/>
								<Typography variant="body2" color="text.secondary">
									{floor(props.ranking.point, 2).toFixed(2)} pts
								</Typography>
							</Stack>
						</Stack>

						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>競技</TableCell>
										<TableCell align="right">得点</TableCell>
										<TableCell align="right">順位</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									<For each={matchedGames()}>
										{({game, rankGame}) => {
											const ruleData = useFirestore(game.rule as DocumentReference<GameRule>);

											return (
												<TableRow>
													<TableCell>
														<Doc data={ruleData}>
															{(rule) => (
																<A
																	href={`/athlons/${props.ranking.athlonId}/${rule.id}`}
																	style={{color: 'inherit', 'text-decoration': 'none'}}
																>
																	<Typography
																		variant="body2"
																		sx={{'&:hover': {textDecoration: 'underline'}}}
																	>
																		{rule.name}
																	</Typography>
																</A>
															)}
														</Doc>
													</TableCell>
													<TableCell align="right">
														<Switch>
															<Match when={rankGame?.isAuthor}>
																<Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.5}>
																	<ElectricBolt sx={{color: blue[500], fontSize: '1rem'}}/>
																	<Typography variant="body2" color="text.secondary">出題者</Typography>
																</Stack>
															</Match>
															<Match when={rankGame?.hasScore}>
																<Typography variant="body2" fontWeight="medium">
																	{floor(rankGame?.point ?? 0, 2).toFixed(2)}
																</Typography>
															</Match>
															<Match when>
																<Typography variant="body2" color="text.disabled">—</Typography>
															</Match>
														</Switch>
													</TableCell>
													<TableCell align="right">
														<Show when={!rankGame?.isAuthor && rankGame?.rank !== null && rankGame?.rank !== undefined}>
															<Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={0.3}>
																<Show when={(rankGame?.rank ?? 99) === 0}>
																	<Star sx={{color: red[600], fontSize: '0.9rem'}}/>
																</Show>
																<Show when={(rankGame?.rank ?? 99) > 0 && (rankGame?.rank ?? 99) < 5}>
																	<Star sx={{color: orange[300], fontSize: '0.9rem'}}/>
																</Show>
																<Typography variant="body2">
																	{(rankGame?.rank ?? 0) + 1}位
																</Typography>
															</Stack>
														</Show>
													</TableCell>
												</TableRow>
											);
										}}
									</For>
								</TableBody>
							</Table>
						</TableContainer>
					</CardContent>
				)}
			</Doc>
		</Card>
	);
};

const UserDetail = () => {
	const param = useParams<{userId: string}>();
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const userData = useFirestore(
		doc(db, 'users', param.userId) as DocumentReference<User>,
	);

	const rankingsData = useFirestore(
		query(
			collectionGroup(db, 'rankings') as Query<AthlonRanking>,
			where('userId', '==', param.userId),
		),
	);

	const athlonsData = useFirestore(
		query(
			collection(db, 'athlons') as CollectionReference<Athlon>,
			orderBy('startAt', 'desc'),
		),
	);

	const sortedRankings = createMemo(() => {
		const rankings = rankingsData.data;
		const athlons = athlonsData.data;
		if (!rankings || !athlons) return [];
		return [...rankings].sort((a, b) => {
			const athlonA = athlons.find((ath) => ath.id === a.athlonId);
			const athlonB = athlons.find((ath) => ath.id === b.athlonId);
			const dateA = athlonA?.startAt?.toDate().getTime() ?? 0;
			const dateB = athlonB?.startAt?.toDate().getTime() ?? 0;
			return dateB - dateA;
		});
	});

	const stats = createMemo(() => {
		const rankings = rankingsData.data;
		if (!rankings || rankings.length === 0) return null;
		const bestRank = Math.min(...rankings.map((r) => r.rank)) + 1;
		const avgRank = rankings.reduce((sum, r) => sum + r.rank, 0) / rankings.length + 1;
		const rank1Count = rankings.filter((r) => r.rank === 0).length;
		return {
			totalParticipations: rankings.length,
			bestRank,
			avgRank,
			rank1Count,
		};
	});

	return (
		<main>
			<Container maxWidth="md">
				<Doc data={userData}>
					{(user) => (
						<>
							<PageTitle>{user.displayName}</PageTitle>

							<Box
								sx={{
									my: 4,
									p: 4,
									borderRadius: 2,
									background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
									color: 'white',
								}}
							>
								<Stack direction="row" spacing={3} alignItems="center">
									<Avatar
										src={user.photoURL}
										alt={user.displayName}
										sx={{width: 96, height: 96, border: '3px solid rgba(255,255,255,0.8)'}}
									/>
									<Box>
										<Typography variant="h4" fontWeight="bold">
											{user.displayName}
										</Typography>
										<Show when={user.description}>
											<Typography variant="body1" sx={{mt: 1, opacity: 0.9}}>
												{user.description}
											</Typography>
										</Show>
									</Box>
								</Stack>
							</Box>

							<Show when={stats()} keyed>
								{(s) => (
									<Box sx={{mb: 4}}>
										<Typography variant="h6" gutterBottom fontWeight="bold">
											Summary
										</Typography>
										<Stack direction="row" flexWrap="wrap" gap={2}>
											<Card sx={{flex: '1 1 130px', textAlign: 'center'}}>
												<CardContent>
													<Typography variant="h4" fontWeight="bold" color="primary">
														{s.totalParticipations}
													</Typography>
													<Typography variant="body2" color="text.secondary">
														参加回数
													</Typography>
												</CardContent>
											</Card>
											<Card sx={{flex: '1 1 130px', textAlign: 'center'}}>
												<CardContent>
													<Typography variant="h4" fontWeight="bold" color="primary">
														{s.bestRank}位
													</Typography>
													<Typography variant="body2" color="text.secondary">
														最高順位
													</Typography>
												</CardContent>
											</Card>
											<Card sx={{flex: '1 1 130px', textAlign: 'center'}}>
												<CardContent>
													<Typography variant="h4" fontWeight="bold" color="primary">
														{s.avgRank.toFixed(1)}位
													</Typography>
													<Typography variant="body2" color="text.secondary">
														平均順位
													</Typography>
												</CardContent>
											</Card>
											<Show when={s.rank1Count > 0}>
												<Card sx={{flex: '1 1 130px', textAlign: 'center', backgroundColor: yellow[50]}}>
													<CardContent>
														<Typography variant="h4" fontWeight="bold" sx={{color: yellow[800]}}>
															{s.rank1Count}回
														</Typography>
														<Typography variant="body2" color="text.secondary">
															🥇 優勝
														</Typography>
													</CardContent>
												</Card>
											</Show>
										</Stack>
									</Box>
								)}
							</Show>
						</>
					)}
				</Doc>

				<Typography variant="h6" gutterBottom fontWeight="bold">
					コンテスト戦績
				</Typography>
				<Switch>
					<Match when={rankingsData.loading || athlonsData.loading}>
						<Typography color="text.secondary">Loading...</Typography>
					</Match>
					<Match when={sortedRankings().length === 0 && !rankingsData.loading}>
						<Typography color="text.secondary">
							まだコンテストに参加していません。
						</Typography>
					</Match>
					<Match when>
						<For each={sortedRankings()}>
							{(ranking) => <AthlonResultCard ranking={ranking}/>}
						</For>
					</Match>
				</Switch>
			</Container>
		</main>
	);
};

export default UserDetail;
