import {AppBar, Toolbar, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {useFirebaseApp, useAuth} from 'solid-firebase';
import {createContext, useContext} from 'solid-js';
import {Outlet} from 'solid-start';
import styles from './arenas.module.css';
import type {UseFireStoreReturn} from '~/lib/schema';

type UseAuthReturn = ReturnType<typeof useAuth>;

const AuthStateContext = createContext<UseFireStoreReturn<UseAuthReturn | null | undefined>>();

const ArenasLayout = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const authState = useAuth(auth);

	return (
		<AuthStateContext.Provider value={authState}>
			<div class={styles.wrap}>
				<AppBar position="static" class={styles.header}>
					<Toolbar variant="dense">
						<Typography variant="h6" color="inherit" component="div">
							タイピング (日本語)
						</Typography>
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
