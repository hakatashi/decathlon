import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import type {Athlon} from '~/lib/schema';

const useAthlon = (athlonId: string) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonRef = doc(db, 'athlons', athlonId) as DocumentReference<Athlon>;
	const athlonData = useFirestore(athlonRef);

	return athlonData;
};

export default useAthlon;
