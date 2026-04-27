import {A} from '@solidjs/router';
import {Person} from '@suid/icons-material';
import {Avatar, Chip, Container, List, ListItem, ListItemAvatar, ListItemButton, ListItemText, Typography} from '@suid/material';
import {collection, CollectionReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {createMemo, For, Match, Switch} from 'solid-js';
import PageTitle from '~/components/PageTitle';
import type {User} from '~/lib/schema';

const Users = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const usersData = useFirestore(
		collection(db, 'users') as CollectionReference<User>,
	);

	const sortedUsers = createMemo(() => {
		if (!usersData.data) {
			return [];
		}
		return [...usersData.data].sort(
			(a, b) => b.participationCount - a.participationCount,
		);
	});

	return (
		<main>
			<PageTitle>Users</PageTitle>
			<Container maxWidth="md">
				<Typography variant="h4" component="h1" my={4}>
					Users
				</Typography>
				<Switch>
					<Match when={usersData.loading}>
						<Typography color="text.secondary">Loading...</Typography>
					</Match>
					<Match when={usersData.error}>
						<Typography color="error">{usersData.error?.toString()}</Typography>
					</Match>
					<Match when={usersData.data}>
						<List>
							<For each={sortedUsers()}>
								{(user, index) => (
									<ListItem disablePadding>
										<ListItemButton component={A} href={`/users/${user.id}`}>
											<Typography
												variant="h6"
												component="span"
												sx={{
													width: '2.5rem',
													textAlign: 'right',
													mr: 2,
													color: 'text.secondary',
													flexShrink: 0,
												}}
											>
												{index() + 1}
											</Typography>
											<ListItemAvatar>
												<Avatar src={user.photoURL} alt={user.displayName}>
													<Person/>
												</Avatar>
											</ListItemAvatar>
											<ListItemText
												primary={user.displayName}
												secondary={user.description}
											/>
											<Chip
												label={`${user.participationCount} 回`}
												size="small"
												color="primary"
												variant="outlined"
											/>
										</ListItemButton>
									</ListItem>
								)}
							</For>
						</List>
					</Match>
				</Switch>
			</Container>
		</main>
	);
};

export default Users;
