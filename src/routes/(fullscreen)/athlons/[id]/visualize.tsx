import {useParams} from '@solidjs/router';
import {Link as LinkUi} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {CollectionReference, collection, doc, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, onCleanup, Show} from 'solid-js';
import styles from './visualize.module.scss';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import type {Athlon, RankingEntry} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';


interface GameVisualizeProps {
	athlon: Athlon,
}

const toggleStatus = (status: 'correct' | 'wrong' | 'pending' | undefined) => {
	switch (status) {
		case 'correct':
			return 'wrong';
		case 'wrong':
			return 'correct';
		case 'pending':
			return 'correct';
		default:
			return 'pending';
	}
};

const AthlonVisualize = (props: GameVisualizeProps) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const auth = getAuth(app);

	const authState = useAuth(auth);

	const athlonRankingsData = useFirestore(
		query(
			collection(db, 'athlons', props.athlon.id, 'rankings') as CollectionReference<RankingEntry>,
			orderBy('userId'),
		),
	);

	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', props.athlon.id)),
			orderBy('order'),
		),
	);

	createEffect(() => {
		console.log(authState.data);
		console.log(athlonRankingsData.data?.[0].point);
	});

	const [isGameActive, setIsGameActive] = createSignal(true);
	const [timerEnd, setTimerEnd] = createSignal<string | null>('15:45');
	const [currentTime, setCurrentTime] = createSignal(Math.floor(Date.now() / 1000));
	const [activeGames, setActiveGames] = createSignal<Set<string>>(new Set());

	const toggleIsGameActive = () => {
		setIsGameActive((prev) => !prev);
	};

	const handleInputTimerEnd = (event: InputEvent) => {
		const target = event.target as HTMLDivElement;
		const newTimerEnd = target.innerText.trim();
		setTimerEnd(newTimerEnd);
	};

	const intervalId = setInterval(() => {
		const now = Math.floor(Date.now() / 1000);
		setCurrentTime(now);
	}, 1000);
	onCleanup(() => {
		clearInterval(intervalId);
	});

	const remainingTime = createMemo(() => {
		const timerEndData = timerEnd();
		const currentTimeData = new Date(currentTime() * 1000);
		if (timerEndData === null) {
			return null;
		}

		const [hourComponent, minuteComponent] = timerEndData.split(':').map(Number);
		if (!Number.isFinite(hourComponent) || !Number.isFinite(minuteComponent)) {
			return null;
		}

		const currentHour = currentTimeData.getHours();
		const currentMinute = currentTimeData.getMinutes();
		const currentSecond = currentTimeData.getSeconds();
		const currentTimeSeconds = currentHour * 3600 + currentMinute * 60 + currentSecond;
		const timerEndSeconds = hourComponent * 3600 + minuteComponent * 60;

		const remainingSeconds = Math.max(timerEndSeconds - currentTimeSeconds, 0);
		const remainingMinutesString = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
		const remainingSecondsString = (remainingSeconds % 60).toString().padStart(2, '0');
		return `${remainingMinutesString}:${remainingSecondsString}`;
	});

	const rankings = createMemo(() => athlonRankingsData.data ?? []);

	return (
		<div class={styles.visualize}>
			<div class={styles.timerArea}>
				<div class={styles.gameTitleArea}>
					<div
						class={styles.gameTitleLabel}
						classList={{[styles.active]: isGameActive()}}
						onClick={toggleIsGameActive}
					>
						{isGameActive() ? '競技中' : '次の競技'}
					</div>
					<div class={styles.gameTitle} contentEditable>
						---
					</div>
				</div>
				<div class={styles.timeConfigurationArea}>
					<div class={styles.timerEndArea}>
						<span class={styles.timerEnd} contentEditable onInput={handleInputTimerEnd}>
							--:--
						</span>
						{isGameActive() ? ' 終了予定' : ' 開始予定'}
					</div>
					<div class={styles.remainingTime}>
						<Show when={isGameActive()} >
							<Show when={remainingTime()}>
								{(remainingTimeString) => (
									<>
										<div class={styles.remainingTimeLabel}>
											残り時間
										</div>
										<div class={styles.remainingTimeValue}>
											{remainingTimeString()}
										</div>
									</>
								)}
							</Show>
						</Show>
					</div>
				</div>
				<div class={styles.informationArea}>
					<div class={styles.description}>
						{isGameActive()
							? 'ポータルサイトから競技ページを開き、競技に参加してください。'
							: 'ポータルサイトを開いて待機してください。'}
					</div>
					<div class={styles.links}>
						<LinkUi>
							https://decathlon.hakatashi.com
						</LinkUi>
					</div>
				</div>
			</div>
			<div class={styles.rankingArea}>
				<div
					class={styles.ranking}
					style={{
						height: `${(athlonRankingsData.data?.length ?? 0) * 8}vmin`,
					}}
				>
					<div
						classList={{
							[styles.rankingItem]: true,
							[styles.rankingHeader]: true,
						}}
						style={{top: '0'}}
					>
						<div class={styles.rank}/>
						<div class={styles.userName}/>
						<div class={styles.totalPoint}/>
						<Collection data={gamesData}>
							{(game) => {
								const ruleData = useFirestore(game.rule);
								return (
									<Doc data={ruleData}>
										{(rule) => (
											<div
												class={styles.game}
												classList={{
													[styles.isActive]: activeGames().has(game.id),
												}}
												onClick={() => {
													setActiveGames((prev) => {
														const newSet = new Set(prev);
														if (newSet.has(game.id)) {
															newSet.delete(game.id);
														} else {
															newSet.add(game.id);
														}
														return newSet;
													});
												}}
											>
												{rule.shortName}
											</div>
										)}
									</Doc>
								);
							}}
						</Collection>
					</div>
					<Collection data={athlonRankingsData}>
						{(ranking) => {
							const siblingIndex = createMemo(() => {
								const siblings = rankings().filter((r) => r.rank === ranking.rank) ?? [];
								return siblings.findIndex((r) => r.userId === ranking.userId);
							});

							return (
								<div
									class={styles.rankingItem}
									style={{top: `${(ranking.rank + siblingIndex()) * 8 + 4}vmin`}}
									data-rank={ranking.rank}
								>
									<div class={styles.rank}>
										{ranking.rank + 1}
									</div>
									<div class={styles.userName}>
										<Username
											userId={ranking.userId}
										/>
									</div>
									<div class={styles.totalPoint}>
										{ranking.point.toFixed(1)}
									</div>
									<For each={ranking.games}>
										{(game) => (
											<div
												class={styles.game}
												classList={{
													[styles.hasScore]: game.hasScore,
													[styles.isAuthor]: game.isAuthor,
													[styles.isActive]: activeGames().has(game.gameId),
													[styles.best]: game.rank === 0,
													[styles.good]: game.rank !== null && game.rank < 5,
												}}
											>
												<Show when={game.hasScore}>
													<span class={styles.score}>{Math.round(game.point)}</span>
												</Show>
												<Show when={!game.hasScore}>
													<span class={styles.score}>-</span>
												</Show>
											</div>
										)}
									</For>
								</div>
							);
						}}
					</Collection>
				</div>
			</div>
		</div>
	);
};

const GameVisualizeWrapper = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonData = useAthlon(param.id);

	return (
		<Doc data={athlonData}>
			{(athlon) => (
				<AthlonVisualize
					athlon={athlon}
				/>
			)}
		</Doc>
	);
};

export default GameVisualizeWrapper;
