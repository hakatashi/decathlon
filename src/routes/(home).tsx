import {Divider, Link, Stack, Typography} from '@suid/material';
import {Show} from 'solid-js';
import {Outlet, useLocation} from 'solid-start';
import Header from '~/components/Header';

const RootLayout = () => {
	const isRoot = () => {
		const location = useLocation();
		return location.pathname === '/';
	};

	return (
		<div
			style={
				isRoot()
					? {
						display: 'flex',
						'flex-direction': 'column',
						height: '100%',
					} : {}
			}
		>
			<Header/>
			<Outlet/>
			<Show when={!isRoot()}>
				<Stack
					direction="row"
					spacing={2}
					justifyContent="center"
					mt={5}
				>
					<Typography variant="body2">decathlon by @hakatashi</Typography>
					<Divider orientation="vertical" flexItem/>
					<Typography variant="body2">
						<Link
							target="_blank"
							rel="noopener noreferrer"
							underline="hover"
							href="https://github.com/hakatashi/decathlon"
						>
							GitHub
						</Link>
					</Typography>
				</Stack>
			</Show>
		</div>
	);
};

export default RootLayout;
