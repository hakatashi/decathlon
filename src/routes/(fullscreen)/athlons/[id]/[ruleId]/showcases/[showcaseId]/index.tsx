import {useParams} from '@solidjs/router';
import {getAuth} from 'firebase/auth';
import {CollectionReference, DocumentReference, collection, doc, getFirestore, query, updateDoc, where} from 'firebase/firestore';
import {useAuth, useFirebaseApp, useFirestore} from 'solid-firebase';
import {createEffect, createMemo, createSignal, For, Match, Show, Switch} from 'solid-js';
import styles from './index.module.scss';
import Collection from '~/components/Collection';
import Doc from '~/components/Doc';
import Username from '~/components/Username';
import type {Game, GameRule, ItQuizShowcase} from '~/lib/schema';


interface GameShowcaseProps {
	game: Game,
}

const toggleStatus = (status: 'correct' | 'wrong' | 'pending' | undefined) => {
	switch (status) {
		case 'correct':
			return 'wrong';
		case 'wrong':
			return 'correct';
		case 'pending':
			return 'correct';
		default:
			return 'pending';
	}
};

const GameShowcase = (props: GameShowcaseProps) => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const showcaseRef = doc(db, 'games', props.game.id, 'showcases', param.showcaseId) as DocumentReference<ItQuizShowcase>;
	const showcaseData = useFirestore(showcaseRef);
	const auth = getAuth(app);

	const authState = useAuth(auth);

	const [state, setState] = createSignal<'question' | 'answer' | 'users'>('question');

	const rotateStateNext = () => {
		switch (state()) {
			case 'question':
				setState('answer');
				break;
			case 'answer':
				setState('users');
				break;
			case 'users':
				setState('question');
				break;
		}
	};

	const rotateStatePrev = () => {
		switch (state()) {
			case 'question':
				setState('users');
				break;
			case 'answer':
				setState('question');
				break;
			case 'users':
				setState('answer');
				break;
		}
	};

	createEffect(() => {
		console.log(authState.data);
	});

	const quiz = createMemo(() => (
		showcaseData.data?.quizzes[showcaseData.data?.currentQuizIndex]
	));

	return (
		<Doc data={showcaseData}>
			{(showcase) => {
				const correctAnswer = createMemo(() => quiz()?.correctAnswers[0] ?? '');
				const alternativeAnswers = createMemo(() => quiz()?.correctAnswers.slice(1) ?? []);
				const answers = createMemo(() => {
					const rawAnswers = quiz()?.answers ?? {};

					return Object.entries(rawAnswers).sort(([, a], [, b]) => {
						if (a.status === 'correct' && b.status !== 'correct') {
							return -1;
						}
						if (a.status !== 'correct' && b.status === 'correct') {
							return 1;
						}
						return 0;
					});
				});

				const incrementCurrentQuizIndex = async (delta: number) => {
					await updateDoc(showcaseRef, {
						currentQuizIndex: showcase.currentQuizIndex + delta,
					});
				};

				const handleClickLeftControl = async () => {
					if (state() === 'question') {
						await incrementCurrentQuizIndex(-1);
					}
					rotateStatePrev();
				};

				const handleClickRightControl = async () => {
					rotateStateNext();
					if (state() === 'question') {
						await incrementCurrentQuizIndex(1);
					}
				};

				const handleToggleAnswer = async (userId: string) => {
					await updateDoc(showcaseRef, {
						[`quizzes.${showcase.currentQuizIndex}.answers.${userId}.status`]: toggleStatus(quiz()?.answers[userId].status),
					});
				};

				const handleToggleIsShown = async (userId: string) => {
					await updateDoc(showcaseRef, {
						[`quizzes.${showcase.currentQuizIndex}.answers.${userId}.isShown`]: !quiz()?.answers[userId].isShown,
					});
				};

				return (
					<div class={styles.showcase}>
						<div class={styles.clickableArea}>
							<h1 class={styles.question}>
								<span class={styles.questionNumber}>第{showcase.currentQuizIndex + 1}問</span>
								{quiz()?.question}
							</h1>
							<div class={styles.correctAnswerArea} style={{visibility: state() === 'question' ? 'hidden' : 'visible'}}>
								<p class={styles.correctAnswer}>
									<span class={styles.correctAnswerLabel}>正解.</span>
									{correctAnswer()}
								</p>
							</div>
							<Show when={alternativeAnswers().length > 0}>
								<div class={styles.alternativeAnswersArea} style={{visibility: state() === 'question' ? 'hidden' : 'visible'}}>
									<p class={styles.alternativeAnswers}>
										<span class={styles.alternativeAnswersLabel}>別解:</span>
										<For each={alternativeAnswers()}>
											{(answer) => (
												<span class={styles.alternativeAnswer}>{answer}</span>
											)}
										</For>
									</p>
								</div>
							</Show>
							<div class={styles.controlArea}>
								<div onClick={handleClickLeftControl}/>
								<div onClick={handleClickRightControl}/>
							</div>
						</div>
						<div class={styles.usersArea} style={{visibility: state() === 'users' ? 'visible' : 'hidden'}}>
							<For each={answers()}>
								{([userId, answer]) => {
									const isCorrect = answer.status === 'correct';

									return (
										<div class={styles.user}>
											<div
												class={styles.userAnswer}
												onClick={() => handleToggleIsShown(userId)}
											>
												<span
													class={styles.userResult}
													onClick={(event) => {
														event.stopPropagation();
														handleToggleAnswer(userId);
													}}
												>
													<Switch>
														<Match when={isCorrect}>
															⭕️
														</Match>
														<Match when={!isCorrect}>
															✖️️
														</Match>
													</Switch>
												</span>
												<span >
													<Show when={answer.isShown}>
														{answer.text}
													</Show>
												</span>
											</div>
											<div class={styles.userName}>
												<Switch>
													<Match when={answer.isAnonymous}>
														<span class={styles.anonymous}>匿名</span>
													</Match>
													<Match when={!answer.isAnonymous}>
														<Username userId={answer.userId} display="inline" sx={{fontSize: '3vmin'}}/>
													</Match>
												</Switch>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				);
			}}
		</Doc>
	);
};

const GameShowcaseWrapper = () => {
	const param = useParams();
	const app = useFirebaseApp();
	const db = getFirestore(app);

	const ruleRef = doc(db, 'gameRules', param.ruleId) as DocumentReference<GameRule>;

	const gameData = useFirestore(
		query(
			collection(db, 'games') as CollectionReference<Game>,
			where('athlon', '==', doc(db, 'athlons', param.id)),
			where('rule', '==', ruleRef),
		),
	);

	return (
		<Collection data={gameData}>
			{(game) => (
				<GameShowcase
					game={game}
				/>
			)}
		</Collection>
	);
};

export default GameShowcaseWrapper;
