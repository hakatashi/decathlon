import {Avatar, Stack} from '@suid/material';
import type {SxProps} from '@suid/system';
import {doc, DocumentReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {JSX, Show, createMemo, mergeProps} from 'solid-js';
import Doc from '~/components/Doc';
import {User} from '~/lib/schema';

interface Props {
	userId: string,
	size?: 'small' | 'medium' | 'large' | number,
	direction?: 'row' | 'column',
	accessory?: JSX.Element,
	sx?: SxProps,
	noIcon?: boolean,
}

const Username = (providedProps: Props) => {
	const props = mergeProps({
		size: 'small',
		direction: 'row' as const,
		noIcon: false,
	}, providedProps);

	const app = useFirebaseApp();
	const db = getFirestore(app);

	const userRef = doc(db, 'users', props.userId) as DocumentReference<User>;
	const userData = useFirestore(userRef);

	const size = createMemo(() => {
		if (typeof props.size === 'number') {
			return props.size;
		}
		if (props.size === 'large') {
			return 256;
		}
		if (props.size === 'medium') {
			return 128;
		}
		return 30;
	});

	return (
		<Doc data={userData}>
			{(user) => (
				<Stack direction={props.direction} alignItems="center" sx={props.sx}>
					<div style={{position: 'relative'}}>
						<Show when={!props.noIcon}>
							<Avatar
								alt={user.displayName}
								src={user.photoURL}
								sx={{width: size(), height: size(), mr: props.direction === 'row' ? 1 : 0}}
							/>
						</Show>
						<Show when={props.accessory} keyed>
							{(accessory) => accessory}
						</Show>
					</div>
					<span>{user.displayName}</span>
				</Stack>
			)}
		</Doc>
	);
};

export default Username;
