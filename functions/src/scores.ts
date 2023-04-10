/* eslint-disable array-plural/array-plural */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */

import type {QuerySnapshot} from 'firebase-admin/firestore';
import {sortBy, sum} from 'lodash';
import type {Game, Score} from '~/lib/schema';
import {RankedScore, calculateGameRanking} from './lib/scores';

// eslint-disable-next-line import/prefer-default-export
export const calculateRanking = (gameDocs: QuerySnapshot<Game>, scoreDocs: QuerySnapshot<Score>) => {
	const usersSet = new Set<string>();
	const scoresMap = new Map<string, Score[]>();
	for (const score of scoreDocs.docs) {
		const gameId = score.ref.parent.parent?.id!;
		if (!scoresMap.has(gameId)) {
			scoresMap.set(gameId, []);
		}
		scoresMap.get(gameId)!.push(score.data());
	}

	const gamesMap = new Map<string, Game>();
	for (const game of gameDocs.docs) {
		gamesMap.set(game.id, game.data());
	}

	const gameScores: [string, RankedScore[]][] = [];

	for (const game of gameDocs.docs) {
		const gameId = game.id;
		const scores = scoresMap.get(gameId) ?? [];
		const rankedScores = calculateGameRanking(game.data(), scores);
		for (const rankedScore of rankedScores) {
			usersSet.add(rankedScore.user);
		}
		gameScores.push([gameId, rankedScores]);
	}

	interface UserScoreEntry {
		userId: string,
		point: number,
		games: {
			gameId: string,
			hasScore: boolean,
			isAuthor: boolean,
			point: number,
			rawScore: number,
			tiebreakScore: number,
			rank: number | null,
		}[],
	}

	const userScoreEntries = Array.from(usersSet).map((userId) => {
		const games = gameScores.map(([gameId, scores]) => {
			const score = scores.find((s) => s.user === userId);
			if (!score) {
				return {
					gameId,
					hasScore: false,
					isAuthor: false,
					point: 0,
					rawScore: 0,
					tiebreakScore: 0,
					rank: null,
				};
			}
			return {
				gameId,
				hasScore: true,
				isAuthor: score.isAuthor,
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
