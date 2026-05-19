/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */

import type {CollectionReference, DocumentReference, DocumentSnapshot, QuerySnapshot} from 'firebase-admin/firestore';
import {prop, sortBy, sum} from 'remeda';
import type {Game, PromptEngineeringResult, PromptEngineeringSubmission, PromptEngineeringVote, ReferenceRecord, Score} from '~/lib/schema.js';
import {db} from './firebase.js';
import {RankedScore, calculateGameRanking, calculateReferenceScore} from './lib/scores.js';

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
	const ranking = sortBy(userScoreEntries, prop('point')).reverse().map((userScoreEntry, index) => {
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

export const calculateReferenceRecordRankings = (
	referenceRecords: {id: string, data: ReferenceRecord}[],
	gameDocs: QuerySnapshot<Game>,
	scoreDocs: QuerySnapshot<Score>,
	userRanking: ReturnType<typeof calculateRanking>,
) => {
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

	const gameRealScores = new Map<string, RankedScore[]>();
	const gameRealMaxRawScore = new Map<string, number>();
	for (const gameDoc of gameDocs.docs) {
		const scores = scoresMap.get(gameDoc.id) ?? [];
		const ranked = calculateGameRanking(gameDoc.data(), scores);
		const realScores = ranked.filter((s) => !s.isAuthor);
		gameRealScores.set(gameDoc.id, realScores);
		gameRealMaxRawScore.set(
			gameDoc.id,
			realScores.length > 0 ? Math.max(...realScores.map((s) => s.rawScore)) : 0,
		);
	}

	return referenceRecords.map(({id: recordId, data: record}) => {
		const games = gameDocs.docs.map((gameDoc) => {
			const gameId = gameDoc.id;
			const game = gameDoc.data();
			const refScore = record.scores[gameId];

			if (!refScore) {
				return {gameId, hasScore: false, isAuthor: false, point: 0, rawScore: 0, tiebreakScore: 0, rank: null};
			}

			const realScores = gameRealScores.get(gameId) ?? [];
			const realMaxRawScore = gameRealMaxRawScore.get(gameId) ?? 0;

			const rank = realScores.filter((s) => {
				if (s.rawScore > refScore.rawScore) {
					return true;
				}
				if (s.rawScore === refScore.rawScore) {
					return game.tiebreakOrder === 'asc'
						? s.tiebreakScore < refScore.tiebreakScore
						: s.tiebreakScore > refScore.tiebreakScore;
				}
				return false;
			}).length;

			const point = calculateReferenceScore(
				refScore.rawScore, rank, game.maxPoint, game.scoreConfiguration, realMaxRawScore,
			);

			return {gameId, hasScore: true, isAuthor: false, point, rawScore: refScore.rawScore, tiebreakScore: refScore.tiebreakScore, rank};
		});

		const pointSum = sum(games.map(({gameId, point}) => point * (gamesMap.get(gameId)?.weight ?? 1)));
		const rank = userRanking.filter((u) => u.point > pointSum).length;

		return {userId: '', referenceRecordId: recordId, athlonId: record.athlonId, point: pointSum, rank, games};
	});
};

export const updatePromptEngineeringScores = async (game: DocumentSnapshot<Game>) => {
	const gameData = game.data();
	if (!gameData) {
		throw new Error('Invalid game data');
	}

	if (gameData.rule.path !== 'gameRules/prompt-engineering') {
		throw new Error('Invalid game rule');
	}

	await db.runTransaction(async (transaction) => {
		const submissionsRef = game.ref.collection('submissions') as CollectionReference<PromptEngineeringSubmission>;
		const submissions = await transaction.get(submissionsRef);
		const votesRef = game.ref.collection('votes') as CollectionReference<PromptEngineeringVote>;
		const votes = await transaction.get(votesRef);
		const resultsRef = game.ref.collection('results') as CollectionReference<PromptEngineeringResult>;
		const results = await transaction.get(resultsRef);

		const formatScoreMap = new Map<string, number>();
		for (const result of results.docs) {
			const {point} = result.data();
			formatScoreMap.set(result.id, point);
		}

		const rawVoteScoreMap = new Map<string, number>();
		const votesMap = new Map<string, {userId: string, order: number}[]>();
		for (const vote of votes.docs) {
			const {userId, choices} = vote.data();
			for (const [order, choice] of choices.entries()) {
				if (!votesMap.has(choice)) {
					votesMap.set(choice, []);
				}
				votesMap.get(choice)!.push({userId, order});
				rawVoteScoreMap.set(choice, (rawVoteScoreMap.get(choice) ?? 0) + (3 - order));
			}
		}

		const maxRawVoteScore = Math.max(...rawVoteScoreMap.values());
		const voteScoreMap = new Map<string, number>();
		for (const [userId, rawVoteScore] of rawVoteScoreMap) {
			voteScoreMap.set(userId, rawVoteScore / maxRawVoteScore * 50);
		}

		for (const submission of submissions.docs) {
			const {userId} = submission.data();
			const formatScore = formatScoreMap.get(userId) ?? 0;
			const rawVoteScore = rawVoteScoreMap.get(userId) ?? 0;
			const voteScore = voteScoreMap.get(userId) ?? 0;
			const targetVotes = votesMap.get(userId) ?? [];
			const score = formatScore + voteScore;

			transaction.update(submission.ref, {
				formatScore,
				rawVoteScore,
				voteScore,
				votes: targetVotes,
				score,
			});

			const scoreRef = game.ref.collection('scores').doc(userId) as DocumentReference<Score>;
			transaction.set(scoreRef, {
				athlon: gameData.athlon,
				rawScore: score,
				tiebreakScore: 0,
				user: userId,
			});
		}
	});
};
