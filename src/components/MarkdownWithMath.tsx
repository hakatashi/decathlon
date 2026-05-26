import {Link} from '@solidjs/meta';
import remarkGfm from 'remark-gfm';
import {createEffect} from 'solid-js';
import {SolidMarkdown} from 'solid-markdown';

const MarkdownWithMath = (props: {content: string}) => {
	let containerRef!: HTMLDivElement;

	createEffect(async () => {
		// @ts-expect-error: URL import
		// eslint-disable-next-line import/no-unresolved
		const {default: renderMathInElement} = await import('https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.mjs');
		renderMathInElement(containerRef, {
			delimiters: [
				{left: '$$', right: '$$', display: true},
				{left: '$', right: '$', display: false},
			],
		});
	});

	return (
		<div ref={containerRef}>
			<Link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"/>
			<SolidMarkdown class="markdown" children={props.content} remarkPlugins={[remarkGfm]} linkTarget="_blank"/>
		</div>
	);
};

export default MarkdownWithMath;
