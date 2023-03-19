import {Button} from '@suid/material';
import {getAuth, signInWithPopup, OAuthProvider} from 'firebase/auth';
import {useFirebaseApp} from 'solid-firebase';

const slackProvider = new OAuthProvider('oidc.slack');
const scopes = ['openid', 'profile', 'email'];
for (const scope of scopes) {
	slackProvider.addScope(scope);
}

const LoginButton = () => {
	const app = useFirebaseApp();
	const signIn = () => signInWithPopup(getAuth(app), slackProvider);

	return (
		<Button
			sx={{my: 2, color: 'inherit', display: 'block'}}
			onClick={signIn}
		>
			Login
		</Button>
	);
};

export default LoginButton;
