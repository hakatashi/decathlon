import {AppBar, Avatar, IconButton, Toolbar, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import type {User as AuthUser} from 'firebase/auth';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import last from 'lodash/last';
import {useFirebaseApp, useAuth, useFirestore} from 'solid-firebase';
import {createContext, createEffect, createMemo, createSignal, Show, useContext} from 'solid-js';
import {A, Outlet, useSearchParams} from 'solid-start';
import styles from './arenas.module.css';
import Doc from '~/components/Doc';
import LoginRequiredDialog from '~/components/LoginRequiredDialog';
import PageNotFoundError from '~/lib/PageNotFoundError';
import type {Game, UseFireStoreReturn, User} from '~/lib/schema';

const UserContext = createContext<AuthUser>();

export const [headerText, setHeaderText] = createSignal<string>('');
export const [arenaTitle, setArenaTitle] = createSignal<string>('');

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

	const [searchParams] = useSearchParams();
	if (typeof searchParams.gameId !== 'string') {
		throw new PageNotFoundError();
	}

	const gameId = searchParams.gameId;

	const gameRef = doc(db, 'games', gameId) as DocumentReference<Game>;
	const gameData = useFirestore(gameRef);

	const athlonId = createMemo(() => {
		if (gameData.data?.athlon) {
			return last(gameData.data.athlon.path.split('/'));
		}
		return '';
	});

	const ruleId = createMemo(() => {
		if (gameData.data?.rule) {
			return last(gameData.data.rule.path.split('/'));
		}
		return '';
	});

	return (
		<div class={styles.wrap}>
			<AppBar position="static" class={styles.header}>
				<Toolbar variant="dense">
					<Typography variant="h6" color="inherit" component="h1">
						<A href={`/athlons/${athlonId()}/${ruleId()}`}>
							{arenaTitle()}
						</A>
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
			<Show when={!authState.loading && !authState.data}>
				<LoginRequiredDialog/>
			</Show>
			<Show when={authState.data} keyed>
				{(user) => (
					<UserContext.Provider value={user}>
						<div class={styles.mainArea}>
							<Outlet/>
						</div>
					</UserContext.Provider>
				)}
			</Show>
		</div>
	);
};

export const useUser = () => useContext(UserContext);
export default ArenasLayout;
