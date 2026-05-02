import assert, {AssertionError} from 'node:assert';
import type {DocumentReference} from 'firebase-admin/firestore';
import {Queue} from 'bullmq';
import {onDocumentCreated} from 'firebase-functions/firestore';
import {info as logInfo, warn as logWarn} from 'firebase-functions/logger';
import {defineString} from 'firebase-functions/params';
import {Redis} from 'ioredis';
import type {CodegolfConfiguration, CodegolfSubmission, EsolangConfiguration, EsolangRanking, EsolangSubmission, EsolangTestSubmission, Game, QuantumComputingConfiguration, QuantumComputingSubmission, ReversingDiffSubmission, SqlSubmission} from '~/lib/schema.js';
import {db, storage} from './firebase.js';

const REDIS_URL = defineString('REDIS_URL');

interface DecathlonJobData {
	gameId: string;
	submissionId: string;
	imageId: string;
	code: string;
	testcases: {stdin: string}[];
	codeEncoding?: 'utf-8' | 'base64';
	timeoutMs?: number;
}

// Converts Firestore binary data (admin SDK returns Buffer/Uint8Array/Blob) to Buffer
const toBuffer = (code: unknown): Buffer => {
	if (Buffer.isBuffer(code)) {
		return code;
	}
	if (code instanceof Uint8Array) {
		return Buffer.from(code);
	}
	if (code && typeof (code as {toUint8Array?: unknown}).toUint8Array === 'function') {
		return Buffer.from((code as {toUint8Array: () => Uint8Array}).toUint8Array());
	}
	if (typeof code === 'string') {
		return Buffer.from(code, 'utf-8');
	}
	return Buffer.alloc(0);
};

let globalQueue: Queue | null = null;
const getQueue = () => {
	if (!globalQueue) {
		globalQueue = new Queue('decathlon', {
			connection: new Redis(REDIS_URL.value(), {maxRetriesPerRequest: null}),
		});
	}
	return globalQueue;
};

const getQuantumComputingJudgeCode = (config: QuantumComputingConfiguration, challengeId: string | null) => {
	if (config.version === 1) {
		return config.judgeCode;
	}
	if (config.version === 2) {
		assert(typeof challengeId === 'string', 'challengeId is required for version 2');
		const challenge = config.challenges.find((c) => c.id === challengeId);
		assert(challenge, 'challenge is not found');
		return challenge.judgeCode;
	}
	throw new AssertionError({message: 'Invalid version'});
};

const isAdjacentToAcquired = (cellIndex: number, acquiredCells: Set<number>): boolean => {
	const cellRow = Math.floor(cellIndex / 8);
	const cellCol = cellIndex % 8;
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) {
				continue;
			}
			const nr = cellRow + dr;
			const nc = cellCol + dc;
			if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && acquiredCells.has(nr * 8 + nc)) {
				return true;
			}
		}
	}
	return false;
};

// --- Trigger 1: enqueue BullMQ job on new submission ---

export const onSubmissionCreated = onDocumentCreated(
	{document: 'games/{gameId}/submissions/{submissionId}'},
	async (event) => {
		if (!event.data?.exists) {
			return;
		}

		const snapshot = event.data;
		const changedGameId = event.params.gameId;
		const changedSubmissionId = event.params.submissionId;
		const submissionRef = db.doc(`games/${changedGameId}/submissions/${changedSubmissionId}`);

		const gameDoc = await db.collection('games').doc(changedGameId).get();
		const game = gameDoc.data() as Game;

		logInfo(`New submission: id = ${snapshot.id}, rule = ${game.rule.path}`);

		const isOk = await db.runTransaction(async (transaction) => {
			const submissionDoc = await transaction.get(submissionRef);
			const submission = submissionDoc.data();
			if (submission?.status !== 'pending') {
				return false;
			}

			transaction.update(submissionRef, {status: 'executing'});
			return true;
		});

		if (!isOk) {
			logWarn('Lock failed.');
			return;
		}

		let jobData: DecathlonJobData | null = null;

		if (game.rule.path === 'gameRules/reversing-diff') {
			const submission = snapshot.data() as ReversingDiffSubmission;
			const answerBlobs = await storage.bucket().file(`games/${changedGameId}/answer`).download();
			const answer = answerBlobs.reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0));
			jobData = {
				gameId: changedGameId,
				submissionId: changedSubmissionId,
				imageId: 'hakatashi/diff-challenge-cpp',
				code: `${answer.toString('base64')}\n${Buffer.from(submission.code, 'utf-8').toString('base64')}`,
				testcases: [{stdin: ''}],
			};
		}

		if (game.rule.path === 'gameRules/codegolf') {
			const submission = snapshot.data() as CodegolfSubmission;
			const config = game.configuration as CodegolfConfiguration;
			jobData = {
				gameId: changedGameId,
				submissionId: changedSubmissionId,
				imageId: `esolang/${submission.language}`,
				code: submission.code,
				testcases: config.testcases.map((tc) => ({stdin: tc.input})),
			};
		}

		if (game.rule.path === 'gameRules/quantum-computing') {
			const submission = snapshot.data() as QuantumComputingSubmission;
			const config = game.configuration as QuantumComputingConfiguration;
			const judgeCode = getQuantumComputingJudgeCode(config, submission.challengeId ?? null);
			jobData = {
				gameId: changedGameId,
				submissionId: changedSubmissionId,
				imageId: config.version === 1
					? 'hakatashi/quantum-computing-challenge'
					: 'hakatashi/quantum-computing-challenge-v2',
				code: [
					Buffer.from(judgeCode, 'utf-8').toString('base64'),
					Buffer.from(submission.code, 'utf-8').toString('base64'),
				].join('\n'),
				testcases: [{stdin: ''}],
			};
		}

		if (game.rule.path === 'gameRules/sql') {
			const submission = snapshot.data() as SqlSubmission;
			jobData = {
				gameId: changedGameId,
				submissionId: changedSubmissionId,
				imageId: `hakatashi/sql-challenge-${submission.engine}`,
				code: [
					game.athlon.id,
					Buffer.from(submission.code, 'utf-8').toString('base64'),
				].join('\n'),
				testcases: [{stdin: ''}],
			};
		}

		if (game.rule.path === 'gameRules/esolang') {
			const submission = snapshot.data() as EsolangSubmission;
			const config = game.configuration as EsolangConfiguration;

			const cellConfig = config.languages[submission.languageIndex];
			if (!cellConfig || cellConfig.type !== 'language') {
				await submissionRef.update({status: 'invalid', errorMessage: 'Invalid cell: not a language cell'});
				return;
			}

			if (cellConfig.id !== submission.languageId) {
				await submissionRef.update({status: 'invalid', errorMessage: 'Language ID mismatch'});
				return;
			}

			const rankingRef = db.doc(`games/${changedGameId}/ranking/${submission.userId}`) as DocumentReference<EsolangRanking>;
			const rankingDoc = await rankingRef.get();
			const rankingData = rankingDoc.data();

			const acquiredCells = new Set<number>();
			for (let i = 0; i < config.languages.length; i++) {
				if (config.languages[i]?.type === 'base') {
					acquiredCells.add(i);
				}
			}
			for (const cell of rankingData?.acquiredCells ?? []) {
				acquiredCells.add(cell);
			}

			const isAdjacent = isAdjacentToAcquired(submission.languageIndex, acquiredCells);

			if (!isAdjacent) {
				await submissionRef.update({status: 'invalid', errorMessage: 'Cell is not adjacent to any acquired cell'});
				return;
			}

			jobData = {
				gameId: changedGameId,
				submissionId: changedSubmissionId,
				imageId: `esolang/${submission.languageId}`,
				code: toBuffer(submission.code).toString('base64'),
				codeEncoding: 'base64',
				testcases: config.testcases.map((tc) => ({stdin: tc.input})),
				timeoutMs: 50000,
			};
		}

		if (jobData) {
			await getQueue().add('process', jobData);
		}
	},
);

// --- Trigger 2: enqueue BullMQ job for esolang code test ---

export const onEsolangTestSubmissionCreated = onDocumentCreated(
	{document: 'esolangTestSubmissions/{submissionId}'},
	async (event) => {
		if (!event.data?.exists) {
			return;
		}

		const submissionId = event.params.submissionId;
		const submissionRef = db.doc(`esolangTestSubmissions/${submissionId}`);
		const submission = event.data.data() as EsolangTestSubmission;

		const isOk = await db.runTransaction(async (transaction) => {
			const submissionDoc = await transaction.get(submissionRef);
			if (submissionDoc.data()?.status !== 'pending') {
				return false;
			}
			transaction.update(submissionRef, {status: 'executing'});
			return true;
		});

		if (!isOk) {
			return;
		}

		const jobData: DecathlonJobData = {
			gameId: 'esolang-test',
			submissionId,
			imageId: `esolang/${submission.languageId}`,
			code: toBuffer(submission.code).toString('base64'),
			codeEncoding: 'base64',
			testcases: [{stdin: submission.stdin}],
		};

		await getQueue().add('process', jobData);
	},
);
