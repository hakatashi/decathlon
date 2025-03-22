import assert from 'node:assert';
import {WebClient} from '@slack/web-api';
import type {DocumentReference, CollectionReference, CollectionGroup} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/firestore';
import {onCall} from 'firebase-functions/https';
import {HttpsError, beforeUserCreated, beforeUserSignedIn} from 'firebase-functions/identity';
import type {AuthUserRecord} from 'firebase-functions/lib/common/providers/identity';
import {info as logInfo, error as logError} from 'firebase-functions/logger';
import {defineString} from 'firebase-functions/params';
import {user as authUser} from 'firebase-functions/v1/auth';
import mdiff from 'mdiff';
import type {Athlon, Game, PromptEngineeringVote, Score, TypingJapaneseSubmission, SlackUserInfo} from '~/lib/schema.js';
import {db} from './firebase.js';
import {calculateRanking, updatePromptEngineeringScores} from './scores.js';

export * from './esolang.js';

const SLACK_TOKEN = defineString('SLACK_TOKEN');

const slack = new WebClient(SLACK_TOKEN.value());

const checkSlackTeamEligibility = async (user: AuthUserRecord) => {
	logInfo('Checking Slack team eligibility');
	logInfo(user, {structuredData: true});

	const slackUserInfosRef = db.collection('slackUserInfo') as CollectionReference<SlackUserInfo>;

	let isUserFound = false;

	for (const providerData of user.providerData) {
		if (providerData.providerId === 'oidc.slack') {
			const slackId = providerData.uid;
			try {
				const response = await slack.users.info({user: slackId});
				if (response.user) {
					await slackUserInfosRef.doc(user.uid).set(response.user);
					isUserFound = true;
					break;
				}
			} catch (error) {
				logError(error, {structuredData: true});
			}
		}
	}

	if (!isUserFound) {
		throw new HttpsError('permission-denied', 'The user is not found in valid Slack team.');
	}
};

export const beforeUserCreatedBlockingFunction = beforeUserCreated(async (event) => {
	if (!event.data) {
		throw new HttpsError('invalid-argument', 'No data provided.');
	}

	await checkSlackTeamEligibility(event.data);
});

export const beforeUserSignInBlockingFunction = beforeUserSignedIn(async (event) => {
	if (!event.data) {
		throw new HttpsError('invalid-argument', 'No data provided.');
	}

	await checkSlackTeamEligibility(event.data);
});

// Firebase Functions v2 does not support onCreate for user creation events yet
export const onUserCreated = authUser().onCreate(async (user) => {
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

export const onScoreChanged = onDocumentWritten(
	'games/{gameId}/scores/{userId}',
	async (event) => {
		const changedGameId = event.params.gameId;

		const gamesRef = db.collection('games') as CollectionReference<Game>;

		await db.runTransaction(async (transaction) => {
			const gameDoc = await transaction.get(gamesRef.doc(changedGameId));
			const athlon = gameDoc.get('athlon') as DocumentReference<Athlon>;
			const athlonData = (await athlon.get()).data();
			if (athlonData && athlonData.endAt.toDate() < new Date()) {
				return;
			}
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
	},
);

export const resetGameSubmission = onCall(async (request) => {
	const {gameId} = request.data;
	const uid = request.auth?.uid;

	assert(typeof gameId === 'string');
	assert(typeof uid === 'string');

	const gameDoc = await (db.collection('games') as CollectionReference<Game>).doc(gameId).get();
	assert(gameDoc.exists);

	const gameData = gameDoc.data();
	assert(gameData);
	assert(gameData.isUserResettable);

	const submissionRef = db.doc(`games/${gameId}/submissions/${uid}`) as DocumentReference<TypingJapaneseSubmission>;
	const submissionData = await submissionRef.get();
	if (submissionData.exists) {
		await submissionRef.delete();
	}

	const scoreRef = db.doc(`games/${gameId}/scores/${uid}`) as DocumentReference<Score>;
	const scoreData = await scoreRef.get();
	if (scoreData.exists) {
		await scoreRef.delete();
	}
});

const normalizeTypingJapaneseText = (input: string) => (
	input.normalize('NFKC')
		.replaceAll(',', '、')
		.replaceAll('.', '。')
		.replaceAll(/\s/g, '')
);

export const submitTypingJapaneseScore = onCall(async (request) => {
	const {gameId, submissionText} = request.data;
	const uid = request.auth?.uid;

	assert(typeof gameId === 'string');
	assert(typeof submissionText === 'string');
	assert(typeof uid === 'string');

	const gameDoc = await (db.collection('games') as CollectionReference<Game>).doc(gameId).get();
	assert(gameDoc.exists);

	const gameData = gameDoc.data();
	assert(gameData);

	assert(gameData.rule && gameData.rule.path === 'gameRules/typing-japanese');

	const correctText = normalizeTypingJapaneseText(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(gameData.configuration as any).correctText,
	);
	assert(typeof correctText === 'string');

	const submissionRef = db.doc(`games/${gameId}/submissions/${uid}`) as DocumentReference<TypingJapaneseSubmission>;
	const scoreRef = db.doc(`games/${gameId}/scores/${uid}`) as DocumentReference<Score>;

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
		userId: uid,
	});

	await scoreRef.set({
		athlon: gameData.athlon,
		rawScore: score,
		tiebreakScore: 0,
		user: uid,
	});

	return score;
});

export const submitPromptEngineeringVote = onCall(async (request) => {
	const {gameId, choices} = request.data;
	const uid = request.auth?.uid;

	assert(typeof gameId === 'string');
	assert(Array.isArray(choices));
	assert(typeof uid === 'string');

	const gameDoc = await (db.collection('games') as CollectionReference<Game>).doc(gameId).get();
	assert(gameDoc.exists);

	const gameData = gameDoc.data();
	assert(gameData);

	assert(gameData.rule && gameData.rule.path === 'gameRules/prompt-engineering');

	const voteRef = db.doc(`games/${gameId}/votes/${uid}`) as DocumentReference<PromptEngineeringVote>;

	const voteData = await voteRef.get();
	assert(!voteData.exists, 'You already voted for this game.');

	assert(choices.length === 3);
	assert(choices.every((choice) => typeof choice === 'string'));

	// TODO: Add more validation (uniqueness, existence of vote target, etc.)

	await voteRef.set({
		choices,
		userId: uid,
	});
});

export const onVoteChanged = onDocumentWritten(
	'games/{gameId}/votes/{userId}',
	async (event) => {
		const changedGameId = event.params.gameId;

		const gameDoc = await (db.collection('games') as CollectionReference<Game>).doc(changedGameId).get();
		const gameData = gameDoc.data();
		if (!gameData) {
			return;
		}

		if (gameData.rule.path === 'gameRules/prompt-engineering') {
			await updatePromptEngineeringScores(gameDoc);
		}
	},
);
