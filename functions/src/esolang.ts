import assert from 'assert';
import axios from 'axios';
import {DocumentReference} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import {firestore, logger, runWith} from 'firebase-functions';
import {Game, ReversingDiffSubmission} from '../../src/lib/schema';
import db from './firestore';

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

			const submissionDoc = await submissionRef.get();
			const submission = submissionDoc.data();

			if (!isOk) {
				logger.warn('Lock failed.');
				return;
			}

			logger.info(submission);

			const result = await axios({
				method: 'POST',
				url: 'https://esolang.hakatashi.com/api/execution',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				data: new URLSearchParams({
					token: process.env.ESOLANG_BATTLE_API_TOKEN!,
					code: 'YVc1MElHMWhhVzRvS1NCN0lISmxkSFZ5YmlBd095QjkKYVc1MElHMWhhVzRvS1NCN0lISmxkSFZ5YmlBeE95Qjk=',
					input: '',
					language: 'clang-cpp',
					imageId: 'hakatashi/diff-challenge-cpp',
				}),
			});
			logger.info(result.data);

			submissionRef.update({status: 'success'});
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
	});
