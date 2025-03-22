/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */

import type {CollectionReference, DocumentReference, DocumentSnapshot, QuerySnapshot} from 'firebase-admin/firestore';
import {prop, sortBy, sum} from 'remeda';
import type {Game, PromptEngineeringResult, PromptEngineeringSubmission, PromptEngineeringVote, Score} from '~/lib/schema.js';
import {db} from './firebase.js';
import {RankedScore, calculateGameRanking} from './lib/scores.js';

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
