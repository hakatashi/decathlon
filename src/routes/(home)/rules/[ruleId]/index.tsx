import {A, useParams} from '@solidjs/router';
import {Box, Breadcrumbs, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, Link as LinkUi, TextField, Typography} from '@suid/material';
import {getAuth} from 'firebase/auth';
import {doc, DocumentReference, getFirestore, serverTimestamp, updateDoc} from 'firebase/firestore';
import remarkGfm from 'remark-gfm';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, Show} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import {formatTimestamp} from '~/lib/date';
import type {Rule, UseFireStoreReturn, User} from '~/lib/schema';

const RuleDetail = () => {
	const param = useParams<{ruleId: string}>();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const auth = getAuth(app);
	const authState = useAuth(auth);

	const ruleRef = doc(db, 'rules', param.ruleId) as DocumentReference<Rule>;
	const ruleData = useFirestore(ruleRef);

	const [userData, setUserData] = createSignal<UseFireStoreReturn<User | null | undefined> | null>(null);

	createEffect(() => {
		if (authState.data) {
			const userRef = doc(db, 'users', authState.data.uid) as DocumentReference<User>;
			setUserData(useFirestore(userRef));
		}
	});

	const isAdmin = createMemo(() => userData()?.data?.isAdmin === true);

	const [isEditDialogOpen, setIsEditDialogOpen] = createSignal(false);
	const [editForm, setEditForm] = createSignal({name: '', description: ''});
	const [isSaving, setIsSaving] = createSignal(false);

	const handleOpenEdit = () => {
		if (ruleData.data) {
			setEditForm({
				name: ruleData.data.name,
				description: ruleData.data.description,
			});
		}
		setIsEditDialogOpen(true);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await updateDoc(ruleRef, {
				name: editForm().name,
				description: editForm().description,
				updatedAt: serverTimestamp(),
			});
			setIsEditDialogOpen(false);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Container maxWidth="md" sx={{py: 4}}>
			<Doc data={ruleData}>
				{(rule) => (
					<PageTitle>{rule.name}</PageTitle>
				)}
			</Doc>
			<Breadcrumbs sx={{mb: 3}}>
				<LinkUi component={A} underline="hover" color="inherit" href="/rules">
					Rules
				</LinkUi>
				<Doc data={ruleData}>
					{(rule) => (
						<Typography color="text.primary">{rule.name}</Typography>
					)}
				</Doc>
			</Breadcrumbs>
			<Doc data={ruleData}>
				{(rule) => (
					<>
						<Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
							<Typography variant="h4" component="h1">
								{rule.name}
							</Typography>
							<Show when={isAdmin()}>
								<Button variant="outlined" onClick={handleOpenEdit}>
									編集
								</Button>
							</Show>
						</Box>
						<Typography variant="body2" color="text.secondary" sx={{mb: 3}}>
							最終更新: {rule.updatedAt ? formatTimestamp(rule.updatedAt) : '—'}
						</Typography>
						<SolidMarkdown
							class="markdown"
							children={rule.description}
							remarkPlugins={[remarkGfm]}
							linkTarget="_blank"
						/>
					</>
				)}
			</Doc>
			<Dialog open={isEditDialogOpen()} onClose={() => setIsEditDialogOpen(false)} fullWidth maxWidth="md">
				<DialogTitle>ルールカテゴリを編集</DialogTitle>
				<DialogContent>
					<TextField
						fullWidth
						required
						label="ルール名"
						value={editForm().name}
						sx={{mt: 2}}
						onChange={(_event, value) => setEditForm((prev) => ({...prev, name: value}))}
					/>
					<TextField
						fullWidth
						required
						multiline
						minRows={5}
						label="ルール詳細 (Markdown)"
						value={editForm().description}
						sx={{mt: 2}}
						onChange={(_event, value) => setEditForm((prev) => ({...prev, description: value}))}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setIsEditDialogOpen(false)}>キャンセル</Button>
					<Button
						variant="contained"
						disabled={editForm().name === '' || isSaving()}
						onClick={handleSave}
					>
						保存
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default RuleDetail;
