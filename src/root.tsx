// @refresh reload
import {FirebaseProvider} from 'solid-firebase';
import {Match, Suspense, Switch} from 'solid-js';
import {
	Body,
	ErrorBoundary,
	ErrorMessage,
	FileRoutes,
	Head,
	Html,
	Link,
	Meta,
	Routes,
	Scripts,
	Title,
} from 'solid-start';
import {HttpStatusCode} from 'solid-start/server';
import PageNotFoundError from './lib/PageNotFoundError';
import { initializeApp } from 'firebase/app'
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

const app = initializeApp(firebaseConfig);

const Root = () => (
	<Html lang="en">
		<Head>
			<Title>Decathlon</Title>
			<Meta charset="utf-8"/>
			<Meta name="viewport" content="width=device-width, initial-scale=1"/>
			<Link rel="icon" type="image/svg" href="/favicon.svg"/>
			<Link
				href="https://fonts.googleapis.com/css?family=Roboto:300,400,500"
				rel="stylesheet"
			/>
		</Head>
		<Body>
			<Suspense>
				<ErrorBoundary
					fallback={(error) => (
						<Switch>
							<Match when={error instanceof PageNotFoundError}>
								<HttpStatusCode code={404}/>
								<h1>Page Not Found</h1>
							</Match>
							<Match when>
								<ErrorMessage error={error}/>
							</Match>
						</Switch>
					)}
				>
					<Routes>
						<FileRoutes/>
					</Routes>
				</ErrorBoundary>
			</Suspense>
			<Scripts/>
		</Body>
	</Html>
);

const App = () => (
	<FirebaseProvider app={app}>
		<Root/>
	</FirebaseProvider>
);

export default App;
