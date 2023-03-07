import {JSX} from 'solid-js';
import {Title} from 'solid-start';

interface Props {
	children: JSX.Element,
}

const PageTitle = (props: Props) => (
	<Title>{props.children} - Decathlon</Title>
);

export default PageTitle;
