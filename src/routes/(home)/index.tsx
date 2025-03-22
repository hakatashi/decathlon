import {Title} from '@solidjs/meta';
import {A} from '@solidjs/router';
import {Button} from '@suid/material';
import {range} from 'remeda';
import {Index} from 'solid-js';
import styles from './index.module.css';

const Home = () => (
	<main class={styles.home}>
		<Title>TSG Decathlon Portal</Title>
		<svg viewBox="-225 -225 450 450" class={styles.logo}>
			<g class={styles.logoRotation}>
				<circle cx={0} cy={0} r={100} stroke="white" fill="transparent"/>
				<Index each={range(0, 9)}>
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
		<Button
			component={A}
			href="/athlons"
			variant="contained"
			size="large"
			sx={{mt: 3}}
		>
			View Contests
		</Button>
	</main>
);

export default Home;
