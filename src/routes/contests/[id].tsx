import {Typography, Container} from '@suid/material';
import {doc, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {useParams} from 'solid-start';
import Doc from '~/components/Doc';

const Home = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const contestData = useFirestore(doc(db, 'contests', param.id));

	return (
		<main>
			<Container maxWidth="xl">
				<Doc data={contestData}>
					{(contest) => (
						<Typography variant="h1">
							{contest.name}
						</Typography>
					)}
				</Doc>
			</Container>
		</main>
	);
};

export default Home;

