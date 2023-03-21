import axios from 'axios';
import {firestore, logger, runWith} from 'firebase-functions';
import {Game} from '../../src/lib/schema';
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
		const gameDoc = await db.collection('games').doc(changedGameId).get();
		const game = gameDoc.data() as Game;

		logger.info(`New submission: id = ${snapshot.id}, rule = ${game.rule.path}`);
		if (game.rule.path === 'gameRules/reversing-diff') {
			logger.info(`user = ${submission.user}`);
		}
	});
