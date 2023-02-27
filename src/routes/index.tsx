import {Button, Card, CardActions, CardContent, Typography, Container} from '@suid/material';
import {GoogleAuthProvider, getAuth, signInWithPopup} from 'firebase/auth';
import {collection, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Match, Switch} from 'solid-js';
import {A} from 'solid-start';
import Collection from '~/components/Collection';
import {formatTimestamp} from '~/lib/date';

const Login = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), new GoogleAuthProvider());

	return <button type="button" onClick={signIn}>Sign In with Google</button>;
};

const Home = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const state = useAuth(getAuth(app));
	const contestsData = useFirestore(collection(db, 'contests'));

	return (
		<main>
			<Container maxWidth="xl">
				<Button variant="outlined">Hello world</Button>
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
				<pre>
					<Switch>
						<Match when={state.loading}>
							<p>Loading...</p>
						</Match>
						<Match when={state.data}>
							<p>Logged in</p>
						</Match>
						<Match when={state.error}>
							<Login/>
						</Match>
						<Match when>
							<Login/>
						</Match>
					</Switch>
				</pre>
			</Container>
		</main>
	);
};

export default Home;
