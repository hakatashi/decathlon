import {Typography, Container, Breadcrumbs, Link, Button} from '@suid/material';
import {collection, CollectionReference, doc, DocumentReference, getFirestore, orderBy, query, where} from 'firebase/firestore';
import {getStorage, ref} from 'firebase/storage';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, Show} from 'solid-js';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import styles from './[ruleId].module.css';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import {useStorageBytes} from '~/lib/firebase';
import type {Game, GameRule} from '~/lib/schema';

const AthlonGame = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const storage = getStorage(app);
	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const ruleData = useFirestore(ruleRef);
	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);


	return (
		<main>
			<div class={styles.header}>
				<Container maxWidth="lg">
					<Breadcrumbs aria-label="breadcrumb" sx={{pt: 3, pb: 3}}>
						<Link component={A} underline="hover" color="inherit" href="/">
							Decathlon
						</Link>
						<Doc data={athlonData}>
							{(athlon) => (
								<Link
									underline="hover"
									color="inherit"
									href={`/athlons/${athlon.id}`}
								>
									{athlon.name}
								</Link>
							)}
						</Doc>
						<Doc data={ruleData}>
							{(rule) => (
								<Typography color="text.primary">{rule.name}</Typography>
							)}
						</Doc>
					</Breadcrumbs>
				</Container>
				<Doc data={ruleData}>
					{(rule) => {
						const iconData = useStorageBytes(ref(storage, 'assets/icons/sprinter.svg'));
						const textDecoder = new TextDecoder();

						return (
							<div class={styles.ruleArea}>
								<div class={styles.ruleDescription}>
									<Typography
										color="text.primary"
										variant="h3"
										component="h2"
										fontWeight="bold"
									>
										{rule.name}
									</Typography>
									<Typography
										color="text.primary"
										variant="body1"
										my={3}
									>
										{rule.description}
									</Typography>
									<Collection data={gameData}>
										{(game) => (
											<For each={game.links}>
												{(link) => (
													<Button
														size="large"
														variant={link.isMain ? 'contained' : 'outlined'}
														component="a"
														target="_blank"
														rel="noopener noreferer"
														href={link.url}
													>
														{link.label}
													</Button>
												)}
											</For>
										)}
									</Collection>
								</div>
								<Show when={iconData.data} keyed>
									{(data) => (
										<span class={styles.ruleIcon} innerHTML={textDecoder.decode(data)}/>
									)}
								</Show>
							</div>
						);
					}}
				</Doc>
			</div>
			<Container maxWidth="lg">
				<Collection data={gameData}>
					{(game) => (
						<div style={{'white-space': 'pre-wrap'}}>{game.description}</div>
					)}
				</Collection>
			</Container>
		</main>
	);
};

export default AthlonGame;


