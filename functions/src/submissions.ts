import assert, {AssertionError} from 'node:assert';
import {Queue} from 'bullmq';
import {onDocumentCreated} from 'firebase-functions/firestore';
import {info as logInfo, warn as logWarn} from 'firebase-functions/logger';
import {defineString} from 'firebase-functions/params';
import {Redis} from 'ioredis';
import type {CodegolfConfiguration, CodegolfSubmission, Game, QuantumComputingConfiguration, QuantumComputingSubmission, ReversingDiffSubmission, SqlSubmission} from '~/lib/schema.js';
import {db, storage} from './firebase.js';

const REDIS_URL = defineString('REDIS_URL');

interface DecathlonJobData {
	gameId: string;
	submissionId: string;
	imageId: string;
	code: string;
	testcases: {stdin: string}[];
}

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
				imageId: 'hakatashi/diff-challenge-python',
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

		if (jobData) {
			await getQueue().add('process', jobData);
		}
	},
);
