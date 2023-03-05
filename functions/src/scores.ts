/* eslint-disable array-plural/array-plural */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */

import type {QuerySnapshot} from 'firebase-admin/firestore';
import {orderBy, sortBy, sum} from 'lodash';
import type {Game, Score, ScoreConfiguration} from '../../src/lib/schema';

// eslint-disable-next-line import/prefer-default-export
export const calculateScore = (rawScore: number, rank: number, maxPoint: number, configuration: ScoreConfiguration) => {
	if (configuration.type === 'score') {
		return Math.min(maxPoint, rawScore * configuration.scoreWeight);
	}

	const maxRankPoint = maxPoint * configuration.rankRatio;
	const maxScorePoint = maxPoint - maxRankPoint;

	const scorePoint = Math.min(maxScorePoint, rawScore * configuration.scoreWeight);
	const rankPoint = maxRankPoint * configuration.rankWeight / (rank + configuration.rankWeight);

	return scorePoint + rankPoint;
};

interface ScoreEntry extends Score {
	rank: number,
	point: number,
	userId: string,
}

export const calculateRanking = (gameDocs: QuerySnapshot<Game>, scoreDocs: QuerySnapshot<Score>) => {
	type ScoreUserId = Score & { userId: string };

	const scoresMap = new Map<string, ScoreUserId[]>();
	for (const score of scoreDocs.docs) {
		const gameId = score.ref.parent.parent?.id!;
		if (!scoresMap.has(gameId)) {
			scoresMap.set(gameId, []);
		}
		scoresMap.get(gameId)!.push({...score.data(), userId: score.id});
	}

	const gamesMap = new Map<string, Game>();
	for (const game of gameDocs.docs) {
		gamesMap.set(game.id, game.data());
	}

	const usersSet = new Set<string>();

	const gameScores: [string, ScoreEntry[]][] = [];

	for (const game of gameDocs.docs) {
		const gameId = game.id;
		const scores = scoresMap.get(gameId) ?? [];
		const sortedScores = orderBy(scores, ['rawScore', 'tiebreakScore'], ['desc', 'desc']);

		for (const score of scores) {
			usersSet.add(score.userId);
		}

		let previousRawScore: number | null = null;
		let previousTiebreakScore: number | null = null;
		let previousRank = 0;
		const sortedScoreEntries = sortedScores.map((score, index) => {
			const scoreEntry = {
				...score,
				rank: index,
				point: 0,
				userId: score.userId,
			} as ScoreEntry;

			if (score.rawScore === previousRawScore && score.tiebreakScore === previousTiebreakScore) {
				scoreEntry.rank = previousRank;
			} else {
				previousRank = index;
			}

			previousRawScore = score.rawScore;
			previousTiebreakScore = score.tiebreakScore;

			scoreEntry.point = calculateScore(
				scoreEntry.rawScore,
				scoreEntry.rank,
				game.data().maxPoint,
				game.data().scoreConfiguration,
			);

			return scoreEntry;
		});

		gameScores.push([gameId, sortedScoreEntries]);
	}

	interface UserScoreEntry {
		userId: string,
		point: number,
		games: {
			gameId: string,
			hasScore: boolean,
			point: number,
			rawScore: number,
			tiebreakScore: number,
			rank: number | null,
		}[],
	}

	const userScoreEntries = Array.from(usersSet).map((userId) => {
		const games = gameScores.map(([gameId, scores]) => {
			const score: ScoreEntry | undefined = scores.find((s) => s.userId === userId);
			if (!score) {
				return {
					gameId,
					hasScore: false,
					point: 0,
					rawScore: 0,
					tiebreakScore: 0,
					rank: null,
				};
			}
			return {
				gameId,
				hasScore: true,
				point: score.point,
				rawScore: score.rawScore,
				tiebreakScore: score.tiebreakScore,
				rank: score.rank,
			};
		});

		const pointSum = sum(games.map(({gameId, point}) => {
			const game = gamesMap.get(gameId);
			return point * (game?.weight ?? 1);
		}));

		return {
			userId,
			point: pointSum,
			games,
		} as UserScoreEntry;
	});

	interface SortedUserScoreEntry extends UserScoreEntry {
		rank: number,
	}

	let previousPoint: number | null = null;
	let previousRank = 0;
	const ranking = sortBy(userScoreEntries, 'point').reverse().map((userScoreEntry, index) => {
		let rank = index;
		if (userScoreEntry.point === previousPoint) {
			rank = previousRank;
		} else {
			previousRank = index;
		}

		previousPoint = userScoreEntry.point;

		return {
			...userScoreEntry,
			rank,
		} as SortedUserScoreEntry;
	});

	return ranking;
};
