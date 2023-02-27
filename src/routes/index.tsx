import {Button, Card, CardActions, CardContent, Typography, Container} from '@suid/material';
import {collection, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For} from 'solid-js';
import {A} from 'solid-start';
import Collection from '~/components/Collection';
import {formatTimestamp} from '~/lib/date';

const Home = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const contestsData = useFirestore(collection(db, 'contests'));

	return (
		<main>
			<Container maxWidth="xl">
				<Collection data={contestsData}>
					{(contests) => (
						<ul>
							<For each={contests}>
								{(contest) => (
									<A href={`/contests/${contest.id}`}>
										<Card sx={{margin: '3rem'}}>
											<CardContent>
												<Typography variant="h1">
													{contest.name}
												</Typography>
												<Typography variant="h5" component="h2">
													{formatTimestamp(contest.startAt)} - {formatTimestamp(contest.endAt)}
												</Typography>
												<Typography variant="body2">
													{contest.description}
												</Typography>
											</CardContent>
											<CardActions>
												<Button>Learn More</Button>
											</CardActions>
										</Card>
									</A>
								)}
							</For>
						</ul>
					)}
				</Collection>
				<pre/>
			</Container>
		</main>
	);
};

export default Home;
