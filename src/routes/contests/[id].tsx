import {Typography, Container} from '@suid/material';
import {collection, doc, getFirestore, query, where} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For} from 'solid-js';
import {useParams} from 'solid-start';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';

const Home = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const contestRef = doc(db, 'contests', param.id);
	const contestData = useFirestore(contestRef);
	const gamesData = useFirestore(query(collection(db, 'games'), where('contest', '==', contestRef)));

	return (
		<main>
			<Container maxWidth="xl">
				<Doc data={contestData}>
					{(contest) => (
						<Typography variant="h1">
							{contest.name}
						</Typography>
					)}
				</Doc>
				<ol>
					<Collection data={gamesData}>
						{(games) => (
							<For each={games}>
								{(game) => {
									const ruleData = useFirestore(game.rule);
									return (
										<Doc data={ruleData}>
											{(rule) => (
												<li>{rule.name}: {game.maxPoint}点</li>
											)}
										</Doc>
									);
								}}
							</For>
						)}
					</Collection>
				</ol>
			</Container>
		</main>
	);
};

export default Home;

