import type {User as SlackUser} from '@slack/web-api/dist/types/response/UsersInfoResponse';
import type {DocumentData, DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

export interface User extends DocumentData {
	displayName: string,
	photoURL: string,
	slug: string,
	slackId: string,
}

export type SlackUserInfo = SlackUser

export interface RankingEntry {
	userId: string,
	athlonId: string,
	point: number,
	rank: number,
	games: {
		gameId: string,
		hasScore: boolean,
		isAuthor: boolean,
		point: number,
		rawScore: number,
		tiebreakScore: number,
		rank: number | null,
	}[],
}

export interface Athlon {
	name: string,
	startAt: Timestamp,
	endAt: Timestamp,
	description: string,
	id: string,
	rookieThresholdId: string | null,
}

export type AthlonRanking = DocumentData & RankingEntry;

export interface ScoreConfigurationScore {
	type: 'score',
	scoreWeight: number,
}

export interface ScoreConfigurationScoreAndRank {
	type: 'score-and-rank',
	scoreWeight: number,
	rankRatio: number,
	rankWeight: number,
}

export interface ScoreConfigurationMaxRatio {
	type: 'max-ratio',
}

export interface ScoreConfigurationTimestamp {
	type: 'timestamp',
	attenuationFactor: number,
}

export type ScoreConfiguration = ScoreConfigurationScore | ScoreConfigurationScoreAndRank | ScoreConfigurationMaxRatio | ScoreConfigurationTimestamp;

export interface Game extends DocumentData {
	athlon: DocumentReference<Athlon>,
	rule: DocumentReference<GameRule>,
	scoreInputNote: string,
	maxPoint: number,
	maxRawScore: number,
	weight?: number,
	endAt: Timestamp | null,
	order: number,
	description: string,
	scoreConfiguration: ScoreConfiguration,
	configuration: Configuration,
	tiebreakOrder: 'asc' | 'desc',
	isScoreUserEditable: boolean,
	isUserResettable?: boolean,
	admins: string[],
	authors: string[],
	adminBonus: {
		type: 'topPlayer',
		count: number,
	},
	links: {
		label: string,
		url: string,
		isMain: boolean,
	}[],
}

export interface Score extends DocumentData {
	athlon: DocumentReference<Athlon>,
	rawScore: number,
	tiebreakScore: number,
	user: string,
}

export interface TypingJapaneseSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	submissionText: string,
	score: number,
	diffTokens: {
		type: 'deletion' | 'addition' | 'common',
		token: string,
	}[],
}

export interface ReversingDiffSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	status: 'pending' | 'executing' | 'failed' | 'success' | 'error' | 'invalid',
	language: string,
	code: string,
	stdout: string | null,
	stderr: string | null,
	errorMessage?: string,
	duration: number | null,
	score: number | null,
	createdAt: Timestamp,
	executedAt: Timestamp | null,
}

export interface CodegolfSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	status: 'pending' | 'executing' | 'failed' | 'success' | 'error' | 'invalid',
	language: string,
	code: string,
	size: number,
	testcases: {
		stdin: string,
		stdout: string | null,
		stderr: string | null,
		trace: string | null,
		duration: number | null,
		status: 'failed' | 'success' | 'error',
	}[],
	errorMessage?: string,
	createdAt: Timestamp,
	executedAt: Timestamp | null,
}

export type QuantumComputingResult = 'failed' | 'success' | 'error';
export type QuantumComputingStatus = 'pending' | 'executing' | QuantumComputingResult;

export interface QuantumComputingSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	status: QuantumComputingStatus,
	code: string,
	size: number,
	stdout: string | null,
	stderr: string | null,
	duration: number | null,
	errorMessage?: string,
	createdAt: Timestamp,
	executedAt: Timestamp | null,
	challengeId?: string,
}

export interface PromptEngineeringHaikuOutput {
	haiku: string[],
	ruby: string[],
}

export interface PromptEngineeringSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	prompt: string,
	status: 'pending' | 'done',
	result: string | null,
	parsedOutput: PromptEngineeringHaikuOutput | null,
	errorMessage?: string,
	formatScore: number | null,
	rawVoteScore: number | null,
	voteScore: number | null,
	votes: {
		userId: string,
		order: number,
	}[],
	score: number | null,
	updatedAt: Timestamp,
}

export type SqlResult = 'failed' | 'success' | 'error';
export type SqlStatus = 'pending' | 'executing' | SqlResult;
export type SqlEngine = 'mysql' | 'postgresql' | 'sqlite';
export interface SqlTestcaseResult {
	testcase: string,
	status: 'WRONG_ANSWER' | 'CORRECT',
	detailed_error: string | null,
}

export interface SqlSubmission extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	status: SqlStatus,
	engine: SqlEngine,
	results: SqlTestcaseResult[],
	code: string,
	size: number,
	stdout: string | null,
	stderr: string | null,
	duration: number | null,
	errorMessage?: string,
	createdAt: Timestamp,
	executedAt: Timestamp | null,
}

export interface DiffConfiguration {
	enabled: boolean,
	language: string,
	rule: string,
	files: {
		filename: string,
		label: string,
		isMain: boolean,
	}[],
}

export type CodegolfJudgeType = 'ignore-whitespaces' | 'ignore-newline-type' | 'number-sequence-ignore-whitespaces';

export interface CodegolfConfiguration {
	enabled: boolean,
	judgeType: CodegolfJudgeType,
	testcases: {
		input: string,
		output: string,
	}[],
	description: string,
	languages: {
		id: string,
		label: string,
	}[],
}

export interface QuantumComputingConfigurationV1 {
	version: 1,
	enabled: boolean,
	description: string,
	judgeCode: string,
	submissionTemplate: string,
}

export interface QuantumComputingChallengeV2 {
	id: string,
	score: number,
	description: string,
	judgeCode: string,
	submissionTemplate: string,
}

export interface QuantumComputingConfigurationV2 {
	version: 2,
	enabled: boolean,
	challenges: QuantumComputingChallengeV2[],
}

export type QuantumComputingConfiguration = QuantumComputingConfigurationV1 | QuantumComputingConfigurationV2;

export type PromptEngineeringPhase = 'submission' | 'vote' | 'finished';

export interface PromptEngineeringConfiguration {
	phase: PromptEngineeringPhase,
	type: string,
	briefRegulation: string,
	regulation: string,
	voteRegulation: string,
	parserScript: string,
	promptTemplate: string,
}

export interface TypingJapaneseConfiguration {
	enabled?: boolean,
	duration?: number,
	textUrl?: string,
}

export interface SqlConfiguration {
	enabled: boolean,
	description: string,
	tableSchemas: {
		name: string,
		columns: {
			name: string,
			type: string,
		}[],
	}[],
	sampleInput: {
		name: string,
		rows: Record<string, string>[],
	}[],
	sampleOutput: {
		columnNames: string[],
		rows: Record<string, string>[],
	},
}

type Configuration =
	DiffConfiguration |
	CodegolfConfiguration |
	QuantumComputingConfigurationV1 |
	PromptEngineeringConfiguration |
	TypingJapaneseConfiguration |
	SqlConfiguration;

export interface ReversingDiffRanking extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	score: number,
	createdAt: Timestamp,
}

export interface CodegolfRanking extends DocumentData {
	athlon: DocumentReference<Athlon>,
	userId: string,
	score: number,
	languages: {
		size: number,
		score: number,
		rank: number,
		hasScore: boolean,
	}[],
	updatedAt: Timestamp,
}

export interface PromptEngineeringResult extends DocumentData {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	openaiResponse: any,
	output: string,
	parsedOutput: {
		haiku: string[],
		ruby: string[],
	},
	point: number,
	points: {
		haiku: number,
		ruby: number,
		jiamari: number,
		extraneous: number,
	},
	seed: number,
}

export interface PromptEngineeringVote extends DocumentData {
	userId: string,
	choices: string[],
}

export interface ItQuizShowcaseQuizAnswer extends DocumentData {
	userId: string,
	text: string,
	status: 'correct' | 'wrong' | 'pending',
	isShown: boolean,
	isAnonymous: boolean,
}

export interface ItQuizShowcaseQuiz extends DocumentData {
	id: string,
	index: number,
	question: string,
	correctAnswers: string[],
	imageUrl: string | null,
	description: string | null,
	answers: Record<string, ItQuizShowcaseQuizAnswer>,
}

export interface ItQuizShowcase extends DocumentData {
	currentQuizIndex: number,
	usersCount: number,
	quizzes: Record<string, ItQuizShowcaseQuiz>,
}

export interface Writeup extends DocumentData {
	content: string,
	title: string,
	createdAt: Timestamp,
	updatedAt: Timestamp,
}

export interface GameRule extends DocumentData {
	name: string,
	icon: string,
	description: string,
	shortName: string,
	users: {
		id: string,
		point: number,
	}[],
}

interface UseFireStoreReturn<T> {
	data: T;
	loading: boolean;
	error: FirestoreError | null;
}
