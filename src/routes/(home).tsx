import {Outlet} from 'solid-start';
import Header from '~/components/Header';

const RootLayout = () => (
	<div>
		<Header/>
		<Outlet/>
	</div>
);

export default RootLayout;
