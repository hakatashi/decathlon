import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo} from 'solid-js';
import type {Game, GameRule} from '~/lib/schema';

/**
 * URL セグメントの `[ruleId]` を「slug または ruleId」として解釈してゲームを解決する。
 * まず `slug == param` で探し、見つからなければ従来どおり `rule == param` で探す。
 * `gameData.data` は従来と同じく高々 1 件の配列。
 */
const useGameBySlug = (athlonId: string, param: () => string) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const slugData = useFirestore(
		() => query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', athlonId)),
			where('slug', '==', param()),
		),
	);
	const ruleQueryData = useFirestore(
		() => query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', athlonId)),
			where('rule', '==', doc(db, 'gameRules', param()) as DocumentReference<GameRule>),
		),
	);

	const isSlugMatched = () => (slugData.data?.length ?? 0) > 0;

	const gameData = {
		get data() {
			if (isSlugMatched()) {
				return slugData.data;
			}
			if (slugData.loading) {
				return undefined;
			}
			return ruleQueryData.data;
		},
		get loading() {
			return slugData.loading || (!isSlugMatched() && ruleQueryData.loading);
		},
		get error() {
			return slugData.error ?? ruleQueryData.error;
		},
	};

	// ゲームが持つ rule の ID。ゲーム解決前は param をそのまま ruleId とみなす。
	const ruleId = createMemo(() => gameData.data?.[0]?.rule.id ?? param());
	const ruleData = useFirestore(() => doc(db, 'gameRules', ruleId()) as DocumentReference<GameRule>);

	return {gameData, ruleData, ruleId};
};

export default useGameBySlug;
