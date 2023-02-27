import {Button} from '@suid/material';
import {GoogleAuthProvider, getAuth, signInWithPopup} from 'firebase/auth';
import {collection, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Match, Switch} from 'solid-js';
import Collection from '~/components/Collection';

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
			<Button variant="contained">Hello world</Button>
			<Collection data={contestsData}>
				{(contests) => (
					<ul>
						<For each={contests}>
							{(contest) => (
								<li>{contest.id}</li>
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
						{JSON.stringify(state.data, null, '  ')}
					</Match>
					<Match when={state.error}>
						<Login/>
					</Match>
					<Match when>
						<Login/>
					</Match>
				</Switch>
			</pre>
		</main>
	);
};

export default Home;
