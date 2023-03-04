import {Divider, Link, Stack, Typography} from '@suid/material';
import {Outlet, useLocation} from 'solid-start';
import Header from '~/components/Header';

const RootLayout = () => {
	const location = useLocation();
	return (
		<div
			style={
				location.pathname === '/'
					? {
						display: 'flex',
						'flex-direction': 'column',
						height: '100%',
					} : {}
			}
		>
			<Header/>
			<Outlet/>
			<Divider sx={{m: 3}}/>
			<Stack
				direction="row"
				spacing={2}
				justifyContent="center"
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
		</div>
	);
};

export default RootLayout;
