import {Stack, Box} from '@suid/material';
import {For, Show} from 'solid-js';
import styles from './RankingSummary.module.css';
import Username from '~/components/Username';

interface Props {
	users: string[],
}

const RankingSummary = (props: Props) => (
	<>
		<Show when={props.users[0]} keyed>
			{(user) => (
				<Username
					userId={user}
					size="large"
					direction="column"
					accessory={
						<img src="/images/crown-solid.svg" class={styles.crown}/>
					}
					sx={{mt: 5}}
				/>
			)}
		</Show>
		<Stack
			direction="row"
			width="100%"
			justifyContent="space-around"
			flexWrap="wrap"
		>
			<For each={props.users.slice(1, 5)} >
				{(user, i) => (
					<Username
						userId={user}
						size="medium"
						direction="column"
						sx={{mt: 5}}
						accessory={
							<div class={styles.rank}>{i() + 2}</div>
						}
					/>
				)}
			</For>
		</Stack>
		<Stack
			direction="row"
			width="100%"
			justifyContent="space-between"
			flexWrap="wrap"
		>
			<For each={props.users.slice(5, 15)} >
				{(user, i) => (
					<Box flex="1 0 64px" textAlign="center" style={{'word-break': 'break-all'}}>
						<Username
							userId={user}
							size={60}
							direction="column"
							sx={{mt: 5}}
							accessory={
								<div class={styles.rank}>{i() + 6}</div>
							}
						/>
					</Box>
				)}
			</For>
		</Stack>
	</>
);

export default RankingSummary;
