import {sum} from 'lodash';
import type {Game, Score, ScoreConfiguration} from '../src/lib/schema';

export const calculateScore = (
	rawScore: number,
	rank: number,
	maxPoint: number,
	configuration: ScoreConfiguration,
	highestRawScore?: number,
) => {
	if (configuration.type === 'max-ratio') {
		if (highestRawScore === undefined) {
			throw new Error('Argument error: highestRawScore must be provided for max-ratio configuration');
		}
		if (rawScore > highestRawScore) {
			throw new Error('highestRawScore cannot be larger than rawScore');
		}
		return rawScore / highestRawScore * maxPoint;
	}

	if (configuration.type === 'score') {
		return Math.min(maxPoint, rawScore * configuration.scoreWeight);
	}

	const maxRankPoint = maxPoint * configuration.rankRatio;
	const maxScorePoint = maxPoint - maxRankPoint;

	const scorePoint = Math.min(maxScorePoint, rawScore * configuration.scoreWeight);
	const rankPoint = maxRankPoint * configuration.rankWeight / (rank + configuration.rankWeight);

	return scorePoint + rankPoint;
};

interface RankedScore extends Score {
	rank: number,
	score: number,
	isAdmin: boolean,
}

export const calculateRanking = (game: Game, scores: Score[]) => {
	const maxRawScore = Math.max(...scores.map(({rawScore}) => rawScore));

	let previousRawScore: number | null = null;
	let previousTiebreakScore: number | null = null;
	let previousRank = 0;
	// eslint-disable-next-line array-plural/array-plural
	const rankedScoresWithoutAdmin = scores
		.filter((score) => !game.admins.includes(score.user))
		.map((score, index) => {
			let rank = index;
			if (score.rawScore === previousRawScore && score.tiebreakScore === previousTiebreakScore) {
				rank = previousRank;
			} else {
				previousRank = index;
			}

			previousRawScore = score.rawScore;
			previousTiebreakScore = score.tiebreakScore;

			const scoreValue = calculateScore(
				score.rawScore,
				rank,
				game.maxPoint,
				game.scoreConfiguration,
				maxRawScore,
			);

			return {
				...score,
				id: score.id,
				rank,
				score: scoreValue,
				isAdmin: false,
			} as RankedScore;
		});


	const adminBonus = sum(
		rankedScoresWithoutAdmin
			.slice(0, game.adminBonus.count)
			.map((score) => score.score),
	) / game.adminBonus.count;

	const rankedScores = [
		...rankedScoresWithoutAdmin,
		...game.admins.map((admin) => ({
			athlon: game.athlon,
			rawScore: 0,
			tiebreakScore: 0,
			user: admin,
			rank: 0,
			isAdmin: true,
			score: adminBonus,
		} as RankedScore)),
	];

	return rankedScores;
};
