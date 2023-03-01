import {Box, AppBar, Avatar, IconButton, Toolbar, Typography, Button} from '@suid/material';
import {GoogleAuthProvider, getAuth, signInWithPopup} from 'firebase/auth';
import {useAuth, useFirebaseApp} from 'solid-firebase';
import {Match, Switch} from 'solid-js';
import {A} from 'solid-start';


const Login = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), new GoogleAuthProvider());

	return <button type="button" onClick={signIn}>Sign In with Google</button>;
};

const Header = () => {
	const app = useFirebaseApp();
	const state = useAuth(getAuth(app));
	return (
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
	);
};

export default Header;
