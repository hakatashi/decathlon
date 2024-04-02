// @refresh reload
import {createHandler, StartServer} from '@solidjs/start/server';

export default createHandler(() => (
	<StartServer
		document={({assets, children, scripts}) => (
			<html lang="ja">
				<head>
					<title>Decathlon</title>
					<meta charset="utf-8"/>
					<meta name="viewport" content="width=device-width, initial-scale=1"/>
					<link rel="icon" type="image/svg" href="/favicon.svg"/>
					<link
						href="https://fonts.googleapis.com/css?family=Roboto:300,400,500"
						rel="stylesheet"
					/>
					{assets}
				</head>
				<body>
					<div id="app">{children}</div>
					{scripts}
				</body>
			</html>
		)}
	/>
));
