import type {DocumentData, DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

export interface User {
	displayName: string,
	photoURL: string,
	slug: string,
	slackId: string,
}

export interface Athlon {
	name: string,
	startAt: Timestamp,
	endAt: Timestamp,
	description: string,
	id: string,
}

export interface Game extends DocumentData {
	rule: DocumentReference<GameRule>,
	scoreInputNote: string,
	maxPoint: number,
	weight?: number,
	order: number,
	description: string,
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
