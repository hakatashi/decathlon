import {Dialog, DialogActions, DialogTitle} from '@suid/material';
import LoginButton from './LoginButton';

const LoginRequiredDialog = () => (
	<Dialog open>
		<DialogTitle>
			ログインが必要です
		</DialogTitle>
		<DialogActions sx={{color: 'primary.main'}}>
			<LoginButton/>
		</DialogActions>
	</Dialog>
);

export default LoginRequiredDialog;
