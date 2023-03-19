
import assert from 'assert';
import {initializeApp} from 'firebase-admin/app';
import {DocumentReference, getFirestore} from 'firebase-admin/firestore';
import type {CollectionReference, CollectionGroup} from 'firebase-admin/firestore';
import {auth, firestore, https} from 'firebase-functions';
import mdiff from 'mdiff';
import type {Athlon, Game, Score, TypingJapaneseSubmission} from '../../src/lib/schema';
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

const normalizeTypingJapaneseText = (input: string) => (
	input.normalize('NFKC')
		.replaceAll(',', '、')
		.replaceAll('.', '。')
		.replaceAll(/\s/g, '')
);

export const submitTypingJapaneseScore = https.onCall(async (data, context) => {
	const {gameId, submissionText} = data;
	const uid = context.auth?.uid;

	assert(typeof gameId === 'string');
	assert(typeof submissionText === 'string');
	assert(typeof uid === 'string');

	const gameDoc = await (db.collection('games') as CollectionReference<Game>).doc(gameId).get();
	assert(gameDoc.exists);

	const gameData = gameDoc.data();
	assert(gameData);

	assert(gameData.rule && gameData.rule.path === 'gameRules/typing-japanese');

	const correctText = normalizeTypingJapaneseText(
		gameData.configuration.correctText,
	);
	assert(typeof correctText === 'string');

	const submissionRef = db.doc(`games/${gameId}/submissions/${uid}`) as DocumentReference<TypingJapaneseSubmission>;
	const submissionData = await submissionRef.get();
	assert(!submissionData.exists, 'You already submitted score for this game.');

	const trimmedSubmissionText = normalizeTypingJapaneseText(
		submissionText.slice(0, correctText.length),
	);
	const diff = mdiff(correctText, trimmedSubmissionText);
	const lcs = diff.getLcs();

	const diffTokens = [] as {
		pos: number,
		type: 'common' | 'deletion' | 'addition',
		token: string,
	}[];

	diff.scanCommon((_startA, _endA, startB, endB) => {
		diffTokens.push({
			pos: (startB + endB) / 2,
			type: 'common',
			token: trimmedSubmissionText.slice(startB, endB),
		});
	});

	let additionCount = 0;
	diff.scanDiff((startA, endA, startB, endB) => {
		if (startA !== endA) {
			diffTokens.push({
				pos: endB,
				type: 'deletion',
				token: correctText.slice(startA, endA),
			});
		}
		if (startB !== endB) {
			diffTokens.push({
				pos: (startB + endB) / 2,
				type: 'addition',
				token: trimmedSubmissionText.slice(startB, endB),
			});
			additionCount += endB - startB;
		}
	});

	diffTokens.sort((a, b) => a.pos - b.pos);

	const score = lcs === null ? 0 : Math.max(0, lcs.length - additionCount);

	await submissionRef.set({
		athlon: gameData.athlon,
		score,
		submissionText,
		diffTokens: diffTokens.map(({type, token}) => ({type, token})),
	});

	return lcs;
});
