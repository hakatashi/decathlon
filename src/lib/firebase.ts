import {getBytes, StorageReference} from 'firebase/storage';
import {createStore, reconcile} from 'solid-js/store';

// eslint-disable-next-line import/prefer-default-export
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
