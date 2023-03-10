import {EmojiEvents} from '@suid/icons-material';
import {Typography, Container, List, ListItem, ListItemAvatar, Avatar, ListItemText, Box, Button} from '@suid/material';
import {collection, CollectionReference, doc, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import styles from './index.module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import {athlonNames} from '~/lib/const';
import type {Game} from '~/lib/schema';

const Home = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			orderBy('order'),
		),
	);

	return (
		<main class={styles.contest}>
			<Doc data={athlonData}>
				{(athlon) => (
					<PageTitle>{athlon.name}</PageTitle>
				)}
			</Doc>
			<div class={styles.athlonHeader}>
				<Doc data={athlonData}>
					{(athlon) => (
						<Typography variant="h1">
							{athlon.name}
						</Typography>
					)}
				</Doc>
				<Show when={athlonNames.get(gamesData?.data?.length)} keyed>
					{(athlonName) => (
						<Typography variant="h3" component="h2" class={styles.athlonName}>
							<For each={Array.from(athlonName)} >
								{(char) => (
									<span>{char}</span>
								)}
							</For>
						</Typography>
					)}
				</Show>
			</div>
			<Container maxWidth="sm">
				<Button size="large" sx={{my: 3}} variant="contained" component={A} href="./leaderboard">
					<EmojiEvents sx={{mr: 1}}/>
					Show Leaderboard
				</Button>
				<Typography
					component="h2"
					textAlign="center"
					letterSpacing={30}
					fontSize={20}
					fontWeight="bold"
					mt={5}
				>
					競技一覧
				</Typography>
				<List sx={{bgcolor: 'background.paper'}}>
					<Collection data={gamesData}>
						{(game, index) => {
							const ruleData = useFirestore(game.rule);
							const hasScore = ruleData?.data?.users?.some((user) => user.id === 'ZnYLOVTDhWVxlKt2vxhmCDmvqrJ3');

							return (
								<ListItem component={A} href={`/athlons/${param.id}/${game.rule.id}`}>
									<ListItemAvatar>
										<Avatar>
											{index() + 1}
										</Avatar>
									</ListItemAvatar>
									<Doc data={ruleData}>
										{(rule) => (
											<ListItemText primary={rule.name} secondary={`${game.maxPoint * (game.weight ?? 1)}点`}/>
										)}
									</Doc>
								</ListItem>
							);
						}}
					</Collection>
				</List>
			</Container>
		</main>
	);
};

export default Home;

