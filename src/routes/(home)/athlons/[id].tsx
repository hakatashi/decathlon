import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createContext, useContext} from 'solid-js';
import {Outlet, useParams} from 'solid-start';
import type {Athlon, UseFireStoreReturn} from '~/lib/schema';

const AthlonContext = createContext<UseFireStoreReturn<Athlon | null | undefined>>();

const AthlonLayout = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonRef = doc(db, 'athlons', param.id) as DocumentReference<Athlon>;
	const athlonData = useFirestore(athlonRef);

	return (
		<AthlonContext.Provider value={athlonData}>
			<Outlet/>
		</AthlonContext.Provider>
	);
};

export const useAthlon = () => useContext(AthlonContext);
export default AthlonLayout;

