import {A, Navigate, useParams} from '@solidjs/router';
import {Add} from '@suid/icons-material';
import {Box, Breadcrumbs, Button, Container, List, ListItem, ListItemButton, ListItemText, Link, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, Show} from 'solid-js';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import type {ReferenceRecord, UseFireStoreReturn, User} from '~/lib/schema';
import useAthlon from '~/lib/useAthlon';

const ReferenceRecordsIndex = () => {
	const param = useParams<{id: string}>();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);
	const authState = useAuth(auth);
	const athlonData = useAthlon(param.id);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);
	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	const notAdmin = createMemo(() => userData()?.data?.isAdmin === false);

	const referenceRecordsData = useFirestore(
		collection(db, 'athlons', param.id, 'referenceRecords') as CollectionReference<ReferenceRecord>,
	);

	return (
		<main>
			<Show when={notAdmin()}>
				<Navigate href={`/athlons/${param.id}`}/>
			</Show>
			<Container maxWidth="md" sx={{py: 3}}>
				<Doc data={athlonData}>
					{(athlon) => (
						<PageTitle>[{athlon.name}] 参考記録管理</PageTitle>
					)}
				</Doc>
				<Breadcrumbs aria-label="breadcrumb" sx={{pb: 3}}>
					<Link component={A} underline="hover" color="inherit" href="/athlons">
						Athlons
					</Link>
					<Doc data={athlonData}>
						{(athlon) => (
							<Link underline="hover" color="inherit" component={A} href={`/athlons/${athlon.id}`}>
								{athlon.name}
							</Link>
						)}
					</Doc>
					<Typography color="text.primary">参考記録管理</Typography>
				</Breadcrumbs>
				<Typography variant="h4" component="h1" gutterBottom>
					参考記録管理
				</Typography>
				<Box sx={{mb: 2}}>
					<Button
						variant="contained"
						startIcon={<Add/>}
						component={A}
						href={`/athlons/${param.id}/referenceRecords/new/edit`}
					>
						新規参考記録を追加
					</Button>
				</Box>
				<Collection
					data={referenceRecordsData}
					empty={<Typography color="text.secondary">参考記録はまだありません。</Typography>}
				>
					{(record) => (
						<List>
							<ListItem disablePadding>
								<ListItemButton component={A} href={`/athlons/${param.id}/referenceRecords/${record.id}/edit`}>
									<ListItemText
										primary={record.name}
										secondary={record.description.slice(0, 100) || '説明なし'}
									/>
								</ListItemButton>
							</ListItem>
						</List>
					)}
				</Collection>
			</Container>
		</main>
	);
};

export default ReferenceRecordsIndex;
