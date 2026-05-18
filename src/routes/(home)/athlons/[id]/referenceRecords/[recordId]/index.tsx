import {A, Navigate, useParams} from '@solidjs/router';
import {Breadcrumbs, Button, Container, Divider, Link, Stack, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {addDoc, collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, setDoc, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, Show} from 'solid-js';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import type {Game, GameRule, ReferenceRecord, UseFireStoreReturn, User} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const ReferenceRecordEdit = () => {
	const param = useParams<{id: string, recordId: string}>();
	const isNew = () => param.recordId === 'new';
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);
	const authState = useAuth(auth);
	const athlonData = useAthlon(param.id);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	const notAdmin = createMemo(() => userData()?.data?.isAdmin === false);

	const existingRecordData = useFirestore(
		doc(db, 'athlons', param.id, 'referenceRecords', param.recordId) as DocumentReference<ReferenceRecord>,
	);

	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			orderBy('order'),
		),
	);

	const [name, setName] = createSignal('');
	const [description, setDescription] = createSignal('');
	const [gameScores, setGameScores] = createSignal<Record<string, {rawScore: string, tiebreakScore: string, description: string}>>({});
	const [isSaving, setIsSaving] = createSignal(false);

	createEffect(() => {
		const record = existingRecordData?.data;
		if (record) {
			setName(record.name);
			setDescription(record.description);
			const scores: Record<string, {rawScore: string, tiebreakScore: string, description: string}> = {};
			for (const [gameId, score] of Object.entries(record.scores)) {
				scores[gameId] = {
					rawScore: String(score.rawScore),
					tiebreakScore: String(score.tiebreakScore),
					description: score.description,
				};
			}
			setGameScores(scores);
		}
	});

	const updateGameScore = (gameId: string, field: 'rawScore' | 'tiebreakScore' | 'description', value: string) => {
		setGameScores((prev) => {
			const existing = prev[gameId] ?? {rawScore: '0', tiebreakScore: '0', description: ''};
			return {...prev, [gameId]: {...existing, [field]: value}};
		});
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const scores: ReferenceRecord['scores'] = {};
			for (const [gameId, s] of Object.entries(gameScores())) {
				const rawScore = Number.parseFloat(s.rawScore);
				const tiebreakScore = Number.parseFloat(s.tiebreakScore);
				if (!Number.isFinite(rawScore) || !Number.isFinite(tiebreakScore)) {
					continue;
				}
				scores[gameId] = {rawScore, tiebreakScore, description: s.description};
			}

			const recordData = {
				name: name(),
				description: description(),
				athlonId: param.id,
				scores,
				updatedAt: serverTimestamp(),
			};

			if (isNew()) {
				await addDoc(
					collection(db, 'athlons', param.id, 'referenceRecords') as CollectionReference<ReferenceRecord>,
					{...recordData, createdAt: serverTimestamp()} as ReferenceRecord,
				);
			} else {
				await setDoc(
					doc(db, 'athlons', param.id, 'referenceRecords', param.recordId) as DocumentReference<ReferenceRecord>,
					{...recordData, createdAt: existingRecordData?.data?.createdAt ?? serverTimestamp()} as ReferenceRecord,
				);
			}
		} finally {
			setIsSaving(false);
		}
	};

	const pageTitle = () => (isNew() ? '新規参考記録' : `参考記録を編集: ${name()}`);

	return (
		<main>
			<Show when={notAdmin()}>
				<Navigate href={`/athlons/${param.id}`}/>
			</Show>
			<Container maxWidth="md" sx={{py: 3}}>
				<Doc data={athlonData}>
					{(athlon) => (
						<PageTitle>[{athlon.name}] {pageTitle()}</PageTitle>
					)}
				</Doc>
				<Breadcrumbs aria-label="breadcrumb" sx={{pb: 3}}>
					<Link component={A} underline="hover" color="inherit" href="/athlons">
						Athlons
					</Link>
					<Doc data={athlonData}>
						{(athlon) => (
							<Link underline="hover" color="inherit" component={A} href={`/athlons/${athlon.id}`}>
								{athlon.name}
							</Link>
						)}
					</Doc>
					<Link underline="hover" color="inherit" component={A} href={`/athlons/${param.id}/referenceRecords`}>
						参考記録管理
					</Link>
					<Typography color="text.primary">{isNew() ? '新規' : '編集'}</Typography>
				</Breadcrumbs>
				<Typography variant="h4" component="h1" gutterBottom>
					{pageTitle()}
				</Typography>
				<Stack spacing={2}>
					<TextField
						fullWidth
						required
						label="記録名"
						value={name()}
						onChange={(_event, value) => setName(value)}
					/>
					<TextField
						fullWidth
						multiline
						minRows={3}
						label="全体説明 (Markdown)"
						value={description()}
						onChange={(_event, value) => setDescription(value)}
					/>
					<Divider/>
					<Typography variant="h6">競技ごとのスコア</Typography>
					<Collection data={gamesData}>
						{(game) => {
							const ruleData = useFirestore(game.rule as DocumentReference<GameRule>);
							return (
								<Doc data={ruleData}>
									{(rule) => (
										<Stack spacing={1} sx={{p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1}}>
											<Typography variant="subtitle1" fontWeight="bold">
												{rule.name}
											</Typography>
											<Stack direction="row" spacing={2}>
												<TextField
													label="Raw Score"
													type="number"
													value={gameScores()[game.id]?.rawScore ?? ''}
													onChange={(_event, value) => updateGameScore(game.id, 'rawScore', value)}
													sx={{width: 160}}
												/>
												<TextField
													label="Tiebreak Score"
													type="number"
													value={gameScores()[game.id]?.tiebreakScore ?? ''}
													onChange={(_event, value) => updateGameScore(game.id, 'tiebreakScore', value)}
													sx={{width: 160}}
												/>
											</Stack>
											<TextField
												fullWidth
												multiline
												minRows={2}
												label="この競技の説明 (Markdown)"
												value={gameScores()[game.id]?.description ?? ''}
												onChange={(_event, value) => updateGameScore(game.id, 'description', value)}
											/>
										</Stack>
									)}
								</Doc>
							);
						}}
					</Collection>
					<Button
						variant="contained"
						disabled={name() === '' || isSaving()}
						onClick={handleSave}
					>
						{isSaving() ? '保存中…' : '保存'}
					</Button>
				</Stack>
			</Container>
		</main>
	);
};

export default ReferenceRecordEdit;
