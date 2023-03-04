import type {DocumentData} from 'firebase/firestore';
import {For, JSX, Match, Switch} from 'solid-js';
import {UseFireStoreReturn} from '~/lib/schema';

interface Props<T extends DocumentData> {
	data: UseFireStoreReturn<T[] | undefined>,
	// eslint-disable-next-line no-unused-vars
	children: (item: T, index: () => number) => JSX.Element,
}

const Collection = <T extends DocumentData, >(props: Props<T>) => (
	<Switch>
		<Match when={props.data.loading}>
			<span class="loading">Loading...</span>
		</Match>
		<Match when={props.data.error}>
			<span class="load-error">{props.data.error?.toString()}</span>
		</Match>
		<Match when={props.data.data} keyed>
			{(docs) => (
				<For each={docs}>
					{(doc, index) => props.children(doc, index)}
				</For>
			)}
		</Match>
		<Match when>
			<span class="load-error">Load error occured.</span>
		</Match>
	</Switch>
);

export default Collection;

