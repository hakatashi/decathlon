import axios from 'axios';
import {firestore, logger, runWith} from 'firebase-functions';
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
		}).onDispatch(async () => {
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
		});

export const onSubmissionCreated = firestore
	.document('games/{gameId}/submissions/{submissionId}')
	.onCreate(async (snapshot, context) => {
		const submission = snapshot.data();
		const changedGameId = context.params.gameId;
		const game = await db.collection('games').doc(changedGameId).get();

		logger.info(submission);
		logger.info(game.data());
	});
