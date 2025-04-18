import assert, {AssertionError} from 'node:assert';
import axios from 'axios';
import type {Timestamp, CollectionReference, DocumentReference} from 'firebase-admin/firestore';
import {getFunctions} from 'firebase-admin/functions';
import {onDocumentCreated} from 'firebase-functions/firestore';
import logger from 'firebase-functions/logger';
import {defineSecret} from 'firebase-functions/params';
import {onTaskDispatched} from 'firebase-functions/tasks';
import {firstBy, groupBy, identity, last, reverse, sortBy, sum, zip} from 'remeda';
import type {CodegolfConfiguration, CodegolfJudgeType, CodegolfRanking, CodegolfSubmission, DiffConfiguration, Game, QuantumComputingConfiguration, QuantumComputingResult, QuantumComputingSubmission, ReversingDiffRanking, ReversingDiffSubmission, Score, SqlResult, SqlSubmission, SqlTestcaseResult} from '~/lib/schema.js';
import {db, storage} from './firebase.js';

const ESOLANG_BATTLE_API_TOKEN = defineSecret('ESOLANG_BATTLE_API_TOKEN');

interface ExecuteDiffSubmissionData {
	gameId: string,
	submissionId: string,
}

export const executeDiffSubmission = onTaskDispatched<ExecuteDiffSubmissionData>(
	{
		secrets: [ESOLANG_BATTLE_API_TOKEN],
		retryConfig: {
			maxAttempts: 5,
			minBackoffSeconds: 60,
		},
		rateLimits: {
			maxConcurrentDispatches: 1,
		},
	},
	async (request) => {
		assert(typeof request.data.gameId === 'string');
		assert(typeof request.data.submissionId === 'string');

		const submissionRef = db.doc(`games/${request.data.gameId}/submissions/${request.data.submissionId}`) as DocumentReference<ReversingDiffSubmission>;
		const gameDoc = await db.collection('games').doc(request.data.gameId).get();
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

		const answerBlobs = await storage.bucket().file(`games/${request.data.gameId}/answer`).download();
		const answer = answerBlobs.reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0));

		const input = `${answer.toString('base64')}\n${Buffer.from(submission.code, 'utf-8').toString('base64')}`;

		const result = await axios({
			method: 'POST',
			url: 'https://esolang.hakatashi.com/api/execution',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			data: new URLSearchParams({
				token: ESOLANG_BATTLE_API_TOKEN.value(),
				code: Buffer.from(input, 'utf-8').toString('base64'),
				input: '',
				language: 'clang-cpp',
				imageId: 'hakatashi/diff-challenge-python',
			}),
			validateStatus: null,
		});

		const {duration, stderr, stdout, error: errorMessage} = result.data;

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
			const submissionDocs = await (db.collection(`games/${request.data.gameId}/submissions`) as CollectionReference<ReversingDiffSubmission>)
				.where('status', '==', 'success').get();
			const submissionsByUser = groupBy(submissionDocs.docs, (s) => s.data().userId);

			const mainFile = config.files.find((file) => file.isMain);
			if (!mainFile) {
				throw new AssertionError({message: 'Main file is not found'});
			}

			const [fileMetadata] = await storage.bucket().file(`assets/reversing-diff/${mainFile.filename}`).getMetadata();
			const fileSize = parseInt(String(fileMetadata.size));

			logger.info(`correct file size: ${fileSize}`);

			const batch = db.batch();
			for (const [userId, submissions] of Object.entries(submissionsByUser)) {
				const minScoreSubmission = firstBy(
					submissions,
					[(s) => s.data().score ?? Infinity, 'asc'],
				).data();
				const rankingRef = db.doc(`games/${request.data.gameId}/ranking/${minScoreSubmission.userId}`) as DocumentReference<ReversingDiffRanking>;
				batch.set(rankingRef, {
					athlon: submission.athlon,
					userId,
					score: minScoreSubmission.score!,
					createdAt: minScoreSubmission.createdAt,
				});

				const rawScore = Number.isNaN(fileSize) ? 0 : Math.max((fileSize - minScoreSubmission.score!) / fileSize, 0);

				logger.info(`user id: ${minScoreSubmission.userId}`);
				logger.info(`file size: ${fileSize}`);
				logger.info(`min score: ${minScoreSubmission.score}`);
				logger.info(`raw score: ${rawScore}`);

				const scoreRef = db.doc(`games/${request.data.gameId}/scores/${minScoreSubmission.userId}`) as DocumentReference<Score>;
				batch.set(scoreRef, {
					athlon: submission.athlon,
					user: userId,
					rawScore,
					tiebreakScore: minScoreSubmission.createdAt.toMillis(),
				});
			}

			await batch.commit();
		}
	},
);

const normalizeCodegolfOutput = (text: string, judgeType: CodegolfJudgeType) => {
	if (judgeType === 'ignore-newline-type') {
		return text
			.replaceAll(/\r\n/g, '\n')
			.replace(/\n+$/, '');
	}
	if (judgeType === 'number-sequence-ignore-whitespaces') {
		return text
			.trim()
			.split(/\s+/)
			.map((s) => parseFloat(s).toString())
			.join(' ');
	}
	return text.replaceAll(/\s/g, '');
};

const isTestcaseCorrect = (result: string, expected: string, judgeType: CodegolfJudgeType) => {
	const normalizedResult = normalizeCodegolfOutput(result, judgeType);
	const normalizedExpected = normalizeCodegolfOutput(expected, judgeType);
	return normalizedResult === normalizedExpected;
};

interface ExecuteCodegolfSubmissionData {
	gameId: string,
	submissionId: string,
}

export const executeCodegolfSubmission = onTaskDispatched<ExecuteCodegolfSubmissionData>(
	{
		secrets: [ESOLANG_BATTLE_API_TOKEN],
		retryConfig: {
			maxAttempts: 5,
			minBackoffSeconds: 60,
		},
		rateLimits: {
			maxConcurrentDispatches: 1,
		},
	},
	async (request) => {
		assert(typeof request.data.gameId === 'string');
		assert(typeof request.data.submissionId === 'string');

		const submissionRef = db.doc(`games/${request.data.gameId}/submissions/${request.data.submissionId}`) as DocumentReference<CodegolfSubmission>;

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

		const gameDoc = await db.collection('games').doc(request.data.gameId).get();
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
					token: ESOLANG_BATTLE_API_TOKEN.value(),
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

			let status: TestcaseStatus | null;
			if (error) {
				status = 'error';
			} else if (isTestcaseCorrect(stdout, testcase.output, config.judgeType)) {
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

		let totalStatus: TestcaseStatus | null;
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
		await updateCodegolfRanking(request.data.gameId, game);
	},
);

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

		if (filteredSubmissions.length === 0) {
			languageRankings.push([]);
			continue;
		}

		const submissionsByUser = groupBy(filteredSubmissions, (submission) => submission.userId);

		const users = Object.entries(submissionsByUser).map(([userId, userSubmissions]) => {
			usersSet.add(userId);
			const shortestSubmission = firstBy(
				userSubmissions,
				[(submission) => submission.size, 'asc'],
			);
			return {id: userId, size: shortestSubmission.size, createdAt: shortestSubmission.createdAt};
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
		const updatedAt = firstBy(
			languages
				.map(({createdAt}) => createdAt)
				.filter((createdAt): createdAt is Timestamp => createdAt !== null)
				.map((createdAt) => createdAt.toDate()),
			[identity(), 'desc'],
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

interface ExecuteQuantumComputingSubmissionData {
	gameId: string,
	submissionId: string,
	challengeId: string | null,
}

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

const parseQuantumComputingResult = (result: string, version: 1 | 2) => {
	const normalizedResult = result.trim();
	if (version === 1) {
		return [normalizedResult === 'CORRECT'];
	}
	if (version === 2) {
		const lines = normalizedResult.split('\n').map((line) => line.trim());
		const results: boolean[] = [];
		for (const line of lines) {
			if (line === 'CORRECT') {
				results.push(true);
			} else if (line === 'INCORRECT') {
				results.push(false);
			} else {
				throw new Error(`Invalid result: ${line}`);
			}
		}
		return results;
	}
	throw new AssertionError({message: 'Invalid version'});
};

const updateQuantumComputingScore = async (gameId: string, userId: string, game: Game, submission: QuantumComputingSubmission) => {
	const config = game.configuration as QuantumComputingConfiguration;
	if (config.version === 1) {
		await db.runTransaction(async (transaction) => {
			const scoreRef = db.doc(`games/${gameId}/scores/${userId}`) as DocumentReference<Score>;
			const scoreDoc = await transaction.get(scoreRef);

			if (scoreDoc.exists) {
				return;
			}

			transaction.set(scoreRef, {
				athlon: submission.athlon,
				user: submission.userId,
				rawScore: game.maxRawScore,
				tiebreakScore: submission.createdAt.toMillis(),
			});
		});
	} else if (config.version === 2) {
		await db.runTransaction(async (transaction) => {
			const submissionsRef = db.collection(`games/${gameId}/submissions`) as CollectionReference<QuantumComputingSubmission>;
			const submissionDocs = await transaction.get(
				submissionsRef
					.where('userId', '==', userId)
					.where('status', '==', 'success'),
			);
			const solvedChallenges = new Map<string, number>();
			for (const submissionDoc of submissionDocs.docs) {
				const submissionData = submissionDoc.data();
				if (submissionData.challengeId) {
					const fastestSubmission = solvedChallenges.get(submissionData.challengeId) ?? Infinity;
					solvedChallenges.set(
						submissionData.challengeId,
						Math.min(fastestSubmission, submissionData.createdAt.toMillis()),
					);
				}
			}
			let score = 0;
			for (const challenge of solvedChallenges.keys()) {
				const challengeData = config.challenges.find((c) => c.id === challenge);
				if (challengeData) {
					score += challengeData.score;
				}
			}
			if (score > 0) {
				const scoreRef = db.doc(`games/${gameId}/scores/${userId}`) as DocumentReference<Score>;
				const tiebreakScore = Math.max(...solvedChallenges.values());
				transaction.set(scoreRef, {
					athlon: submission.athlon,
					user: userId,
					rawScore: score,
					tiebreakScore,
				});
			}
		});
	}
};

export const executeQuantumComputingSubmission = onTaskDispatched<ExecuteQuantumComputingSubmissionData>(
	{
		secrets: [ESOLANG_BATTLE_API_TOKEN],
		retryConfig: {
			maxAttempts: 5,
			minBackoffSeconds: 60,
		},
		rateLimits: {
			maxConcurrentDispatches: 1,
		},
	},
	async (request) => {
		assert(typeof request.data.gameId === 'string');
		assert(typeof request.data.submissionId === 'string');
		assert(typeof request.data.challengeId === 'string' || request.data.challengeId === null);

		const submissionRef = db.doc(`games/${request.data.gameId}/submissions/${request.data.submissionId}`) as DocumentReference<QuantumComputingSubmission>;
		const gameDoc = await db.collection('games').doc(request.data.gameId).get();
		const game = gameDoc.data() as Game;
		const config = game.configuration as QuantumComputingConfiguration;
		const judgeCode = getQuantumComputingJudgeCode(config, request.data.challengeId);

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

		const input = [
			Buffer.from(judgeCode, 'utf-8').toString('base64'),
			Buffer.from(submission.code, 'utf-8').toString('base64'),
		].join('\n');

		const result = await axios({
			method: 'POST',
			url: 'https://esolang.hakatashi.com/api/execution',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			data: new URLSearchParams({
				token: ESOLANG_BATTLE_API_TOKEN.value(),
				code: Buffer.from(input, 'utf-8').toString('base64'),
				input: '',
				language: 'kotlin',
				imageId: config.version === 1
					? 'hakatashi/quantum-computing-challenge'
					: 'hakatashi/quantum-computing-challenge-v2',
			}),
			validateStatus: null,
		});

		const {duration, stderr, stdout, error: errorMessage} = result.data;

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
		if (typeof errorMessage === 'string') {
			error = errorMessage;
		}
		if (!error && result.status !== 200) {
			error = JSON.stringify(result.data) || 'unknown error';
		}

		let isCorrect = false;
		try {
			const results = parseQuantumComputingResult(stdout, config.version);
			isCorrect = results.length > 0 && results.every((res) => res === true);
		} catch (parseError) {
			error = `failed to parse stdout: ${parseError}`;
		}

		let status: QuantumComputingResult = 'failed';
		if (error) {
			status = 'error';
		} else if (isCorrect) {
			status = 'success';
		}

		await submissionRef.update({
			status,
			...(error ? {errorMessage: error} : {}),
			duration: typeof duration === 'number' ? duration : null,
			stderr: typeof stderr === 'string' ? stderr : null,
			stdout: typeof stdout === 'string' ? stdout : null,
			executedAt: new Date(),
		});

		if (status === 'success') {
			await updateQuantumComputingScore(
				request.data.gameId,
				submission.userId,
				game,
				submission,
			);
		}
	},
);

interface ExecuteSqlSubmissionData {
	gameId: string,
	submissionId: string,
}

export const executeSqlSubmission = onTaskDispatched<ExecuteSqlSubmissionData>(
	{
		secrets: [ESOLANG_BATTLE_API_TOKEN],
		retryConfig: {
			maxAttempts: 5,
			minBackoffSeconds: 60,
		},
		rateLimits: {
			maxConcurrentDispatches: 1,
		},
	},
	async (request) => {
		assert(typeof request.data.gameId === 'string');
		assert(typeof request.data.submissionId === 'string');

		const submissionRef = db.doc(`games/${request.data.gameId}/submissions/${request.data.submissionId}`) as DocumentReference<SqlSubmission>;
		const gameDoc = await db.collection('games').doc(request.data.gameId).get();
		const game = gameDoc.data() as Game;
		const athlonId = game.athlon.id;

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

		const input = [
			athlonId,
			Buffer.from(submission.code, 'utf-8').toString('base64'),
		].join('\n');

		const result = await axios({
			method: 'POST',
			url: 'https://esolang.hakatashi.com/api/execution',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			data: new URLSearchParams({
				token: ESOLANG_BATTLE_API_TOKEN.value(),
				code: Buffer.from(input, 'utf-8').toString('base64'),
				input: '',
				language: 'kotlin',
				imageId: `hakatashi/sql-challenge-${submission.engine}`,
			}),
			validateStatus: null,
		});

		const {duration, stderr, stdout, error: errorMessage} = result.data;
		logger.info(result.data);

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
		if (typeof errorMessage === 'string') {
			error = errorMessage;
		}
		if (!error && result.status !== 200) {
			error = JSON.stringify(result.data) || 'unknown error';
		}

		let testcaseResults: SqlTestcaseResult[] = [];
		let isCorrect = false;
		try {
			const parsedStdout = JSON.parse(stdout);
			// eslint-disable-next-line no-negated-condition
			if (!Array.isArray(parsedStdout)) {
				error = 'stdout is not a valid format';
			} else {
				testcaseResults = parsedStdout;
				isCorrect = testcaseResults.every((testcaseResult) => testcaseResult.status === 'CORRECT');
			}
		} catch {
			error = 'failed to parse stdout';
		}

		let status: SqlResult = 'failed';
		if (error) {
			status = 'error';
		} else if (isCorrect) {
			status = 'success';
		}

		await submissionRef.update({
			status,
			...(error ? {errorMessage: error} : {}),
			duration: typeof duration === 'number' ? duration : null,
			stderr: typeof stderr === 'string' ? stderr : null,
			stdout: typeof stdout === 'string' ? stdout : null,
			executedAt: new Date(),
			results: testcaseResults,
		});

		if (status === 'success') {
			db.runTransaction(async (transaction) => {
				const scoreRef = db.doc(`games/${request.data.gameId}/scores/${submission.userId}`) as DocumentReference<Score>;
				const scoreDoc = await transaction.get(scoreRef);

				if (scoreDoc.exists) {
					return;
				}

				transaction.set(scoreRef, {
					athlon: submission.athlon,
					user: submission.userId,
					rawScore: game.maxRawScore,
					tiebreakScore: submission.createdAt.toMillis(),
				});
			});
		}
	},
);

export const onSubmissionCreated = onDocumentCreated(
	'games/{gameId}/submissions/{submissionId}',
	async (event) => {
		if (!event.data?.exists) {
			return;
		}

		const snapshot = event.data;
		const changedGameId = event.params.gameId;
		const changedSubmissionId = event.params.submissionId;

		const gameDoc = await db.collection('games').doc(changedGameId).get();
		const game = gameDoc.data() as Game;

		logger.info(`New submission: id = ${snapshot.id}, rule = ${game.rule.path}`);

		if (game.rule.path === 'gameRules/reversing-diff') {
			const queue = getFunctions().taskQueue<ExecuteDiffSubmissionData>('executeDiffSubmission');
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
			const queue = getFunctions().taskQueue<ExecuteCodegolfSubmissionData>('executeCodegolfSubmission');
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

		if (game.rule.path === 'gameRules/quantum-computing') {
			const queue = getFunctions().taskQueue<ExecuteQuantumComputingSubmissionData>('executeQuantumComputingSubmission');
			const submission = snapshot.data() as QuantumComputingSubmission;
			queue.enqueue(
				{
					gameId: changedGameId,
					submissionId: changedSubmissionId,
					challengeId: submission.challengeId ?? null,
				},
				{
					scheduleDelaySeconds: 0,
					dispatchDeadlineSeconds: 60 * 5,
				},
			);
		}

		if (game.rule.path === 'gameRules/sql') {
			const queue = getFunctions().taskQueue<ExecuteSqlSubmissionData>('executeSqlSubmission');
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
	},
);
