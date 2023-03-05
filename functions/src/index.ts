/* eslint-disable array-plural/array-plural */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {initializeApp} from 'firebase-admin/app';
import {DocumentReference, getFirestore} from 'firebase-admin/firestore';
import type {CollectionReference, CollectionGroup} from 'firebase-admin/firestore';
import {auth, firestore} from 'firebase-functions';
import {orderBy, sortBy, sum} from 'lodash';
import type {Athlon, Game, Score} from '../../src/lib/schema';
import {calculateScore} from './scores';

initializeApp();
const db = getFirestore();

// eslint-disable-next-line import/prefer-default-export
export const onUserCreated = auth.user().onCreate(async (user) => {
	await db.runTransaction(async (transaction) => {
		const userRef = db.collection('users').doc(user.uid);
		const userData = await transaction.get(userRef);
		if (userData.exists) {
			return;
		}

		const slackId = user.providerData
			.find((provider) => provider.providerId === 'oidc.slack')
			?.uid;

		transaction.set(userRef, {
			displayName: user.displayName ?? '',
			photoURL: user.photoURL ?? '',
			slug: user.uid,
			slackId: slackId ?? '',
		});
	});
});

export const onScoreChanged = firestore
	.document('games/{gameId}/scores/{userId}')
	.onWrite(async (change, context) => {
		const changedGameId = context.params.gameId;

		interface ScoreEntry extends Score {
			rank: number,
			point: number,
			userId: string,
		}

		const gamesRef = db.collection('games') as CollectionReference<Game>;
		const gameDoc = await gamesRef.doc(changedGameId).get();
		const athlon = gameDoc.get('athlon') as DocumentReference<Athlon>;
		const gameDocs = await (db.collection('games') as CollectionReference<Game>)
			.where('athlon', '==', athlon)
			.orderBy('order', 'asc')
			.get();
		const scoreDocs = await (db.collectionGroup('scores') as CollectionGroup<Score>)
			.where('athlon', '==', athlon)
			.get();

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
		const ranking = sortBy(userScoreEntries, 'point').map((userScoreEntry, index) => {
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

		await athlon.update({
			ranking,
		});
	});
