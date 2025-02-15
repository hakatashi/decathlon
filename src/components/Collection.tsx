import {Skeleton} from '@suid/material';
import type {DocumentData} from 'firebase/firestore';
import {For, JSX, Match, Switch} from 'solid-js';
import {UseFireStoreReturn} from '~/lib/schema';

interface Props<T extends DocumentData> {
	data: UseFireStoreReturn<T[] | null | undefined> | null | undefined,
	children: (item: T, index: () => number) => JSX.Element,
	empty?: JSX.Element,
}

const Collection = <T extends DocumentData, >(props: Props<T>) => (
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
			{(docs) => (
				<Switch>
					<Match when={docs.length === 0 && props.empty !== undefined}>
						{props.empty}
					</Match>
					<Match when>
						<For each={docs}>
							{(doc, index) => props.children(doc, index)}
						</For>
					</Match>
				</Switch>
			)}
		</Match>
		<Match when>
			<span class="load-error">Load error occured.</span>
		</Match>
	</Switch>
);

export default Collection;

