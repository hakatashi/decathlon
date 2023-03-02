import {Button, Container, Divider, Stack, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, JSX, Show} from 'solid-js';
import Doc from '~/components/Doc';
import type {UseFireStoreReturn, User} from '~/lib/schema';

const Home = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const db = getFirestore(app);

	const authState = useAuth(auth);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	const [photoURL, setPhotoURL] = createSignal<string | undefined>(undefined);
	const [displayName, setDisplayName] = createSignal<string | undefined>(undefined);
	const [slug, setSlug] = createSignal<string | undefined>(undefined);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	createEffect(() => {
		const loadedPhotoURL = userData()?.data?.photoURL;
		if (loadedPhotoURL) {
			setPhotoURL(loadedPhotoURL);
		}
	});

	createEffect(() => {
		const loadedSlug = userData()?.data?.slug;
		if (loadedSlug) {
			setSlug(loadedSlug);
		}
	});

	createEffect(() => {
		const loadedDisplayName = userData()?.data?.displayName;
		if (loadedDisplayName) {
			setDisplayName(loadedDisplayName);
		}
	});

	const handlePhotoInputChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
		const image = event.currentTarget.files?.[0];
		if (image) {
			setPhotoURL(URL.createObjectURL(image));
		}
	};

	return (
		<main>
			<Container maxWidth="xl">
				<Typography
					component="h1"
					variant="h2"
				>
					Settings
				</Typography>
				<Divider sx={{margin: '2rem 0'}}/>
				<Doc data={userData()}>
					{({displayName: currentDisplayName, slug: currentSlug}) => (
						<Stack spacing={4}>
							<Show when={typeof displayName() === 'string'}>
								<TextField
									label="Display Name"
									defaultValue={currentDisplayName}
								/>
							</Show>
							<Show when={typeof slug() === 'string'}>
								<TextField
									label="ID"
									defaultValue={currentSlug}
									value={slug()}
									onChange={(_event, value) => {
										setSlug(value);
									}}
								/>
							</Show>
							<div>
								<Typography variant="caption">
									Icon
								</Typography>
								<img src={photoURL()}/>
								<Button variant="contained" component="label">
									<span>Select File</span>
									<input
										hidden
										accept="image/*"
										multiple
										type="file"
										onChange={handlePhotoInputChange}
									/>
								</Button>
							</div>
							<Button>
								Send
							</Button>
						</Stack>
					 )}
				</Doc>
			</Container>
		</main>
	);
};

export default Home;
