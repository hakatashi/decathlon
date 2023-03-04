import {Button, Card, CardActions, CardContent, Typography, Container} from '@suid/material';
import {collection, CollectionReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {A} from 'solid-start';
import Collection from '~/components/Collection';
import {formatTimestamp} from '~/lib/date';
import type {Athlon} from '~/lib/schema';

const Athlons = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonsData = useFirestore(collection(db, 'athlons') as CollectionReference<Athlon>);

	return (
		<main>
			<Container maxWidth="xl">
				<ul>
					<Collection data={athlonsData}>
						{(athlon) => (
							<A href={`/athlons/${athlon.id}`}>
								<Card sx={{margin: '3rem'}}>
									<CardContent>
										<Typography variant="h1">
											{athlon.name}
										</Typography>
										<Typography variant="h5" component="h2">
											{formatTimestamp(athlon.startAt)} - {formatTimestamp(athlon.endAt)}
										</Typography>
										<Typography variant="body2">
											{athlon.description}
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
	);
};

export default Athlons;
