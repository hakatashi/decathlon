import {Logout, Settings} from '@suid/icons-material';
import {Box, AppBar, Avatar, IconButton, Toolbar, Typography, Button, Menu, MenuItem, Divider, ListItemIcon} from '@suid/material';
import {getAuth, signInWithPopup, signOut, OAuthProvider} from 'firebase/auth';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, Match, Show, Switch} from 'solid-js';
import {A} from 'solid-start';
import Doc from '~/components/Doc';
import type {UseFireStoreReturn, User} from '~/lib/schema';

const slackProvider = new OAuthProvider('oidc.slack');
const scopes = ['openid', 'profile', 'email'];
for (const scope of scopes) {
	slackProvider.addScope(scope);
}

const Login = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), slackProvider);

	return (
		<Button
			sx={{my: 2, color: 'white', display: 'block'}}
			onClick={signIn}
		>
			Login
		</Button>
	);
};

const Header = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const db = getFirestore(app);

	const authState = useAuth(auth);

	const [anchorEl, setAnchorEl] = createSignal<HTMLElement | null>(null);
	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	const isAccountMenuOpen = () => Boolean(anchorEl());
	const handleAccountMenuClose = () => setAnchorEl(null);

	const handleLogout = () => signOut(auth);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

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
						<A href="/athlons">
							Athlons
						</A>
					</Button>
				</Box>
				<Switch>
					<Match when={authState.loading}>
						<p>Loading...</p>
					</Match>
					<Match when={authState.data} keyed>
						{(user) => (
							<>
								<IconButton sx={{p: 0}} onClick={(event) => setAnchorEl(event.currentTarget)}>
									<Avatar
										alt={user.displayName ?? 'No name'}
										src={user.photoURL ?? ''}
									/>
								</IconButton>
								<Menu
									anchorEl={anchorEl()}
									open={isAccountMenuOpen()}
									onClose={handleAccountMenuClose}
									onClick={handleAccountMenuClose}
									transformOrigin={{
										horizontal: 'right',
										vertical: 'top',
									}}
									anchorOrigin={{
										horizontal: 'right',
										vertical: 'bottom',
									}}
								>
									<MenuItem>
										<Show when={userData()} keyed>
											{
												(userDoc) => (
													<Doc data={userDoc}>
														{({displayName}) => (
															<span>{displayName}</span>
														)}
													</Doc>
												)
											}
										</Show>
									</MenuItem>
									<MenuItem component={A} href={`/users/${user.uid}`}>
										Profile
									</MenuItem>
									<Divider/>
									<MenuItem component={A} href="/settings">
										<ListItemIcon>
											<Settings fontSize="small"/>
										</ListItemIcon>
										Settings
									</MenuItem>
									<MenuItem onClick={handleLogout}>
										<ListItemIcon>
											<Logout fontSize="small"/>
										</ListItemIcon>
										Logout
									</MenuItem>
								</Menu>
							</>
						)}
					</Match>
					<Match when={authState.error}>
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
