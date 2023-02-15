import { Title } from "solid-start";
import { Match, Switch } from 'solid-js'
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth'
import { useAuth} from 'solid-firebase'
import Counter from "~/components/Counter";
import { collection, getFirestore } from 'firebase/firestore'
import { useFirebaseApp, useFirestore } from 'solid-firebase'

const Login = () => {
  const app = useFirebaseApp()
  const signIn = () => signInWithPopup(getAuth(app), new GoogleAuthProvider())

  return <button onClick={signIn}>Sign In with Google</button>
}

export default function Home() {
  const app = useFirebaseApp()
  const db = getFirestore(app)
  const state = useAuth(getAuth(app))
  const achievements = useFirestore(collection(db, 'achievement_data'))
  return (
    <main>
      <Title>Hello World</Title>
      <p>{JSON.stringify(achievements.data?.[0], null, '  ')}</p>
      <Counter />
      <p>
        Visit{" "}
        <a href="https://start.solidjs.com" target="_blank">
          start.solidjs.com
        </a>{" "}
        to learn how to build SolidStart apps.
      <Switch>
        <Match when={state.loading}>
          <p>Loading...</p>
        </Match>
        <Match when={state.data}>
          {JSON.stringify(state.data)}
        </Match>
        <Match when={state.error}>
          <Login />
        </Match>
        <Match when={true}>
          <Login />
        </Match>
      </Switch>
      </p>
    </main>
  );
}
