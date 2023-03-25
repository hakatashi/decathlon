import assert, {AssertionError} from 'assert';
import axios from 'axios';
import {CollectionReference, DocumentReference} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import {getStorage} from 'firebase-admin/storage';
import {firestore, logger, runWith} from 'firebase-functions';
import {groupBy, minBy} from 'lodash';
import {CodegolfConfiguration, CodegolfSubmission, Game, ReversingDiffRanking, ReversingDiffSubmission} from '../../src/lib/schema';
import db from './firestore';

const bucket = getStorage().bucket();

export const executeDiffSubmission =
	runWith({secrets: ['ESOLANG_BATTLE_API_TOKEN']})
		.tasks.taskQueue({
			retryConfig: {
				maxAttempts: 5,
				minBackoffSeconds: 60,
			},
			rateLimits: {
				maxConcurrentDispatches: 1,
			},
		}).onDispatch(async (data) => {
			assert(typeof data.gameId === 'string');
			assert(typeof data.submissionId === 'string');

			const submissionRef = db.doc(`games/${data.gameId}/submissions/${data.submissionId}`) as DocumentReference<ReversingDiffSubmission>;

			logger.info('Getting lock...');
			const isOk = await db.runTransaction(async (transaction) => {
				const submissionDoc = await transaction.get(submissionRef);
				const submission = submissionDoc.data();
				if (submission?.status !== 'pending') {
					return false;
				}

				transaction.update(submissionDoc.ref, {status: 'executing'});
				return true;
			});

			if (!isOk) {
				logger.warn('Lock failed.');
				return;
			}

			const submissionDoc = await submissionRef.get();
			const submission = submissionDoc.data();

			if (!submission || typeof submission.code !== 'string') {
				throw new AssertionError();
			}

			logger.info(submission);
			const answerBlobs = await bucket.file(`games/${data.gameId}/answer`).download();
			const answer = answerBlobs.reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0));

			const input = `${answer.toString('base64')}\n${Buffer.from(submission.code, 'utf-8').toString('base64')}`;

			const result = await axios({
				method: 'POST',
				url: 'https://esolang.hakatashi.com/api/execution',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				data: new URLSearchParams({
					token: process.env.ESOLANG_BATTLE_API_TOKEN!,
					code: Buffer.from(input, 'utf-8').toString('base64'),
					input: '',
					language: 'clang-cpp',
					imageId: 'hakatashi/diff-challenge-cpp',
				}),
			});

			const {duration, stderr, stdout} = result.data;

			// eslint-disable-next-line no-undef-init
			let error = null;
			if (typeof duration !== 'number') {
				error = 'duration is not a number';
			}
			if (typeof stderr !== 'string') {
				error = 'stderr is not a string';
			}
			if (typeof stdout !== 'string') {
				error = 'stdout is not a string';
			}
			if (!stdout.match(/^\d+$/)) {
				error = 'stdout is not a valid format';
			}

			let score = error ? null : parseInt(stdout);
			if (!Number.isFinite(score)) {
				score = null;
			}

			await submissionRef.update({
				status: error ? 'error' : 'success',
				...(error ? {errorMessage: error} : {}),
				score,
				duration,
				stderr,
				stdout,
				executedAt: new Date(),
			});

			{
				const submissionDocs = await (db.collection(`games/${data.gameId}/submissions`) as CollectionReference<ReversingDiffSubmission>)
					.where('status', '==', 'success').get();
				const submissionsByUser = groupBy(submissionDocs.docs, (s) => s.data().userId);
				for (const [userId, submissions] of Object.entries(submissionsByUser)) {
					const minScoreSubmission = minBy(submissions, (s) => s.data().score)!.data();
					const rankingRef = db.doc(`games/${data.gameId}/ranking/${minScoreSubmission.userId}`) as DocumentReference<ReversingDiffRanking>;
					await rankingRef.set({
						athlon: submission.athlon,
						userId,
						score: minScoreSubmission.score!,
						createdAt: minScoreSubmission.createdAt,
					});
				}
			}
		});

export const executeCodegolfSubmission =
	runWith({secrets: ['ESOLANG_BATTLE_API_TOKEN']})
		.tasks.taskQueue({
			retryConfig: {
				maxAttempts: 5,
				minBackoffSeconds: 60,
			},
			rateLimits: {
				maxConcurrentDispatches: 1,
			},
		}).onDispatch(async (data) => {
			assert(typeof data.gameId === 'string');
			assert(typeof data.submissionId === 'string');

			const submissionRef = db.doc(`games/${data.gameId}/submissions/${data.submissionId}`) as DocumentReference<CodegolfSubmission>;

			logger.info('Getting lock...');
			const isOk = await db.runTransaction(async (transaction) => {
				const submissionDoc = await transaction.get(submissionRef);
				const submission = submissionDoc.data();
				if (submission?.status !== 'pending') {
					return false;
				}

				transaction.update(submissionDoc.ref, {status: 'executing'});
				return true;
			});

			if (!isOk) {
				logger.warn('Lock failed.');
				return;
			}

			const submissionDoc = await submissionRef.get();
			const submission = submissionDoc.data();

			const gameDoc = await db.collection('games').doc(data.gameId).get();
			const game = gameDoc.data() as Game;
			const config = game.configuration as CodegolfConfiguration;

			if (!submission || typeof submission.code !== 'string') {
				throw new AssertionError();
			}

			logger.info(`Starting execution of submission ${submissionDoc.id}`);

			let error = null;
			const testcaseResults: {
				stdin: string,
				stdout: string | null,
				stderr: string | null,
				trace: string | null,
				duration: number | null,
			}[] = [];

			for (const [i, testcase] of config.testcases.entries()) {
				logger.info(`Executing test case ${i}...`);

				const result = await axios({
					method: 'POST',
					url: 'https://esolang.hakatashi.com/api/execution',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					data: new URLSearchParams({
						token: process.env.ESOLANG_BATTLE_API_TOKEN!,
						code: Buffer.from(submission.code, 'utf-8').toString('base64'),
						input: testcase.input,
						language: submission.language,
						imageId: `esolang/${submission.language}`,
					}),
				});

				const {duration, stderr, stdout, trace} = result.data;

				if (typeof duration !== 'number') {
					error = 'duration is not a number';
				}
				if (typeof stderr !== 'string') {
					error = 'stderr is not a string';
				}
				if (typeof stdout !== 'string') {
					error = 'stdout is not a string';
				}
				if (typeof trace !== 'string') {
					error = 'trace is not a string';
				}

				if (error) {
					break;
				}

				testcaseResults.push({
					stdin: testcase.input,
					stdout: typeof stdout === 'string' ? stdout : null,
					stderr: typeof stderr === 'string' ? stderr : null,
					trace: typeof trace === 'string' ? trace : null,
					duration: typeof duration === 'number' ? duration : null,
				});
			}

			await submissionRef.update({
				status: error ? 'error' : 'success',
				...(error ? {errorMessage: error} : {}),
				testcases: testcaseResults,
				executedAt: new Date(),
			});
		});

export const onSubmissionCreated = firestore
	.document('games/{gameId}/submissions/{submissionId}')
	.onCreate(async (snapshot, context) => {
		const changedGameId = context.params.gameId;
		const changedSubmissionId = context.params.submissionId;

		const gameDoc = await db.collection('games').doc(changedGameId).get();
		const game = gameDoc.data() as Game;

		logger.info(`New submission: id = ${snapshot.id}, rule = ${game.rule.path}`);

		if (game.rule.path === 'gameRules/reversing-diff') {
			const queue = getFunctions().taskQueue('executeDiffSubmission');
			queue.enqueue(
				{
					gameId: changedGameId,
					submissionId: changedSubmissionId,
				},
				{
					scheduleDelaySeconds: 0,
					dispatchDeadlineSeconds: 60 * 5,
				},
			);
		}

		if (game.rule.path === 'gameRules/codegolf') {
			const queue = getFunctions().taskQueue('executeCodegolfSubmission');
			queue.enqueue(
				{
					gameId: changedGameId,
					submissionId: changedSubmissionId,
				},
				{
					scheduleDelaySeconds: 0,
					dispatchDeadlineSeconds: 60 * 5,
				},
			);
		}
	});
