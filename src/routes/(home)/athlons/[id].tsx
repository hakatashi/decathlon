import {Typography, Container, List, ListItem, ListItemAvatar, Avatar, ListItemText} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {Show} from 'solid-js';
import {useParams} from 'solid-start';
import styles from './[id].module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import {athlonNames} from '~/lib/const';
import type {Game, Athlon} from '~/lib/schema';

const Home = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonRef = doc(db, 'athlons', param.id) as DocumentReference<Athlon>;
	const athlonData = useFirestore(athlonRef);
	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', athlonRef),
			orderBy('order'),
		),
	);

	return (
		<main class={styles.contest}>
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
						<Typography variant="h3" component="h2">{athlonName}</Typography>
					)}
				</Show>
			</div>
			<Container maxWidth="sm">
				<Typography
					component="h2"
					textAlign="center"
					letterSpacing={30}
					fontSize={20}
					fontWeight="bold"
					mt={5}
					mb={1}
				>
					競技一覧
				</Typography>
				<List sx={{bgcolor: 'background.paper'}}>
					<Collection data={gamesData}>
						{(game, index) => {
							const ruleData = useFirestore(game.rule);
							const hasScore = ruleData?.data?.users?.some((user) => user.id === 'ZnYLOVTDhWVxlKt2vxhmCDmvqrJ3');

							return (
								<ListItem>
									<ListItemAvatar>
										<Avatar>
											{index() + 1}
										</Avatar>
									</ListItemAvatar>
									<Doc data={ruleData}>
										{(rule) => (
											<ListItemText primary={rule.name} secondary={`${game.maxPoint}点`}/>
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

