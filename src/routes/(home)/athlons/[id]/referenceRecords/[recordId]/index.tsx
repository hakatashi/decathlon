import {A, useParams} from '@solidjs/router';
import {Breadcrumbs, Chip, Container, Link as LinkUi, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {floor} from 'remeda';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo, Show} from 'solid-js';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import MarkdownWithMath from '~/components/MarkdownWithMath';
import PageTitle from '~/components/PageTitle';
import type {AthlonRanking, Game, GameRule, ReferenceRecord} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const ReferenceRecordDetail = () => {
	const param = useParams<{id: string, recordId: string}>();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonData = useAthlon(param.id);

	const recordData = useFirestore(
		doc(db, 'athlons', param.id, 'referenceRecords', param.recordId) as DocumentReference<ReferenceRecord>,
	);

	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			orderBy('order'),
		),
	);

	const rankingData = useFirestore(
		query(
			collection(db, 'athlons', param.id, 'rankings') as CollectionReference<AthlonRanking>,
			where('referenceRecordId', '==', param.recordId),
		),
	);

	const ranking = createMemo(() => rankingData.data?.[0]);

	return (
		<main>
			<Container maxWidth="md" sx={{py: 3}}>
				<Doc data={athlonData}>
					{(athlon) => (
						<Doc data={recordData}>
							{(record) => (
								<PageTitle>[{athlon.name}] {record.name}</PageTitle>
							)}
						</Doc>
					)}
				</Doc>
				<Breadcrumbs aria-label="breadcrumb" sx={{pb: 3}}>
					<LinkUi component={A} underline="hover" color="inherit" href="/athlons">
						Athlons
					</LinkUi>
					<Doc data={athlonData}>
						{(athlon) => (
							<LinkUi underline="hover" color="inherit" component={A} href={`/athlons/${athlon.id}`}>
								{athlon.name}
							</LinkUi>
						)}
					</Doc>
					<Doc data={recordData}>
						{(record) => (
							<Typography color="text.primary">{record.name}</Typography>
						)}
					</Doc>
				</Breadcrumbs>
				<Doc data={recordData} fallback={<Typography color="text.secondary">参考記録が見つかりません。</Typography>}>
					{(record) => (
						<Stack spacing={3}>
							<Stack direction="row" alignItems="center" spacing={2}>
								<Typography variant="h4" component="h1">
									{record.name}
								</Typography>
								<Chip label="参考記録" variant="outlined" size="small"/>
								<Show when={ranking()} keyed>
									{(r) => (
										<Typography variant="h5" color="text.secondary">
											{floor(r.point, 2).toFixed(2)} pt
										</Typography>
									)}
								</Show>
							</Stack>
							<Show when={record.description}>
								<MarkdownWithMath content={record.description}/>
							</Show>
							<TableContainer component={Paper}>
								<Table>
									<TableHead>
										<TableRow>
											<TableCell>競技</TableCell>
											<TableCell align="right">Point</TableCell>
											<TableCell align="right">Raw Score</TableCell>
											<TableCell align="right">Tiebreak</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										<Collection data={gamesData}>
											{(game) => {
												const ruleData = useFirestore(game.rule as DocumentReference<GameRule>);
												const score = record.scores[game.id];
												const gameRanking = createMemo(() => ranking()?.games.find((g) => g.gameId === game.id));
												return (
													<Show when={score} keyed>
														{(s) => (
															<Doc data={ruleData}>
																{(rule) => (
																	<TableRow>
																		<TableCell>
																			<LinkUi
																				component={A}
																				underline="hover"
																				href={`/athlons/${param.id}/referenceRecords/${param.recordId}/${rule.id}`}
																			>
																				{rule.name}
																			</LinkUi>
																		</TableCell>
																		<TableCell align="right">
																			<Show
																				when={gameRanking()}
																				keyed
																				fallback={<Typography component="span" color="text.secondary">—</Typography>}
																			>
																				{(r) => (
																					<Typography variant="h6" component="span">
																						{floor(r.point, 2).toFixed(2)}
																					</Typography>
																				)}
																			</Show>
																		</TableCell>
																		<TableCell align="right">{s.rawScore}</TableCell>
																		<TableCell align="right">{s.tiebreakScore}</TableCell>
																	</TableRow>
																)}
															</Doc>
														)}
													</Show>
												);
											}}
										</Collection>
									</TableBody>
								</Table>
							</TableContainer>
						</Stack>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default ReferenceRecordDetail;
