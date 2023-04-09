import assert, {AssertionError} from 'assert';
import axios from 'axios';
import {CollectionReference, DocumentReference, Timestamp} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import {firestore, logger, runWith} from 'firebase-functions';
import {groupBy, last, max, minBy, reverse, sortBy, sum, zip} from 'lodash';
import type {CodegolfConfiguration, CodegolfRanking, CodegolfSubmission, DiffConfiguration, Game, ReversingDiffRanking, ReversingDiffSubmission, Score} from '~/lib/schema';
import {db, storage} from './firebase';

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
			const gameDoc = await db.collection('games').doc(data.gameId).get();
			const game = gameDoc.data() as Game;
			const config = game.configuration as DiffConfiguration;

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

			const answerBlobs = await storage.bucket().file(`games/${data.gameId}/answer`).download();
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
				validateStatus: null,
			});

			const {duration, stderr, stdout, error: errorMessage} = result.data;

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
			if (typeof errorMessage === 'string') {
				error = errorMessage;
			}
			if (!error && result.status !== 200) {
				error = JSON.stringify(result.data) || 'unknown error';
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

				const mainFile = config.files.find((file) => file.isMain);
				if (!mainFile) {
					throw new AssertionError({message: 'Main file is not found'});
				}

				const [fileMetadata] = await storage.bucket().file(`assets/reversing-diff/${mainFile.filename}`).getMetadata();
				const fileSize: number = fileMetadata.size;

				logger.info(`correct file size: ${fileSize}`);

				const batch = db.batch();
				for (const [userId, submissions] of Object.entries(submissionsByUser)) {
					const minScoreSubmission = minBy(submissions, (s) => s.data().score)!.data();
					const rankingRef = db.doc(`games/${data.gameId}/ranking/${minScoreSubmission.userId}`) as DocumentReference<ReversingDiffRanking>;
					batch.set(rankingRef, {
						athlon: submission.athlon,
						userId,
						score: minScoreSubmission.score!,
						createdAt: minScoreSubmission.createdAt,
					});

					const rawScore = Math.max((fileSize - minScoreSubmission.score!) / fileSize, 0);

					const scoreRef = db.doc(`games/${data.gameId}/scores/${minScoreSubmission.userId}`) as DocumentReference<Score>;
					batch.set(scoreRef, {
						athlon: submission.athlon,
						user: userId,
						rawScore,
						tiebreakScore: minScoreSubmission.createdAt.toMillis(),
					});
				}

				await batch.commit();
			}
		});

const isTestcaseCorrect = (result: string, expected: string) => {
	const normalizedResult = result.replaceAll(/\s/g, '');
	const normalizedExpected = expected.replaceAll(/\s/g, '');
	return normalizedResult === normalizedExpected;
};

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

			type TestcaseStatus = 'error' | 'failed' | 'success';

			let error = null;
			const testcaseResults: {
				stdin: string,
				stdout: string | null,
				stderr: string | null,
				trace: string | null,
				duration: number | null,
				status: TestcaseStatus,
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
					validateStatus: null,
				});

				const {duration, stderr, stdout, trace, error: errorMessage} = result.data;

				if (typeof duration !== 'number') {
					error = 'duration is not a number';
				}
				if (typeof stderr !== 'string') {
					error = 'stderr is not a string';
				}
				if (typeof stdout !== 'string') {
					error = 'stdout is not a string';
				}
				if (trace !== null && typeof trace !== 'string') {
					error = 'trace is not a string';
				}
				if (typeof errorMessage === 'string') {
					error = errorMessage;
				}
				if (!error && result.status !== 200) {
					error = JSON.stringify(result.data) || 'unknown error';
				}

				let status: TestcaseStatus | null = null;
				if (error) {
					status = 'error';
				} else if (isTestcaseCorrect(stdout, testcase.output)) {
					status = 'success';
				} else {
					status = 'failed';
				}

				testcaseResults.push({
					stdin: testcase.input,
					stdout: typeof stdout === 'string' ? stdout : null,
					stderr: typeof stderr === 'string' ? stderr : null,
					trace: typeof trace === 'string' ? trace : null,
					duration: typeof duration === 'number' ? duration : null,
					status,
				});

				if (error) {
					break;
				}
			}

			let totalStatus: TestcaseStatus | null = null;
			if (testcaseResults.some(({status}) => status === 'error')) {
				totalStatus = 'error';
			} else if (testcaseResults.some(({status}) => status === 'failed')) {
				totalStatus = 'failed';
			} else {
				totalStatus = 'success';
			}

			await submissionRef.update({
				status: totalStatus,
				...(error ? {errorMessage: error} : {}),
				testcases: testcaseResults,
				executedAt: new Date(),
			});

			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			await updateCodegolfRanking(data.gameId, game);
		});

const updateCodegolfRanking = async (gameId: string, game: Game) => {
	const submissionsRef = db.collection('games').doc(gameId).collection('submissions') as CollectionReference<CodegolfSubmission>;
	const submissionDocs = await submissionsRef.where('status', '==', 'success').get();
	const submissions = submissionDocs.docs.map((submission) => submission.data());

	interface RankedUser {
		id: string,
		size: number,
		score: number,
		rank: number,
		createdAt: Timestamp,
	}

	const config = game.configuration as CodegolfConfiguration;
	const languageRankings: RankedUser[][] = [];
	const usersSet = new Set<string>();

	for (const language of config.languages) {
		const filteredSubmissions =
			language.id === 'anything'
				? submissions
				: submissions.filter((s) => s.language === language.id);
		const submissionsByUser = groupBy(filteredSubmissions, (submission) => submission.userId);

		const users = Object.entries(submissionsByUser).map(([userId, userSubmissions]) => {
			usersSet.add(userId);
			const shortestSubmission = minBy(userSubmissions, (submission) => submission.size);
			return {id: userId, size: shortestSubmission!.size, createdAt: shortestSubmission!.createdAt};
		});
		const sortedUsers = reverse(sortBy(users, (user) => user.size));

		const firstUser = last(sortedUsers);
		assert(firstUser);
		const fullscore = 1 / firstUser.size;

		let previousSize: number | null = null;
		let previousRank = 0;
		const rankedUsers = sortedUsers.map((user, index) => {
			let rank = index;
			if (user.size === previousSize) {
				rank = previousRank;
			} else {
				previousRank = index;
			}

			previousSize = user.size;

			return {
				...user,
				rank,
				score: (1 / user.size) / fullscore * game.maxPoint / config.languages.length,
			};
		});

		languageRankings.push(rankedUsers);
	}

	const batch = db.batch();

	for (const userId of usersSet) {
		const languages = zip(config.languages, languageRankings).map(([language, rankedUsers]) => {
			assert(language && rankedUsers);
			const rankedUser = rankedUsers.find((user) => user.id === userId);
			if (rankedUser) {
				return {
					...rankedUser,
					languageId: language.id,
					hasScore: true,
				};
			}
			return {
				id: userId,
				size: 0,
				score: 0,
				rank: 0,
				languageId: language.id,
				hasScore: false,
				createdAt: null,
			};
		});

		const scoreSum = sum(languages.map(({score}) => score));
		const updatedAt = max(
			languages
				.map(({createdAt}) => createdAt)
				.filter((createdAt): createdAt is Timestamp => createdAt !== null)
				.map((createdAt) => createdAt.toDate()),
		);

		const rankingRef = db.doc(`games/${gameId}/ranking/${userId}`) as DocumentReference<CodegolfRanking>;
		batch.set(rankingRef, {
			athlon: game.athlon,
			userId,
			score: scoreSum,
			// @ts-expect-error: Date is compatible
			updatedAt,
			languages: languages.map((l) => ({
				size: l.size,
				score: l.score,
				rank: l.rank,
				hasScore: l.hasScore,
			})),
		});

		const scoreRef = db.doc(`games/${gameId}/scores/${userId}`) as DocumentReference<Score>;
		batch.set(scoreRef, {
			athlon: game.athlon,
			rawScore: scoreSum,
			tiebreakScore: updatedAt?.getTime() ?? 0,
			user: userId,
		});
	}

	await batch.commit();
};

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
