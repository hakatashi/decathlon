import {useSearchParams} from '@solidjs/router';
import {AutoFixNormal, Circle, Create, CropSquare, Delete, FormatColorFill, HorizontalRule, RadioButtonUnchecked, Redo, Send, Square, Undo} from '@suid/icons-material';
import {
	Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
	IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, setDoc} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack} from 'solid-js';
import type {JSX} from 'solid-js';
import {setArenaTitle, setHeaderText, useUser} from '../arenas';
import styles from './cnn-reversing.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageNotFoundError from '~/lib/PageNotFoundError';
import {Bitmap, drawEllipse, drawLine, drawRect, floodFill, Point, renderBitmap, Segment, stamp} from '~/lib/bitmapPaint';
import {CNN_IMAGE_SIZE, CnnModel, decodeCnnImage, encodeCnnImage, parseCnnModel, runCnn} from '~/lib/cnn';
import type {CnnReversingConfiguration, CnnReversingSubmission, Game, Score, UseFireStoreReturn, User} from '~/lib/schema';

const SIZE = CNN_IMAGE_SIZE;
const BRUSH_SIZES = [1, 2, 3, 4, 6, 8, 12];
const MAX_UNDO = 100;

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'filledRect' | 'ellipse' | 'filledEllipse' | 'fill';
type Phase = 'loading' | 'waiting' | 'playing' | 'submitting' | 'finished';

interface Evaluation {
	score: number,
	image: string,
	elapsed: number,
}

const storageKey = (gameId: string, key: string) => `cnn-reversing_${gameId}_${key}`;

const loadEvaluations = (gameId: string): Evaluation[] => {
	try {
		const saved = localStorage.getItem(storageKey(gameId, 'evaluations'));
		return saved ? JSON.parse(saved) as Evaluation[] : [];
	} catch {
		return [];
	}
};

const formatScore = (score: number) => score.toFixed(3);

const formatElapsed = (ms: number) => {
	const seconds = Math.floor(ms / 1000);
	return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

interface BitmapImageProps {
	image: string,
	class?: string,
}

const BitmapImage = (props: BitmapImageProps) => {
	let canvas: HTMLCanvasElement | undefined;
	createEffect(() => {
		if (canvas) {
			renderBitmap(canvas, {bitmap: decodeCnnImage(props.image), size: SIZE});
		}
	});
	return <canvas ref={canvas} width={SIZE} height={SIZE} class={`${styles.pixelated} ${props.class ?? ''}`}/>;
};

interface GalleryItemProps {
	submission: CnnReversingSubmission,
	rank: number,
	isMine: boolean,
}

const GalleryItem = (props: GalleryItemProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const userData = useFirestore(doc(db, 'users', props.submission.userId) as DocumentReference<User>);

	return (
		<Paper class={styles.galleryItem} variant="outlined" sx={props.isMine ? {borderColor: 'primary.main', borderWidth: 2} : {}}>
			<BitmapImage image={props.submission.image} class={styles.galleryImage}/>
			<Typography variant="subtitle2" component="p">
				#{props.rank} {formatScore(props.submission.score)}
			</Typography>
			<Typography variant="body2" component="p" noWrap>
				<Doc data={userData}>{(user) => user.displayName}</Doc>
			</Typography>
			<Typography variant="caption" component="p" sx={{color: 'text.secondary'}}>
				{props.submission.evaluationCount}回評価 / {formatElapsed(props.submission.achievedAt)}時点
			</Typography>
		</Paper>
	);
};

interface GalleryProps {
	gameId: string,
	uid: string,
}

const Gallery = (props: GalleryProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const submissionsRef = collection(db, 'games', props.gameId, 'submissions') as CollectionReference<CnnReversingSubmission>;
	const submissions = useFirestore(query(submissionsRef, orderBy('score', 'desc')));

	return (
		<Box class={styles.gallery}>
			<Collection data={submissions} empty={<Typography>まだ提出がありません</Typography>}>
				{(submission, index) => (
					<GalleryItem submission={submission} rank={index() + 1} isMine={submission.userId === props.uid}/>
				)}
			</Collection>
		</Box>
	);
};

const CnnReversing = () => {
	const [searchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}
	const gameId = searchParams.gameId;

	const app = useFirebaseApp();
	const db = getFirestore(app);
	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);
	const user = useUser();

	setArenaTitle('CNNリバーシング');

	const [submissionData, setSubmissionData] = createSignal<UseFireStoreReturn<CnnReversingSubmission | null | undefined> | null>(null);
	createEffect(() => {
		const userData = user();
		if (userData?.uid) {
			const submissionRef = doc(db, 'games', gameId, 'submissions', userData.uid) as DocumentReference<CnnReversingSubmission>;
			setSubmissionData(useFirestore(submissionRef));
		}
	});

	const config = createMemo(() => gameData.data?.configuration as CnnReversingConfiguration | undefined);
	const isAdmin = createMemo(() => {
		const uid = user()?.uid;
		return uid !== undefined && (gameData.data?.admins ?? []).includes(uid);
	});
	const canStart = createMemo(() => config()?.enabled === true || isAdmin());

	const [phase, setPhase] = createSignal<Phase>('loading');
	const [model, setModel] = createSignal<CnnModel | null>(null);
	const [modelError, setModelError] = createSignal<string | null>(null);
	const [submitError, setSubmitError] = createSignal<string | null>(null);
	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const [remainingText, setRemainingText] = createSignal('');

	// Canvas state
	let bitmap: Bitmap = new Uint8Array(SIZE * SIZE);
	const [bitmapVersion, setBitmapVersion] = createSignal(0);
	const undoStack: Bitmap[] = [];
	const redoStack: Bitmap[] = [];
	const [historyVersion, setHistoryVersion] = createSignal(0);
	const [tool, setTool] = createSignal<Tool>('pen');
	const [brush, setBrush] = createSignal(3);
	const [canvasEl, setCanvasEl] = createSignal<HTMLCanvasElement | null>(null);

	const [evaluations, setEvaluations] = createSignal<Evaluation[]>(loadEvaluations(gameId));
	const [isEvaluating, setIsEvaluating] = createSignal(false);
	const best = createMemo(() => {
		let result: Evaluation | null = null;
		for (const evaluation of evaluations()) {
			if (result === null || evaluation.score > result.score) {
				result = evaluation;
			}
		}
		return result;
	});
	const latest = createMemo(() => evaluations().at(-1) ?? null);

	const getStartTime = () => {
		const saved = localStorage.getItem(storageKey(gameId, 'startTime'));
		return saved === null ? null : Number.parseFloat(saved);
	};

	const redraw = () => {
		const canvas = canvasEl();
		if (canvas) {
			renderBitmap(canvas, {bitmap, size: SIZE});
		}
	};

	const commitBitmap = () => {
		setBitmapVersion((v) => v + 1);
		localStorage.setItem(storageKey(gameId, 'canvas'), encodeCnnImage(bitmap));
	};

	createEffect(() => {
		bitmapVersion();
		redraw();
	});

	onMount(() => {
		const savedCanvas = localStorage.getItem(storageKey(gameId, 'canvas'));
		if (savedCanvas !== null) {
			try {
				bitmap = decodeCnnImage(savedCanvas);
			} catch {
				bitmap = new Uint8Array(SIZE * SIZE);
			}
			setBitmapVersion((v) => v + 1);
		}
	});

	// Load model once the game document is available
	let modelRequested = false;
	createEffect(() => {
		const url = config()?.modelUrl;
		if (!url || modelRequested) {
			return;
		}
		modelRequested = true;
		(async () => {
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				setModel(parseCnnModel(await response.arrayBuffer()));
			} catch (error) {
				setModelError(`モデルの読み込みに失敗しました: ${error}`);
			}
		})();
	});

	const [isSubmitInFlight, setIsSubmitInFlight] = createSignal(false);
	const submitResult = () => untrack(async () => {
		const uid = user()?.uid;
		const athlon = gameData.data?.athlon;
		const currentModel = model();
		if (!uid || !athlon || !currentModel || isSubmitInFlight() || phase() === 'finished') {
			return;
		}
		setIsSubmitInFlight(true);
		setPhase('submitting');
		setSubmitError(null);

		let result = best();
		if (result === null) {
			const startTime = getStartTime() ?? Date.now();
			result = {
				score: runCnn(currentModel, bitmap),
				image: encodeCnnImage(bitmap),
				elapsed: Math.min(Date.now() - startTime, config()?.duration ?? Infinity),
			};
			setEvaluations([result]);
		}

		try {
			// Skip on retry if the submission itself was already written (submissions are create-only)
			if (!submissionData()?.data) {
				const submissionRef = doc(db, 'games', gameId, 'submissions', uid) as DocumentReference<CnnReversingSubmission>;
				await setDoc(submissionRef, {
					athlon,
					userId: uid,
					score: result.score,
					image: result.image,
					evaluationCount: Math.max(evaluations().length, 1),
					achievedAt: result.elapsed,
					createdAt: serverTimestamp(),
				});
			}
			const scoreRef = doc(db, 'games', gameId, 'scores', uid) as DocumentReference<Score>;
			await setDoc(scoreRef, {
				athlon,
				rawScore: Math.max(0, Math.round(result.score * 1000) / 1000),
				tiebreakScore: Math.round(result.elapsed) / 1000,
				user: uid,
			});
			setPhase('finished');
		} catch (error) {
			setSubmitError(`スコアの送信に失敗しました: ${error}`);
		} finally {
			setIsSubmitInFlight(false);
		}
	});

	// Phase transitions
	createEffect(() => {
		if (gameData.data === null || gameData.error) {
			throw new PageNotFoundError();
		}
		const submission = submissionData();
		if (!gameData.data || !submission || submission.loading) {
			return;
		}
		if (gameData.data.rule.path !== 'gameRules/cnn-reversing') {
			throw new PageNotFoundError();
		}
		// While submitting, wait for the server to acknowledge the writes (see submitResult)
		// so that the gallery query is evaluated after the submission exists on the server.
		if (phase() === 'submitting') {
			return;
		}
		if (submission.data) {
			setPhase('finished');
			return;
		}
		const startTime = getStartTime();
		const duration = config()?.duration ?? 0;
		if (startTime === null) {
			setPhase('waiting');
		} else if (startTime + duration <= Date.now()) {
			if (model()) {
				submitResult();
			}
		} else {
			setPhase('playing');
		}
	});

	const intervalId = setInterval(() => {
		const startTime = getStartTime();
		const duration = config()?.duration;
		if (startTime === null || !duration || phase() !== 'playing') {
			return;
		}
		const remaining = Math.max(Math.ceil((duration - (Date.now() - startTime)) / 1000), 0);
		const text = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
		setHeaderText(text);
		setRemainingText(text);
		if (remaining === 0) {
			submitResult();
		}
	}, 250);
	onCleanup(() => {
		clearInterval(intervalId);
		setHeaderText('');
	});

	const handleStart = () => {
		if (phase() !== 'waiting' || !canStart() || !model()) {
			return;
		}
		localStorage.setItem(storageKey(gameId, 'startTime'), Date.now().toString());
		setPhase('playing');
	};

	const handleEvaluate = () => {
		const currentModel = model();
		const startTime = getStartTime();
		if (phase() !== 'playing' || !currentModel || startTime === null || isEvaluating()) {
			return;
		}
		setIsEvaluating(true);
		// Yield to the renderer so that the progress indicator becomes visible
		setTimeout(() => {
			const score = runCnn(currentModel, bitmap);
			const next = [...evaluations(), {score, image: encodeCnnImage(bitmap), elapsed: Date.now() - startTime}];
			setEvaluations(next);
			localStorage.setItem(storageKey(gameId, 'evaluations'), JSON.stringify(next));
			setIsEvaluating(false);
		}, 10);
	};

	// Undo / redo
	const pushUndo = () => {
		undoStack.push(bitmap.slice());
		if (undoStack.length > MAX_UNDO) {
			undoStack.shift();
		}
		redoStack.length = 0;
		setHistoryVersion((v) => v + 1);
	};

	const undo = () => {
		const previous = undoStack.pop();
		if (previous) {
			redoStack.push(bitmap);
			bitmap = previous;
			commitBitmap();
			setHistoryVersion((v) => v + 1);
		}
	};

	const redo = () => {
		const next = redoStack.pop();
		if (next) {
			undoStack.push(bitmap);
			bitmap = next;
			commitBitmap();
			setHistoryVersion((v) => v + 1);
		}
	};

	const clearCanvas = () => {
		pushUndo();
		bitmap = new Uint8Array(SIZE * SIZE);
		commitBitmap();
	};

	const loadImage = (image: string) => {
		if (phase() !== 'playing') {
			return;
		}
		pushUndo();
		bitmap = decodeCnnImage(image);
		commitBitmap();
	};

	// Pointer handling
	let dragStart: Point | null = null;
	let lastPoint: Point | null = null;
	let baseBitmap: Bitmap | null = null;

	const toPoint = (event: PointerEvent): Point => {
		const canvas = event.currentTarget as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();
		return {
			x: Math.floor(((event.clientX - rect.left) / rect.width) * SIZE),
			y: Math.floor(((event.clientY - rect.top) / rect.height) * SIZE),
		};
	};

	const drawShape = (segment: Segment) => {
		const color = 1;
		const target = {bitmap, size: SIZE};
		switch (tool()) {
			case 'line':
				drawLine(target, segment, {brush: brush(), color});
				break;
			case 'rect':
				drawRect(target, segment, {brush: brush(), color});
				break;
			case 'filledRect':
				drawRect(target, segment, {brush: brush(), color, filled: true});
				break;
			case 'ellipse':
				drawEllipse(target, segment, {brush: brush(), color});
				break;
			case 'filledEllipse':
				drawEllipse(target, segment, {brush: brush(), color, filled: true});
				break;
			default:
				break;
		}
	};

	const handlePointerDown = (event: PointerEvent) => {
		if (phase() !== 'playing' || event.button !== 0) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
		const point = toPoint(event);
		pushUndo();
		const currentTool = tool();
		if (currentTool === 'fill') {
			floodFill({bitmap, size: SIZE}, point, bitmap[point.y * SIZE + point.x] ? 0 : 1);
			commitBitmap();
			return;
		}
		dragStart = point;
		lastPoint = point;
		if (currentTool === 'pen' || currentTool === 'eraser') {
			stamp({bitmap, size: SIZE}, point, {brush: brush(), color: currentTool === 'pen' ? 1 : 0});
			redraw();
		} else {
			baseBitmap = bitmap.slice();
			drawShape({from: point, to: point});
			redraw();
		}
	};

	const handlePointerMove = (event: PointerEvent) => {
		if (dragStart === null || lastPoint === null) {
			return;
		}
		const point = toPoint(event);
		const currentTool = tool();
		if (currentTool === 'pen' || currentTool === 'eraser') {
			drawLine({bitmap, size: SIZE}, {from: lastPoint, to: point}, {brush: brush(), color: currentTool === 'pen' ? 1 : 0});
		} else if (baseBitmap) {
			bitmap.set(baseBitmap);
			drawShape({from: dragStart, to: point});
		}
		lastPoint = point;
		redraw();
	};

	const handlePointerUp = () => {
		if (dragStart === null) {
			return;
		}
		dragStart = null;
		lastPoint = null;
		baseBitmap = null;
		commitBitmap();
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (phase() !== 'playing') {
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) {
				redo();
			} else {
				undo();
			}
		} else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
			event.preventDefault();
			redo();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			handleEvaluate();
		}
	};
	window.addEventListener('keydown', handleKeydown);
	onCleanup(() => window.removeEventListener('keydown', handleKeydown));

	const toolButtons: {value: Tool, label: string, icon: () => JSX.Element}[] = [
		{value: 'pen', label: 'ペン', icon: () => <Create/>},
		{value: 'eraser', label: '消しゴム', icon: () => <AutoFixNormal/>},
		{value: 'line', label: '直線', icon: () => <HorizontalRule/>},
		{value: 'rect', label: '四角形', icon: () => <CropSquare/>},
		{value: 'filledRect', label: '四角形 (塗りつぶし)', icon: () => <Square/>},
		{value: 'ellipse', label: '楕円', icon: () => <RadioButtonUnchecked/>},
		{value: 'filledEllipse', label: '楕円 (塗りつぶし)', icon: () => <Circle/>},
		{value: 'fill', label: '塗りつぶし (白黒反転)', icon: () => <FormatColorFill/>},
	];

	const isDrawingDisabled = () => phase() !== 'playing';

	return (
		<main class={styles.app}>
			<Show when={config()?.enabled === false && isAdmin()}>
				<Alert severity="warning" sx={{mb: 2}}>
					この競技はまだ公開されていません。管理者としてプレビューしています。
				</Alert>
			</Show>
			<Show when={modelError()}>
				<Alert severity="error" sx={{mb: 2}}>{modelError()}</Alert>
			</Show>
			<Show when={submitError()}>
				<Alert
					severity="error"
					sx={{mb: 2}}
					action={<Button color="inherit" size="small" onClick={submitResult}>再送信</Button>}
				>
					{submitError()}
				</Alert>
			</Show>

			<Show when={phase() === 'loading'}>
				<Stack alignItems="center" sx={{my: 4}}>
					<CircularProgress/>
				</Stack>
			</Show>

			<Show when={phase() === 'waiting'}>
				<Container maxWidth="sm">
					<Paper class={styles.startCard}>
						<Typography variant="h5" component="h2" gutterBottom>
							CNNリバーシング
						</Typography>
						<Typography variant="body1" component="p" gutterBottom>
							128×128 の白黒画像を入力するとスコアを1つ出力する、秘密のCNNが用意されています。
							画像を描いて「評価する」を押すと、その画像に対するCNNの出力 (ロジット) が表示されます。
							何度も評価しながらCNNが何を見ているのかを推理し、なるべく高いスコアを目指してください。
						</Typography>
						<Typography variant="body1" component="p" gutterBottom>
							制限時間は{Math.round((config()?.duration ?? 0) / 60000)}分です。
							制限時間中に評価した画像のうち、最もスコアが高いものが自動的に提出されます。
						</Typography>
						<Typography variant="body2" component="p" sx={{color: 'text.secondary', mb: 2}}>
							モデルの重みはブラウザにダウンロードされますが、開発者ツールでの解析・APIの直接呼び出しなどは行わず、
							画面上のペイントツールのみでプレイしてください。
						</Typography>
						<Button
							variant="contained"
							size="large"
							disabled={!canStart() || model() === null}
							onClick={handleStart}
						>
							<Show when={model() !== null} fallback="モデルを読み込み中⋯⋯">
								{canStart() ? '競技を開始する' : '競技開始まで少々お待ちください'}
							</Show>
						</Button>
					</Paper>
				</Container>
			</Show>

			<Show when={phase() === 'playing' || phase() === 'submitting'}>
				<div class={styles.playArea}>
					<div class={styles.canvasColumn}>
						<Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" class={styles.toolbar}>
							<ToggleButtonGroup
								value={tool()}
								exclusive
								size="small"
								onChange={(_event, value) => {
									if (value) {
										setTool(value as Tool);
									}
								}}
							>
								<For each={toolButtons}>
									{(button) => (
										<ToggleButton value={button.value} title={button.label} aria-label={button.label}>
											{button.icon()}
										</ToggleButton>
									)}
								</For>
							</ToggleButtonGroup>
							<ToggleButtonGroup
								value={brush()}
								exclusive
								size="small"
								onChange={(_event, value) => {
									if (value) {
										setBrush(value as number);
									}
								}}
							>
								<For each={BRUSH_SIZES}>
									{(size) => (
										<ToggleButton value={size} title={`太さ ${size}px`}>
											<span class={styles.brushLabel}>{size}</span>
										</ToggleButton>
									)}
								</For>
							</ToggleButtonGroup>
							<Box>
								<IconButton title="元に戻す (Ctrl+Z)" onClick={undo} disabled={(historyVersion(), undoStack.length === 0) || isDrawingDisabled()}>
									<Undo/>
								</IconButton>
								<IconButton title="やり直す (Ctrl+Y)" onClick={redo} disabled={(historyVersion(), redoStack.length === 0) || isDrawingDisabled()}>
									<Redo/>
								</IconButton>
								<IconButton title="全消去" onClick={clearCanvas} disabled={isDrawingDisabled()}>
									<Delete/>
								</IconButton>
							</Box>
						</Stack>
						<canvas
							ref={setCanvasEl}
							width={SIZE}
							height={SIZE}
							class={`${styles.pixelated} ${styles.paintCanvas}`}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							onPointerCancel={handlePointerUp}
						/>
					</div>

					<div class={styles.sideColumn}>
						<Typography variant="h4" component="p" align="center" class={styles.timer}>
							残り時間 {remainingText()}
						</Typography>
						<Stack direction="row" gap={1}>
							<Button
								variant="contained"
								size="large"
								startIcon={isEvaluating() ? <CircularProgress size={20} color="inherit"/> : <Send/>}
								onClick={handleEvaluate}
								disabled={isEvaluating() || isDrawingDisabled()}
								sx={{flexGrow: 1}}
							>
								評価する (Ctrl+Enter)
							</Button>
							<Button
								variant="outlined"
								color="error"
								onClick={() => setConfirmOpen(true)}
								disabled={isDrawingDisabled()}
							>
								終了
							</Button>
						</Stack>
						<Stack direction="row" gap={2} sx={{my: 2}}>
							<Paper variant="outlined" class={styles.scoreBox}>
								<Typography variant="caption" sx={{color: 'text.secondary'}}>最新のスコア</Typography>
								<Typography variant="h4" component="p">
									{latest() ? formatScore(latest()?.score ?? 0) : '-'}
								</Typography>
								<Show when={latest()}>
									{(evaluation) => (
										<Typography variant="caption" sx={{color: 'text.secondary'}}>
											確率換算: {(sigmoid(evaluation().score) * 100).toPrecision(4)}%
										</Typography>
									)}
								</Show>
							</Paper>
							<Paper variant="outlined" class={styles.scoreBox}>
								<Typography variant="caption" sx={{color: 'text.secondary'}}>ベストスコア</Typography>
								<Typography variant="h4" component="p" color="primary">
									{best() ? formatScore(best()?.score ?? 0) : '-'}
								</Typography>
								<Typography variant="caption" sx={{color: 'text.secondary'}}>
									評価回数: {evaluations().length}
								</Typography>
							</Paper>
						</Stack>
						<Typography variant="subtitle2" component="h3" gutterBottom>
							評価履歴 (クリックでキャンバスに読み込み)
						</Typography>
						<div class={styles.history}>
							<For each={[...evaluations()].reverse()}>
								{(evaluation) => (
									<button
										type="button"
										class={styles.historyItem}
										classList={{[styles.historyBest]: evaluation === best()}}
										onClick={() => loadImage(evaluation.image)}
									>
										<BitmapImage image={evaluation.image} class={styles.historyImage}/>
										<span>{formatScore(evaluation.score)}</span>
									</button>
								)}
							</For>
						</div>
					</div>
				</div>
			</Show>

			<Show when={phase() === 'submitting' && !submitError()}>
				<Dialog open>
					<DialogContent>
						<Stack alignItems="center" gap={2}>
							<CircularProgress/>
							<Typography>スコアを送信しています⋯⋯</Typography>
						</Stack>
					</DialogContent>
				</Dialog>
			</Show>

			<Dialog open={confirmOpen()} onClose={() => setConfirmOpen(false)}>
				<DialogTitle>競技を終了しますか?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						現在のベストスコア ({best() ? formatScore(best()?.score ?? 0) : '未評価'}) が提出され、以降は評価できなくなります。
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
					<Button
						color="error"
						onClick={() => {
							setConfirmOpen(false);
							submitResult();
						}}
					>
						終了して提出する
					</Button>
				</DialogActions>
			</Dialog>

			<Show when={phase() === 'finished'}>
				<Container maxWidth="lg">
					<Doc data={submissionData()}>
						{(submission) => (
							<Stack direction="row" gap={3} alignItems="center" flexWrap="wrap" sx={{my: 3}}>
								<BitmapImage image={submission.image} class={styles.resultImage}/>
								<Box>
									<Typography variant="h6" component="p">競技は終了しました</Typography>
									<Typography variant="h3" component="p" color="primary">
										{formatScore(submission.score)}
									</Typography>
									<Typography variant="body2" component="p" sx={{color: 'text.secondary'}}>
										評価回数: {submission.evaluationCount}回 / {formatElapsed(submission.achievedAt)}時点で達成
									</Typography>
								</Box>
							</Stack>
						)}
					</Doc>
					<Typography variant="h6" component="h2" gutterBottom>
						みんなの提出
					</Typography>
					<Show when={user()?.uid}>
						{(uid) => <Gallery gameId={gameId} uid={uid()}/>}
					</Show>
				</Container>
			</Show>
		</main>
	);
};

export const reset = (gameId: string) => {
	localStorage.removeItem(storageKey(gameId, 'startTime'));
	localStorage.removeItem(storageKey(gameId, 'evaluations'));
	localStorage.removeItem(storageKey(gameId, 'canvas'));
};

export default CnnReversing;
