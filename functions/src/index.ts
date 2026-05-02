import assert from 'node:assert';
import {WebClient} from '@slack/web-api';
import {FieldValue} from 'firebase-admin/firestore';
import type {DocumentReference, CollectionReference, CollectionGroup} from 'firebase-admin/firestore';
import {onDocumentWritten} from 'firebase-functions/firestore';
import {onCall} from 'firebase-functions/https';
import {HttpsError, beforeUserCreated, beforeUserSignedIn} from 'firebase-functions/identity';
import type {AuthUserRecord} from 'firebase-functions/identity';
import {info as logInfo, error as logError} from 'firebase-functions/logger';
import {defineString} from 'firebase-functions/params';
import {user as authUser} from 'firebase-functions/v1/auth';
import {Diff} from 'mdiff';
import type {Athlon, Game, PromptEngineeringVote, Score, TypingJapaneseSubmission, SlackUserInfo, AthlonRanking} from '~/lib/schema.js';
import {db} from './firebase.js';
import {calculateRanking, updatePromptEngineeringScores} from './scores.js';

export * from './submissions.js';
export * from './executions.js';

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
			isAdmin: false,
			description: '',
			participationCount: 0,
		});
	});
});

export const onRankingWritten = onDocumentWritten(
	'athlons/{athlonId}/rankings/{userId}',
	async (event) => {
		const {userId} = event.params;
		const existed = event.data?.before?.exists ?? false;
		const exists = event.data?.after?.exists ?? false;

		let delta = 0;
		if (!existed && exists) {
			delta = 1;
		} else if (existed && !exists) {
			delta = -1;
		}
		if (delta === 0) {
			return;
		}

		await db.collection('users').doc(userId).set(
			{participationCount: FieldValue.increment(delta)},
			{merge: true},
		);
	},
);

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
				logInfo('Athlon is ended, skipping ranking update', {
					athlonId: athlon.id,
					endAt: athlonData.endAt.toDate(),
				});
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

			const athlonRankings = athlon.collection('rankings') as CollectionReference<AthlonRanking>;
			const existingRankings = await transaction.get(athlonRankings);

			const newUserIds = new Set(ranking.map((entry) => entry.userId));
			for (const existingEntry of existingRankings.docs) {
				if (!newUserIds.has(existingEntry.id)) {
					transaction.delete(existingEntry.ref);
				}
			}

			for (const rankingEntry of ranking) {
				const {userId} = rankingEntry;
				const rankingEntryRef = athlonRankings.doc(userId);
				transaction.set(rankingEntryRef, {...rankingEntry, athlonId: athlon.id});
			}
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

interface DiffToken {type: 'common' | 'deletion' | 'addition', token: string}

const computeScoreV1 = (correct: string, input: string) => {
	const trimmed = input.slice(0, correct.length);
	const diff = new Diff(correct, trimmed);
	const lcs = diff.getLcs();

	const posTokens: {pos: number, type: 'common' | 'deletion' | 'addition', token: string}[] = [];

	diff.scanCommon((_startA, _endA, startB, endB) => {
		posTokens.push({pos: (startB + endB) / 2, type: 'common', token: trimmed.slice(startB, endB)});
	});

	let additionCount = 0;
	diff.scanDiff((startA, endA, startB, endB) => {
		if (startA !== endA) {
			posTokens.push({pos: endB, type: 'deletion', token: correct.slice(startA, endA)});
		}
		if (startB !== endB) {
			posTokens.push({pos: (startB + endB) / 2, type: 'addition', token: trimmed.slice(startB, endB)});
			additionCount += endB - startB;
		}
	});
	posTokens.sort((a, b) => a.pos - b.pos);

	const score = lcs === null ? 0 : Math.max(0, lcs.length - additionCount);
	return {score, diffTokens: posTokens.map(({type, token}) => ({type, token}))};
};

const buildDpRow = (ops: Uint8Array, prevRow: number[], currRow: number[], correct: string, trimmed: string, i: number, m: number) => {
	const stride = m + 1;
	currRow[0] = i;
	ops[i * stride] = 1;
	for (let j = 1; j <= m; j++) {
		if (correct[i - 1] === trimmed[j - 1]) {
			currRow[j] = prevRow[j - 1];
			ops[i * stride + j] = 0;
		} else {
			const del = prevRow[j];
			const ins = currRow[j - 1];
			const sub = prevRow[j - 1];
			const minCost = Math.min(del, ins, sub);
			currRow[j] = 1 + minCost;
			let opCode = 3;
			if (del === minCost) {
				opCode = 1;
			} else if (ins === minCost) {
				opCode = 2;
			}
			ops[i * stride + j] = opCode;
		}
	}
};

const backtraceV2 = (ops: Uint8Array, correct: string, trimmed: string, optN: number, m: number): DiffToken[] => {
	const stride = m + 1;
	const chars: {type: 'common' | 'deletion' | 'addition', ch: string}[] = [];
	let bi = optN;
	let bj = m;
	while (bi > 0 || bj > 0) {
		const op = ops[bi * stride + bj];
		if (op === 0) {
			chars.push({type: 'common', ch: correct[bi - 1]});
			bi--;
			bj--;
		} else if (op === 1) {
			chars.push({type: 'deletion', ch: correct[bi - 1]});
			bi--;
		} else if (op === 2) {
			chars.push({type: 'addition', ch: trimmed[bj - 1]});
			bj--;
		} else {
			// substitute: deletion of correct char then addition of typed char
			chars.push({type: 'addition', ch: trimmed[bj - 1]}, {type: 'deletion', ch: correct[bi - 1]});
			bi--;
			bj--;
		}
	}
	chars.reverse();

	const diffTokens: DiffToken[] = [];
	for (const {type, ch} of chars) {
		const last = diffTokens.at(-1);
		if (last?.type === type) {
			last.token += ch;
		} else {
			diffTokens.push({type, token: ch});
		}
	}
	return diffTokens;
};

// Computes min_n S(n) where S(n) = edit_distance(correct[:n], input) via a single O(n*m) DP pass.
// rawScore = argmin_n S(n) - min_n S(n); higher means more characters effectively matched.
const computeScoreV2 = (correct: string, input: string) => {
	const trimmed = input.slice(0, correct.length);
	const n = correct.length;
	const m = trimmed.length;

	// ops[i*(m+1)+j]: 0=match, 1=delete(i-1,j), 2=insert(i,j-1), 3=substitute(i-1,j-1)
	const ops = new Uint8Array((n + 1) * (m + 1));
	for (let j = 1; j <= m; j++) {
		ops[j] = 2;
	}

	const editDistances = new Int32Array(n + 1);
	editDistances[0] = m;

	let prevRow: number[] = Array.from({length: m + 1}, (_, j) => j);
	let currRow: number[] = new Array(m + 1) as number[];

	for (let i = 1; i <= n; i++) {
		buildDpRow(ops, prevRow, currRow, correct, trimmed, i, m);
		editDistances[i] = currRow[m];
		[prevRow, currRow] = [currRow, prevRow];
	}

	// Find n* = argmin S(n); prefer larger n on ties (higher rawScore)
	let minDist = editDistances[0];
	let optN = 0;
	for (let i = 1; i <= n; i++) {
		if (editDistances[i] <= minDist) {
			minDist = editDistances[i];
			optN = i;
		}
	}

	return {
		score: Math.max(0, m - minDist),
		editDistance: minDist,
		diffTokens: backtraceV2(ops, correct, trimmed, optN, m),
	};
};

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

	assert(gameData.rule?.path === 'gameRules/typing-japanese');

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const config = gameData.configuration as any;
	const version: number = config.version ?? 1;

	const correctText = normalizeTypingJapaneseText(config.correctText);
	assert(typeof correctText === 'string');

	const submissionRef = db.doc(`games/${gameId}/submissions/${uid}`) as DocumentReference<TypingJapaneseSubmission>;
	const scoreRef = db.doc(`games/${gameId}/scores/${uid}`) as DocumentReference<Score>;

	const submissionData = await submissionRef.get();
	assert(submissionData.exists === false, 'You already submitted score for this game.');

	const normalizedInput = normalizeTypingJapaneseText(submissionText);

	let score: number;
	let editDistance: number | undefined;
	let diffTokens: DiffToken[];

	if (version === 2) {
		const result = computeScoreV2(correctText, normalizedInput);
		score = result.score;
		editDistance = result.editDistance;
		diffTokens = result.diffTokens;
	} else {
		const result = computeScoreV1(correctText, normalizedInput);
		score = result.score;
		diffTokens = result.diffTokens;
	}

	await submissionRef.set({
		athlon: gameData.athlon,
		score,
		submissionText,
		...(editDistance !== undefined ? {editDistance} : {}),
		diffTokens,
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
