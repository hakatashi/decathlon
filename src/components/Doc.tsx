import type {DocumentData, FirestoreError} from 'firebase/firestore';
import {JSX, Match, Switch} from 'solid-js';

interface UseFireStoreReturn<T> {
	data: T;
	loading: boolean;
	error: FirestoreError | null;
}

interface Props {
	data: UseFireStoreReturn<DocumentData | null | undefined>,
	children: (item: DocumentData) => JSX.Element,
}

const Doc = (props: Props) => (
	<Switch>
		<Match when={props.data.loading}>
			<span class="loading">Loading...</span>
		</Match>
		<Match when={props.data.error}>
			<span class="load-error">Load error occured.</span>
		</Match>
		<Match when={props.data.data} keyed>
			{(data) => (
				props.children(data)
			)}
		</Match>
		<Match when>
			<span class="load-error">Load error occured.</span>
		</Match>
	</Switch>
);

export default Doc;

