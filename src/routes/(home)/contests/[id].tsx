import {Typography, Container} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {Show} from 'solid-js';
import {useParams} from 'solid-start';
import styles from './[id].module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import {athlonNames} from '~/lib/const';
import type {Game, Contest} from '~/lib/schema';

const Home = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const contestRef = doc(db, 'contests', param.id) as DocumentReference<Contest>;
	const contestData = useFirestore(contestRef);
	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('contest', '==', contestRef),
		),
	);

	return (
		<main>
			<div class={styles.athlonHeader}>
				<Doc data={contestData}>
					{(contest) => (
						<Typography variant="h1">
							{contest.name}
						</Typography>
					)}
				</Doc>
				<Show when={athlonNames.get(gamesData?.data?.length)} keyed>
					{(athlonName) => (
						<Typography variant="h3" component="h2">{athlonName}</Typography>
					)}
				</Show>
			</div>
			<Container maxWidth="xl">
				<ol>
					<Collection data={gamesData}>
						{(game) => {
							const ruleData = useFirestore(game.rule);
							return (
								<li>
									<Doc data={ruleData}>
										{(rule) => (
											<span>{rule.name}:</span>
										)}
									</Doc>
									{game.maxPoint}点
								</li>
							);
						}}
					</Collection>
				</ol>
			</Container>
		</main>
	);
};

export default Home;

