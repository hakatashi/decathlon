import {Button, Card, CardActions, CardContent, Typography, Container} from '@suid/material';
import {collection, CollectionReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {A} from 'solid-start';
import Collection from '~/components/Collection';
import Header from '~/components/Header';
import {formatTimestamp} from '~/lib/date';
import type {Contest} from '~/lib/schema';

const Home = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const contestsData = useFirestore(collection(db, 'contests') as CollectionReference<Contest>);

	return (
		<div>
			<Header/>
			<main>
				<Container maxWidth="xl">
					<ul>
						<Collection data={contestsData}>
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
						</Collection>
					</ul>
					<pre/>
				</Container>
			</main>
		</div>
	);
};

export default Home;
