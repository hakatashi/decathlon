import type {User as SlackUser} from '@slack/web-api/dist/types/response/UsersInfoResponse';
import type {DocumentData, DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

export interface User {
	displayName: string,
	photoURL: string,
	slug: string,
	slackId: string,
}

export type SlackUserInfo = SlackUser

export interface RankingEntry {
	userId: string,
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
	ranking: RankingEntry[],
}

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

export type CodegolfJudgeType = 'ignore-whitespaces' | 'ignore-newline-type';

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

export interface QuantumComputingConfiguration {
	enabled: boolean,
	description: string,
	judgeCode: string,
	submissionTemplate: string,
}

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

type Configuration = DiffConfiguration | CodegolfConfiguration | QuantumComputingConfiguration | PromptEngineeringConfiguration | TypingJapaneseConfiguration;

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
