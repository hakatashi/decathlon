import type {DocumentData} from 'firebase/firestore';
import {DataModel, FirestoreModel, rules, timestampType} from 'fireschema';
import {z} from 'zod';

const UserType = z.object({
	displayName: z.string(),
	photoURL: z.string(),
	slug: z.string(),
	slackId: z.string(),
});

export type User = z.infer<typeof UserType> & DocumentData;

const RankingEntryType = z.object({
	userId: z.string(),
	point: z.number().finite(),
	rank: z.number().int(),
	games: z.array(z.object({
		gameId: z.string(),
		hasScore: z.boolean(),
		point: z.number().finite(),
		rawScore: z.number().finite(),
		tiebreakScore: z.number().finite(),
		rank: z.union([z.number(), z.null()]),
	})),
});

export type RankingEntry = z.infer<typeof RankingEntryType> & DocumentData;

const AthlonType = z.object({
	name: z.string(),
	startAt: timestampType(),
	endAt: timestampType(),
	description: z.string(),
	id: z.string(),
	ranking: z.array(RankingEntryType),
});

export type Athlon = z.infer<typeof AthlonType> & DocumentData;

export const UserModel = new DataModel({
	schema: UserType,
});

export const AthlonModel = new DataModel({
	schema: AthlonType,
});

export const firestoreModel = new FirestoreModel({
	'function isAdmin()': `
		return exists(${rules.basePath}/admins/$(request.auth.uid));
	`,

	'function requestUserIs(uid)': `
		return request.auth.uid == uid;
	`,

	'/users/{userId}': {
		model: UserModel,
		allow: {
			read: true,
			write: rules.or('requestUserIs(userId)', 'isAdmin()'),
		},
	},

	'/athlons/{athlonId}': {
		model: AthlonModel,
		allow: {
			read: true,
			write: rules.or('isAdmin()'),
		},
	},

	collectionGroups: {},
});

export default firestoreModel;
