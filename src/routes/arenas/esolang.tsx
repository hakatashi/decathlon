import {Link} from '@solidjs/meta';
import {useSearchParams} from '@solidjs/router';
import {
	Alert,
	Box,
	Button,
	ButtonGroup,
	CircularProgress,
	Container,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	InputLabel,
	Link as LinkUi,
	MenuItem,
	Paper,
	Select,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@suid/material';
import {SelectChangeEvent} from '@suid/material/Select';
import {blue, green, red} from '@suid/material/colors';
import dayjs from 'dayjs';
import {
	addDoc,
	Bytes,
	collection,
	CollectionReference,
	doc,
	DocumentReference,
	getFirestore,
	orderBy,
	query,
	serverTimestamp,
	where,
} from 'firebase/firestore';
import remarkGfm from 'remark-gfm';
import {floor} from 'remeda';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {setArenaTitle, useUser} from '../arenas';
import styles from './esolang.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import PageNotFoundError from '~/lib/PageNotFoundError';
import type {
	EsolangBoxLanguage,
	EsolangConfiguration,
	EsolangConfigurationLanguageLanguage,
	EsolangRanking,
	EsolangSubmission,
	EsolangTestSubmission,
	Game,
	UseFireStoreReturn,
} from '~/lib/schema';

const exampleCodeToString = (code: unknown): string => {
	if (typeof code === 'string') {
		return code;
	}
	if (code && typeof (code as {toUint8Array?: unknown}).toUint8Array === 'function') {
		return new TextDecoder().decode((code as {toUint8Array: () => Uint8Array}).toUint8Array());
	}
	if (code instanceof Uint8Array) {
		return new TextDecoder().decode(code);
	}
	return '';
};

const getBytes = (code: unknown): Uint8Array => {
	if (code instanceof Uint8Array) {
		return code;
	}
	if (code && typeof (code as {toUint8Array?: unknown}).toUint8Array === 'function') {
		return (code as {toUint8Array: () => Uint8Array}).toUint8Array();
	}
	if (typeof code === 'string') {
		return new TextEncoder().encode(code);
	}
	return new Uint8Array(0);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

const fileToBytesOrText = async (file: File): Promise<{bytes: Bytes, text: string | null}> => {
	const ab = await file.arrayBuffer();
	const uint8 = new Uint8Array(ab);
	let text: string | null = null;
	try {
		text = new TextDecoder('utf-8', {fatal: true}).decode(uint8);
	} catch {
		// binary file
	}
	return {bytes: Bytes.fromUint8Array(uint8), text};
};

const getAdjacentIndices = (idx: number): number[] => {
	const row = Math.floor(idx / 8);
	const col = idx % 8;
	const result: number[] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) {
				continue;
			}
			const nr = row + dr;
			const nc = col + dc;
			if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
				result.push(nr * 8 + nc);
			}
		}
	}
	return result;
};

interface MainTabProps {
	myRanking: UseFireStoreReturn<EsolangRanking | null | undefined> | null,
	phase: 'loading' | 'waiting' | 'playing' | 'finished',
}

const MainTab = (props: MainTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const user = useUser();

	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const languagesRef = collection(db, 'esolangBoxLanguages') as CollectionReference<EsolangBoxLanguage>;
	const languagesData = useFirestore(languagesRef);

	const langMap = createMemo(() => {
		const langs = languagesData.data;
		if (!Array.isArray(langs)) {
			return new Map<string, EsolangBoxLanguage>();
		}
		return new Map(langs.map((lang) => [lang.id, lang]));
	});

	const allAcquiredCells = createMemo(() => {
		const config = gameData.data?.configuration as EsolangConfiguration | undefined;
		const acquired = new Set<number>();
		if (config) {
			for (let i = 0; i < config.languages.length; i++) {
				if (config.languages[i]?.type === 'base') {
					acquired.add(i);
				}
			}
		}
		const rankingCells = props.myRanking?.data?.acquiredCells;
		if (Array.isArray(rankingCells)) {
			for (const cell of rankingCells) {
				acquired.add(cell);
			}
		}
		return acquired;
	});

	const availableCells = createMemo(() => {
		const config = gameData.data?.configuration as EsolangConfiguration | undefined;
		if (!config) {
			return new Set<number>();
		}
		const acquired = allAcquiredCells();
		const available = new Set<number>();
		for (const idx of acquired) {
			for (const neighborIdx of getAdjacentIndices(idx)) {
				if (config.languages[neighborIdx]?.type === 'language' && !acquired.has(neighborIdx)) {
					available.add(neighborIdx);
				}
			}
		}
		return available;
	});

	const [selectedCell, setSelectedCell] = createSignal<number | null>(null);
	const [dialogOpen, setDialogOpen] = createSignal(false);
	const [code, setCode] = createSignal('');
	const [codeFile, setCodeFile] = createSignal<File | null>(null);
	const [submitStatus, setSubmitStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [lastSubmissionTime, setLastSubmissionTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal(0);
	const [currentSubmission, setCurrentSubmission] =
		createSignal<UseFireStoreReturn<EsolangSubmission | null | undefined> | null>(null);

	let fileInputRef!: HTMLInputElement;
	let descriptionEl!: HTMLElement;

	createEffect(async () => {
		// @ts-expect-error: URL import
		// eslint-disable-next-line import/no-unresolved
		const {default: renderMathInElement} = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
		renderMathInElement(descriptionEl, {
			delimiters: [
				{left: '$$', right: '$$', display: true},
				{left: '$', right: '$', display: false},
			],
		});
	});

	const intervalId = setInterval(() => {
		const lastTime = lastSubmissionTime();
		if (lastTime === null) {
			setThrottleTime(0);
			return;
		}
		const remaining = Math.max(0, 30000 - (Date.now() - lastTime));
		setThrottleTime(remaining);
		if (remaining === 0 && submitStatus() === 'throttled') {
			setSubmitStatus('ready');
		}
	}, 1000);
	onCleanup(() => clearInterval(intervalId));

	createEffect(() => {
		const sub = currentSubmission();
		if (submitStatus() === 'executing') {
			if ((['success', 'failed', 'error', 'invalid'] as (string | undefined)[]).includes(sub?.data?.status)) {
				setSubmitStatus('throttled');
			}
		}
	});

	const handleOpenCell = (idx: number) => {
		setSelectedCell(idx);
		setCode('');
		setCodeFile(null);
		if (fileInputRef) {
			fileInputRef.value = '';
		}
		setCurrentSubmission(null);
		setSubmitStatus('ready');
		setDialogOpen(true);
	};

	const handleCloseDialog = () => {
		setDialogOpen(false);
	};

	const handleSubmit = async () => {
		const cellIdx = selectedCell();
		const uid = user()?.uid;
		if (cellIdx === null || !gameData.data || !uid) {
			return;
		}

		const config = gameData.data.configuration as EsolangConfiguration;
		const cellConfig = config.languages[cellIdx];
		if (cellConfig?.type !== 'language') {
			return;
		}

		const file = codeFile();
		let codeBytes: Bytes;
		if (file) {
			const {bytes} = await fileToBytesOrText(file);
			codeBytes = bytes;
		} else {
			if (code().length === 0) {
				return;
			}
			codeBytes = Bytes.fromUint8Array(new TextEncoder().encode(code()));
		}

		setCurrentSubmission(null);
		setSubmitStatus('executing');

		const submissionRef = await addDoc(
			collection(gameRef, 'submissions') as CollectionReference<EsolangSubmission>,
			{
				athlon: gameData.data.athlon,
				userId: uid,
				status: 'pending',
				languageIndex: cellIdx,
				languageId: cellConfig.id,
				code: codeBytes,
				testcases: [],
				createdAt: serverTimestamp(),
				executedAt: null,
			},
		);

		setLastSubmissionTime(Date.now());
		setCurrentSubmission(useFirestore(submissionRef));
	};

	const selectedLang = createMemo(() => {
		const idx = selectedCell();
		if (idx === null) {
			return null;
		}
		const config = gameData.data?.configuration as EsolangConfiguration | undefined;
		const cellConfig = config?.languages[idx];
		if (cellConfig?.type !== 'language') {
			return null;
		}
		return langMap().get(cellConfig.id) ?? null;
	});

	const selectedCellIsAcquired = createMemo(() => {
		const idx = selectedCell();
		if (idx === null) {
			return false;
		}
		return allAcquiredCells().has(idx);
	});

	const selectedCellIsAvailable = createMemo(() => {
		const idx = selectedCell();
		if (idx === null) {
			return false;
		}
		return availableCells().has(idx);
	});

	const hasCode = createMemo(() => codeFile() !== null || code().length > 0);

	const handleFilenameClick = (lang: EsolangBoxLanguage, example: EsolangBoxLanguage['examples'][number]) => {
		const codeBytes = getBytes(example.code);
		const base64Code = bytesToBase64(codeBytes);
		handleCloseDialog();
		setSearchParams({
			tab: 'test',
			submissionId: undefined,
			testLanguageId: lang.id,
			testCode: base64Code,
			testStdin: example.stdin ?? '',
		});
	};

	return (
		<Doc data={gameData}>
			{(game) => {
				const config = game.configuration as EsolangConfiguration;

				return (
					<>
						<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
						<Typography variant="body1" ref={descriptionEl}>
							<SolidMarkdown
								class="markdown"
								children={config.description}
								remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
						</Typography>
						<Box sx={{mt: 2}}>
							<div class={styles.grid}>
								<For each={Array.from({length: 64}, (_, i) => i)}>
									{(i) => {
										const cellConfig = config.languages[i];
										const isBase = cellConfig?.type === 'base';
										const isAcquired = createMemo(() => allAcquiredCells().has(i));
										const isAvailable = createMemo(() => availableCells().has(i));

										const lang = createMemo(() => {
											if (cellConfig?.type !== 'language') {
												return null;
											}
											return langMap().get(cellConfig.id) ?? null;
										});

										const cellClass = createMemo(() => {
											if (isBase) {
												return `${styles.cell} ${styles.cellBase}`;
											}
											if (isAcquired()) {
												return `${styles.cell} ${styles.cellAcquired} ${styles.cellLanguage}`;
											}
											if (isAvailable()) {
												return `${styles.cell} ${styles.cellAvailable}`;
											}
											return `${styles.cell} ${styles.cellUnavailable}${cellConfig?.type === 'language' ? ` ${styles.cellLanguage}` : ''}`;
										});

										return (
											<div
												class={cellClass()}
												onClick={() => {
													if (cellConfig?.type === 'language') {
														handleOpenCell(i);
													}
												}}
											>
												<Show when={cellConfig?.type === 'language'}>
													<span class={styles.cellName}>
														{lang()?.name ?? (cellConfig as EsolangConfigurationLanguageLanguage).id}
													</span>
													<Show when={lang()}>
														<span class={styles.cellWeight}>{lang()?.weight}</span>
													</Show>
												</Show>
											</div>
										);
									}}
								</For>
							</div>
						</Box>
						<Show when={props.myRanking?.data}>
							{(ranking) => (
								<Typography variant="body2" sx={{mt: 1, color: 'text.secondary'}}>
									取得済みマス: {ranking().acquiredCells.length}個 /
									スコア: {floor(ranking().score, 2).toFixed(2)}
								</Typography>
							)}
						</Show>

						<Dialog open={dialogOpen()} onClose={handleCloseDialog} maxWidth="md" fullWidth>
							<DialogTitle>
								<Show when={selectedLang()} keyed>
									{(lang) => (
										<>
											{lang.name}
											<Typography variant="body2" component="span" sx={{ml: 1, color: 'text.secondary'}}>
												Weight: {lang.weight}
											</Typography>
										</>
									)}
								</Show>
							</DialogTitle>
							<DialogContent>
								<Show when={selectedLang()} keyed>
									{(lang) => (
										<Stack spacing={2}>
											<Box>
												<Typography variant="body2" color="text.secondary">リファレンス</Typography>
												<LinkUi href={lang.link} target="_blank" rel="noopener noreferrer">
													{lang.link}
												</LinkUi>
											</Box>
											<Show when={lang.examples.length > 0}>
												<Divider/>
												<Typography variant="subtitle2">サンプルプログラム</Typography>
												<For each={lang.examples}>
													{(example) => (
														<Box>
															<Typography
																variant="body2"
																sx={{
																	cursor: 'pointer',
																	color: 'primary.main',
																	textDecoration: 'underline',
																	display: 'inline',
																}}
																onClick={() => handleFilenameClick(lang, example)}
															>
																{example.filename}
															</Typography>
															<Show
																when={example.isPrintable}
																fallback={
																	<Typography variant="body2">
																		<LinkUi
																			href={`https://github.com/hakatashi/esolang-box/blob/master/boxes/${lang.id}/assets/${example.filename}`}
																			target="_blank"
																			rel="noopener noreferrer"
																		>
																			ソースコードを GitHub で見る
																		</LinkUi>
																	</Typography>
																}
															>
																<pre
																	style={{
																		'font-size': '0.8rem',
																		overflow: 'auto',
																		background: '#f5f5f5',
																		padding: '8px',
																		'border-radius': '4px',
																	}}
																>
																	{exampleCodeToString(example.code)}
																</pre>
															</Show>
															<Show when={example.stdin}>
																<Typography variant="body2" color="text.secondary">
																	stdin: <code>{example.stdin}</code>
																</Typography>
															</Show>
															<Typography variant="body2" color="text.secondary">
																stdout: <code>{example.stdout}</code>
															</Typography>
														</Box>
													)}
												</For>
											</Show>
											<Divider/>
											<Show when={selectedCellIsAcquired()}>
												<Alert severity="success">このマスはすでに獲得済みです。</Alert>
											</Show>
											<Show when={!selectedCellIsAcquired() && !selectedCellIsAvailable()}>
												<Alert severity="info">
													このマスはまだ解放されていません。隣接するマスを先に獲得してください。
												</Alert>
											</Show>
											<Show when={!selectedCellIsAcquired() && selectedCellIsAvailable()}>
												<Stack spacing={1}>
													<TextField
														label="提出コード"
														multiline
														minRows={4}
														value={codeFile() ? `[ファイル: ${codeFile()?.name ?? ''}]` : code()}
														onChange={(_event, value) => {
															if (!codeFile()) {
																setCode(value);
															}
														}}
														disabled={props.phase === 'finished' || submitStatus() === 'executing' || codeFile() !== null}
														// @ts-expect-error: type error
														sx={{
															width: '100%',
															'& textarea': {'font-family': 'monospace', 'line-height': '1em'},
														}}
													/>
													<Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
														<input
															ref={(el) => {
																fileInputRef = el;
															}}
															type="file"
															style={{display: 'none'}}
															onChange={(event) => setCodeFile(event.currentTarget.files?.[0] ?? null)}
														/>
														<Button
															size="small"
															variant="outlined"
															disabled={props.phase === 'finished' || submitStatus() === 'executing'}
															onClick={() => fileInputRef.click()}
														>
															ファイルを選択
														</Button>
														<Show when={codeFile()}>
															<Typography variant="body2" component="span">{codeFile()?.name ?? ''}</Typography>
															<Button
																size="small"
																color="error"
																onClick={() => {
																	setCodeFile(null);
																	if (fileInputRef) {
																		fileInputRef.value = '';
																	}
																}}
															>
																クリア
															</Button>
														</Show>
													</Box>
												</Stack>
												<Show when={submitStatus() !== 'executing' && currentSubmission() !== null}>
													<Doc data={currentSubmission()}>
														{(sub) => (
															<Alert severity={sub.status === 'success' ? 'success' : 'error'}>
																<Switch>
																	<Match when={sub.status === 'success'}>
																		提出成功！マスを獲得しました。
																	</Match>
																	<Match when={sub.status === 'invalid'}>
																		提出無効: {sub.errorMessage}
																	</Match>
																	<Match when>
																		提出失敗
																	</Match>
																</Switch>
															</Alert>
														)}
													</Doc>
												</Show>
											</Show>
										</Stack>
									)}
								</Show>
							</DialogContent>
							<DialogActions>
								<Button onClick={handleCloseDialog}>閉じる</Button>
								<Show when={!selectedCellIsAcquired() && selectedCellIsAvailable() && props.phase !== 'finished'}>
									<Switch>
										<Match when={submitStatus() === 'ready'}>
											<Button
												onClick={handleSubmit}
												variant="contained"
												disabled={!hasCode()}
											>
												送信
											</Button>
										</Match>
										<Match when={submitStatus() === 'executing'}>
											<Button variant="contained" disabled>
												<CircularProgress
													color="secondary"
													sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}
												/>
												実行中
											</Button>
										</Match>
										<Match when={submitStatus() === 'throttled'}>
											<Button variant="contained" disabled>
												<CircularProgress
													variant="determinate"
													value={(1 - throttleTime() / 30000) * 100}
													color="secondary"
													sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}
												/>
												待機中⋯⋯
											</Button>
										</Match>
									</Switch>
								</Show>
								<Show when={props.phase === 'finished'}>
									<Button variant="contained" disabled>競技は終了しました</Button>
								</Show>
							</DialogActions>
						</Dialog>
					</>
				);
			}}
		</Doc>
	);
};

interface SubmissionsTabProps {
	submissions: UseFireStoreReturn<EsolangSubmission[] | null | undefined> | null,
}

const SubmissionsTab = (props: SubmissionsTabProps) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const languagesRef = collection(db, 'esolangBoxLanguages') as CollectionReference<EsolangBoxLanguage>;
	const languagesData = useFirestore(languagesRef);

	const langMap = createMemo(() => {
		const langs = languagesData.data;
		if (!Array.isArray(langs)) {
			return new Map<string, EsolangBoxLanguage>();
		}
		return new Map(langs.map((lang) => [lang.id, lang]));
	});

	const handleClickSubmission = (submissionId: string, event: MouseEvent) => {
		event.preventDefault();
		setSearchParams({submissionId});
	};

	return (
		<Switch>
			<Match when={searchParams.submissionId} keyed>
				{(submissionId) => {
					const submission = createMemo(() => (
						props.submissions?.data?.find(({id}) => submissionId === id)
					));

					return (
						<div class={styles.submission}>
							<LinkUi
								href="#"
								underline="hover"
								onClick={() => setSearchParams({submissionId: undefined})}
							>
								提出一覧に戻る
							</LinkUi>
							<Typography variant="h4" component="h2" my={1}>Author</Typography>
							<Show when={submission()} keyed>
								{({userId}) => <Username userId={userId}/>}
							</Show>
							<Typography variant="h4" component="h2" my={1}>Date</Typography>
							<Show when={submission()?.createdAt} keyed>
								{(createdAt) => <p>{dayjs(createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}</p>}
							</Show>
							<Typography variant="h4" component="h2" my={1}>Status</Typography>
							<p>{submission()?.status}</p>
							<Typography variant="h4" component="h2" my={1}>Language</Typography>
							<p>{langMap().get(submission()?.languageId ?? '')?.name ?? submission()?.languageId}</p>
							<Typography variant="h4" component="h2" my={1}>Code</Typography>
							<pre>{exampleCodeToString(submission()?.code)}</pre>
							<Show when={submission()?.errorMessage}>
								<Typography variant="h4" component="h2" my={1}>Error</Typography>
								<pre>{submission()?.errorMessage}</pre>
							</Show>
							<For each={submission()?.testcases}>
								{(testcase, i) => (
									<>
										<Typography variant="h4" component="h2" my={1}>Test Case {i() + 1}</Typography>
										<Typography variant="h5" component="h3" my={1}>Execution Time</Typography>
										<p>{testcase.duration}ms</p>
										<Typography variant="h5" component="h3" my={1}>stdin</Typography>
										<pre>{testcase.stdin}</pre>
										<Typography variant="h5" component="h3" my={1}>stdout</Typography>
										<pre>{testcase.stdout}</pre>
										<Typography variant="h5" component="h3" my={1}>stderr</Typography>
										<pre>{testcase.stderr}</pre>
									</>
								)}
							</For>
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
								<TableCell align="right">Language</TableCell>
								<TableCell align="right">Status</TableCell>
								<TableCell align="right">Date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							<Collection data={props.submissions}>
								{(submission) => (
									<TableRow
										sx={{backgroundColor: submission.status === 'success' ? green[50] : red[50]}}
									>
										<TableCell><Username userId={submission.userId}/></TableCell>
										<TableCell align="right">
											<strong>{langMap().get(submission.languageId)?.name ?? submission.languageId}</strong>
										</TableCell>
										<TableCell align="right">{submission.status}</TableCell>
										<TableCell align="right">
											<LinkUi
												href="#"
												underline="hover"
												sx={{display: 'inline-box', whiteSpace: 'pre'}}
												onClick={(event) => handleClickSubmission(submission.id, event)}
											>
												{dayjs(submission.createdAt.toDate()).format('YYYY-MM-DD HH:mm:ss')}
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
	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const user = useUser();

	const rankingRef = collection(db, `games/${gameId}/ranking`) as CollectionReference<EsolangRanking>;
	const rankingDocs = useFirestore(query(rankingRef, orderBy('score', 'desc'), orderBy('updatedAt', 'asc')));

	return (
		<TableContainer component={Paper}>
			<Table>
				<TableHead>
					<TableRow>
						<TableCell>#</TableCell>
						<TableCell>User</TableCell>
						<TableCell align="right">取得マス数</TableCell>
						<TableCell align="right">Score</TableCell>
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
									<TableCell align="right">{ranking.acquiredCells.length}</TableCell>
									<TableCell align="right"><strong>{floor(ranking.score, 2).toFixed(2)}</strong></TableCell>
								</TableRow>
							);
						}}
					</Collection>
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const TestTab = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const user = useUser();

	const languagesRef = collection(db, 'esolangBoxLanguages') as CollectionReference<EsolangBoxLanguage>;
	const languagesData = useFirestore(languagesRef);

	const [searchParams] = useSearchParams();
	const gameId = Array.isArray(searchParams.gameId) ? searchParams.gameId[0] : searchParams.gameId;
	const gameRef = doc(db, 'games', gameId ?? '') as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const sortedLanguages = createMemo(() => {
		const langs = languagesData.data;
		if (!Array.isArray(langs)) {
			return [];
		}
		return [...langs].sort((a, b) => a.name.localeCompare(b.name));
	});

	const languagesList = createMemo(() => {
		const languagesMap = new Map(
			sortedLanguages().map((language) => (
				[language.id, language]
			)),
		);

		const gameConfiguration = gameData?.data?.configuration as EsolangConfiguration | undefined;
		if (!gameConfiguration?.languages) {
			return [];
		}

		return gameConfiguration.languages
			.filter((language) => language.type === 'language')
			.sort((a, b) => a.id.localeCompare(b.id))
			.map((language) => languagesMap.get(language.id));
	});

	const [selectedLanguageId, setSelectedLanguageId] = createSignal('');
	const [code, setCode] = createSignal('');
	const [codeFile, setCodeFile] = createSignal<File | null>(null);
	const [stdin, setStdin] = createSignal('');
	const [testStatus, setTestStatus] = createSignal<'ready' | 'executing' | 'throttled'>('ready');
	const [lastTestTime, setLastTestTime] = createSignal<number | null>(null);
	const [throttleTime, setThrottleTime] = createSignal(0);
	const [testResult, setTestResult] =
		createSignal<UseFireStoreReturn<EsolangTestSubmission | null | undefined> | null>(null);
	const [initialized, setInitialized] = createSignal(false);

	let testFileInputRef!: HTMLInputElement;
	let executingTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Initialize from URL params (e.g. after clicking a sample filename)
	createEffect(() => {
		const langs = languagesList();
		if (langs.length > 0 && !initialized()) {
			setInitialized(true);
			const rawLangId = searchParams.testLanguageId;
			const rawCode = searchParams.testCode;
			const rawStdin = searchParams.testStdin;

			const testLangId = Array.isArray(rawLangId) ? rawLangId[0] : rawLangId;
			const testCodeB64 = Array.isArray(rawCode) ? rawCode[0] : rawCode;
			const testStdin = Array.isArray(rawStdin) ? rawStdin[0] : rawStdin;

			if (testLangId) {
				setSelectedLanguageId(testLangId);
			}
			if (testCodeB64) {
				try {
					const bytes = base64ToBytes(testCodeB64);
					let text: string | null = null;
					try {
						text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
					} catch {
						// binary - create a File object
					}
					if (text === null) {
						const blob = new Blob([new Uint8Array(bytes)]);
						const file = new File([blob], 'code.bin');
						setCodeFile(file);
						setCode('');
					} else {
						setCode(text);
						setCodeFile(null);
					}
				} catch {
					// ignore invalid base64
				}
			}
			if (testStdin) {
				setStdin(testStdin);
			}
		}
	});

	const intervalId = setInterval(() => {
		const lastTime = lastTestTime();
		if (lastTime === null) {
			setThrottleTime(0);
			return;
		}
		const remaining = Math.max(0, 10000 - (Date.now() - lastTime));
		setThrottleTime(remaining);
		if (remaining === 0 && testStatus() === 'throttled') {
			setTestStatus('ready');
		}
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
		if (executingTimeoutId !== null) {
			clearTimeout(executingTimeoutId);
		}
	});

	createEffect(() => {
		const result = testResult();
		if (testStatus() === 'executing') {
			if ((['success', 'error'] as (string | undefined)[]).includes(result?.data?.status)) {
				if (executingTimeoutId !== null) {
					clearTimeout(executingTimeoutId);
					executingTimeoutId = null;
				}
				setTestStatus('throttled');
			}
		}
	});

	const hasCode = createMemo(() => codeFile() !== null || code().length > 0);

	const handleTest = async () => {
		const uid = user()?.uid;
		const languageId = selectedLanguageId();
		if (!uid || !languageId || !hasCode()) {
			return;
		}

		const file = codeFile();
		let codeBytes: Bytes;
		if (file) {
			const {bytes} = await fileToBytesOrText(file);
			codeBytes = bytes;
		} else {
			codeBytes = Bytes.fromUint8Array(new TextEncoder().encode(code()));
		}

		setTestResult(null);
		setTestStatus('executing');

		if (executingTimeoutId !== null) {
			clearTimeout(executingTimeoutId);
		}
		executingTimeoutId = setTimeout(() => {
			executingTimeoutId = null;
			if (testStatus() === 'executing') {
				setTestStatus('throttled');
			}
		}, 90000);

		const testRef = await addDoc(
			collection(db, 'esolangTestSubmissions') as CollectionReference<EsolangTestSubmission>,
			{
				userId: uid,
				languageId,
				code: codeBytes,
				stdin: stdin(),
				status: 'pending',
				stdout: null,
				stderr: null,
				duration: null,
				createdAt: serverTimestamp(),
			},
		);

		setLastTestTime(Date.now());
		setTestResult(useFirestore(testRef));
	};

	const handleChangeLanguage = (event: SelectChangeEvent) => {
		setSelectedLanguageId(event.target.value);
	};

	return (
		<Stack spacing={2} sx={{mt: 2}}>
			<FormControl fullWidth>
				<InputLabel>言語</InputLabel>
				<Select value={selectedLanguageId()} onChange={handleChangeLanguage} label="言語">
					<For each={languagesList()}>
						{(lang) => (
							<MenuItem value={lang?.id}>{lang?.name}</MenuItem>
						)}
					</For>
				</Select>
			</FormControl>
			<Stack spacing={1}>
				<TextField
					label="コード"
					multiline
					minRows={6}
					value={codeFile() ? `[ファイル: ${codeFile()?.name ?? ''}]` : code()}
					onChange={(_event, value) => {
						if (!codeFile()) {
							setCode(value);
						}
					}}
					disabled={testStatus() === 'executing' || codeFile() !== null}
					// @ts-expect-error: type error
					sx={{
						width: '100%',
						'& textarea': {'font-family': 'monospace', 'line-height': '1em'},
					}}
				/>
				<Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
					<input
						ref={(el) => {
							testFileInputRef = el;
						}}
						type="file"
						style={{display: 'none'}}
						onChange={(event) => setCodeFile(event.currentTarget.files?.[0] ?? null)}
					/>
					<Button
						size="small"
						variant="outlined"
						disabled={testStatus() === 'executing'}
						onClick={() => testFileInputRef.click()}
					>
						ファイルを選択
					</Button>
					<Show when={codeFile()}>
						<Typography variant="body2" component="span">{codeFile()?.name ?? ''}</Typography>
						<Button
							size="small"
							color="error"
							onClick={() => {
								setCodeFile(null);
								if (testFileInputRef) {
									testFileInputRef.value = '';
								}
							}}
						>
							クリア
						</Button>
					</Show>
				</Box>
			</Stack>
			<TextField
				label="標準入力 (stdin)"
				multiline
				minRows={2}
				value={stdin()}
				onChange={(_event, value) => setStdin(value)}
				disabled={testStatus() === 'executing'}
				// @ts-expect-error: type error
				sx={{
					width: '100%',
					'& textarea': {'font-family': 'monospace', 'line-height': '1em'},
				}}
			/>
			<Box>
				<Switch>
					<Match when={testStatus() === 'ready'}>
						<Button
							onClick={handleTest}
							variant="contained"
							disabled={selectedLanguageId() === '' || !hasCode()}
						>
							実行
						</Button>
					</Match>
					<Match when={testStatus() === 'executing'}>
						<Button variant="contained" disabled>
							<CircularProgress color="secondary" sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}/>
							実行中
						</Button>
					</Match>
					<Match when={testStatus() === 'throttled'}>
						<Button variant="contained" disabled>
							<CircularProgress
								variant="determinate"
								value={(1 - throttleTime() / 30000) * 100}
								color="secondary"
								sx={{color: 'inherit', width: '16px', height: '16px', mr: 1}}
							/>
							待機中⋯⋯
						</Button>
					</Match>
				</Switch>
			</Box>
			<Show when={testStatus() !== 'executing' && testResult() !== null}>
				<Doc data={testResult()}>
					{(result) => (
						<Stack spacing={1}>
							<Alert severity={result.status === 'success' ? 'success' : 'error'}>
								<Switch>
									<Match when={result.status === 'success'}>実行完了 ({result.duration}ms)</Match>
									<Match when>実行エラー: {result.errorMessage}</Match>
								</Switch>
							</Alert>
							<Show when={result.stdout !== null}>
								<Box>
									<Typography variant="subtitle2">stdout</Typography>
									<pre
										style={{
											'font-size': '0.85rem',
											background: '#f5f5f5',
											padding: '8px',
											'border-radius': '4px',
											overflow: 'auto',
											'max-height': '300px',
										}}
									>
										{result.stdout}
									</pre>
								</Box>
							</Show>
							<Show when={result.stderr}>
								<Box>
									<Typography variant="subtitle2">stderr</Typography>
									<pre
										style={{
											'font-size': '0.85rem',
											background: '#fff3e0',
											padding: '8px',
											'border-radius': '4px',
											overflow: 'auto',
											'max-height': '200px',
										}}
									>
										{result.stderr}
									</pre>
								</Box>
							</Show>
						</Stack>
					)}
				</Doc>
			</Show>
		</Stack>
	);
};

const Esolang = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const user = useUser();

	const [phase, setPhase] = createSignal<'loading' | 'waiting' | 'playing' | 'finished'>('loading');
	const [submissions, setSubmissions] =
		createSignal<UseFireStoreReturn<EsolangSubmission[] | null | undefined> | null>(null);
	const [myRanking, setMyRanking] =
		createSignal<UseFireStoreReturn<EsolangRanking | null | undefined> | null>(null);

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const isGameAdmin = createMemo(() => {
		const uid = user()?.uid;
		const admins = gameData.data?.admins;
		if (!uid || !admins) {
			return false;
		}
		return admins.includes(uid);
	});

	const effectivePhase = createMemo(() => {
		if (phase() === 'waiting' && isGameAdmin()) {
			return 'playing' as const;
		}
		return phase();
	});

	const adminViewingUnpublished = createMemo(() => phase() === 'waiting' && isGameAdmin());

	setArenaTitle('難解プログラミング言語');

	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			const rankingRef = doc(db, `games/${gameId}/ranking/${userData.uid}`) as DocumentReference<EsolangRanking>;
			setMyRanking(useFirestore(rankingRef));

			if (effectivePhase() === 'playing') {
				setSubmissions(useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<EsolangSubmission>,
						where('userId', '==', userData.uid),
						orderBy('createdAt', 'desc'),
					),
				));
			} else if (effectivePhase() === 'finished') {
				setSubmissions(useFirestore(
					query(
						collection(gameRef, 'submissions') as CollectionReference<EsolangSubmission>,
						orderBy('createdAt', 'desc'),
					),
				));
			}
		}
	});

	createEffect(() => {
		const tab = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
		if (!(['main', 'submissions', 'ranking', 'test'] as (string | undefined)[]).includes(tab)) {
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

		if (gameData.data.rule.path !== 'gameRules/esolang') {
			throw new PageNotFoundError();
		}

		setPhase('waiting');

		if ((gameData.data.configuration as EsolangConfiguration).enabled) {
			setPhase('playing');

			if (gameData.data.endAt && gameData.data.endAt.toDate() <= new Date()) {
				setPhase('finished');
			}
		}
	});

	const intervalId = setInterval(() => {
		if (phase() === 'playing' && gameData.data?.endAt && gameData.data.endAt.toDate() <= new Date()) {
			setPhase('finished');
		}
	}, 1000);
	onCleanup(() => clearInterval(intervalId));

	return (
		<Switch>
			<Match when={effectivePhase() === 'waiting'}>
				<Typography variant="h3" component="p" textAlign="center" py={6}>
					競技開始までしばらくお待ち下さい。
				</Typography>
			</Match>
			<Match when={effectivePhase() === 'playing' || effectivePhase() === 'finished'}>
				<main>
					<Container maxWidth="lg" sx={{py: 3}}>
						<Show when={adminViewingUnpublished()}>
							<Alert severity="warning" sx={{mb: 1}}>
								この競技はまだ公開されていません。あなたはこのゲームのadminのため、閲覧・提出が可能です。
							</Alert>
						</Show>
						<Alert severity="info" sx={{mb: 2}}>
							盤面上のプログラミング言語でコードを提出し、マスを獲得してください。
							獲得済みのマスに隣接するマス（青色）のみ提出できます。
						</Alert>
						<Box textAlign="center" my={1}>
							<ButtonGroup variant="outlined" size="large">
								<Button
									variant={searchParams.tab === 'main' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'main', submissionId: undefined})}
								>
									盤面
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
								<Button
									variant={searchParams.tab === 'test' ? 'contained' : 'outlined'}
									onClick={() => setSearchParams({tab: 'test', submissionId: undefined})}
								>
									コードテスト
								</Button>
							</ButtonGroup>
						</Box>
						<Switch>
							<Match when={searchParams.tab === 'main'}>
								<MainTab myRanking={myRanking()} phase={effectivePhase()}/>
							</Match>
							<Match when={searchParams.tab === 'submissions'}>
								<SubmissionsTab submissions={submissions()}/>
							</Match>
							<Match when={searchParams.tab === 'ranking'}>
								<RankingTab/>
							</Match>
							<Match when={searchParams.tab === 'test'}>
								<TestTab/>
							</Match>
						</Switch>
					</Container>
				</main>
			</Match>
		</Switch>
	);
};

export default Esolang;
