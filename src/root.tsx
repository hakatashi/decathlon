// @refresh reload
import {Menu, MenuItem, Box, AppBar, Avatar, IconButton, Toolbar, Typography, Button} from '@suid/material';
import {GoogleAuthProvider, getAuth, signInWithPopup} from 'firebase/auth';
import {FirebaseProvider, useAuth, useFirebaseApp} from 'solid-firebase';
import {Suspense, Match, Switch} from 'solid-js';
import {
	Body,
	ErrorBoundary,
	FileRoutes,
	Head,
	Html,
	Link,
	Meta,
	Routes,
	Scripts,
	Title,
	A} from 'solid-start';
import './root.css';

const firebaseConfig = {
	apiKey: 'AIzaSyAd3v1a8OcFGa2K2PnMGaND1awfHgG6z8E',
	authDomain: 'tsg-decathlon.firebaseapp.com',
	projectId: 'tsg-decathlon',
	storageBucket: 'tsg-decathlon.appspot.com',
	messagingSenderId: '621156302243',
	appId: '1:621156302243:web:c0724b4636cb8e42cb6e16',
	measurementId: 'G-SSBBNLVY2E',
};

const Login = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), new GoogleAuthProvider());

	return <button type="button" onClick={signIn}>Sign In with Google</button>;
};

const Root = () => {
	const app = useFirebaseApp();
	const state = useAuth(getAuth(app));

	return (
		<Html lang="en">
			<Head>
				<Title>SolidStart - Bare</Title>
				<Meta charset="utf-8"/>
				<Meta name="viewport" content="width=device-width, initial-scale=1"/>
				<Link
					href="https://fonts.googleapis.com/css?family=Roboto:300,400,500"
					rel="stylesheet"
				/>
			</Head>
			<Body>
				<Suspense>
					<ErrorBoundary>
						<AppBar position="static">
							<Toolbar variant="dense">
								<Typography
									component="h1"
									variant="h5"
									noWrap
									sx={{
										mr: 2,
										display: 'flex',
										flexGrow: 0,
										fontFamily: 'monospace',
										fontWeight: 700,
										letterSpacing: '.3rem',
										textDecoration: 'none',
									}}
								>
									<A href="/">
										DECATHLON
									</A>
								</Typography>
								<Box sx={{flexGrow: 1, display: 'flex'}}>
									<Button
										sx={{my: 2, color: 'white', display: 'block'}}
									>
										<A href="/">
											Index
										</A>
									</Button>
								</Box>
								<Switch>
									<Match when={state.loading}>
										<p>Loading...</p>
									</Match>
									<Match when={state.data}>
										<IconButton sx={{p: 0}}>
											<Avatar
												alt={state.data?.displayName ?? 'No name'}
												src={state.data?.photoURL ?? ''}
											/>
										</IconButton>
									</Match>
									<Match when={state.error}>
										<Login/>
									</Match>
									<Match when>
										<Login/>
									</Match>
								</Switch>
							</Toolbar>
						</AppBar>
						<Routes>
							<FileRoutes/>
						</Routes>
					</ErrorBoundary>
				</Suspense>
				<Scripts/>
			</Body>
		</Html>
	);
};

const App = () => (
	<FirebaseProvider config={firebaseConfig}>
		<Root/>
	</FirebaseProvider>
);

export default App;
