import {RouteSectionProps, useIsRouting, useLocation} from '@solidjs/router';
import {Divider, LinearProgress, Link, Stack, Typography} from '@suid/material';
import {Show} from 'solid-js';
import Header from '~/components/Header';

const RootLayout = (props: RouteSectionProps) => {
	const isRoot = () => {
		const location = useLocation();
		return location.pathname === '/';
	};
	const isRouting = useIsRouting();

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
			<Show when={isRouting()}>
				<LinearProgress
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						'z-index': 999,
					}}
				/>
			</Show>
			<Header/>
			{props.children}
			<Show when={!isRoot()}>
				<Stack
					direction="row"
					spacing={2}
					justifyContent="center"
					mt={5}
					pb={2}
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
