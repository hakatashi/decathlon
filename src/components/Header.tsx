import {Logout, Settings} from '@suid/icons-material';
import {Box, AppBar, Avatar, IconButton, Toolbar, Typography, Button, Menu, MenuItem, Divider, ListItemIcon} from '@suid/material';
import {GoogleAuthProvider, getAuth, signInWithPopup, signOut} from 'firebase/auth';
import {useAuth, useFirebaseApp} from 'solid-firebase';
import {createSignal, Match, Switch} from 'solid-js';
import {A} from 'solid-start';


const Login = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), new GoogleAuthProvider());

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
	const authState = useAuth(auth);

	const [anchorEl, setAnchorEl] = createSignal<null | HTMLElement>(null);
	const isAccountMenuOpen = () => Boolean(anchorEl());
	const handleAccountMenuClose = () => setAnchorEl(null);

	const handleLogout = () => signOut(auth);

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
					<Match when={authState.loading}>
						<p>Loading...</p>
					</Match>
					<Match when={authState.data}>
						<IconButton sx={{p: 0}} onClick={(event) => setAnchorEl(event.currentTarget)}>
							<Avatar
								alt={authState.data?.displayName ?? 'No name'}
								src={authState.data?.photoURL ?? ''}
							/>
						</IconButton>
					</Match>
					<Match when={authState.error}>
						<Login/>
					</Match>
					<Match when>
						<Login/>
					</Match>
				</Switch>
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
						Profile
					</MenuItem>
					<Divider/>
					<MenuItem>
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
			</Toolbar>
		</AppBar>
	);
};

export default Header;
