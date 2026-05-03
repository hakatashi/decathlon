import {Link} from '@solidjs/meta';
import {A, useParams} from '@solidjs/router';
import {Typography, Container, Breadcrumbs, Link as LinkUi, Button, Chip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Stack, TextField, Grid, Box, Checkbox, FormControlLabel} from '@suid/material';
import dayjs from 'dayjs';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, setDoc, where} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getStorage, ref} from 'firebase/storage';
import remarkGfm from 'remark-gfm';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, Show, Switch} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import {tippy} from 'solid-tippy';
import styles from './index.module.scss';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import {useStorageBytes} from '~/lib/firebase';
import type {Game, GameRule, Rule, Score} from '~/lib/schema';
import 'tippy.js/dist/tippy.css';
import useAthlon from '~/lib/useAthlon';
import {reset as resetTypingJapanese} from '~/routes/arenas/typing-japanese';

interface Props {
	onSubmit: (score: number, tiebreakScore: number) => void,
	onClose: () => void,
	open: boolean,
	maxRawScore: number,
	scoreInputNote: string,
	scoreConfigurationType: string,
	defaultValue?: number,
	defaultTiebreakValue?: number,
}

declare module 'solid-js' {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace JSX {
		interface Directives {
			tippy: {
				hidden?: boolean,
				disabled?: boolean,
				props?: {
					content?: string | null,
				},
			},
		}
	}
}

const ScoreRecordDialog = (props: Props) => {
	const [score, setScore] = createSignal<number>(props.defaultValue ?? 0);
	const [tiebreakScore, setTiebreakScore] = createSignal<number>(props.defaultTiebreakValue ?? 0);
	const [isSolved, setIsSolved] = createSignal<boolean>(props.defaultValue === props.maxRawScore);

	const handleClickSubmit = () => {
		props.onSubmit(score(), tiebreakScore());
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
		>
			<DialogTitle id="alert-dialog-title">
				スコアを記録する
			</DialogTitle>
			<DialogContent>
				<DialogContentText id="alert-dialog-description">
					<p>{props.scoreInputNote}</p>
					<Switch>
						<Match when={props.scoreConfigurationType === 'timestamp'}>
							<Box>
								<FormControlLabel
									control={
										<Checkbox
											checked={isSolved()}
											onChange={(_event, checked) => {
												setIsSolved(checked);
												if (checked) {
													setScore(props.maxRawScore);
												} else {
													setScore(0);
													setTiebreakScore(0);
												}
											}}
										/>
									}
									label="解けた"
								/>
							</Box>
							<Show when={isSolved()}>
								<input
									class={styles.timestampInput}
									type="time"
									step="1"
									value={dayjs(tiebreakScore() || 0).format('HH:mm:ss')}
									onChange={(event) => {
										const time = event.currentTarget.value;
										const [hours, minutes, seconds] = time.split(':').map((component) => parseInt(component));
										const timeData = dayjs().set('hours', hours).set('minutes', minutes).set('seconds', seconds);

										setTiebreakScore(timeData.valueOf());
									}}
								/>
							</Show>
						</Match>
						<Match when>
							<TextField
								label="Score"
								variant="standard"
								type="number"
								inputProps={{inputMode: 'numeric', pattern: '[0-9]*', max: props.maxRawScore, min: 0}}
								defaultValue={props.defaultValue}
								required
								value={score()}
								onChange={(event, value) => {
									setScore(parseInt(value));
									setTiebreakScore(0);
								}}
							/>
						</Match>
					</Switch>
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClickSubmit}>
					送信
				</Button>
			</DialogActions>
		</Dialog>
	);
};

const ResetDialog = (props: {open: boolean, onClose: () => void, onReset: () => void}) => {
	const handleClickReset = () => {
		props.onReset();
	};

	return (
		<Dialog
			open={props.open}
			onClose={props.onClose}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
		>
			<DialogTitle id="alert-dialog-title">
				進捗をリセットする
			</DialogTitle>
			<DialogContent>
				<DialogContentText id="alert-dialog-description">
					<p>進捗をリセットしますか？</p>
					<p>※この操作は一部のシステムテストコンテストでのみ実行することができます。</p>
				</DialogContentText>
			</DialogContent>
			<DialogActions>
				<Button onClick={handleClickReset} color="error">
					リセット
				</Button>
			</DialogActions>
		</Dialog>
	);
};

const RuleCategoryChip = (props: {ruleRef: DocumentReference<Rule>}) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const ruleData = useFirestore(doc(db, 'rules', props.ruleRef.id) as DocumentReference<Rule>);

	return (
		<Doc data={ruleData}>
			{(rule) => (
				<Chip
					label={rule.name}
					component={A}
					href={`/rules/${props.ruleRef.id}`}
					clickable
				/>
			)}
		</Doc>
	);
};

const ScoreDescriptionSection = (props: {game: Game}) => {
	let containerRef!: HTMLDivElement;

	createEffect(async () => {
		// @ts-expect-error: URL import
		// eslint-disable-next-line import/no-unresolved
		const {default: renderMathInElement} = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
		renderMathInElement(containerRef, {
			delimiters: [
				{left: '$$', right: '$$', display: true},
				{left: '$', right: '$', display: false},
			],
		});
	});

	const descriptionHtml = createMemo(() => {
		const c = props.game.scoreConfiguration;
		const mp = props.game.maxPoint;

		if (c.type === 'score') {
			if (c.scoreWeight === 1) {
				return `<p>配点: ${mp}点満点</p><p>素点がそのまま獲得得点になります。</p>`;
			}
			return `<p>配点: ${mp}点満点</p><p>$$\\text{獲得得点} = \\min(${mp},\\ \\text{素点} \\times ${c.scoreWeight})$$</p>`;
		}

		if (c.type === 'max-ratio') {
			return `<p>配点: ${mp}点満点</p>
<p>参加者の中で最も高い素点を${mp}点としたときの点数が各参加者の獲得得点となります。</p>
<p>$$\\text{獲得得点} = \\frac{\\text{素点}}{\\text{最高素点}} \\times ${mp}$$</p>`;
		}

		if (c.type === 'timestamp') {
			return `<p>配点: ${mp}点満点</p>
<p>問題が解けた場合: $\\text{獲得得点} = ${mp} \\times ${c.attenuationFactor}^{\\text{順位}}$（順位は0-indexed）</p>
<p>問題が解けなかった場合: 0点</p>`;
		}

		const maxRankPoint = Math.round(mp * c.rankRatio);
		const maxScorePoint = mp - maxRankPoint;
		const rankDenominator = c.rankWeight === 1 ? '\\text{順位}' : `\\text{順位} + ${c.rankWeight - 1}`;

		if (c.rankRatio >= 1) {
			return `<p>配点: ${mp}点満点（順位点のみ）</p>
<p>$$\\text{獲得得点} = ${mp} \\times \\frac{${c.rankWeight}}{${rankDenominator}}$$</p>
<p>（順位は1-indexed）</p>`;
		}

		const scoreFormula = c.scoreWeight > 0
			? `<p>$$\\text{素点点数} = \\min(${maxScorePoint},\\ \\text{素点} \\times ${c.scoreWeight})$$</p>`
			: '';
		return `<p>配点: 素点${maxScorePoint}点 + 順位点${maxRankPoint}点 = ${mp}点満点</p>
${scoreFormula}<p>$$\\text{順位点} = ${maxRankPoint} \\times \\frac{${c.rankWeight}}{${rankDenominator}}$$</p>
<p>（順位は1-indexed）</p>`;
	});

	return (
		<div ref={containerRef} class="markdown">
			<h2>獲得得点の計算方法</h2>
			<div innerHTML={descriptionHtml()}/>
		</div>
	);
};

const AthlonGame = () => {
	const param = useParams<{id: string, ruleId: string}>();
	const athlonData = useAthlon(param.id);
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);
	const auth = getAuth(app);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const [myScore, setMyScore] = createSignal<string>('N/A');
	const [scoreRecordDialogOpen, setScoreRecordDialogOpen] = createSignal<boolean>(false);
	const [resetDialogOpen, setResetDialogOpen] = createSignal<boolean>(false);

	const ruleData = useFirestore(ruleRef);
	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);
	const authState = useAuth(auth);

	const scoreRecordErrorMessage = createMemo(() => {
		if (!gameData.data?.[0]?.isScoreUserEditable) {
			return 'この競技はスコアを手動入力できません';
		}

		if (!authState.data?.uid) {
			return 'ログインしてください';
		}

		return null;
	});

	const isUserResettable = createMemo(() => gameData.data?.[0]?.isUserResettable === true);

	const scoreRecordTippyProps = createMemo(() => ({
		disabled: scoreRecordErrorMessage() === null,
		hidden: true,
		props: {
			content: scoreRecordErrorMessage(),
		},
	}));

	const isGameEnded = createMemo(() => {
		if (gameData.data?.[0]?.endAt) {
			return dayjs().isAfter(dayjs(gameData.data[0].endAt.toDate()));
		}

		return false;
	});

	// XXX: https://www.solidjs.com/guides/typescript#use___
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions, no-constant-binary-expression
	false && tippy;

	return (
		<main>
			<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
			<Doc data={athlonData}>
				{(athlon) => (
					<Doc data={ruleData}>
						{(rule) => (
							<PageTitle>[{athlon.name}] {rule.name}</PageTitle>
						)}
					</Doc>
				)}
			</Doc>
			<div class={styles.header}>
				<Container maxWidth="lg">
					<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
						<LinkUi component={A} underline="hover" color="inherit" href="/athlons">
							Athlons
						</LinkUi>
						<Doc data={athlonData}>
							{(athlon) => (
								<LinkUi
									underline="hover"
									color="inherit"
									component={A}
									href={`/athlons/${athlon.id}`}
								>
									{athlon.name}
								</LinkUi>
							)}
						</Doc>
						<Doc data={ruleData}>
							{(rule) => (
								<Typography color="text.primary">{rule.name}</Typography>
							)}
						</Doc>
					</Breadcrumbs>
					<Doc data={ruleData}>
						{(rule) => {
							const iconData = useStorageBytes(ref(storage, `assets/icons/${rule.icon}.svg`));
							const textDecoder = new TextDecoder();

							return (
								<Grid
									container
									spacing={2}
									pb={2}
									justifyContent="center"
									alignItems="center"
									flexDirection="row-reverse"
								>
									<Grid item xs={6} md={4} class={styles.ruleIcon}>
										<Show when={iconData.data} keyed>
											{(data) => (
												<div style={{width: '100%', height: '100%'}} innerHTML={textDecoder.decode(data)}/>
											)}
										</Show>
									</Grid>
									<Grid item xs={12} md={8}>
										<Typography
											color="text.primary"
											variant="h3"
											component="h2"
											fontWeight="bold"
										>
											{rule.name}
										</Typography>
										<Typography
											color="text.primary"
											variant="body1"
											my={3}
										>
											{rule.description}
										</Typography>
										<Collection data={gameData}>
											{(game) => (
												<Show when={game.ruleCategories?.length > 0}>
													<Stack direction="row" flexWrap="wrap" gap={1} sx={{mt: 2, mb: 3}}>
														<For each={game.ruleCategories}>
															{(categoryRef) => (
																<RuleCategoryChip ruleRef={categoryRef}/>
															)}
														</For>
													</Stack>
												</Show>
											)}
										</Collection>
										<Stack direction="row" flexWrap="wrap" gap={1}>
											<Collection data={gameData}>
												{(game) => (
													<For each={game.links}>
														{(link) => (
															<Button
																size="large"
																variant={link.isMain ? 'contained' : 'outlined'}
																component="a"
																target="_blank"
																rel="noopener noreferer"
																href={link.url}
															>
																{link.label}
															</Button>
														)}
													</For>
												)}
											</Collection>
											<div use:tippy={scoreRecordTippyProps()}>
												<Button
													size="large"
													variant="contained"
													color="secondary"
													disabled={scoreRecordErrorMessage() !== null}
													onClick={() => setScoreRecordDialogOpen(true)}
												>
													スコアを記録する
												</Button>
											</div>
											{isUserResettable() && (
												<Button
													size="large"
													variant="contained"
													color="error"
													onClick={() => setResetDialogOpen(true)}
												>
													進捗をリセットする
												</Button>
											)}
											<div
												use:tippy={{
													disabled: isGameEnded(),
													hidden: true,
													props: {
														content: '競技終了後のみ閲覧できます',
													},
												}}
											>
												<A href="./writeups">
													<Button
														size="large"
														variant="contained"
														color="info"
														disabled={!isGameEnded()}
														onClick={() => setScoreRecordDialogOpen(true)}
													>
														解説を見る
													</Button>
												</A>
											</div>
										</Stack>
										<Typography
											variant="body2"
											my={2}
										>
											Your score: {myScore()}
										</Typography>
										<Box sx={{mb: 3}} >
											<LinkUi component={A} href="./leaderboard">
												ランキングを表示する
											</LinkUi>
										</Box>
									</Grid>
								</Grid>
							);
						}}
					</Doc>
				</Container>
			</div>
			<Container maxWidth="lg">
				<Collection data={gameData}>
					{(game) => (
						<>
							<SolidMarkdown
								class="markdown"
								children={game.description}
								remarkPlugins={[remarkGfm]}
								linkTarget="_blank"
							/>
							<ScoreDescriptionSection game={game}/>
						</>
					)}
				</Collection>
				<Collection data={gameData}>
					{(game) => {
						const uid = authState.data?.uid;
						if (!uid) {
							return null;
						}
						const scoreRef = doc(db, 'games', game.id, 'scores', uid) as DocumentReference<Score>;
						const scoreData = useFirestore(scoreRef);

						const functions = getFunctions();
						const resetGameSubmission = httpsCallable(functions, 'resetGameSubmission');

						const handleScoreSubmit = async (score: number, tiebreakScore: number) => {
							if (athlonData?.data?.id) {
								await setDoc(scoreRef, {
									athlon: doc(db, 'athlons', athlonData?.data?.id),
									rawScore: score,
									user: uid,
									tiebreakScore,
								});
							}
							setScoreRecordDialogOpen(false);
						};

						const handleReset = async () => {
							await resetGameSubmission({
								gameId: game.id,
							});

							if (game.rule.path === 'gameRules/typing-japanese') {
								resetTypingJapanese(game.id);
							}

							setResetDialogOpen(false);
						};

						const handleCloseDialog = () => {
							setScoreRecordDialogOpen(false);
							setResetDialogOpen(false);
						};

						createEffect(() => {
							if (typeof scoreData.data?.rawScore === 'number') {
								setMyScore(scoreData.data.rawScore.toString());
							}
						});

						return (
							<>
								<Doc
									data={scoreData}
									fallback={
										<ScoreRecordDialog
											open={scoreRecordDialogOpen()}
											scoreInputNote={game.scoreInputNote}
											scoreConfigurationType={game.scoreConfiguration.type}
											maxRawScore={game.maxRawScore}
											onSubmit={handleScoreSubmit}
											onClose={handleCloseDialog}
										/>
									}
								>
									{(score) => (
										<ScoreRecordDialog
											open={scoreRecordDialogOpen()}
											scoreInputNote={game.scoreInputNote}
											scoreConfigurationType={game.scoreConfiguration.type}
											maxRawScore={game.maxRawScore}
											onSubmit={handleScoreSubmit}
											onClose={handleCloseDialog}
											defaultValue={score.rawScore}
											defaultTiebreakValue={score.tiebreakScore}
										/>
									)}
								</Doc>
								<ResetDialog
									open={resetDialogOpen()}
									onClose={handleCloseDialog}
									onReset={handleReset}
								/>
							</>
						);
					}}
				</Collection>
			</Container>
		</main>
	);
};

export default AthlonGame;


