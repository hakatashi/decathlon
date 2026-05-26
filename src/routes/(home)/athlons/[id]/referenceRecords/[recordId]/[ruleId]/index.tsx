import {A, useParams} from '@solidjs/router';
import {Breadcrumbs, Chip, Container, Divider, Link as LinkUi, Stack, Typography} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {floor} from 'remeda';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo, Show} from 'solid-js';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import MarkdownWithMath from '~/components/MarkdownWithMath';
import PageTitle from '~/components/PageTitle';
import type {AthlonRanking, Game, GameRule, ReferenceRecord} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const ReferenceRecordGameDetail = () => {
	const param = useParams<{id: string, recordId: string, ruleId: string}>();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonData = useAthlon(param.id);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;
	const ruleData = useFirestore(ruleRef);

	const recordData = useFirestore(
		doc(db, 'athlons', param.id, 'referenceRecords', param.recordId) as DocumentReference<ReferenceRecord>,
	);

	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
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
								<Doc data={ruleData}>
									{(rule) => (
										<PageTitle>[{athlon.name}] {record.name} — {rule.name}</PageTitle>
									)}
								</Doc>
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
							<LinkUi
								underline="hover"
								color="inherit"
								component={A}
								href={`/athlons/${param.id}/referenceRecords/${param.recordId}`}
							>
								{record.name}
							</LinkUi>
						)}
					</Doc>
					<Doc data={ruleData}>
						{(rule) => (
							<Typography color="text.primary">{rule.name}</Typography>
						)}
					</Doc>
				</Breadcrumbs>
				<Doc data={recordData} fallback={<Typography color="text.secondary">参考記録が見つかりません。</Typography>}>
					{(record) => (
						<Collection data={gameData} empty={<Typography color="text.secondary">競技が見つかりません。</Typography>}>
							{(game) => {
								const score = record.scores[game.id];
								const gameRanking = createMemo(() => ranking()?.games.find((g) => g.gameId === game.id));
								return (
									<Show when={score} keyed>
										{(s) => (
											<Stack spacing={3}>
												<Doc data={ruleData}>
													{(rule) => (
														<Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
															<Typography variant="h4" component="h1">
																{record.name}
															</Typography>
															<Chip label="参考記録" variant="outlined" size="small"/>
															<Typography variant="h5" component="span" color="text.secondary">
																— {rule.name}
															</Typography>
														</Stack>
													)}
												</Doc>
												<Stack direction="row" spacing={4} alignItems="baseline">
													<Stack alignItems="center">
														<Typography variant="caption" color="text.secondary">Point</Typography>
														<Show
															when={gameRanking()}
															keyed
															fallback={<Typography variant="h4" color="text.secondary">—</Typography>}
														>
															{(r) => (
																<Typography variant="h6">
																	<strong>{floor(r.point, 2).toFixed(2)}</strong>
																</Typography>
															)}
														</Show>
													</Stack>
													<Stack alignItems="center">
														<Typography variant="caption" color="text.secondary">Raw Score</Typography>
														<Typography variant="h6">{s.rawScore}</Typography>
													</Stack>
													<Stack alignItems="center">
														<Typography variant="caption" color="text.secondary">Tiebreak</Typography>
														<Typography variant="h6">{s.tiebreakScore}</Typography>
													</Stack>
												</Stack>
												<Show when={s.description}>
													<Divider/>
													<MarkdownWithMath content={s.description}/>
												</Show>
											</Stack>
										)}
									</Show>
								);
							}}
						</Collection>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default ReferenceRecordGameDetail;
