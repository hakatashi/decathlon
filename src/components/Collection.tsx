import type {DocumentData, FirestoreError} from 'firebase/firestore';
import {For, JSX, Match, Switch} from 'solid-js';
import {UseFireStoreReturn} from '~/lib/schema';

interface Props<T extends DocumentData> {
	data: UseFireStoreReturn<T[] | undefined>,
	children: (item: T) => JSX.Element,
}

const Collection = <T extends DocumentData, >(props: Props<T>) => (
	<Switch>
		<Match when={props.data.loading}>
			<span class="loading">Loading...</span>
		</Match>
		<Match when={props.data.error}>
			<span class="load-error">Load error occured.</span>
		</Match>
		<Match when={props.data.data} keyed>
			{(docs) => (
				<For each={docs}>
					{(doc) => props.children(doc)}
				</For>
			)}
		</Match>
		<Match when>
			<span class="load-error">Load error occured.</span>
		</Match>
	</Switch>
);

export default Collection;

