import {EmojiEvents, Star} from '@suid/icons-material';
import {Typography, Container, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button, Stack, Box} from '@suid/material';
import {collection, CollectionReference, doc, getFirestore, orderBy, query, where} from 'firebase/firestore';
import remarkGfm from 'remark-gfm';
import {useFirebaseApp, useFirestore} from 'solid-firebase';
import {For, JSX, Show} from 'solid-js';
import SolidMarkdown from 'solid-markdown';
import {A, useParams} from 'solid-start';
import {useAthlon} from '../[id]';
import styles from './index.module.css';
import crown from '~/../public/images/crown-solid.svg';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import PageTitle from '~/components/PageTitle';
import Username from '~/components/Username';
import {athlonNames} from '~/lib/const';
import type {Game} from '~/lib/schema';

const Head = (props: {children: JSX.Element}) => (
	<Typography
		component="h2"
		textAlign="center"
		letterSpacing={30}
		fontSize={20}
		fontWeight="bold"
		mt={5}
	>
		{props.children}
	</Typography>
);

const Home = () => {
	const param = useParams();
	const athlonData = useAthlon();
	const app = useFirebaseApp();
	const db = getFirestore(app);
	const gamesData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			orderBy('order'),
		),
	);

	return (
		<main class={styles.contest}>
			<Doc data={athlonData}>
				{(athlon) => (
					<PageTitle>{athlon.name}</PageTitle>
				)}
			</Doc>
			<div class={styles.athlonHeader}>
				<Doc data={athlonData}>
					{(athlon) => (
						<Typography variant="h1" style={{'font-size': '10vmin'}}>
							{athlon.name}
						</Typography>
					)}
				</Doc>
				<Show when={athlonNames.get(gamesData?.data?.length)} keyed>
					{(athlonName) => (
						<Typography variant="h3" component="h2" class={styles.athlonName}>
							<For each={Array.from(athlonName)} >
								{(char) => (
									<span>{char}</span>
								)}
							</For>
						</Typography>
					)}
				</Show>
			</div>
			<Container maxWidth="md">
				<Doc data={athlonData}>
					{(athlon) => (
						<SolidMarkdown
							class="markdown"
							children={athlon.description}
							remarkPlugins={[remarkGfm]}
							linkTarget="_blank"
						/>
					)}
				</Doc>
				<Head>
					競技一覧
				</Head>
				<List sx={{bgcolor: 'background.paper', 'max-width': '480px', m: '0 auto'}}>
					<Collection data={gamesData}>
						{(game, index) => {
							const ruleData = useFirestore(game.rule);

							return (
								<ListItem component={A} href={`/athlons/${param.id}/${game.rule.id}`}>
									<ListItemAvatar>
										<Avatar>
											{index() + 1}
										</Avatar>
									</ListItemAvatar>
									<Doc data={ruleData}>
										{(rule) => (
											<ListItemText primary={rule.name} secondary={`${game.maxPoint * (game.weight ?? 1)}点`}/>
										)}
									</Doc>
								</ListItem>
							);
						}}
					</Collection>
				</List>
				<Head>
					成績上位者
				</Head>
				<Doc data={athlonData}>
					{(athlon) => (
						<>
							<Show when={athlon.ranking[0]} keyed>
								{(rankingEntry) => (
									<Username
										userId={rankingEntry.userId}
										size="large"
										direction="column"
										accessory={
											<img src={crown} class={styles.crown}/>
										}
										sx={{mt: 5}}
									/>
								)}
							</Show>
							<Stack
								direction="row"
								width="100%"
								justifyContent="space-around"
								flexWrap="wrap"
							>
								<For each={athlon.ranking.slice(1, 5)} >
									{(rankingEntry, i) => (
										<Username
											userId={rankingEntry.userId}
											size="medium"
											direction="column"
											sx={{mt: 5}}
											accessory={
												<div class={styles.rank}>{i() + 2}</div>
											}
										/>
									)}
								</For>
							</Stack>
							<Stack
								direction="row"
								width="100%"
								justifyContent="space-between"
								flexWrap="wrap"
							>
								<For each={athlon.ranking.slice(5, 15)} >
									{(rankingEntry, i) => (
										<Box flex="1 0 64px" textAlign="center" style={{'word-break': 'break-all'}}>
											<Username
												userId={rankingEntry.userId}
												size={60}
												direction="column"
												sx={{mt: 5}}
												accessory={
													<div class={styles.rank}>{i() + 6}</div>
												}
											/>
										</Box>
									)}
								</For>
							</Stack>
						</>
					)}
				</Doc>
				<Box textAlign="center" my={3}>
					<Button size="large" variant="contained" component={A} href="./leaderboard">
						<EmojiEvents sx={{mr: 1}}/>
						ランキングをすべて表示する
					</Button>
				</Box>
			</Container>
		</main>
	);
};

export default Home;

