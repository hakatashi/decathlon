import {AppBar, Avatar, Button, IconButton, Toolbar, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useAuth, useFirestore} from 'solid-firebase';
import {createContext, createEffect, createSignal, Show, useContext} from 'solid-js';
import {Outlet} from 'solid-start';
import styles from './arenas.module.css';
import Doc from '~/components/Doc';
import type {UseFireStoreReturn, User} from '~/lib/schema';

type UseAuthReturn = ReturnType<typeof useAuth>;

const AuthStateContext = createContext<UseAuthReturn>();

export const [headerText, setHeaderText] = createSignal<string>('');

const ArenasLayout = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const db = getFirestore(app);

	const authState = useAuth(auth);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	return (
		<AuthStateContext.Provider value={authState}>
			<div class={styles.wrap}>
				<AppBar position="static" class={styles.header}>
					<Toolbar variant="dense">
						<Typography variant="h6" color="inherit" component="h1">
							タイピング (日本語)
						</Typography>
						<Typography variant="h6" component="div" color="inherit" sx={{flexGrow: 1, textAlign: 'center'}}>
							{headerText()}
						</Typography>
						<IconButton sx={{p: 0}} size="small">
							<Doc data={userData()}>
								{({displayName, photoURL}) => (
									<Avatar
										alt={displayName ?? 'No name'}
										src={photoURL ?? ''}
										sx={{width: 30, height: 30}}
									/>
								)}
							</Doc>
						</IconButton>
					</Toolbar>
				</AppBar>
				<div class={styles.mainArea}>
					<Outlet/>
				</div>
			</div>
		</AuthStateContext.Provider>
	);
};

export const useAuthState = () => useContext(AuthStateContext);
export default ArenasLayout;
