import type {DocumentReference, FirestoreError, Timestamp} from 'firebase/firestore';

export interface User {
	displayName: string,
	photoURL: string,
	slug: string,
}

export interface Contest {
	name: string,
	startAt: Timestamp,
	endAt: Timestamp,
	description: string,
	id: string,
}

export interface Game {
	rule: DocumentReference<GameRule>,
	maxPoint: number,
}

export interface GameRule {
	name: string,
}

interface UseFireStoreReturn<T> {
	data: T;
	loading: boolean;
	error: FirestoreError | null;
}
