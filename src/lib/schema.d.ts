import type {DocumentData, DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

export interface User {
	displayName: string,
	photoURL: string,
	slug: string,
	slackId: string,
}

export interface RankingEntry {
	userId: string,
	point: number,
	rank: number,
	games: {
		gameId: string,
		hasScore: boolean,
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

export type ScoreConfiguration = ScoreConfigurationScore | ScoreConfigurationScoreAndRank | ScoreConfigurationMaxRatio;

export interface Game extends DocumentData {
	athlon: DocumentReference<Athlon>,
	rule: DocumentReference<GameRule>,
	scoreInputNote: string,
	maxPoint: number,
	maxRawScore: number,
	weight?: number,
	endAt?: Timestamp,
	order: number,
	description: string,
	scoreConfiguration: ScoreConfiguration,
	configuration: {[key: string]: any},
	tiebreakOrder: 'asc' | 'desc',
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

export interface DiffConfiguration {
	enabled: boolean,
	rule: string,
	files: {
		filename: string,
		label: string,
		isMain: boolean,
	}[],
}

export interface CodegolfConfiguration {
	enabled: boolean,
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
