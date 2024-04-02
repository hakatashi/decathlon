import {Title} from '@solidjs/meta';
import type {JSX} from 'solid-js';

interface Props {
	children: JSX.Element,
}

const PageTitle = (props: Props) => (
	<Title>{props.children} - Decathlon</Title>
);

export default PageTitle;
