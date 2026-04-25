import assert, {AssertionError} from 'node:assert';
import type {Timestamp, CollectionReference, DocumentReference} from 'firebase-admin/firestore';
import {onDocumentCreated} from 'firebase-functions/firestore';
import {info as logInfo} from 'firebase-functions/logger';
import {firstBy, groupBy, identity, last, reverse, sortBy, sum, zip} from 'remeda';
import type {CodegolfConfiguration, CodegolfJudgeType, CodegolfRanking, CodegolfSubmission, DiffConfiguration, Execution, Game, QuantumComputingConfiguration, QuantumComputingResult, QuantumComputingSubmission, ReversingDiffRanking, ReversingDiffSubmission, Score, SqlResult, SqlSubmission, SqlTestcaseResult} from '~/lib/schema.js';
import {db, storage} from './firebase.js';

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

// --- Trigger 2: score and rank on execution result ---

const processReversingDiffExecution = async (
	game: Game,
	execution: Execution,
) => {
	const submissionRef = db.doc(`games/${execution.gameId}/submissions/${execution.submissionId}`) as DocumentReference<ReversingDiffSubmission>;
	const submissionDoc = await submissionRef.get();
	const submission = submissionDoc.data();
	if (!submission) {
		return;
	}

	const config = game.configuration as DiffConfiguration;
	const result = execution.results[0] ?? null;
	const stdout = result?.stdout ?? '';
	const stderr = result?.stderr ?? '';
	const duration = result?.durationMs ?? null;

	let error: string | null = execution.error;
	if (!error && !result) {
		error = 'No execution result';
	}
	if (!error && !stdout.match(/^\d+$/)) {
		error = 'stdout is not a valid format';
	}

	let score = error ? null : parseInt(stdout);
	if (score !== null && !Number.isFinite(score)) {
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

	const submissionDocs = await (db.collection(`games/${execution.gameId}/submissions`) as CollectionReference<ReversingDiffSubmission>)
		.where('status', '==', 'success').get();
	const submissionsByUser = groupBy(submissionDocs.docs, (s) => s.data().userId);

	const mainFile = config.files.find((file) => file.isMain);
	if (!mainFile) {
		throw new AssertionError({message: 'Main file is not found'});
	}

	const [fileMetadata] = await storage.bucket().file(`assets/reversing-diff/${mainFile.filename}`).getMetadata();
	const fileSize = parseInt(String(fileMetadata.size));
	logInfo(`correct file size: ${fileSize}`);

	const batch = db.batch();
	for (const [userId, submissions] of Object.entries(submissionsByUser)) {
		const minScoreSubmission = firstBy(
			submissions,
			[(s) => s.data().score ?? Infinity, 'asc'],
		).data();
		const rankingRef = db.doc(`games/${execution.gameId}/ranking/${minScoreSubmission.userId}`) as DocumentReference<ReversingDiffRanking>;
		batch.set(rankingRef, {
			athlon: submission.athlon,
			userId,
			score: minScoreSubmission.score!,
			createdAt: minScoreSubmission.createdAt,
		});

		const rawScore = Number.isNaN(fileSize) ? 0 : Math.max((fileSize - minScoreSubmission.score!) / fileSize, 0);
		logInfo(`user id: ${minScoreSubmission.userId}`);
		logInfo(`file size: ${fileSize}`);
		logInfo(`min score: ${minScoreSubmission.score}`);
		logInfo(`raw score: ${rawScore}`);

		const scoreRef = db.doc(`games/${execution.gameId}/scores/${minScoreSubmission.userId}`) as DocumentReference<Score>;
		batch.set(scoreRef, {
			athlon: submission.athlon,
			user: userId,
			rawScore,
			tiebreakScore: minScoreSubmission.createdAt.toMillis(),
		});
	}

	await batch.commit();
};

const processCodegolfExecution = async (
	game: Game,
	execution: Execution,
) => {
	const submissionRef = db.doc(`games/${execution.gameId}/submissions/${execution.submissionId}`) as DocumentReference<CodegolfSubmission>;
	const submissionDoc = await submissionRef.get();
	const submission = submissionDoc.data();
	if (!submission) {
		return;
	}

	const config = game.configuration as CodegolfConfiguration;

	type TestcaseStatus = 'error' | 'failed' | 'success';

	const testcaseResults: {
		stdin: string,
		stdout: string | null,
		stderr: string | null,
		trace: string | null,
		duration: number | null,
		status: TestcaseStatus,
	}[] = [];

	for (const [i, testcase] of config.testcases.entries()) {
		const result = execution.results[i] ?? null;

		const stdout = result?.stdout ?? '';
		const stderr = result?.stderr ?? '';
		const duration = result?.durationMs ?? null;

		let status: TestcaseStatus;
		if (execution.error) {
			status = 'error';
		} else if (isTestcaseCorrect(stdout, testcase.output, config.judgeType)) {
			status = 'success';
		} else {
			status = 'failed';
		}

		testcaseResults.push({
			stdin: testcase.input,
			stdout: result ? stdout : null,
			stderr: result ? stderr : null,
			trace: null,
			duration,
			status,
		});
	}

	let totalStatus: TestcaseStatus;
	if (testcaseResults.some(({status}) => status === 'error')) {
		totalStatus = 'error';
	} else if (testcaseResults.some(({status}) => status === 'failed')) {
		totalStatus = 'failed';
	} else {
		totalStatus = 'success';
	}

	await submissionRef.update({
		status: totalStatus,
		...(execution.error ? {errorMessage: execution.error} : {}),
		testcases: testcaseResults,
		executedAt: new Date(),
	});

	await updateCodegolfRanking(execution.gameId, game);
};

const processQuantumComputingExecution = async (
	game: Game,
	execution: Execution,
) => {
	const submissionRef = db.doc(`games/${execution.gameId}/submissions/${execution.submissionId}`) as DocumentReference<QuantumComputingSubmission>;
	const submissionDoc = await submissionRef.get();
	const submission = submissionDoc.data();
	if (!submission) {
		return;
	}

	const config = game.configuration as QuantumComputingConfiguration;
	const result = execution.results[0] ?? null;
	const stdout = result?.stdout ?? '';
	const stderr = result?.stderr ?? '';
	const duration = result?.durationMs ?? null;

	let error: string | null = execution.error;
	if (!error && !result) {
		error = 'No execution result';
	}

	let isCorrect = false;
	if (!error) {
		try {
			const parseResults = parseQuantumComputingResult(stdout, config.version);
			isCorrect = parseResults.length > 0 && parseResults.every((res) => res === true);
		} catch (parseError) {
			error = `failed to parse stdout: ${parseError}`;
		}
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
		duration,
		stderr,
		stdout,
		executedAt: new Date(),
	});

	if (status === 'success') {
		await updateQuantumComputingScore(execution.gameId, submission.userId, game, submission);
	}
};

const processSqlExecution = async (
	game: Game,
	execution: Execution,
) => {
	const submissionRef = db.doc(`games/${execution.gameId}/submissions/${execution.submissionId}`) as DocumentReference<SqlSubmission>;
	const submissionDoc = await submissionRef.get();
	const submission = submissionDoc.data();
	if (!submission) {
		return;
	}

	const result = execution.results[0] ?? null;
	const stdout = result?.stdout ?? '';
	const stderr = result?.stderr ?? '';
	const duration = result?.durationMs ?? null;
	logInfo({stdout, stderr, duration});

	let error: string | null = execution.error;
	if (!error && !result) {
		error = 'No execution result';
	}

	let testcaseResults: SqlTestcaseResult[] = [];
	let isCorrect = false;
	if (!error) {
		try {
			const parsedStdout = JSON.parse(stdout);
			// eslint-disable-next-line no-negated-condition
			if (!Array.isArray(parsedStdout)) {
				error = 'stdout is not a valid format';
			} else {
				testcaseResults = parsedStdout;
				isCorrect = testcaseResults.every((r) => r.status === 'CORRECT');
			}
		} catch {
			error = 'failed to parse stdout';
		}
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
		duration,
		stderr,
		stdout,
		executedAt: new Date(),
		results: testcaseResults,
	});

	if (status === 'success') {
		db.runTransaction(async (transaction) => {
			const scoreRef = db.doc(`games/${execution.gameId}/scores/${submission.userId}`) as DocumentReference<Score>;
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
};

export const onExecutionCreated = onDocumentCreated(
	'executions/{submissionId}',
	async (event) => {
		if (!event.data?.exists) {
			return;
		}

		const execution = event.data.data() as Execution;
		const gameDoc = await db.collection('games').doc(execution.gameId).get();
		const game = gameDoc.data() as Game;

		// --- reversing-diff ---
		if (game.rule.path === 'gameRules/reversing-diff') {
			await processReversingDiffExecution(game, execution);
			return;
		}

		// --- codegolf ---
		if (game.rule.path === 'gameRules/codegolf') {
			await processCodegolfExecution(game, execution);
			return;
		}

		// --- quantum-computing ---
		if (game.rule.path === 'gameRules/quantum-computing') {
			await processQuantumComputingExecution(game, execution);
			return;
		}

		// --- sql ---
		if (game.rule.path === 'gameRules/sql') {
			await processSqlExecution(game, execution);
		}
	},
);
