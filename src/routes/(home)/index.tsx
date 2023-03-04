import range from 'lodash/range';
import {Index} from 'solid-js';
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
	</main>
);

export default Home;
