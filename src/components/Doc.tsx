import {Skeleton} from '@suid/material';
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
			<Skeleton variant="text"/>
		</Match>
		<Match when={props.data?.loading}>
			<Skeleton variant="text"/>
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

