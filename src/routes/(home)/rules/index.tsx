import {A} from '@solidjs/router';
import {Add} from '@suid/icons-material';
import {Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, ListItemText, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, serverTimestamp, setDoc} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, Show} from 'solid-js';
import Collection from '~/components/Collection';
import PageTitle from '~/components/PageTitle';
import type {Rule, UseFireStoreReturn, User} from '~/lib/schema';

const Rules = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);
	const authState = useAuth(auth);

	const rulesData = useFirestore(
		query(
			collection(db, 'rules') as CollectionReference<Rule>,
			orderBy('updatedAt', 'desc'),
		),
	);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	const isAdmin = createMemo(() => userData()?.data?.isAdmin === true);

	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [newRule, setNewRule] = createSignal({id: '', name: '', description: ''});
	const [isSaving, setIsSaving] = createSignal(false);

	const handleAddRule = async () => {
		setIsSaving(true);
		try {
			await setDoc(doc(db, 'rules', newRule().id), {
				name: newRule().name,
				description: newRule().description,
				updatedAt: serverTimestamp(),
			});
			setIsDialogOpen(false);
			setNewRule({id: '', name: '', description: ''});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<main>
			<Container maxWidth="md" sx={{py: 4}}>
				<PageTitle>Rules</PageTitle>
				<Typography variant="h4" component="h1" gutterBottom>
					ルールカテゴリ一覧
				</Typography>
				<Show when={isAdmin()}>
					<Box sx={{mb: 2}}>
						<Button variant="contained" startIcon={<Add/>} onClick={() => setIsDialogOpen(true)}>
							新しいルールカテゴリを追加
						</Button>
					</Box>
				</Show>
				<List>
					<Collection
						data={rulesData}
						empty={<Typography color="text.secondary">ルールカテゴリはまだありません。</Typography>}
					>
						{(rule) => (
							<ListItem disablePadding>
								<ListItemButton component={A} href={`/rules/${rule.id}`}>
									<ListItemText primary={rule.name}/>
								</ListItemButton>
							</ListItem>
						)}
					</Collection>
				</List>
				<Dialog open={isDialogOpen()} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="md">
					<DialogTitle>新しいルールカテゴリを追加</DialogTitle>
					<DialogContent>
						<TextField
							fullWidth
							required
							label="ルールID"
							value={newRule().id}
							sx={{mt: 2}}
							onChange={(_event, value) => setNewRule((prev) => ({...prev, id: value}))}
						/>
						<TextField
							fullWidth
							required
							label="ルール名"
							value={newRule().name}
							sx={{mt: 2}}
							onChange={(_event, value) => setNewRule((prev) => ({...prev, name: value}))}
						/>
						<TextField
							fullWidth
							required
							multiline
							minRows={5}
							label="ルール詳細 (Markdown)"
							value={newRule().description}
							sx={{mt: 2}}
							onChange={(_event, value) => setNewRule((prev) => ({...prev, description: value}))}
						/>
					</DialogContent>
					<DialogActions>
						<Button onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
						<Button
							variant="contained"
							disabled={newRule().id === '' || newRule().name === '' || isSaving()}
							onClick={handleAddRule}
						>
							追加
						</Button>
					</DialogActions>
				</Dialog>
			</Container>
		</main>
	);
};

export default Rules;
