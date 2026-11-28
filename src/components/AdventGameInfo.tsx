import {Alert, Stack, Table, TableBody, TableCell, TableRow, Typography} from '@suid/material';
import dayjs from 'dayjs';
import {createSignal, onCleanup, Show} from 'solid-js';
import {getWeekOfGame, isGamePublished} from '~/../lib/advent';
import type {Athlon, Game} from '~/lib/schema';

const formatDateTime = (date: Date) => dayjs(date).format('M月D日(ddd) HH:mm');

const formatDuration = (ms: number) => {
	const minutes = Math.round(ms / 60 / 1000);
	if (minutes >= 60 && minutes % 60 === 0) {
		return `${minutes / 60}時間`;
	}
	return `${minutes}分`;
};

/**
 * Advent Calendar の競技ページに表示する、非同期参加のための情報パネル。
 */
const AdventGameInfo = (props: {athlon: Athlon, game: Game}) => {
	const [now, setNow] = createSignal(Date.now());
	const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
	onCleanup(() => clearInterval(timer));

	const week = () => getWeekOfGame(props.athlon, props.game);
	const published = () => isGamePublished(props.game, now());
	const publishAt = () => props.game.publishAt?.toDate() ?? null;
	const isWeekend = () => props.game.kind === 'weekend';
	const duration = () => (typeof props.game.duration === 'number' ? props.game.duration : null);

	return (
		<Show when={props.athlon.type === 'advent-calendar'}>
			<Stack spacing={2} sx={{my: 3}}>
				<Typography variant="h5" component="h2" fontWeight="bold">
					参加について
				</Typography>
				<Show when={!published() && publishAt()}>
					{(date) => (
						<Alert severity="info">
							この競技は {formatDateTime(date())} に公開されます。それまでは競技のルールのみ閲覧できます。
						</Alert>
					)}
				</Show>
				<Table size="small">
					<TableBody>
						<TableRow>
							<TableCell component="th" scope="row">{isWeekend() ? '開始時刻' : '公開日時'}</TableCell>
							<TableCell>
								{publishAt() ? formatDateTime(publishAt() as Date) : '公開済み'}
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell component="th" scope="row">種別</TableCell>
							<TableCell>
								{isWeekend() ? '週末競技' : '平日競技'}(満点 {props.game.maxPoint} 点)
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell component="th" scope="row">制限時間</TableCell>
							<TableCell>{duration() === null ? 'なし' : formatDuration(duration() as number)}</TableCell>
						</TableRow>
						<Show when={week()}>
							{(w) => (
								<TableRow>
									<TableCell component="th" scope="row">所属する週</TableCell>
									<TableCell>
										{w().label}(凍結時刻: {formatDateTime(w().freezeAt.toDate())})
									</TableCell>
								</TableRow>
							)}
						</Show>
					</TableBody>
				</Table>
				<Typography variant="body2" component="ul" sx={{pl: 3, m: 0}}>
					<li>参加は 1 回だけです。</li>
					<Show when={duration() !== null}>
						<li>開始後 {formatDuration(duration() as number)} で終了します。</li>
					</Show>
					<Show when={week()}>
						{(w) => (
							<li>凍結時刻({formatDateTime(w().freezeAt.toDate())})までに完了しないと得点に入りません。</li>
						)}
					</Show>
				</Typography>
			</Stack>
		</Show>
	);
};

export default AdventGameInfo;
