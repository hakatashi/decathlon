import type {DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

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

export interface Game {
	rule: DocumentReference<GameRule>,
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

export interface GameRule {
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
