import {FirebaseError} from '@firebase/util';
import {Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle} from '@suid/material';
import {getAuth, signInWithPopup, OAuthProvider} from 'firebase/auth';
import {useFirebaseApp} from 'solid-firebase';
import {createSignal} from 'solid-js';

const USER_NOT_FOUND_MESSAGE = 'The user is not found in valid Slack team.';

const slackProvider = new OAuthProvider('oidc.slack');
const scopes = ['openid', 'profile', 'email'];
for (const scope of scopes) {
	slackProvider.addScope(scope);
}

const LoginButton = () => {
	const app = useFirebaseApp();

	const [loginErrorMessage, setLoginErrorMessage] = createSignal<string | null>(null);

	const signIn = async () => {
		try {
			await signInWithPopup(getAuth(app), slackProvider);
		} catch (error) {
			if (error instanceof FirebaseError) {
				if (error.code === 'auth/popup-closed-by-user') {
					// The login popup is closed by the user.
				} else if (error.code === 'auth/internal-error') {
					if (error.message.includes(USER_NOT_FOUND_MESSAGE)) {
						setLoginErrorMessage('指定されたSlackチームが選択されていません');
					} else {
						setLoginErrorMessage(`ログインに失敗しました: ${error.message}`);
					}
				} else {
					setLoginErrorMessage(`ログインに失敗しました: ${error.message}`);
				}
			} else {
				setLoginErrorMessage(`ログインに失敗しました: ${error}`);
			}
		}
	};

	return (
		<>
			<Dialog open={loginErrorMessage() !== null} onClose={() => setLoginErrorMessage(null)}>
				<DialogTitle>
					{loginErrorMessage()}
				</DialogTitle>
				<DialogContent>
					<img src="https://user-images.githubusercontent.com/3126484/230712207-9e179595-8337-47fc-9ccd-dd060a862b6d.png" width="100%"/>
					<DialogContentText>
						ログイン用のポップアップが表示されたら、右上のワークスペースが「TSG」になっているのを確認した上で「許可する」を押してください。(「TSG」でない場合は選択してください)
					</DialogContentText>
				</DialogContent>
				<DialogActions sx={{color: 'primary.main'}}>
					<Button
						onClick={() => setLoginErrorMessage(null)}
					>
						閉じる
					</Button>
				</DialogActions>
			</Dialog>
			<Button
				sx={{my: 2, color: 'inherit', display: 'block'}}
				onClick={signIn}
			>
				Login
			</Button>
		</>
	);
};

export default LoginButton;
