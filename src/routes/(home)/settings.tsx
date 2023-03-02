import {Button, Container, Divider, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, JSX} from 'solid-js';
import Doc from '~/components/Doc';
import type {UseFireStoreReturn, User} from '~/lib/schema';

const Home = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const db = getFirestore(app);

	const authState = useAuth(auth);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	const [photoURL, setPhotoURL] = createSignal<string | undefined>(undefined);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	createEffect(() => {
		const newPhotoURL = userData()?.data?.photoURL;
		if (newPhotoURL) {
			setPhotoURL(newPhotoURL);
		}
	});

	const handlePhotoInputChange: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
		const image = event.target.files[0];
		setPhotoURL(URL.createObjectURL(image));
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
				<Divider sx={{margin: '3rem 0'}}/>
				<Doc data={userData()}>
					{({displayName, slug}) => (
						<>
							<TextField
								label="Display Name"
								defaultValue={displayName}
							/>
							<TextField
								label="Slug"
								defaultValue={slug}
							/>
							<img src={photoURL()}/>
							<Button variant="contained" component="label">
								<span>Upload</span>
								<input
									hidden
									accept="image/*"
									multiple
									type="file"
									onChange={handlePhotoInputChange}
								/>
							</Button>
						</>
					 )}
				</Doc>
			</Container>
		</main>
	);
};

export default Home;
