
import {initializeApp} from 'firebase-admin/app';
import {DocumentReference, getFirestore} from 'firebase-admin/firestore';
import type {CollectionReference, CollectionGroup} from 'firebase-admin/firestore';
import {auth, firestore} from 'firebase-functions';
import type {Athlon, Game, Score} from '../../src/lib/schema';
import {calculateRanking} from './scores';

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
	.onWrite(async (_change, context) => {
		const changedGameId = context.params.gameId;

		const gamesRef = db.collection('games') as CollectionReference<Game>;

		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gamesRef.doc(changedGameId));
			const athlon = gameDoc.get('athlon') as DocumentReference<Athlon>;
			const gameDocs = await transaction.get(
				(db.collection('games') as CollectionReference<Game>)
					.where('athlon', '==', athlon)
					.orderBy('order', 'asc'),
			);
			const scoreDocs = await transaction.get(
				(db.collectionGroup('scores') as CollectionGroup<Score>)
					.where('athlon', '==', athlon),
			);

			const ranking = calculateRanking(gameDocs, scoreDocs);

			transaction.update(athlon, {
				ranking,
			});
		});
	});
