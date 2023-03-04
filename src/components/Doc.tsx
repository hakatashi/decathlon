/* eslint-disable react/require-default-props */

import type {DocumentData} from 'firebase/firestore';
import {JSX, Match, Show, Switch} from 'solid-js';
import {UseFireStoreReturn} from '~/lib/schema';

interface Props<T extends DocumentData> {
	data: UseFireStoreReturn<T | null | undefined> | null | undefined,
	fallback?: JSX.Element,
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
			<span class="load-error">{props.data?.error?.toString()}</span>
		</Match>
		<Match when={props.data?.data} keyed>
			{(data) => (
				props.children(data)
			)}
		</Match>
		<Match when>
			<Show when={props.fallback} keyed>
				{(fallback) => fallback}
			</Show>
		</Match>
	</Switch>
);

export default Doc;

