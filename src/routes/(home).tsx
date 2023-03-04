import {Outlet, useLocation} from 'solid-start';
import Header from '~/components/Header';

const RootLayout = () => {
	const location = useLocation();
	return (
		<div
			style={
				location.pathname === '/'
					? {
						display: 'flex',
						'flex-direction': 'column',
						height: '100%',
					} : {}
			}
		>
			<Header/>
			<Outlet/>
		</div>
	);
};

export default RootLayout;
