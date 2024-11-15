import {getBytes, StorageReference} from 'firebase/storage';
import {createStore, reconcile} from 'solid-js/store';

export const useStorageBytes = (storageRef: StorageReference) => {
	const [state, setState] = createStore<{
		loading: boolean
		error: Error | null
		data: ArrayBuffer | null
	}>({
		loading: true,
		error: null,
		data: null,
	});

	getBytes(storageRef)
		.then((buffer) => {
			setState(
				reconcile({
					loading: false,
					error: null,
					data: buffer,
				}),
			);
		})
		.catch((error) => {
			setState(
				reconcile({
					loading: false,
					error,
					data: null,
				}),
			);
		});

	return state;
};
