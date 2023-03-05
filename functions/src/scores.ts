import {ScoreConfiguration} from '../../src/lib/schema';

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
