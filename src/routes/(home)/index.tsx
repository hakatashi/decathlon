import {Divider, Link, Stack, Typography} from '@suid/material';
import range from 'lodash/range';
import {Index} from 'solid-js';
import {A} from 'solid-start';
import styles from './index.module.css';

const Home = () => (
	<main class={styles.home}>
		<svg viewBox="-225 -225 450 450" class={styles.logo}>
			<g class={styles.logoRotation}>
				<circle cx={0} cy={0} r={100} stroke="white" fill="transparent"/>
				<Index each={range(9)}>
					{(i) => (
						<circle
							cx={Math.sin(Math.PI * 2 / 9 * i()) * 151.98}
							cy={Math.cos(Math.PI * 2 / 9 * i()) * 151.98}
							r={51.98}
							stroke="white"
							fill="transparent"
						/>
					)}
				</Index>
			</g>
		</svg>
		<h1 class={styles.title}>TSG Decathlon Portal</h1>
		<Stack
			direction="row"
			spacing={2}
			justifyContent="center"
			mt={5}
		>
			<Typography variant="h3">decathlon by @hakatashi</Typography>
			<Divider orientation="vertical" flexItem sx={{bgcolor: 'white'}}/>
			<Typography variant="h3">
				<Link
					underline="hover"
					component={A}
					href="/athlons"
					color="inherit"
				>
					CONTESTS
				</Link>
			</Typography>
		</Stack>
	</main>
);

export default Home;
