import {ScoreConfiguration} from '../src/lib/schema';

// eslint-disable-next-line import/prefer-default-export
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
