import {A, useSearchParams} from '@solidjs/router';
import {Alert, Box, Button, ButtonGroup, CircularProgress, Container, Link as LinkUi, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from '@suid/material';
import {blue} from '@suid/material/colors';
import dayjs from 'dayjs';
import {Bytes, collection, CollectionReference, doc, DocumentReference, getDoc, getFirestore, orderBy, query, serverTimestamp, writeBatch} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import {useDownloadURL, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch} from 'solid-js';
import {setArenaTitle, setHeaderText, useUser} from '../arenas';
import styles from './bitflip-procon.module.css';
import {countBitflips} from '~/../lib/bitflip';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import MarkdownWithMath from '~/components/MarkdownWithMath';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {BitflipProconConfiguration, BitflipProconRanking, BitflipProconSubmission, BitflipProconSubmissionCode, Game, UseFireStoreReturn} from '~/lib/schema';

type Phase = 'loading' | 'waiting' | 'playing' | 'finished';
type Submissions = UseFireStoreReturn<BitflipProconSubmission[] | null | undefined> | null;

// Must be the same as the limit in firestore.rules
const MAX_BINARY_SIZE = 262144;
const THROTTLE_DURATION = 30000;
const EXECUTION_TIMEOUT = 90000;
const MAX_DIFF_ROWS = 256;

const FINISHED_STATUSES: BitflipProconSubmission['status'][] = ['success', 'failed', 'error', 'invalid'];

const formatHex = (value: number, length: number) => value.toString(16).padStart(length, '0');

const formatByte = (value: number | undefined) => (
	value === undefined ? '--' : `${formatHex(value, 2)} (${value.toString(2).padStart(8, '0')})`
);

interface MainTabProps {
	submissions: Submissions,
	phase: Phase,
	originalBinary: Uint8Array | undefined,
}

const MainTab = (props: MainTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);

	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const [file, setFile] = createSignal<{name: string, data: Uint8Array} | null>(null);
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [submissionId, setSubmissionId] = createSignal<string | null>(null);
	const [submitError, setSubmitError] = createSignal<string | null>(null);
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal<number>(0);

	let fileInputRef!: HTMLInputElement;

	const submission = createMemo(() => {
		const id = submissionId();
		return props.submissions?.data?.find((s) => s.id === id) ?? null;
	});

	const expectedBitflips = createMemo(() => {
		const fileData = file();
		if (!fileData || !props.originalBinary) {
			return null;
		}
		return countBitflips(props.originalBinary, fileData.data);
	});

	const isFileTooLarge = createMemo(() => (file()?.data.length ?? 0) > MAX_BINARY_SIZE);
	const isFileEmpty = createMemo(() => file()?.data.length === 0);

	const handleFileChange = async (event: Event & {currentTarget: HTMLInputElement}) => {
		const selectedFile = event.currentTarget.files?.[0];
		if (!selectedFile) {
			return;
		}
		const data = new Uint8Array(await selectedFile.arrayBuffer());
		setFile({name: selectedFile.name, data});
	};

	const handleClickSubmit = async () => {
		const userData = user();
		const fileData = file();
		if (!gameData.data || !userData?.uid || !fileData) {
			return;
		}

		setSubmissionId(null);
		setSubmitError(null);
		setSubmitStatus('executing');

		const submissionRef = doc(collection(gameRef, 'submissions') as CollectionReference<BitflipProconSubmission>);
		const codeRef = doc(gameRef, 'submissionCodes', submissionRef.id) as DocumentReference<BitflipProconSubmissionCode>;

		// The binary is stored in a separate document so that the other participants cannot read it
		const batch = writeBatch(db);
		batch.set(submissionRef, {
			athlon: gameData.data.athlon,
			userId: userData.uid,
			status: 'pending',
			size: fileData.data.length,
			bitflips: null,
			score: null,
			testcases: [],
			createdAt: serverTimestamp(),
			executedAt: null,
		});
		batch.set(codeRef, {
			userId: userData.uid,
			code: Bytes.fromUint8Array(fileData.data),
		});

		try {
			await batch.commit();
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : String(error));
			setSubmitStatus('ready');
			return;
		}

		setLastSubmissionTime(Date.now());
		setSubmissionId(submissionRef.id);
	};

	createEffect(() => {
		const submissionData = submission();
		if (submitStatus() === 'executing' && submissionData && FINISHED_STATUSES.includes(submissionData.status)) {
			setSubmitStatus('throttled');
		}
	});

	const intervalId = setInterval(() => {
		const lastSubmissionTimeData = lastSubmissionTime();
		if (lastSubmissionTimeData === null) {
			setThrottleTime(0);
			return;
		}

		const elapsedTime = Date.now() - lastSubmissionTimeData;
		const newThrottleTime = Math.max(0, THROTTLE_DURATION - elapsedTime);
		setThrottleTime(newThrottleTime);
		if (newThrottleTime === 0 && submitStatus() === 'throttled') {
			setSubmitStatus('ready');
		}
		// Safety net for the case that the worker failed to report the result
		if (elapsedTime > EXECUTION_TIMEOUT && submitStatus() === 'executing') {
			setSubmitError('実行がタイムアウトしました。しばらく待ってから提出一覧を確認してください。');
			setSubmitStatus('ready');
		}
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	createEffect(() => {
		const submissionsData = props.submissions;
		const userData = user();
		if (submissionsData && Array.isArray(submissionsData.data)) {
			const scores = submissionsData.data
				.filter(({status, userId}) => status === 'success' && userId === userData?.uid)
				.map(({score}) => score)
				.filter((score) => typeof score === 'number');
			if (scores.length === 0) {
				setHeaderText('スコア: -');
			} else {
				setHeaderText(`スコア: ${Math.min(...scores)}`);
			}
		}
	});

	return (
		<Doc data={gameData}>
			{(game) => {
				const config = game.configuration as BitflipProconConfiguration;

				return (
					<>
						<Typography variant="body1" component="div">
							<MarkdownWithMath content={config.rule}/>
						</Typography>
						<Stack gap={2} direction="row" flexWrap="wrap">
							<For each={config.files}>
								{(configFile) => {
									const urlData = useDownloadURL(ref(storage, `assets/bitflip-procon/${configFile.filename}`));

									return (
										<Show when={urlData.latest} keyed>
											{(url) => (
												<Button
													variant={configFile.isMain ? 'contained' : 'outlined'}
													size="large"
													component={A}
													href={url}
													color="secondary"
												>
													{configFile.label}をダウンロードする
												</Button>
											)}
										</Show>
									);
								}}
							</For>
						</Stack>
						<Typography variant="h5" component="h2" sx={{mt: 5, mb: 1}}>
							提出
						</Typography>
						<Stack gap={2} direction="row" alignItems="center" flexWrap="wrap" sx={{mb: 2}}>
							<input
								ref={fileInputRef}
								type="file"
								class={styles.fileInput}
								onChange={handleFileChange}
							/>
							<Button
								variant="outlined"
								disabled={props.phase === 'finished' || submitStatus() === 'executing'}
								onClick={() => fileInputRef.click()}
							>
								提出するバイナリを選択
							</Button>
							<Show when={file()} keyed fallback={<Typography color="text.secondary">ファイルが選択されていません</Typography>}>
								{(fileData) => (
									<Typography>
										{fileData.name} ({fileData.data.length} bytes)
										<Show when={expectedBitflips() !== null}>
											{' - '}
											bitflip数: <strong>{expectedBitflips()}</strong>
										</Show>
									</Typography>
								)}
							</Show>
						</Stack>
						<Show when={isFileTooLarge()}>
							<Alert severity="error" sx={{my: 2}}>
								ファイルサイズが大きすぎます。提出できるバイナリは {MAX_BINARY_SIZE} bytes までです。
							</Alert>
						</Show>
						<Show when={isFileEmpty()}>
							<Alert severity="error" sx={{my: 2}}>
								空のファイルは提出できません。
							</Alert>
						</Show>
						<Show when={submitError()}>
							<Alert severity="error" sx={{my: 2}}>
								{submitError()}
							</Alert>
						</Show>
						<Show when={submitStatus() !== 'executing' && submission()} keyed>
							{(submissionData) => (
								<Switch>
									<Match when={submissionData.status === 'success'}>
										<Alert severity="success" sx={{my: 2}}>
											提出成功 - bitflip数: {submissionData.score}
										</Alert>
									</Match>
									<Match when={FINISHED_STATUSES.includes(submissionData.status)}>
										<Alert severity="error" sx={{my: 2}}>
											提出失敗 ({submissionData.status})
											{' - '}
											<LinkUi
												href="#"
												underline="hover"
												onClick={(event) => {
													event.preventDefault();
													setSearchParams({tab: 'submissions', submissionId: submissionData.id});
												}}
											>
												詳細を見る
											</LinkUi>
										</Alert>
									</Match>
								</Switch>
							)}
						</Show>
						<Switch>
							<Match when={props.phase === 'finished'}>
								<Button variant="contained" disabled size="large">
									競技は終了しました
								</Button>
							</Match>
							<Match when={submitStatus() === 'ready'}>
								<Button
									onClick={handleClickSubmit}
									variant="contained"
									size="large"
									disabled={file() === null || isFileTooLarge() || isFileEmpty()}
								>
									送信
								</Button>
							</Match>
							<Match when={submitStatus() === 'executing'}>
								<Button variant="contained" disabled size="large">
									<CircularProgress color="secondary" sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}/>
									実行中
								</Button>
							</Match>
							<Match when={submitStatus() === 'throttled'}>
								<Button variant="contained" disabled size="large">
									<CircularProgress
										variant="determinate"
										value={(1 - throttleTime() / THROTTLE_DURATION) * 100}
										color="secondary"
										sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}
									/>
									待機中⋯⋯
								</Button>
							</Match>
						</Switch>
					</>
				);
			}}
		</Doc>
	);
};

interface SubmissionCodeProps {
	gameId: string,
	submissionId: string,
	originalBinary: Uint8Array | undefined,
}

// Shows the submitted binary. Rendered only when the user is permitted to read it.
const SubmissionCode = (props: SubmissionCodeProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const [code] = createResource(
		() => props.submissionId,
		async (submissionId) => {
			const codeRef = doc(db, 'games', props.gameId, 'submissionCodes', submissionId) as DocumentReference<BitflipProconSubmissionCode>;
			const codeDoc = await getDoc(codeRef);
			return codeDoc.data()?.code.toUint8Array() ?? null;
		},
	);

	const downloadUrl = createMemo(() => {
		const codeData = code.error ? null : code();
		if (!codeData) {
			return null;
		}
		const url = URL.createObjectURL(new Blob([new Uint8Array(codeData)], {type: 'application/octet-stream'}));
		onCleanup(() => URL.revokeObjectURL(url));
		return url;
	});

	const diff = createMemo(() => {
		const codeData = code.error ? null : code();
		const original = props.originalBinary;
		if (!codeData || !original) {
			return null;
		}

		const rows: {offset: number, original: number | undefined, submitted: number | undefined, bitflips: number}[] = [];
		let count = 0;
		const length = Math.max(codeData.length, original.length);
		for (let offset = 0; offset < length; offset++) {
			const originalByte = original.at(offset);
			const submittedByte = codeData.at(offset);
			if (originalByte === submittedByte) {
				continue;
			}
			count++;
			if (rows.length < MAX_DIFF_ROWS) {
				rows.push({
					offset,
					original: originalByte,
					submitted: submittedByte,
					bitflips: originalByte === undefined || submittedByte === undefined
						? 8
						: countBitflips(Uint8Array.of(originalByte), Uint8Array.of(submittedByte)),
				});
			}
		}

		return {rows, count};
	});

	return (
		<Switch>
			<Match when={code.loading}>
				<CircularProgress size={24}/>
			</Match>
			<Match when={code.error || !code()}>
				<Alert severity="warning">提出バイナリを読み込めませんでした。</Alert>
			</Match>
			<Match when>
				<Show when={downloadUrl()} keyed>
					{(url) => (
						<Button
							variant="outlined"
							component="a"
							href={url}
							download={`submission-${props.submissionId}`}
						>
							提出バイナリをダウンロードする
						</Button>
					)}
				</Show>
				<Show when={diff()} keyed>
					{(diffData) => (
						<>
							<Typography variant="h4" component="h2" my={1}>Diff</Typography>
							<Show when={diffData.count > diffData.rows.length}>
								<p>変更された {diffData.count} bytes のうち、最初の {diffData.rows.length} bytes を表示しています。</p>
							</Show>
							<TableContainer component={Paper}>
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Offset</TableCell>
											<TableCell>Original</TableCell>
											<TableCell>Submitted</TableCell>
											<TableCell align="right">Bitflips</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										<For each={diffData.rows}>
											{(row) => (
												<TableRow>
													<TableCell class={styles.mono}>0x{formatHex(row.offset, 8)}</TableCell>
													<TableCell class={styles.mono}>{formatByte(row.original)}</TableCell>
													<TableCell class={styles.mono}>{formatByte(row.submitted)}</TableCell>
													<TableCell align="right">{row.bitflips}</TableCell>
												</TableRow>
											)}
										</For>
									</TableBody>
								</Table>
							</TableContainer>
						</>
					)}
				</Show>
			</Match>
		</Switch>
	);
};

interface SubmissionsTabProps {
	submissions: Submissions,
	phase: Phase,
	originalBinary: Uint8Array | undefined,
}

const SubmissionsTab = (props: SubmissionsTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const user = useUser();

	const handleClickSubmission = (submissionId: string, event: MouseEvent) => {
		event.preventDefault();
		setSearchParams({submissionId});
	};

	return (
		<Switch>
			<Match when={typeof searchParams.submissionId === 'string' && searchParams.submissionId} keyed>
				{(submissionId) => {
					const submission = createMemo(() => (
						props.submissions?.data?.find(({id}) => submissionId === id)
					));

					const isCodeVisible = createMemo(() => {
						const submissionData = submission();
						return submissionData !== undefined && (
							props.phase === 'finished' || submissionData.userId === user()?.uid
						);
					});

					return (
						<div class={styles.submission}>
							<LinkUi
								href="#"
								underline="hover"
								onClick={(event) => {
									event.preventDefault();
									setSearchParams({submissionId: undefined});
								}}
							>
								提出一覧に戻る
							</LinkUi>
							<Show when={submission()} keyed>
								{(submissionData) => (
									<>
										<Typography variant="h4" component="h2" my={1}>Author</Typography>
										<Username userId={submissionData.userId}/>
										<Typography variant="h4" component="h2" my={1}>Date</Typography>
										<p>{dayjs(submissionData.createdAt?.toDate()).format('YYYY-MM-DD HH:mm:ss')}</p>
										<Typography variant="h4" component="h2" my={1}>Status</Typography>
										<p>{submissionData.status}</p>
										<Typography variant="h4" component="h2" my={1}>Size</Typography>
										<p>{submissionData.size} bytes</p>
										<Typography variant="h4" component="h2" my={1}>Bitflips</Typography>
										<p>{submissionData.bitflips ?? '-'}</p>
										<Show when={submissionData.errorMessage}>
											<Typography variant="h4" component="h2" my={1}>Error</Typography>
											<pre class={styles.output}>{submissionData.errorMessage}</pre>
										</Show>
										<Typography variant="h4" component="h2" my={1}>Testcases</Typography>
										<TableContainer component={Paper}>
											<Table size="small">
												<TableHead>
													<TableRow>
														<TableCell>Name</TableCell>
														<TableCell>Status</TableCell>
														<TableCell align="right">Time</TableCell>
														<TableCell>Stdout</TableCell>
														<TableCell>Stderr</TableCell>
													</TableRow>
												</TableHead>
												<TableBody>
													<For each={submissionData.testcases}>
														{(testcase) => (
															<TableRow>
																<TableCell>{testcase.name}</TableCell>
																<TableCell><strong>{testcase.status}</strong></TableCell>
																<TableCell align="right">{testcase.duration === null ? '-' : `${testcase.duration}ms`}</TableCell>
																<TableCell>
																	<Show when={testcase.isSample} fallback="(hidden)">
																		<pre class={styles.output}>{testcase.stdout}</pre>
																	</Show>
																</TableCell>
																<TableCell>
																	<Show when={testcase.isSample} fallback="(hidden)">
																		<pre class={styles.output}>{testcase.stderr}</pre>
																	</Show>
																</TableCell>
															</TableRow>
														)}
													</For>
												</TableBody>
											</Table>
										</TableContainer>
										<Typography variant="h4" component="h2" my={1}>Binary</Typography>
										<Show
											when={isCodeVisible()}
											fallback={<p>他の参加者の提出バイナリは競技終了後に公開されます。</p>}
										>
											<SubmissionCode
												gameId={searchParams.gameId as string}
												submissionId={submissionId}
												originalBinary={props.originalBinary}
											/>
										</Show>
									</>
								)}
							</Show>
						</div>
					);
				}}
			</Match>
			<Match when>
				<TableContainer component={Paper}>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>User</TableCell>
								<TableCell align="right">Size</TableCell>
								<TableCell align="right">Bitflips</TableCell>
								<TableCell align="right">Status</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission) => (
									<TableRow sx={submission.userId === user()?.uid ? {backgroundColor: blue[50]} : {}}>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right">{submission.size}</TableCell>
										<TableCell align="right"><strong>{submission.bitflips ?? '-'}</strong></TableCell>
										<TableCell align="right">{submission.status}</TableCell>
										<TableCell align="right">
											<LinkUi
												href="#"
												underline="hover"
												sx={{display: 'inline-box', whiteSpace: 'pre'}}
												onClick={(event) => handleClickSubmission(submission.id, event)}
											>
												{dayjs(submission.createdAt?.toDate()).format('YYYY-MM-DD HH:mm:ss')}
											</LinkUi>
										</TableCell>
									</TableRow>
								)}
							</Collection>
						</TableBody>
					</Table>
				</TableContainer>
			</Match>
		</Switch>
	);
};

const RankingTab = () => {
	const [searchParams] = useSearchParams();
	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const user = useUser();

	const rankingRef = collection(db, `games/${gameId}/ranking`) as CollectionReference<BitflipProconRanking>;
	const rankingDocs = useFirestore(query(rankingRef, orderBy('score', 'asc'), orderBy('createdAt', 'asc')));

	return (
		<TableContainer component={Paper}>
			<Table>
				<TableHead>
					<TableRow>
						<TableCell>#</TableCell>
						<TableCell>User</TableCell>
						<TableCell align="right">Bitflips</TableCell>
						<TableCell align="right">Date</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					<Collection data={rankingDocs}>
						{(ranking, i) => {
							const userData = user();
							const isMe = userData?.uid === ranking.userId;

							return (
								<TableRow sx={isMe ? {backgroundColor: blue[50]} : {}}>
									<TableCell>{i() + 1}</TableCell>
									<TableCell><Username userId={ranking.userId}/></TableCell>
									<TableCell align="right"><strong>{ranking.score}</strong></TableCell>
									<TableCell align="right">
										<Box component="span" sx={{display: 'inline-box', whiteSpace: 'pre'}}>
											{dayjs(ranking.createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}
										</Box>
									</TableCell>
								</TableRow>
							);
						}}
					</Collection>
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const BitflipProcon = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);

	const user = useUser();
	const [submissions, setSubmissions] = createSignal<Submissions>(null);
	const [phase, setPhase] = createSignal<Phase>('loading');
	const [originalBinaryUrl, setOriginalBinaryUrl] = createSignal<string | null>(null);

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	setArenaTitle('bitflip競プロ');

	// Submission statuses of all the participants are public in this game
	createEffect(() => {
		const userData = user();
		if (userData?.uid && (phase() === 'playing' || phase() === 'finished')) {
			setSubmissions(useFirestore(
				query(
					collection(gameRef, 'submissions') as CollectionReference<BitflipProconSubmission>,
					orderBy('createdAt', 'desc'),
				),
			));
		}
	});

	const mainFilename = createMemo(() => {
		if (phase() !== 'playing' && phase() !== 'finished') {
			return null;
		}
		const config = gameData.data?.configuration as BitflipProconConfiguration | undefined;
		return config?.files?.find((file) => file.isMain)?.filename ?? null;
	});

	createEffect(() => {
		const filename = mainFilename();
		if (filename !== null) {
			const urlData = useDownloadURL(ref(storage, `assets/bitflip-procon/${filename}`));
			createEffect(() => {
				if (urlData.latest) {
					setOriginalBinaryUrl(urlData.latest);
				}
			});
		}
	});

	// The challenge binary is used for the bitflip count preview and the diff view
	const [originalBinary] = createResource(originalBinaryUrl, async (url) => {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch the challenge binary: ${response.status}`);
		}
		return new Uint8Array(await response.arrayBuffer());
	});
	const originalBinaryData = createMemo(() => (originalBinary.error ? undefined : originalBinary()));

	createEffect(() => {
		const tab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
		if (!(['main', 'submissions', 'ranking'] as (string | undefined)[]).includes(tab)) {
			setSearchParams({tab: 'main'});
		}
	});

	createEffect(() => {
		if (gameData.loading) {
			return;
		}

		if (!gameData.data || gameData.error) {
			throw new PageNotFoundError();
		}

		if (gameData.data.rule.path !== 'gameRules/bitflip-procon') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');

		if ((gameData.data.configuration as BitflipProconConfiguration).enabled) {
			setPhase('playing');

			if (gameData.data.endAt && gameData.data.endAt.toDate() <= new Date()) {
				setPhase('finished');
			}
		}
	});

	const intervalId = setInterval(() => {
		if (
			phase() === 'playing' &&
			gameData.data?.endAt &&
			gameData.data.endAt.toDate() <= new Date()
		) {
			setPhase('finished');
		}
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	return (
		<Switch>
			<Match when={phase() === 'waiting'}>
				<Typography
					variant="h3"
					component="p"
					textAlign="center"
					py={6}
				>
					競技開始までしばらくお待ち下さい。
				</Typography>
			</Match>
			<Match
				when={phase() === 'playing' || phase() === 'finished'}
			>
				<main>
					<Container maxWidth="lg" sx={{py: 3}}>
						<Alert severity="info">
							与えられた実行ファイルを、なるべく少ないbitflipで問題の条件を満たすプログラムに書き換えて提出してください。
						</Alert>
						<Box textAlign="center" my={1}>
							<ButtonGroup variant="outlined" size="large">
								<Button
									variant={searchParams.tab === 'main' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'main', submissionId: undefined})}
								>
									問題
								</Button>
								<Button
									variant={searchParams.tab === 'submissions' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'submissions'})}
								>
									提出一覧
								</Button>
								<Button
									variant={searchParams.tab === 'ranking' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'ranking', submissionId: undefined})}
								>
									ランキング
								</Button>
							</ButtonGroup>
						</Box>
						<Switch>
							<Match when={searchParams.tab === 'main'}>
								<MainTab submissions={submissions()} phase={phase()} originalBinary={originalBinaryData()}/>
							</Match>
							<Match when={searchParams.tab === 'submissions'}>
								<SubmissionsTab submissions={submissions()} phase={phase()} originalBinary={originalBinaryData()}/>
							</Match>
							<Match when={searchParams.tab === 'ranking'}>
								<RankingTab/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default BitflipProcon;
