import type {DocumentReference, Timestamp} from 'firebase/firestore';

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
