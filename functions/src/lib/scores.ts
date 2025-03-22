import {sum, sortBy, prop} from 'remeda';
import type {Game, Score, ScoreConfiguration} from '~/lib/schema.js';

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
			throw new Error('rawScore cannot be larger than highestRawScore');
		}
		return rawScore / highestRawScore * maxPoint;
	}

	if (configuration.type === 'score') {
		return Math.min(maxPoint, rawScore * configuration.scoreWeight);
	}

	if (configuration.type === 'timestamp') {
		return rawScore * configuration.attenuationFactor ** rank;
	}

	const maxRankPoint = maxPoint * configuration.rankRatio;
	const maxScorePoint = maxPoint - maxRankPoint;

	const scorePoint = Math.min(maxScorePoint, rawScore * configuration.scoreWeight);
	const rankPoint = maxRankPoint * configuration.rankWeight / (rank + configuration.rankWeight);

	return scorePoint + rankPoint;
};

export interface RankedScore extends Score {
	rank: number,
	point: number,
	isAuthor: boolean,
}

export const calculateGameRanking = (game: Game, scores: Score[]) => {
	const sortedScores = sortBy(
		scores,
		[prop('rawScore'), 'desc'],
		[prop('tiebreakScore'), game.tiebreakOrder],
	);

	const maxRawScore = Math.max(...sortedScores.map(({rawScore}) => rawScore));

	let previousRawScore: number | null = null;
	let previousTiebreakScore: number | null = null;
	let previousRank = 0;
	const rankedScoresWithoutAdmin = sortedScores
		.filter((score) => !game.authors.includes(score.user))
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
				point: scoreValue,
				isAuthor: false,
			} as RankedScore;
		});

	const adminBonus = sum(
		rankedScoresWithoutAdmin
			.slice(0, game.adminBonus.count)
			.map((score) => score.point),
	) / game.adminBonus.count;

	const rankedScores = [
		...rankedScoresWithoutAdmin,
		...game.authors.map((admin) => ({
			athlon: game.athlon,
			rawScore: 0,
			tiebreakScore: 0,
			user: admin,
			rank: 0,
			isAuthor: true,
			point: adminBonus,
		} as RankedScore)),
	];

	return rankedScores;
};
