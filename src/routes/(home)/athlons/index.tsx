import {Typography, Container, Divider, Stack} from '@suid/material';
import {collection, CollectionReference, getFirestore} from 'firebase/firestore';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Show} from 'solid-js';
import {A} from 'solid-start';
import styles from './index.module.css';
import Collection from '~/components/Collection';
import Username from '~/components/Username';
import {formatTimestamp} from '~/lib/date';
import type {Athlon} from '~/lib/schema';

const Athlons = () => {
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const athlonsData = useFirestore(collection(db, 'athlons') as CollectionReference<Athlon>);

	return (
		<main>
			<Container maxWidth="xl">
				<Typography
					variant="h1"
					fontSize="min(15vmin, 96px)"
					textAlign="center"
					fontWeight="bold"
					letterSpacing={30}
					fontFamily="serif"
					mt={5}
					mb={15}
				>
					Athlons
				</Typography>
				<ul style={{padding: '0', 'text-align': 'center'}}>
					<Collection data={athlonsData}>
						{(athlon, i) => (
							<>
								<Show when={i() !== 0}>
									<Divider sx={{my: 10}}/>
								</Show>
								<A href={`/athlons/${athlon.id}`}>
									<Typography
										variant="h2"
										fontSize="min(10vmin, 64px)"
										textAlign="center"
									>
										{athlon.name}
									</Typography>
									<Typography
										variant="h5"
										component="h3"
										fontSize="min(5vmin, 32px)"
										textAlign="center"
									>
										{formatTimestamp(athlon.startAt)} - {formatTimestamp(athlon.endAt)}
									</Typography>
									<Stack
										direction="row"
										flexWrap="wrap"
										justifyContent="center"
										sx={{display: 'inline-flex', mt: 5}}
									>
										<For each={athlon.ranking.slice(0, 5)}>
											{(rank, j) => (
												<Stack direction="row" px={1}>
													<Show when={j() === 0}>
														<img src="/images/crown-solid.svg" style={{width: '36px'}}/>
													</Show>
													<Show when={j() > 0}>
														<div class={styles.rank}>{j() + 1}</div>
													</Show>
													<Username userId={rank.userId} size={48} noIcon sx={{ml: 1}}/>
												</Stack>
											)}
										</For>
									</Stack>
									<Typography
										variant="body2"
										component="p"
										textAlign="center"
									>
										参加者: {athlon.ranking.length} 人
									</Typography>
								</A>
							</>
						)}
					</Collection>
				</ul>
			</Container>
		</main>
	);
};

export default Athlons;
