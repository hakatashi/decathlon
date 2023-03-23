import {Avatar, Stack} from '@suid/material';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import Doc from '~/components/Doc';
import {User} from '~/lib/schema';


const Username = (props: {userId: string}) => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const userRef = doc(db, 'users', props.userId) as DocumentReference<User>;
	const userData = useFirestore(userRef);

	return (
		<Doc data={userData}>
			{(user) => (
				<Stack direction="row" alignItems="center">
					<Avatar
						alt={user.displayName}
						src={user.photoURL}
						sx={{width: 30, height: 30, mr: 1}}
					/>
					<span>{user.displayName}</span>
				</Stack>
			)}
		</Doc>
	);
};

export default Username;
