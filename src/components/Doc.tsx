import type {DocumentData} from 'firebase/firestore';
import {JSX, Match, Switch} from 'solid-js';
import {UseFireStoreReturn} from '~/lib/schema';

interface Props<T extends DocumentData> {
	data: UseFireStoreReturn<T | null | undefined> | null | undefined,
	children: (item: T) => JSX.Element,
}

const Doc = <T extends DocumentData, >(props: Props<T>) => (
	<Switch>
		<Match when={props.data === null}>
			<span class="loading">Loading...</span>
		</Match>
		<Match when={props.data?.loading}>
			<span class="loading">Loading...</span>
		</Match>
		<Match when={props.data?.error}>
			<span class="load-error">Load error occured.</span>
		</Match>
		<Match when={props.data?.data} keyed>
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

