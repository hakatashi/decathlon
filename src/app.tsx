import {MetaProvider} from '@solidjs/meta';
import {Router} from '@solidjs/router';
import {HttpStatusCode} from '@solidjs/start';
import {FileRoutes} from '@solidjs/start/router';
import {initializeApp} from 'firebase/app';
import {FirebaseProvider} from 'solid-firebase';
import {ErrorBoundary, Match, Suspense, Switch} from 'solid-js';
import PageNotFoundError from './lib/PageNotFoundError';
import './app.css';

const firebaseConfig = {
	apiKey: 'AIzaSyAd3v1a8OcFGa2K2PnMGaND1awfHgG6z8E',
	authDomain: 'tsg-decathlon.firebaseapp.com',
	projectId: 'tsg-decathlon',
	storageBucket: 'tsg-decathlon.appspot.com',
	messagingSenderId: '621156302243',
	appId: '1:621156302243:web:c0724b4636cb8e42cb6e16',
	measurementId: 'G-SSBBNLVY2E',
};

const app = initializeApp(firebaseConfig);

const App = () => (
	<FirebaseProvider app={app}>
		<Router
			root={(props) => (
				<MetaProvider>
					<Suspense>
						<ErrorBoundary
							fallback={(error: any) => (
								<Switch>
									<Match when={error instanceof PageNotFoundError}>
										<HttpStatusCode code={404}/>
										<h1>Page Not Found</h1>
									</Match>
									<Match when>
										{error}
									</Match>
								</Switch>
							)}
						>
							{props.children}
						</ErrorBoundary>
					</Suspense>
				</MetaProvider>
			)}
		>
			<FileRoutes/>
		</Router>
	</FirebaseProvider>
);

export default App;
