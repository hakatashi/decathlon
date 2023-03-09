import {Button, Container, Stack, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore, updateDoc} from 'firebase/firestore';
import {getStorage, ref as storageRef, uploadBytes} from 'firebase/storage';
import {nanoid} from 'nanoid';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createSignal, JSX, Show} from 'solid-js';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import type {UseFireStoreReturn, User} from '~/lib/schema';

const Settings = () => {
	const app = useFirebaseApp();
	const auth = getAuth(app);
	const db = getFirestore(app);
	const storage = getStorage(app);

	const authState = useAuth(auth);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	const [imageFile, setImageFile] = createSignal<File | undefined>(undefined);
	const [photoURL, setPhotoURL] = createSignal<string | undefined>(undefined);
	const [displayName, setDisplayName] = createSignal<string | undefined>(undefined);
	const [isLoading, setIsLoading] = createSignal<boolean>(false);

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
		const loadedDisplayName = userData()?.data?.displayName;
		if (loadedDisplayName) {
			setDisplayName(loadedDisplayName);
		}
	});

	const handlePhotoInputChange: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
		const image = event.currentTarget.files?.[0];
		if (image) {
			setImageFile(() => image);
			setPhotoURL(URL.createObjectURL(image));
		}
	};

	const handleSubmit: JSX.EventHandler<HTMLButtonElement, MouseEvent> = async (event) => {
		event.preventDefault();
		setIsLoading(true);

		// Upload profile image
		const imageFileData = imageFile();
		const profilePictureRef = storageRef(storage, `users/${authState?.data?.uid}/profilePicture_${nanoid()}`);
		if (imageFileData) {
			await uploadBytes(profilePictureRef, imageFileData);
			setPhotoURL(`https://storage.googleapis.com/${app.options.storageBucket}/${profilePictureRef.fullPath}`);
		}

		const userRef = doc(db, 'users', authState?.data?.uid ?? '') as DocumentReference<User>;
		await updateDoc(userRef, {
			displayName: displayName(),
			photoURL: photoURL(),
		});
		setIsLoading(false);
	};

	return (
		<main>
			<PageTitle>Settings</PageTitle>
			<Container maxWidth="md">
				<Typography
					component="h1"
					variant="h2"
					my={6}
				>
					Settings
				</Typography>
				<Doc data={userData()}>
					{({displayName: currentDisplayName}) => (
						<Stack spacing={4}>
							<TextField
								label="User ID"
								defaultValue={authState.data?.uid}
								disabled
								InputProps={{
									readOnly: true,
								}}
							/>
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
							<Stack spacing={1} alignItems="flex-start">
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
						</Stack>
					)}
				</Doc>
				<Button
					component="button"
					onClick={handleSubmit}
					disabled={isLoading()}
					size="large"
					sx={{mt: 3}}
				>
					Submit
				</Button>
			</Container>
		</main>
	);
};

export default Settings;
