import type {Athlon, AthlonWeek, Game, GameParticipation} from '~/lib/schema.js';

interface TimestampLike {
	toMillis: () => number,
}

/**
 * Returns whether the game is visible to participants at the given time.
 * Games without `publishAt` are always considered published.
 */
export const isGamePublished = (game: Pick<Game, 'publishAt'>, now: Date | number) => {
	if (!game.publishAt) {
		return true;
	}
	const nowMillis = typeof now === 'number' ? now : now.getTime();
	return (game.publishAt as TimestampLike).toMillis() <= nowMillis;
};

/**
 * Returns the week definition the game belongs to, or null if it cannot be determined.
 */
export const getWeekOfGame = (athlon: Pick<Athlon, 'weeks'>, game: Pick<Game, 'week'>): AthlonWeek | null => {
	if (game.week === undefined || !athlon.weeks) {
		return null;
	}
	return athlon.weeks.find((week) => week.index === game.week) ?? null;
};

/**
 * Returns the time (ms since epoch) by which the participant must finish the game, or null if there is no limit.
 * Per-participant `duration` is applied from `startedAt`, and the game's `endAt` is also respected.
 */
export const getParticipationDeadline = (
	game: Pick<Game, 'duration' | 'endAt'>,
	participation: Pick<GameParticipation, 'startedAt'>,
): number | null => {
	const deadlines: number[] = [];
	if (typeof game.duration === 'number') {
		deadlines.push((participation.startedAt as TimestampLike).toMillis() + game.duration);
	}
	if (game.endAt) {
		deadlines.push((game.endAt as TimestampLike).toMillis());
	}
	return deadlines.length === 0 ? null : Math.min(...deadlines);
};
