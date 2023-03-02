import {Button, Container, Divider, Stack, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore, setDoc, updateDoc} from 'firebase/firestore';
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
	const [isLoading, setIsLoading] = createSignal<boolean>(undefined);

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

	const handleSubmit: JSX.EventHandler<HTMLButtonElement, MouseEvent> = async (event) => {
		event.preventDefault();
		setIsLoading(true);
		const userRef = doc(db, 'users', authState?.data?.uid ?? '') as DocumentReference<User>;
		await updateDoc(userRef, {
			displayName: displayName(),
			photoURL: photoURL(),
			slug: slug(),
		});
		setIsLoading(false);
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
						<Stack spacing={4} alignItems="flex-start">
							<Show when={typeof displayName() === 'string'}>
								<TextField
									label="Display Name"
									defaultValue={currentDisplayName}
									value={displayName()}
									onChange={(_event, value) => {
										setDisplayName(value);
									}}
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
							<Stack spacing={1}>
								<Typography variant="caption">
									Icon
								</Typography>
								<img src={photoURL()} style={{width: '10rem', height: '10rem', 'object-fit': 'contain'}}/>
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
							</Stack>
							<Button component="button" onClick={handleSubmit} disabled={isLoading()}>
								Submit
							</Button>
						</Stack>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default Home;
