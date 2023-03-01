import {Title} from 'solid-start';
import {HttpStatusCode} from 'solid-start/server';

const NotFound = () => (
	<main>
		<Title>Not Found</Title>
		<HttpStatusCode code={404}/>
		<h1>Page Not Found</h1>
	</main>
);

export default NotFound;
