import {A} from '@solidjs/router';
import {ExpandMore} from '@suid/icons-material';
import {Button, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount, Show} from 'solid-js';
import styles from './AdventCalendar.module.css';
import Doc from './Doc';
import {getGamePath} from '~/lib/const';
import type {Athlon, Game, GameRule, RankingEntry, UseFireStoreReturn} from '~/lib/schema';

const JST_OFFSET = 9 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** Returns the JST calendar date (as a UTC-based Date) for the given epoch milliseconds. */
const toJstDate = (millis: number) => new Date(millis + JST_OFFSET);

const pad = (n: number) => n.toString().padStart(2, '0');

const formatMonthDay = (millis: number) => {
	const d = toJstDate(millis);
	return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

const formatTime = (millis: number) => {
	const d = toJstDate(millis);
	return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
};

interface Props {
	athlonId: string,
	athlon: Athlon,
	games: Game[],
}

interface DayCell {
	game: Game,
	date: number,
	weekdayIndex: number,
	weekend: boolean,
	points: number,
}

const GameName = (props: {game: Game}) => {
	const ruleData = useFirestore(props.game.rule as DocumentReference<GameRule>);
	return (
		<Doc data={ruleData}>
			{(rule) => rule.name}
		</Doc>
	);
};

const AdventCalendar = (props: Props) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const authState = useAuth(getAuth(app));
	const [now, setNow] = createSignal(Date.now());
	const [openWeeks, setOpenWeeks] = createSignal<Record<number, boolean | undefined>>({});

	onMount(() => {
		const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
		onCleanup(() => clearInterval(timer));
	});

	const userId = () => authState.data?.uid;
	const [myRankingData, setMyRankingData] = createSignal<UseFireStoreReturn<RankingEntry[] | null | undefined> | null>(null);
	createEffect(() => {
		const uid = userId();
		if (uid) {
			setMyRankingData(useFirestore(
				query(
					collection(db, 'athlons', props.athlonId, 'rankings') as CollectionReference<RankingEntry>,
					where('userId', '==', uid),
				),
			));
		}
	});

	const getMyPoint = (gameId: string) => {
		if (!userId()) {
			return null;
		}
		const game = myRankingData()?.data?.[0]?.games.find((g) => g.gameId === gameId);
		return game?.hasScore ? game.point : null;
	};

	const startDate = () => Math.floor((props.athlon.startAt.toMillis() + JST_OFFSET) / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);

	const cells = createMemo(() => props.games.filter((g) => g.day !== undefined).map((game): DayCell => {
		const date = startDate() + ((game.day ?? 1) - 1) * 24 * 60 * 60 * 1000;
		const weekdayIndex = (new Date(date).getUTCDay() + 6) % 7;
		return {
			game,
			date,
			weekdayIndex,
			weekend: game.kind ? game.kind === 'weekend' : weekdayIndex >= 5,
			points: game.maxPoint * (game.weight ?? 1),
		};
	}));

	const weeks = createMemo(() => {
		const indexes = Array.from(new Set(cells().map((c) => c.game.week ?? 0))).sort((a, b) => a - b);
		return indexes.map((index) => {
			const definition = props.athlon.weeks?.find((w) => w.index === index);
			const weekCells = cells().filter((c) => (c.game.week ?? 0) === index);
			const days = weekCells.map((c) => c.game.day ?? 0);
			return {
				index,
				label: definition?.label ?? `第${index}週`,
				cells: weekCells,
				from: weekCells[0]?.date ?? 0,
				to: weekCells[weekCells.length - 1]?.date ?? 0,
				fromDay: Math.min(...days),
				toDay: Math.max(...days),
			};
		});
	});

	const todayDay = () => Math.floor((toJstDate(now()).getTime() - startDate()) / (24 * 60 * 60 * 1000)) + 1;
	const todayCell = () => cells().find((c) => c.game.day === todayDay());

	const isPublished = (cell: DayCell) => !cell.game.publishAt || cell.game.publishAt.toMillis() <= now();

	const publishLabel = (cell: DayCell) => {
		const publishAt = cell.game.publishAt?.toMillis();
		if (publishAt === undefined) {
			return '';
		}
		return `${formatMonthDay(publishAt)} ${formatTime(publishAt)} ${cell.weekend ? '開始' : '公開'}`;
	};

	const startLabel = (cell: DayCell) => {
		const publishAt = cell.game.publishAt?.toMillis();
		return publishAt === undefined ? '' : `${formatTime(publishAt)} 開始`;
	};

	const whenLabel = (cell: DayCell) => {
		const publishAt = cell.game.publishAt?.toMillis();
		if (publishAt === undefined) {
			return '';
		}
		return cell.weekend ? startLabel(cell) : `${formatTime(publishAt)} 公開`;
	};

	const isWeekOpen = (index: number, from: number, to: number) => {
		const explicit = openWeeks()[index];
		if (explicit !== undefined) {
			return explicit;
		}
		const today = toJstDate(now()).getTime();
		return today >= from && today < to + 24 * 60 * 60 * 1000;
	};

	const cellClass = (cell: DayCell) => {
		const classes = [styles.cell];
		if (cell.weekend) {
			classes.push(styles.cellWeekend);
		}
		if (!isPublished(cell)) {
			classes.push(styles.cellLocked);
		}
		if (cell.game.day === todayDay()) {
			classes.push(styles.cellToday);
		}
		return classes.join(' ');
	};

	const rowClass = (cell: DayCell) => {
		const classes = [styles.row];
		if (cell.weekend) {
			classes.push(styles.rowWeekend);
		} else if (cell.game.day === todayDay()) {
			classes.push(styles.rowToday);
		} else if (!isPublished(cell)) {
			classes.push(styles.rowLocked);
		}
		return classes.join(' ');
	};

	const renderStatus = (cell: DayCell): JSX.Element => {
		const point = () => getMyPoint(cell.game.id);
		return (
			<Show
				when={isPublished(cell)}
				fallback={<span>開催前</span>}
			>
				<Show
					when={point() !== null}
					fallback={<div class={styles.rowAction}>参加する</div>}
				>
					<div class={styles.rowDone}>{point()}<span class={styles.cellSub}> /{cell.points}</span></div>
				</Show>
			</Show>
		);
	};

	return (
		<>
			<Show when={todayCell()} keyed>
				{(cell) => (
					<div class={styles.todayBox}>
						<div class={styles.todayLabel}>
							TODAY
							<div class={styles.todayDate}>{formatMonthDay(now())}</div>
						</div>
						<div class={styles.todayName}><GameName game={cell.game}/></div>
						<Show when={isPublished(cell)}>
							<Button variant="contained" component={A} href={getGamePath(props.athlonId, cell.game)}>
								参加する
							</Button>
						</Show>
					</div>
				)}
			</Show>

			<Typography
				component="h2"
				textAlign="center"
				letterSpacing={30}
				fontSize={20}
				fontWeight="bold"
				mt={5}
				mb={2}
				paddingInlineStart={5}
			>
				競技一覧
			</Typography>

			<div class={styles.desktop}>
				<div class={styles.headRow}>
					<div/>
					<For each={WEEKDAY_LABELS}>
						{(label, i) => (
							<div class={`${styles.dayHead} ${i() >= 5 ? styles.dayHeadWeekend : ''}`}>{label}</div>
						)}
					</For>
				</div>
				<div class={styles.weekRows}>
					<For each={weeks()}>
						{(week) => (
							<div class={styles.weekRow}>
								<div class={styles.weekLabel}>
									<div class={styles.weekName}>{week.label}</div>
									<A class={styles.weekLink} href="./leaderboard">ランキング →</A>
								</div>
								<For each={WEEKDAY_LABELS}>
									{(_, wd) => {
										const cell = () => week.cells.find((c) => c.weekdayIndex === wd());
										return (
											<Show when={cell()} fallback={<div class={styles.blankCell}/>} keyed>
												{(c) => (
													<A class={cellClass(c)} href={getGamePath(props.athlonId, c.game)}>
														<div class={styles.cellHead}>
															<span class={styles.cellDay}>{new Date(c.date).getUTCDate()}</span>
															<Show when={c.game.day === todayDay()}>
																<span class={styles.todayChip}>今日</span>
															</Show>
															<span class={styles.cellPoints}>{c.points}点</span>
														</div>
														<div class={styles.cellName}><GameName game={c.game}/></div>
														<Show when={c.weekend ? c.game.publishAt : null}>
															<div class={styles.cellSub}>{startLabel(c)}</div>
														</Show>
														<Show
															when={isPublished(c)}
															fallback={<div class={styles.cellSub}>{publishLabel(c)}</div>}
														>
															<Show
																when={getMyPoint(c.game.id) !== null}
																fallback={<div class={styles.cellButton}>参加する</div>}
															>
																<div class={styles.cellDone}>
																	参加済 <span>{getMyPoint(c.game.id)} / {c.points}</span>
																</div>
															</Show>
														</Show>
													</A>
												)}
											</Show>
										);
									}}
								</For>
							</div>
						)}
					</For>
				</div>
			</div>

			<div class={styles.mobile}>
				<For each={weeks()}>
					{(week) => (
						<div class={styles.weekSection}>
							<button
								type="button"
								class={styles.weekHeader}
								aria-expanded={isWeekOpen(week.index, week.from, week.to)}
								onClick={() => setOpenWeeks({...openWeeks(), [week.index]: !isWeekOpen(week.index, week.from, week.to)})}
							>
								<span class={styles.weekHeaderText}>
									<span class={styles.weekHeaderTitle}>{week.label}</span>
									<span class={styles.weekHeaderRange}>
										{`${new Date(week.from).getUTCMonth() + 1}/${new Date(week.from).getUTCDate()}`}–{new Date(week.to).getUTCDate()}
									</span>
								</span>
								<ExpandMore
									sx={{transform: isWeekOpen(week.index, week.from, week.to) ? 'rotate(180deg)' : 'none'}}
								/>
							</button>
							<Show when={isWeekOpen(week.index, week.from, week.to)}>
								<For each={week.cells}>
									{(c) => (
										<A class={rowClass(c)} href={getGamePath(props.athlonId, c.game)}>
											<div class={styles.rowDate}>
												<div class={styles.rowWeekday}>{WEEKDAY_LABELS[c.weekdayIndex]}</div>
												<div class={styles.rowDay}>{new Date(c.date).getUTCDate()}</div>
											</div>
											<div class={styles.rowBody}>
												<div class={styles.rowName}><GameName game={c.game}/></div>
												<div class={styles.cellSub}>
													<span class={styles.rowPoints}>{c.points}点</span>
													{' · '}
													{whenLabel(c)}
												</div>
											</div>
											<div class={styles.rowStatus}>{renderStatus(c)}</div>
										</A>
									)}
								</For>
							</Show>
						</div>
					)}
				</For>
			</div>

			<p class={styles.notes}>
				参加できるのは各競技 1 回だけです。各週の凍結後に完了した参加は得点に反映されません。
			</p>
		</>
	);
};

export default AdventCalendar;
