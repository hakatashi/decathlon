import {readFile} from 'fs/promises';
import {stripIndent} from 'common-tags';
import {initializeApp, cert} from 'firebase-admin/app';
import {getFirestore, CollectionReference, CollectionGroup, DocumentReference, Timestamp, Firestore} from 'firebase-admin/firestore';
import {orderBy, sample, sortBy, sum} from 'lodash';
import type {Athlon, Game, Score} from '../src/lib/schema';

// process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

const HAKATASHI = 'AqablkZU7XN9XaHY4Ef70N5Li172';

type FirestoreDoc<T> = {
	[P in keyof T]: T[P] extends Timestamp ? Date : T[P];
}

(async () => {
	const serviceAccount = await readFile('../tsg-decathlon-firebase-adminsdk-64vnw-18995df04d.json', 'utf-8');

	initializeApp({
		credential: cert(JSON.parse(serviceAccount)),
	});

	const db = getFirestore();

	const upsertGame = async (game: Game) => {
		const existingRecord = await db.collection('games')
			.where('athlon', '==', game.athlon)
			.where('rule', '==', game.rule)
			.get();
		if (existingRecord.docs.length === 0) {
			const gameRef = await db.collection('games').add(game);
			return gameRef;
		}
		for (const doc of existingRecord.docs) {
			await doc.ref.update(game);
		}
		return existingRecord.docs[0].ref;
	};

	/*
	const scores = await db.collectionGroup('scores').get();
	for (const score of scores.docs) {
		const user = score.id;
		await score.ref.update({user});
	}

	await db.collection('gameRules').doc('sandbox-quiz').set({
		name: 'sandbox能力検定',
		type: 'external',
		description: 'Slackのsandboxを生き抜くのに必要な能力を題材にしたクイズ大会',
	});
	*/

	/*
	await db.collection('games').add({
		athlon: db.doc('athlons/2023'),
		configuration: {},
		maxPoint: 100,
		order: 10,
		rule: db.doc('gameRules/sandbox-quiz'),
		users: [],
	});

	const result = await db.collection('games')
		.where('athlon', '==', db.doc('athlons/2023'))
		.where('rule', '==', db.doc('gameRules/it-quiz'))
		.get();

	const game = result.docs?.[0];
	if (game) {
		game.ref.update({
			admins: [],
			description: stripIndent`
				# 実施概要

				* TSGで定期的に開催されている、「ITクイズ」を題材にしたペーパーテストです。
				* インターネットやプログラミングなど、ひろく「IT」に関連する周辺知識を問う小問が出題されます。
				* 過去問から30問、新規作成した問題が20問の計50問と、近似値問題1問が出題されます。
					* 過去問は https://it-quiz.hkt.sh/ から確認することができます (約2000問)。
				* 事前の予習や対策に制限はありません。
				* 競技終了後、作問者が採点を行います。採点が終了したあと、採点結果をまとめたスプレッドシートを公開します。そこに記載してある点数を入力してください。

				# ルール

				* 競技開始と同時に、クイズ回答用のGoogleフォームのリンクが共有されます。フォームにアクセスし、制限時間以内に問題を解いて提出してください。
				* 検索は禁止です。極力頭の中にある知識のみを使って解いてください。

				# 獲得得点の計算方法

				* 配点は素点が50点、順位点が50点の100点満点です。
				* 素点は1問1点で50点満点です。
				* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
					* 素点の高い順に順位がつきます。
					* 素点が同率の場合は近似値問題の近い順に順位がつきます。
					* 近似値問題も同率の場合は回答送信時刻の早い順に順位がつきます。

				## 採点基準

				* 明らかに表記が誤っているものは、小さなミスであっても誤答とします。 (Google→Gogle など)
				* 通称・略称などの一般的な表記ゆれは正解とします。(Amazon.com, Inc.→アマゾン社 など)
				* 漢字表記は必要ありません。
				* 東洋人名はフルネームのみを正解とします。
				* 西洋人名はファーストネームのみで正解とします。
				* 採点には常識が適用されます。(「その挙動から『リターンキー』とも呼ばれるキーは何でしょう？」で「リターンキー」と答えても正解にはなりません)
			`,
		});
	}

	const games = await db.collection('games')
		.where('athlon', '==', db.doc('athlons/test'))
		.get();

	for (const game of games.docs) {
		await game.ref.delete();
	}

	await db.collection('games').add({
		athlon: db.doc('athlons/test'),
		configuration: {},
		maxPoint: 2000,
		scoreInputNote: 'AtCoder Problem に表示されている自分の得点をそのまま入力してください。(最終提出時刻は考慮しません)',
		maxRawScore: 2000,
		weight: 0.1,
		order: 2,
		rule: db.doc('gameRules/atcoder-speedrun'),
		users: [],
		admins: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: '競技ページ',
				url: 'https://kenkoooo.com/atcoder/#/contest/show/3b890b5c-760b-4c75-9137-1b8c595c53c8',
				isMain: true,
			},
		],
		scoreConfiguration: {
			type: 'score',
			scoreWeight: 1,
		},
		description: stripIndent`
			# 実施概要

			* AtCoderのバーチャルコンテストを用いた、競技プログラミングの早解きコンテストです。
			* 競技に参加するにはAtCoderアカウントおよび AtCoder Problems アカウントが必要です。
			* 問題セットは 100-100-200-200-300-300-400-400 です。

			# ルール

			* 競技は外部サイトの AtCoder Problems 上で行われます。あらかじめリンク先を確認し「Join」しておいてください。
			* 競技が始まったら問題リストが公開されるので、指定された問題を解いて、AtCoderに提出してください。

			以下の行為は禁止です。

			* 過去の自分や他人の提出を読んだり、コピーする行為
			* 問題文の内容を処理することにより、プログラムの入出力以外の部分を自動生成して提出する行為

			# 獲得得点の計算方法

			* 時間内に獲得した問題の合計得点がそのまま獲得得点になります。
			* ペナルティはありません。また、最終提出時刻は競技点数には影響しません。
		`,
	});

	await db.collection('games').add({
		athlon: db.doc('athlons/test'),
		configuration: {},
		maxPoint: 100,
		maxRawScore: 20,
		scoreInputNote: '公開したスプレッドシートに記載されている自分の得点を入力してください。',
		weight: 1,
		order: 1,
		rule: db.doc('gameRules/it-quiz'),
		users: [],
		admins: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: 'デモページ',
				url: 'https://docs.google.com/forms/d/e/1FAIpQLSfQGSAlCtTshfjyGY40PbIBhZXfJ9TRxwiii6fi0970PJzYdA/viewform?usp=sf_link',
				isMain: false,
			},
		],
		scoreConfiguration: {
			type: 'score-and-rank',
			scoreWeight: 2.5,
			rankRatio: 0.5,
			rankWeight: 2,
		},
		description: stripIndent`
			# 実施概要

			* TSGで定期的に開催されている、「ITクイズ」を題材にしたペーパーテストです。
			* インターネットやプログラミングなど、ひろく「IT」に関連する周辺知識を問う小問が出題されます。
			* デモコンテストでは過去問から20問出題されます。
				* 過去問は https://tsg-it-quiz.hkt.sh/ から確認することができます (約2000問)。
			* 事前の予習や対策に制限はありません。
			* 競技終了後、作問者が採点を行います。採点が終了したあと、採点結果をまとめたスプレッドシートを公開します。そこに記載してある点数を入力してください。

			# ルール

			* 競技開始と同時に、クイズ回答用のGoogleフォームのリンクが共有されます。フォームにアクセスし、制限時間以内に問題を解いて提出してください。
			* 検索は禁止です。極力頭の中にある知識のみを使って解いてください。

			# 獲得得点の計算方法

			* 配点は素点が50点、順位点が50点の100点満点です。
			* 素点は1問2.5点で50点満点です。
			* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
				* 素点の高い順に順位がつきます。
				* 素点が同率の場合は近似値問題の近い順に順位がつきます。
				* 近似値問題も同率の場合は回答送信時刻の早い順に順位がつきます。

			## 採点基準

			* 明らかに表記が誤っているものは、小さなミスであっても誤答とします。 (Google→Gogle など)
			* 通称・略称などの一般的な表記ゆれは正解とします。(Amazon.com, Inc.→アマゾン社 など)
			* 漢字表記は必要ありません。
			* 東洋人名はフルネームのみを正解とします。
			* 西洋人名はファミリーネームのみで正解とします。
			* 採点には常識が適用されます。(「その挙動から『リターンキー』とも呼ばれるキーは何でしょう？」で「リターンキー」と答えても正解にはなりません)
		`,
	});

	await db.collection('games').add({
		athlon: db.doc('athlons/test'),
		configuration: {},
		maxPoint: 100,
		maxRawScore: 200,
		scoreInputNote: '結果ページのCertificateに書かれているWPMの値を入力してください。',
		weight: 1,
		order: 3,
		rule: db.doc('gameRules/typing-english'),
		users: [],
		admins: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: '競技ページ',
				url: 'https://www.typingtest.com/test.html?minutes=3&textfile=certificate.txt&mode=sent&result_url=certificate.html&bt=0',
				isMain: true,
			},
		],
		scoreConfiguration: {
			type: 'score-and-rank',
			scoreWeight: 50 / 120,
			rankRatio: 0.5,
			rankWeight: 2,
		},
		description: stripIndent`
			# 実施概要

			* 英語タイピングの速度を競います。
			* 競技にはtypingtest.comの「Certificate」モードを使用します。このモードで3分間タイピングを行い、WPMの高い順にスコアをつけます。
			* **typingtest.comのトップページからではなく、必ず「競技ページ」のリンクからアクセスしてください。**

			# ルール

			* あらかじめ競技ページを開いておいてください。DiscordやSlackで競技開始の合図を出すので、全員で同時に競技をスタートしてください。
			* 競技は一発勝負です。トラブルの場合などを除き、競技のやり直しは許可されません。
			* 競技時間が3分であれば、競技開始の遅れは問題ありません。

			# 獲得得点の計算方法

			* 配点は素点が50点、順位点が50点の100点満点です。
			* 素点は WPM / 120 * 50 点です。ただし50点を超えた場合は50点に揃えられます。
			* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
				* 素点の高い順に順位がつきます。
		`,
	});
	*/

	await (db.doc('athlons/2023') as DocumentReference<Athlon>).set({
		// @ts-ignore:
		startAt: new Date('2023-04-15T13:00:00+0900'),
		// @ts-ignore:
		endAt: new Date('2023-04-15T19:00:00+0900'),
		id: '2023',
		name: 'TSG十種競技',
		description: stripIndent`
			TSG十種競技は、TSGに関連する競技を1日で10種類行い、その総合得点でTSGの王者を決めるイベントです。

			1競技だけの参加なども歓迎です。時間が合えばぜひ参加してください！

			[参加者用マニュアル](https://github.com/hakatashi/decathlon/wiki)

			# ️タイムスケジュール

			* 13:00-13:15 イベントの説明など
			* 13:15-15:15 **第1～4競技 CTF + diff**
				* CTF (Pwn), CTF (Web), CTF (Crypto), diff を同時に開催します
			* 15:30-15:50 **第5競技 ITクイズ**
			* 16:00-16:30 **第6競技 競プロ早解き**
			* 16:30-16:50 ITクイズ 採点結果発表&解説
			* ～これ以降の予定は目安です。当日の進行状況に応じて前倒しもしくは後ろ倒しになります～
			* 16:50-17:15 **第7,8競技 タイピング**
				* タイピング (英語) (3分) と タイピング (日本語) (10分) を順に行います
			* 17:15-17:45 **第9競技 コードゴルフ**
			* 18:00-18:15 **第10競技 sandbox能力検定**
			* 18:15-18:30 結果発表
		`,
	}, {merge: true});

	await (db.doc('athlons/system-test') as DocumentReference<Athlon>).set({
		// @ts-ignore:
		startAt: new Date('2023-01-01T00:00:00+0900'),
		// @ts-ignore:
		endAt: new Date('2033-01-01T00:00:00+0900'),
		description: 'Decathlon上で競技を行う日本語タイピング、コードゴルフ、diffのシステムテスト用コンテスト',
		id: 'system-test',
		name: 'システムテストコンテスト',
	}, {merge: true});

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test'),
			configuration: {
				correctText: stripIndent`
						　しょうゆは、和食には欠かせない調味料の一つで、古くから全国各地で食されてきました。そのため気候や風土、使われている素材やそこに住む人々の好みによって、味が少しずつ違うと聞いたことがありましたが、わたしはそれを九州で体験しました。とある旅館で海の幸に添えられていたものがあまりにも甘いので、そのことを仲居さんに伝えると、これが普通だという答えがすぐに帰ってきたのです。このとき、地域によって味が異なるというのは、本当だったのだと感じました。
						　この歴史は長く、起源をたどれば飛鳥時代にまでさかのぼるとされています。万葉集に登場する「ひしお」が原点になっているという説があります。ただし、これがいつごろ日本に伝わったのかは定かではありません。現在に近い形状のものが製造されるようになったのは室町時代になってからで、しょうゆという名前が誕生したのもこのころだといわれています。ちなみに、わが国の文献で初めて登場するのは１５９７年のことで、現在の国語辞典のようなものの中に記されているそうです。江戸時代になると、しょうゆは各地で工業的に生産され、その後、関東地方で盛んになって大きく発展するころには、それぞれ独自の風味や味わいを持つものが開発されます。そして、明治時代になって海外との交流が盛んになるとソースやケチャップなど、西洋風の調味料が伝わってきます。日本でもそれらが製造されるようになりますが、それでもなお、しょうゆの地位は揺らぐことなく、第１次世界大戦後に訪れた好景気によって生産量も飛躍的に拡大しました。それに伴って一般家庭への普及も一気に進んだといわれています。現在では、日本国内はもとより、世界１００か国以上で販売されています。
						　さて、スーパーなどの売り場には、さまざまな種類が並べられていますが、これらはとある制度によって五つに分けられています。まず、生産量が最も多いこいくちと呼ばれるものです。バランスが良いので、調理にも卓上用にも適しているといわれています。こうじは大豆と小麦の２種類をほぼ同量とし、それを１年ほど発酵させてから搾っているそうです。二つ目は、色も香りも控えめであるうすくちです。素材の特色を生かす料理に向いており、関西地方で好まれています。塩分が少し高めであり、こいくちより寝かせる期間が短いため、さっぱりとした味わいです。三つ目は、たまりという東海地方で多く生産されているものです。これは、豆みそを製造する過程の中で、たまたま生まれたとされています。とろみがあって色が濃く独特のうま味と香りがあるそうです。四つ目は、山口県にルーツを持つとされている再仕込みです。食塩の代わりに火入れをしていないしょうゆを用いて再度熟成させるため、このように呼ばれているそうです。とてもうま味が強くて濃厚なので、刺し身を食べるときなどに使われます。そして最後に、愛知県の三河地方で生まれた白しょうゆです。小麦の分量が多く、淡いこはく色で素材の鮮やかさや香りを大切にしたい料理に用いることが多いといいます。それぞれ向いている料理が異なるというので、わたしも使い分けてみたいと思います。
						　あなたは、人形劇と聞くとどのような印象を持つでしょうか。おそらく、幼稚園児や小学校低学年の子供たちが楽しむものだと感じる人が多いのではないでしょうか。実際にわたしも、幼いころに児童館で見た、かわいい動物や子供たちが冒険をする物語を今でもよく覚えています。
						　日本には、歌舞伎と肩を並べる伝統芸能として、文楽と呼ばれる人形劇があります。この始まりは江戸時代にさかのぼるそうです。大衆の前で物語に節を付けて聴かせる浄瑠璃という芸と三味線が組み合わされ、さらにそれらと古くから親しまれてきた操り人形が結び付いて誕生したといわれています。これは、わたしが幼少期に見た劇とは全く別物と考えるべきでしょう。その最大の違いは、物語が恋愛や世の無常、歴史など複雑でシリアスなテーマで展開されるという点です。そうなると、前述の劇とは違って対象は子供ではないので、舞台には大人の鑑賞に堪えられるだけの質や魅力が求められます。また、文楽の演目には和服姿の女性がよく登場しますが、そうしたときに身に着けているのはまるで大掛かりな時代劇に出演する役者のような豪華な衣装や、きらびやかな髪飾りなどです。人形の身長はおよそ１メートルほどなので、当然このためだけに仕立てられた専用の衣装ということでしょう。人形は、細工師と呼ばれるプロの手によって作られており、髪の毛以外は基本的に木でできています。特に主要な出演者の顔部分は、少しでも感情を表現するため、目や眉が動くように設計されている場合が多く、美しい姫が一瞬にして鬼や動物に変わるという特殊なものもあります。このような凝った顔は、細工師が一つの木で頭を作り、耳の前で半分に割って内側をくりぬいたうえで仕掛けを施すようです。さらに感情の表現には、手も大きな役割を担います。性別によって形や動き方が異なり、演目によっては、指を１本ずつ動かせるタイプが使われることもあるようです。いずれも制作には、細工師の高度な技術が求められます。
						　文楽は一般的に主役の１体を３人で操っているのですが、右手と首を動かす役割の「主遣い」は、最も経験を積んだベテランが担当するといわれています。そしてその次の古参が左手を動かし、新米は両足と決まっているようです。それにしても人形の各部位を別々に操っているのにも関わらず、まるで生きているかのように、舞台上で滑らかに動くさまは美しく、３人の呼吸がぴったりと合っていなければ成り立ちません。生身の役者よりも表情に乏しくしゃべらない人形だからこそ、肩の落とし具合やうつむき加減、首のかしげ方によって気持ちを表現するのです。わたしたちは、そうした動きから、その心の内を想像して感動を覚えるのでしょう。おそらく、語り手の言葉を細部まで理解できないだろうと思われる海外でも、高い評価を得ているのは、こうした感情移入が万国共通だからかもしれません。
						　わが国では、伝統芸能を継承する人の減少が問題となっていますが、文楽も例外ではありません。なぜなら舞台上の演技以前に、細工師の高齢化が進み、腕の立つ熟練者が数えるくらいしかいないといわれているからです。世界に類を見ないこの素晴らしい芸能を後世に残していきたいものです。
					`,
				enabled: true,
				duration: 600000,
				textUrl: 'https://www.goukaku.ne.jp/image/sample/0307kfng4ysd/65-BSJ-Q.pdf',
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 1,
			// @ts-expect-error:
			rule: db.doc('gameRules/typing-japanese'),
			authors: [],
			admins: [HAKATASHI],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'max-ratio',
			},
			description: stripIndent`
				# 実施概要

				* 日本語タイピングの速度を競います。この競技のルールは概ね[「文章入力スピード認定試験」](https://www.goukaku.ne.jp/test_pcspeed.html)のルールに準拠しています。
				* 競技ページにアクセスし、競技開始時刻になると開始ボタンが表示されます。好きなタイミングで開始ボタンをクリックし、競技を開始してください。
				* ゲームが開始すると画面左側にPDFが表示されます。PDFに記載されている文章を右側の入力エリアに正しく入力していってください。

				# ルール

				* 競技時間は開始ボタンを押してから10分間です。
				* 競技中は、打鍵によって文字を入力するものであればどのようなツールを使っても構いません。
					* つまり、キーボード配列やIMEの種類に制限はありません。
				* 競技中に他のウェブサイトを開いたりしても構いませんが、コピーアンドペーストで文字を入力するなどの行為は禁止です。

				# 獲得得点の計算方法

				* 時間内に正しく入力できた文字数が素点となります。
				* 参加者の中で最も高い素点を100点としたときの点数が各参加者の獲得得点となります。

				## 素点の計算方法

				「入力した文字列」と「正解文字列」に以下の正規化を順番に施したものをそれぞれ【入力】と【正解】とする。

				1. [NFKC正規化](https://ja.wikipedia.org/wiki/Unicode%E6%AD%A3%E8%A6%8F%E5%8C%96#%E6%AD%A3%E8%A6%8F%E5%8C%96%E5%BD%A2%E5%BC%8F)
				2. 「,」を「、」に、「.」を「。」に変換する
				3. [空白文字](https://developer.mozilla.org/ja/docs/Glossary/Whitespace#javascript_%E3%81%A7%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)の除去

				【入力】と【正解】の最長共通部分文字列を計算し、共通部分文字列の長さから【入力】で余分に挿入されている文字列の長さを引いたものを「正しく入力できた文字数」とする。

				### わかりやすい説明

				* 余分に挿入された改行や空白などはスコアに影響を及ぼしません。
				* 不足している改行や空白などもスコアに影響を及ぼしません。
				* 全角数字を半角で打ち込んでもスコアに影響を及ぼしません。
			`,
			tiebreakOrder: 'desc',
			// @ts-expect-error:
			endAt: new Date('2023-04-01T13:00:00+0900'),
			isUserResettable: true,
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/typing-japanese?gameId=${gameRef.id}`,
			}],
		});
	}

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test'),
			configuration: {
				enabled: true,
				files: [
					{
						filename: 'diff_system-test_0432c1c74614482c008f79e492affced',
						isMain: true,
						label: 'バイナリ',
					},
					{
						filename: 'diff_system-test_99387a4b7b8bece86d610372f44dc5c4.exe',
						isMain: false,
						label: 'バイナリ（Win64/参考）',
					},
					{
						filename: 'diff_system-test_maco_428656d61d05eb9e627f7947bf78c93a',
						isMain: false,
						label: 'バイナリ（Mach-O/参考）',
					},
					{
						filename: 'diff_system-test_riscv_ae997d2088031cadcfaefa1bef285f3',
						isMain: false,
						label: 'バイナリ（RISC-V/参考）',
					},
				],
				rule: stripIndent`
					## ルール

					* 言語: C++
					* コンパイル環境: [GNU C++ Compiler 12.2.0 / Debian 12 64bit](https://github.com/hakatashi/diff-challenge/tree/main/langs/cpp)
					* 使用イメージ: [hakatashi/diff-challenge-cpp@1ebbe7a4b95e5dc01d068fd98a2d6a49ef0574c42e644a6e6516502cad3cc7a5](https://hub.docker.com/layers/hakatashi/diff-challenge-cpp/latest/images/sha256-1ebbe7a4b95e5dc01d068fd98a2d6a49ef0574c42e644a6e6516502cad3cc7a5)
					* 参考のため、Windowsで動作するWin64バイナリがダウンロードできます。
						* このファイルは課題のバイナリファイルと同じソースコードを cl.exe (Microsoft C/C++ Compiler 19.28.29914 for x64) でコンパイルしたものです。解答の参考にすることができますが、採点には使用されません。
					* 送信後、送信されたプログラムがサーバーでコンパイルされ、ビルドされたバイナリを正解ファイルと比較した際のdiffスコアが計算されます。diffスコアが小さいほどランキングで上位の結果が得られます。
					* 問題ファイルでは、OSの標準環境で利用できるライブラリ以外の外部のライブラリは使用していません。
					* 提出には30秒のクールタイムが存在します。

					### 🔰初心者向けヒント

					* この競技では機械語のバイナリを解析する必要があります。
					* バイナリの解析には、disassembler / decompilerを使うのをおすすめします。
					* インストール不要で各種ツールのデコンパイルに興味がある場合、[dogbolt.org](https://dogbolt.org/)は便利でしょう。
						* 解析結果をより詳しく解析する予定がある場合、事前に[Ghidra](https://ghidra-sre.org/)や[IDA](https://hex-rays.com/ida-free/)をインストールしておくことをおすすめします。
						* **ほとんどの場合、アセンブリを読む必要はありません。**


					## ローカルでのビルド

					ビルドしたいファイルがカレントディレクトリの \`input.cpp\` にあるとすると、

					\`\`\`
					docker pull hakatashi/diff-challenge-cpp

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output
					\`\`\`

					でリモートと同じ環境でビルドすることができます。

					## ローカルでのdiffスコア算出

					\`\`\`
					docker pull hakatashi/diff-challenge-base

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2
					\`\`\`
				`,
			},
			maxPoint: 100,
			maxRawScore: 1,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 2,
			// @ts-expect-error
			rule: db.doc('gameRules/reversing-diff'),
			authors: [],
			
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score-and-rank',
				scoreWeight: 50,
				rankRatio: 0.5,
				rankWeight: 2,
			},
			description: stripIndent`
				# 実施概要

				* リバースエンジニアリングを、早く、的確に行う能力を競う競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールとバイナリファイルのダウンロードリンクが表示されます。
					* 与えられたバイナリファイルを解析し、これになるべく近いファイルにビルドされるようなソースコードを提出してください。
				* ソースコードは複数回提出することができます。

				## 🔰初心者向けヒント

				* この競技では機械語のバイナリを解析する必要があります。
				* バイナリの解析には、disassembler / decompilerを使うのをおすすめします。
				* インストール不要で各種ツールのデコンパイルに興味がある場合、[dogbolt.org](https://dogbolt.org/)は便利でしょう。
					* 解析結果をより詳しく解析する予定がある場合、事前に[Ghidra](https://ghidra-sre.org/)や[IDA](https://hex-rays.com/ida-free/)をインストールしておくことをおすすめします。
					* **ほとんどの場合、アセンブリを読む必要はありません。**

				# ルール

				* 禁止事項は特にありません。
				* コンパイル環境など、細かいルールは競技開始後に表示されます。

				# 獲得得点の計算方法

				* 配点は素点が50点、順位点が50点の100点満点です。
				* 素点は (正解バイナリのサイズ - diffスコア) / 正解バイナリのサイズ * 50 点です。
					* ただし、0点未満にはなりません。
				* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
					* 素点の高い順に順位がつきます。
					* 素点が同じ場合、提出時刻の早いほうが高い順位を獲得します。
			`,
			// @ts-expect-error
			endAt: new Date('2023-04-01T00:00:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/reversing-diff?gameId=${gameRef.id}`,
			}],
		});
	}

	{
		const gameRef = await upsertGame({
			// @ts-expect-error
			athlon: db.doc('athlons/system-test'),
			configuration: {
				enabled: true,
				judgeType: 'ignore-whitespaces',
				testcases: [
					{
						input: `${stripIndent`
							1
							2
							45
							9
							1
							23
							4
							15
							1134
						`}\n`,
						output: '1234',
					},
					{
						input: `${stripIndent`
							1
							2
							45
							9
							1
							23
							4
							14
							1133
						`}\n`,
						output: '1232',
					},
					{
						input: `${stripIndent`
							34
							44
							54
							64
							74
							50
							20
							1
							8
						`}\n`,
						output: '349',
					},
					{
						input: `${stripIndent`
							654119723
							1
							123
							80654
							2
							1099999999
							45
							63
							34
						`}\n`,
						output: '1754200644',
					},
				],
				description: stripIndent`
					## 課題

					9つの数が与えられます。与えられた数の総和を計算して出力してください。

					※[Anarchy Golf - sum input](http://golf.shinh.org/p.rb?sum+input) を改題

					## ルール

					* 入力の最後には改行が与えられます。
					* 出力に含まれる空白文字は無視されます。
					* 提出には15秒のクールタイムが存在します。
					* 今回の提出システムでは提出されるコードはUTF-8として有効な文字列である必要があります。

					## ローカルでの実行

					たとえばC言語について、実行したいファイルがカレントディレクトリの \`code.c\` にあるとすると、

					\`\`\`
					docker pull esolang/c-gcc

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code esolang/c-gcc script /code/code.c

					# Windows
					docker run --rm -v %CD%:/code esolang/c-gcc script /code/code.c
					\`\`\`

					でリモートと同じ環境で実行することができます。

					Dockerイメージの詳細は [esolang-box](https://github.com/hakatashi/esolang-box) を参照してください。
				`,
				languages: [
					{
						id: 'c-gcc',
						label: 'C言語',
					},
					{
						id: 'python3',
						label: 'Python3',
					},
					{
						id: 'anything',
						label: '任意言語',
					},
				],
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 3,
			// @ts-expect-error
			rule: db.doc('gameRules/codegolf'),
			admins: [HAKATASHI],
			authors: [],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score',
				scoreWeight: 1,
			},
			description: stripIndent`
				# 実施概要

				* コードゴルフを行います。コードゴルフは、与えられた処理を実行するプログラムを可能な限り短く書く、という競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールと問題が表示されます。
				* ソースコードは複数回提出することができます。

				# ルール

				* このコードゴルフ競技は個人戦です。他の人と協力して解くことは禁止されています。

				# 獲得得点の計算方法

				* このコードゴルフ競技では複数の言語による種目が行われます。獲得得点はそれぞれの言語ごとに計算され、その合計がこの競技での獲得点数となります。
				* それぞれの言語における満点は 100 ÷ [言語の数] 点です。
				* それぞれの言語について、課題を解く全プレイヤーで最も短いコードを提出したプレイヤーは満点を獲得します。
				* 課題を解くコードを提出した他のプレイヤーは、満点 × [全プレイヤーで最も短いコードの長さ] ÷ [自分が提出した最も短いコードの長さ] を獲得します。
				* この競技における満点は100点ですが、必ずしも100点を獲得するプレイヤーがいるとは限らないことに注意してください。
			`,
			// @ts-expect-error
			endAt: new Date('2023-04-01T00:00:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/codegolf?gameId=${gameRef.id}`,
			}],
		});
	}

	await (db.doc('athlons/system-test-2') as DocumentReference<Athlon>).set({
		// @ts-ignore:
		startAt: new Date('2023-01-01T00:00:00+0900'),
		// @ts-ignore:
		endAt: new Date('2033-04-15T18:00:00+0900'),
		description: 'システムコンテスト第2弾',
		id: 'system-test-2',
		name: 'システムテストコンテスト2',
	}, {merge: true});

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test-2'),
			configuration: {
				correctText: stripIndent`
					　できることなら筋肉を付けたいと思っている人は、多いのではないでしょうか。その量が増えると、基礎代謝が上がり、エネルギー消費量が増加するため、太りにくく疲れにくい体質になるとされています。そのため近年は、普段の生活に筋力トレーニングを取り入れる人が増えています。そして、効率よく効果を得るためには、毎日の食事に気を使うことも大切なようです。
					　わたしたちが筋肉を作り出すためには、タンパク質のもととなるアミノ酸が必要となります。もし、食事の量を減らしたり栄養が偏ったりすると、体がエネルギー源として筋肉の中にある大切なアミノ酸を放出してしまいます。それにより、筋肉量が減ってしまう場合があるため、注意が必要なのです。最も大切なことは、必要な栄養をバランスよく取ることです。また、筋肉を鍛える際にはその食事のタイミングも重要だといわれています。
					　おなかの中に何もない状態で行ったり、直前に摂取したりすることは体に負担を掛けるため、２時間ほど前に食べるのが良いようです。また、運動を終えてから３０分から４５分以内にタンパク質を摂取すると、筋肉の修復に効果的だともいわれています。そこで、ふと疑問に思ったのが、草食動物は植物ばかり食べているのに、なぜ筋肉質なのかということです。必要とする成分が、わたしたち人間と異なるのでしょうか。調べてみると、どうやら草食動物の体内には、たくさんの微生物がいて、筋肉を作るための手助けをしていることが分かりました。例えば、ウマは食べた草をまずは胃で消化吸収した後に、とても長い腸の中にいる膨大な微生物たちに、必要な栄養素を作ってもらっているのです。また、四つの胃を持つウシは、ほとんど自力では消化をしていないといえるかもしれません。食べたものは、このそれぞれの部位を通過するときに微生物によって分解されていきます。アミノ酸を生成してもらい、さらにそれ自体までも吸収しているのです。種によって仕組みはさまざまですが、いずれも自ら生み出した成分で分解するのではなく、体内の細菌や微生物たちが働くことで筋肉が作られているといいます。
					　そうすると、次に気になるのが肉食動物です。肉ばかり食べていて栄養が偏らないのかという疑問が浮かんできます。野菜を食べないとビタミン不足になるのではないかと、つい気になってしまいます。彼らの体内には植物を分解する酵素がありません。そこで思い出してほしいのが、彼らのえさとなるのは、草食動物だということです。その肉や内臓にはさまざまな栄養素がバランスよく詰まっています。つまり、間接的に植物を摂取しているといえるでしょう。そのためか、獲物を仕留めると胃や腸などの消化器官から食べるというから驚きです。
					　わたしたちの生活の中には、自然界の動植物を手本として誕生したものが数多く存在します。この地球上には長い歴史の中でさまざまな生き物が生息してきました。そして、その過酷な生存競争をくぐり抜けるため、環境に応じて多様に変化してきたのです。そんな動植物の知恵や能力、仕組みには、人の暮らしに役立つヒントがたくさん隠されていました。例えば現在、わが国では生活用水の３割近くが洗浄のために使われています。清潔といえば聞こえはいいかもしれませんが、少々使いすぎのようです。そこで、家を建てる会社の研究者たちが注目したのが、雨の季節によく見掛けるカタツムリでした。彼らは、湿気の多い場所にいるのに、いつも殻がきれいです。どのような構造かというと、その表面には数百ナノメートルというとてつもなく細かい溝が広がっており、そこに常に水がたまる仕組みになっているのです。その上に油を落とすと、水分と反発し合って、はじかれて汚れも一緒に流れ落ちていきます。これをヒントにして開発されたのが、汚れにくい外壁材です。
					　また、日本の新幹線といえば、高速かつ高い安全性で世界的に注目されています。これは速さにばかり注目が集まりますが、実は技術者からすれば、ただ単に速く走らせるだけであれば、比較的簡単にできることだといいます。開発における最大の課題は、安全性だといい、さらに、世界一厳しい日本の騒音基準も高いハードルとなります。新幹線は時速２００キロメートルを超えると、その速度のおよそ６乗に比例して増加した音が発生するといわれているのです。これを抑えるのは並大抵のことではなく、車輪やレール、構造物の振動、車体自体から発生するものなど、騒音の音源は複数ありますが、中でも特に課題となっているのがパンタグラフと呼ばれる集電装置でした。列車の上に付いている棒のようなものに見覚えがあるという人は少なくないでしょう。これを使って線路の上に配された電線から電気を取り入れ、モーターに送ることで走行しています。
					　このパンタグラフに起因する空力騒音が、大きな課題となってきました。ここでヒントとなったのがフクロウでした。彼らは鳥類の中で最も静かに飛ぶといいます。獲物に気付かれないように近づいて、捕らえることができるよう備わった仕組みなのでしょう。音を立てずに飛ぶ彼らの姿から着想を得て羽の構造を調べたところ、他の鳥には存在しない、風を切る独特なギザギザの羽があり、これが空気を逃がして抵抗を少なくしていることが分かったのです。この課題となっている空力騒音、つまり気流の運動によって生じる音はその渦が大きいほど激しくなります。そこでフクロウの羽の原理を適用して、のこぎりのような突起を付けた翼の構造を組み込んだところ、気流の大きな渦の発生を防ぐことに成功しました。これは、時速３００キロメートルで運行を開始した５００系新幹線に採用されました。その後、さらに改良が進みますが、構造自体は後継へと引き継がれているそうです。
					　また、同じく５００系新幹線には、もう一つある鳥の機能が取り入れられています。それはカワセミです。彼らは獲物を得るために高速で水中に飛び込みますが、その際の水しぶきが非常に少ないという特徴があります。その秘密はくちばしにありました。それは空気抵抗が小さい形状をしており、まさにあの流線形は、この鳥から着想を得たものだったのです。
					　このように、動物を手本にしてその仕組みを応用し、新たな製品を作り出す試みは、さまざまな分野で行われています。いずれ、こうした自然に学んだ技術が、わたしたちの直面する地球環境問題の解決策となっていくのかもしれません。
				`,
				enabled: true,
				duration: 600000,
				textUrl: 'https://www.goukaku.ne.jp/image/sample/0310xzkn5ryv/66-BSJ-Q.pdf',
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 1,
			// @ts-expect-error:
			rule: db.doc('gameRules/typing-japanese'),
			admins: [HAKATASHI],
			authors: [],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'max-ratio',
			},
			description: stripIndent`
				# 実施概要

				* 日本語タイピングの速度を競います。この競技のルールは概ね[「文章入力スピード認定試験」](https://www.goukaku.ne.jp/test_pcspeed.html)のルールに準拠しています。
				* 競技ページにアクセスし、競技開始時刻になると開始ボタンが表示されます。好きなタイミングで開始ボタンをクリックし、競技を開始してください。
				* ゲームが開始すると画面左側にPDFが表示されます。PDFに記載されている文章を右側の入力エリアに正しく入力していってください。

				# ルール

				* 競技時間は開始ボタンを押してから10分間です。
				* 競技中は、打鍵によって文字を入力するものであればどのようなツールを使っても構いません。
					* つまり、キーボード配列やIMEの種類に制限はありません。
				* 競技中に他のウェブサイトを開いたりしても構いませんが、コピーアンドペーストで文字を入力するなどの行為は禁止です。

				# 獲得得点の計算方法

				* 時間内に正しく入力できた文字数が素点となります。
				* 参加者の中で最も高い素点を100点としたときの点数が各参加者の獲得得点となります。

				## 素点の計算方法

				「入力した文字列」と「正解文字列」に以下の正規化を順番に施したものをそれぞれ【入力】と【正解】とする。

				1. [NFKC正規化](https://ja.wikipedia.org/wiki/Unicode%E6%AD%A3%E8%A6%8F%E5%8C%96#%E6%AD%A3%E8%A6%8F%E5%8C%96%E5%BD%A2%E5%BC%8F)
				2. 「,」を「、」に、「.」を「。」に変換する
				3. [空白文字](https://developer.mozilla.org/ja/docs/Glossary/Whitespace#javascript_%E3%81%A7%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)の除去

				【入力】と【正解】の最長共通部分文字列を計算し、共通部分文字列の長さから【入力】で余分に挿入されている文字列の長さを引いたものを「正しく入力できた文字数」とする。

				### わかりやすい説明

				* 余分に挿入された改行や空白などはスコアに影響を及ぼしません。
				* 不足している改行や空白などもスコアに影響を及ぼしません。
				* 全角数字を半角で打ち込んでもスコアに影響を及ぼしません。
			`,
			tiebreakOrder: 'desc',
			// @ts-expect-error:
			endAt: new Date('2023-04-01T18:00:00+0900'),
			isUserResettable: true,
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/typing-japanese?gameId=${gameRef.id}`,
			}],
		});
	}

	/*
	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test-2'),
			configuration: {
				enabled: true,
				files: [
					{
						filename: 'diff_system-test_0432c1c74614482c008f79e492affced',
						isMain: true,
						label: 'バイナリ',
					},
					{
						filename: 'diff_system-test_99387a4b7b8bece86d610372f44dc5c4.exe',
						isMain: false,
						label: 'バイナリ（Win64/参考）',
					},
					{
						filename: 'diff_system-test_maco_428656d61d05eb9e627f7947bf78c93a',
						isMain: false,
						label: 'バイナリ（Mach-O/参考）',
					},
					{
						filename: 'diff_system-test_riscv_ae997d2088031cadcfaefa1bef285f3',
						isMain: false,
						label: 'バイナリ（RISC-V/参考）',
					},
				],
				rule: stripIndent`
					## ルール

					* 言語: C++
					* コンパイル環境: [GNU C++ Compiler 12.2.0 / Debian 12 64bit](https://github.com/hakatashi/diff-challenge/tree/main/langs/cpp)
					* 使用イメージ: [hakatashi/diff-challenge-cpp@1ebbe7a4b95e5dc01d068fd98a2d6a49ef0574c42e644a6e6516502cad3cc7a5](https://hub.docker.com/layers/hakatashi/diff-challenge-cpp/latest/images/sha256-1ebbe7a4b95e5dc01d068fd98a2d6a49ef0574c42e644a6e6516502cad3cc7a5)
					* 参考のため、Windowsで動作するWin64バイナリがダウンロードできます。
						* このファイルは課題のバイナリファイルと同じソースコードを cl.exe (Microsoft C/C++ Compiler 19.28.29914 for x64) でコンパイルしたものです。解答の参考にすることができますが、採点には使用されません。
					* 送信後、送信されたプログラムがサーバーでコンパイルされ、ビルドされたバイナリを正解ファイルと比較した際のdiffスコアが計算されます。diffスコアが小さいほどランキングで上位の結果が得られます。
					* 問題ファイルでは、OSの標準環境で利用できるライブラリ以外の外部のライブラリは使用していません。
					* 提出には30秒のクールタイムが存在します。

					## ローカルでのビルド

					ビルドしたいファイルがカレントディレクトリの \`input.cpp\` にあるとすると、

					\`\`\`
					docker pull hakatashi/diff-challenge-cpp

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output
					\`\`\`

					でリモートと同じ環境でビルドすることができます。

					## ローカルでのdiffスコア算出

					\`\`\`
					docker pull hakatashi/diff-challenge-base

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2
					\`\`\`
				`,
			},
			maxPoint: 100,
			maxRawScore: 1,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 2,
			// @ts-expect-error
			rule: db.doc('gameRules/reversing-diff'),
			authors: [],
			admins: [HAKATASHI],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score-and-rank',
				scoreWeight: 50,
				rankRatio: 0.5,
				rankWeight: 2,
			},
			description: stripIndent`
				# 実施概要

				* リバースエンジニアリングを、早く、的確に行う能力を競う競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールとバイナリファイルのダウンロードリンクが表示されます。
					* 与えられたバイナリファイルを解析し、これになるべく近いファイルにビルドされるようなソースコードを提出してください。
				* ソースコードは複数回提出することができます。

				# ルール

				* 禁止事項は特にありません。
				* コンパイル環境など、細かいルールは競技開始後に表示されます。

				# 獲得得点の計算方法

				* 配点は素点が50点、順位点が50点の100点満点です。
				* 素点は (正解バイナリのサイズ - diffスコア) / 正解バイナリのサイズ * 50 点です。
					* ただし、0点未満にはなりません。
				* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
					* 素点の高い順に順位がつきます。
					* 素点が同じ場合、提出時刻の早いほうが高い順位を獲得します。
			`,
			// @ts-expect-error
			endAt: new Date('2023-04-15T18:00:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/reversing-diff?gameId=${gameRef.id}`,
			}],
		});
	}
	*/

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test-2'),
			configuration: {
				enabled: true,
				judgeType: 'ignore-newline-type',
				testcases: [
					{
						input: '',
						output: [
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                                     +  +  +                                     ',
							'                                    +++++++++                                    ',
							'                                     +  +  +                                     ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                               +        +        +                               ',
							'                              +++      +++      +++                              ',
							'                               +        +        +                               ',
							'                            +  +  +  +  +  +  +  +  +                            ',
							'                           +++++++++++++++++++++++++++                           ',
							'                            +  +  +  +  +  +  +  +  +                            ',
							'                               +        +        +                               ',
							'                              +++      +++      +++                              ',
							'                               +        +        +                               ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                                     +  +  +                                     ',
							'                                    +++++++++                                    ',
							'                                     +  +  +                                     ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'             +                          +                          +             ',
							'            +++                        +++                        +++            ',
							'             +                          +                          +             ',
							'          +  +  +                    +  +  +                    +  +  +          ',
							'         +++++++++                  +++++++++                  +++++++++         ',
							'          +  +  +                    +  +  +                    +  +  +          ',
							'             +                          +                          +             ',
							'            +++                        +++                        +++            ',
							'             +                          +                          +             ',
							'    +        +        +        +        +        +        +        +        +    ',
							'   +++      +++      +++      +++      +++      +++      +++      +++      +++   ',
							'    +        +        +        +        +        +        +        +        +    ',
							' +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  + ',
							'+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++',
							' +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  + ',
							'    +        +        +        +        +        +        +        +        +    ',
							'   +++      +++      +++      +++      +++      +++      +++      +++      +++   ',
							'    +        +        +        +        +        +        +        +        +    ',
							'             +                          +                          +             ',
							'            +++                        +++                        +++            ',
							'             +                          +                          +             ',
							'          +  +  +                    +  +  +                    +  +  +          ',
							'         +++++++++                  +++++++++                  +++++++++         ',
							'          +  +  +                    +  +  +                    +  +  +          ',
							'             +                          +                          +             ',
							'            +++                        +++                        +++            ',
							'             +                          +                          +             ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                                     +  +  +                                     ',
							'                                    +++++++++                                    ',
							'                                     +  +  +                                     ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                               +        +        +                               ',
							'                              +++      +++      +++                              ',
							'                               +        +        +                               ',
							'                            +  +  +  +  +  +  +  +  +                            ',
							'                           +++++++++++++++++++++++++++                           ',
							'                            +  +  +  +  +  +  +  +  +                            ',
							'                               +        +        +                               ',
							'                              +++      +++      +++                              ',
							'                               +        +        +                               ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
							'                                     +  +  +                                     ',
							'                                    +++++++++                                    ',
							'                                     +  +  +                                     ',
							'                                        +                                        ',
							'                                       +++                                       ',
							'                                        +                                        ',
						].join('\n') + '\n',
					},
				],
				description: stripIndent`
					## 課題

					指定された文字列を出力してください。

					※[Anarchy Golf - Fractal Plus](http://golf.shinh.org/p.rb?Fractal+Plus) より引用

					## ルール

					* 入力は0バイトです。
					* 出力の改行文字がCRLFだった場合、LFに正規化されます。
					* 出力の最後の改行の有無は正誤判定に影響しません。
						* それ以外の空白文字の有無は正誤判定に**影響します。**
					* 提出には15秒のクールタイムが存在します。
					* 今回の提出システムでは提出されるコードはUTF-8として有効な文字列である必要があります。
					* テストケース

					## ローカルでの実行

					たとえばC言語について、実行したいファイルがカレントディレクトリの \`code.c\` にあるとすると、

					\`\`\`
					docker pull esolang/c-gcc

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code esolang/c-gcc script /code/code.c

					# Windows
					docker run --rm -v %CD%:/code esolang/c-gcc script /code/code.c
					\`\`\`

					でリモートと同じ環境で実行することができます。

					Dockerイメージの詳細は [esolang-box](https://github.com/hakatashi/esolang-box) を参照してください。
				`,
				languages: [
					{
						id: 'c-gcc',
						label: 'C言語',
					},
					{
						id: 'python3',
						label: 'Python3',
					},
					{
						id: 'anything',
						label: '任意言語',
					},
				],
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 3,
			// @ts-expect-error
			rule: db.doc('gameRules/codegolf'),
			authors: [],
			admins: [HAKATASHI],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score',
				scoreWeight: 1,
			},
			description: stripIndent`
				# 実施概要

				* コードゴルフを行います。コードゴルフは、与えられた処理を実行するプログラムを可能な限り短く書く、という競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールと問題が表示されます。
				* ソースコードは複数回提出することができます。

				# ルール

				* このコードゴルフ競技は個人戦です。他の人と協力して解くことは禁止されています。

				# 獲得得点の計算方法

				* このコードゴルフ競技では複数の言語による種目が行われます。獲得得点はそれぞれの言語ごとに計算され、その合計がこの競技での獲得点数となります。
				* それぞれの言語における満点は 100 ÷ [言語の数] 点です。
				* それぞれの言語について、課題を解く全プレイヤーで最も短いコードを提出したプレイヤーは満点を獲得します。
				* 課題を解くコードを提出した他のプレイヤーは、満点 × [全プレイヤーで最も短いコードの長さ] ÷ [自分が提出した最も短いコードの長さ] を獲得します。
				* この競技における満点は100点ですが、必ずしも100点を獲得するプレイヤーがいるとは限らないことに注意してください。
			`,
			// @ts-expect-error
			endAt: new Date('2033-04-15T18:00:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/codegolf?gameId=${gameRef.id}`,
			}],
		});
	}

	{
		const genres = [
			['pwn', 'xQQsCgIPaXdBl5ZxWs9vvnwQFdr1'],
			['web', 'ks4O6STDpCYDoo8FsTYeApOg4PF2'],
			['crypto', '48di7kQPjPTm8UHmZDQxgaNrbze2'],
		];

		for (const [i, [genre, author]] of genres.entries()) {
			await upsertGame({
				// @ts-expect-error:
				athlon: db.doc('athlons/2023'),
				configuration: {},
				maxPoint: 100,
				maxRawScore: 100,
				scoreInputNote: `${genre}ジャンルの問題が解けた場合、回答送信時刻を記入してください`,
				isScoreUserEditable: true,
				weight: 1,
				order: i + 1,
				// @ts-expect-error:
				rule: db.doc(`gameRules/ctf-${genre}`),
				admins: [author, HAKATASHI],
				authors: [author],
				adminBonus: {
					type: 'topPlayer',
					count: 5,
				},
				links: [
					{
						isMain: true,
						url: 'https://ctf.hakatashi.com/',
						label: '競技ページ',
					}
				],
				scoreConfiguration: {
					type: 'timestamp',
					attenuationFactor: 0.99,
				},
				description: stripIndent`
					# 実施概要

					* 第1競技から第4競技までは同時に行われます。与えられた時間を自由に使って、まずは自分の得意な分野に取り組んでみてください。
					* CTFはサイバーセキュリティに関連する技術を用いたパズルです。問題ごとにさまざまなタスクを解き、最終的にフラグと呼ばれる文字列を提出するとクリアとなります。
					* CTFの競技はすべて[別途設ける競技ページ](https://ctf.hakatashi.com/)上で行われます。競技に先立ってあらかじめユーザー登録をしておいてください。
						* 競技ページの右上のRegisterボタンからユーザー登録できます。

					## 🔰初心者向けヒント

					* 競技ページに表示される問題文に初心者向けのヒントが表示されます。ぜひ確認してください。
					* CTFが初めての場合は、[Scrapboxの「CTF」のページ](https://scrapbox.io/tsg/CTF)を事前に確認して、雰囲気をつかんでおきましょう。常設CTFの問題をいくつか解いてみるのもOKです。
					* Pwn問題ではバイナリファイルが渡されます。バイナリを詳しく解析したい場合、事前に[Ghidra](https://ghidra-sre.org/)や[IDA](https://hex-rays.com/ida-free/)をインストールしておくことをおすすめします。

					# ルール

					* 今回のCTFは個人戦です。アカウントを共有したり、情報を共有したりしないでください。
					* スコアサーバーを攻撃しないでください。

					# 獲得得点の計算方法

					* 獲得得点はそれぞれの問題ごとに独立に計算されます。
					* 提出が早い順番に順位が付きます。
					* 問題が解けた場合、この競技の獲得得点は 100 × 0.99 ^ [提出順位 (0-indexed)] 点です。
					* 問題が解けなかった場合、この競技の獲得得点は0点となります。

					# 送信するスコアについて

					問題が解けた場合、ポータルサイトで回答送信時刻を入力してください。回答送信時刻を確認するには、ログインした状態で https://ctf.hakatashi.com/user にアクセスして、Solvesの欄を見てください。

					![](https://user-images.githubusercontent.com/3126484/231153631-4b58f07a-70d3-4a16-b41e-85eb9121683f.png)
				`,
				// @ts-expect-error
				endAt: new Date('2023-04-15T15:15:00+0900'),
				tiebreakOrder: 'asc',
			});
		}
	}

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/2023'),
			configuration: {
				...{
					enabled: false,
					files: []
				},
				...{
					enabled: true,
					files: [
						{
							filename: 'diff_2023_bac24600ba7ed7db6eafe3b68ee273c2',
							isMain: true,
							label: 'バイナリ',
						},
						{
							filename: 'diff_2023_win_9427b4185186ce373a00d816950ceea8.exe',
							isMain: false,
							label: 'バイナリ（Win64/参考）',
						},
						{
							filename: 'diff_2023_mac_5f9dd76431d540ac700f3e2b82e28b31',
							isMain: false,
							label: 'バイナリ（Mach-O/参考）',
						},
					],
				},
				rule: stripIndent`
					## ルール

					* 言語: C++
					* コンパイル環境: [GNU C++ Compiler 12.2.0 / Debian 12 64bit](https://github.com/hakatashi/diff-challenge/tree/main/langs/cpp)
					* 使用イメージ: [hakatashi/diff-challenge-cpp@241f0fefbe887330faedb84cd37b6e554d5b729f88d0715501ca5416de072ec1](https://hub.docker.com/layers/hakatashi/diff-challenge-cpp/latest/images/sha256-241f0fefbe887330faedb84cd37b6e554d5b729f88d0715501ca5416de072ec1)
					* 参考のため、Windowsで動作するWin64バイナリがダウンロードできます。
						* このファイルは課題のバイナリファイルと同じソースコードを cl.exe (Microsoft C/C++ Compiler 19.28.29914 for x64) でコンパイルしたものです。解答の参考にすることができますが、採点には使用されません。
					* 送信後、送信されたプログラムがサーバーでコンパイルされ、ビルドされたバイナリを正解ファイルと比較した際のdiffスコアが計算されます。diffスコアが小さいほどランキングで上位の結果が得られます。
					* 問題ファイルでは、OSの標準環境で利用できるライブラリ以外の外部のライブラリは使用していません。
					* 提出には30秒のクールタイムが存在します。

					### 🔰初心者向けヒント

					* この競技では機械語のバイナリを解析する必要があります。
					* バイナリの解析には、disassembler / decompilerを使うのをおすすめします。
					* インストール不要で各種ツールのデコンパイルに興味がある場合、[dogbolt.org](https://dogbolt.org/)は便利でしょう。
						* 解析結果をより詳しく解析する予定がある場合、事前に[Ghidra](https://ghidra-sre.org/)や[IDA](https://hex-rays.com/ida-free/)をインストールしておくことをおすすめします。
						* **ほとんどの場合、アセンブリを読む必要はありません。**

					## ローカルでのビルド

					ビルドしたいファイルがカレントディレクトリの \`input.cpp\` にあるとすると、

					\`\`\`
					docker pull hakatashi/diff-challenge-cpp

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-cpp /tmp/build.sh /code/input.cpp /code/output
					\`\`\`

					でリモートと同じ環境でビルドすることができます。

					## ローカルでのdiffスコア算出

					\`\`\`
					docker pull hakatashi/diff-challenge-base

					# Mac / Linux
					docker run --rm -v \`pwd\`:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2

					# Windows
					docker run --rm -v %CD%:/code hakatashi/diff-challenge-base /tmp/compare /code/binary1 /code/binary2
					\`\`\`
				`,
			},
			maxPoint: 100,
			maxRawScore: 1,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 4,
			// @ts-expect-error:
			rule: db.doc('gameRules/reversing-diff'),
			admins: [HAKATASHI, 'NmVzOoLbH3ODkjBUTUKLVMMnXGc2'],
			authors: ['NmVzOoLbH3ODkjBUTUKLVMMnXGc2'],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score-and-rank',
				scoreWeight: 50,
				rankRatio: 0.5,
				rankWeight: 2,
			},
			description: stripIndent`
				# 実施概要

				* リバースエンジニアリングを、早く、的確に行う能力を競う競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールとバイナリファイルのダウンロードリンクが表示されます。
					* 与えられたバイナリファイルを解析し、これになるべく近いファイルにビルドされるようなソースコードを提出してください。
				* ソースコードは複数回提出することができます。

				## 🔰初心者向けヒント

				* この競技では機械語のバイナリを解析する必要があります。
				* バイナリの解析には、disassembler / decompilerを使うのをおすすめします。
				* インストール不要で各種ツールのデコンパイルに興味がある場合、[dogbolt.org](https://dogbolt.org/)は便利でしょう。
					* 解析結果をより詳しく解析する予定がある場合、事前に[Ghidra](https://ghidra-sre.org/)や[IDA](https://hex-rays.com/ida-free/)をインストールしておくことをおすすめします。
					* **ほとんどの場合、アセンブリを読む必要はありません。**

				# ルール

				* 禁止事項は特にありません。
				* コンパイル環境など、細かいルールは競技開始後に表示されます。

				# 獲得得点の計算方法

				* 配点は素点が50点、順位点が50点の100点満点です。
				* 素点は (正解バイナリのサイズ - diffスコア) / 正解バイナリのサイズ * 50 点です。
					* ただし、0点未満にはなりません。
				* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
					* 素点の高い順に順位がつきます。
					* 素点が同じ場合、提出時刻の早いほうが高い順位を獲得します。
			`,
			// @ts-expect-error
			endAt: new Date('2023-04-15T15:15:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/reversing-diff?gameId=${gameRef.id}`,
			}],
		});
	}

	await upsertGame({
		// @ts-expect-error:
		athlon: db.doc('athlons/2023'),
		maxPoint: 200,
		maxRawScore: 200,
		scoreInputNote: '自分の得点を入力してください。',
		isScoreUserEditable: false,
		weight: 1,
		order: 5,
		// @ts-expect-error:
		rule: db.doc('gameRules/it-quiz'),
		admins: [HAKATASHI],
		authors: [HAKATASHI],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: 'サンプル問題',
				url: 'https://docs.google.com/forms/d/e/1FAIpQLSfQGSAlCtTshfjyGY40PbIBhZXfJ9TRxwiii6fi0970PJzYdA/viewform?usp=sf_link',
				isMain: false,
			},
			{
				label: '競技ページ',
				url: 'https://docs.google.com/forms/d/e/1FAIpQLScYoF9nR0HhH03faXTKJsLiik3cEtsAlddka6mY-Rrf-Gh1yA/viewform?usp=sf_link',
				isMain: true,
			},
		],
		scoreConfiguration: {
			type: 'score-and-rank',
			scoreWeight: 1,
			rankRatio: 0.5,
			rankWeight: 2,
		},
		description: stripIndent`
			# 実施概要

			* TSGで定期的に開催されている、「ITクイズ」を題材にしたペーパーテストです。
			* インターネットやプログラミングなど、ひろく「IT」に関連する周辺知識を問う小問が出題されます。
			* 過去問から30問、新規作成した問題が20問の計50問と、近似値問題1問が出題されます。
				* 過去問は https://tsg-it-quiz.hkt.sh/ から確認することができます (約2000問)。
			* 事前の予習や対策に制限はありません。
			* 競技終了後、作問者が採点を行います。採点が終了したあと、採点結果をまとめたスプレッドシートを公開します。そこに記載してある点数を入力してください。

			## 🔰初心者向けヒント

			* このクイズの出題範囲は、インターネットやIT企業についてなど、わりと広めです。プログラミングの経験はそこまで関係ないので、初心者でも気軽に参加できると思います。
			* 問題の多くは過去問から出題されるので、事前の予習も有効です。

			# ルール

			* 競技開始と同時に、クイズ回答用のGoogleフォームのリンクが共有されます。フォームにアクセスし、制限時間以内に問題を解いて提出してください。
			* 検索は禁止です。極力頭の中にある知識のみを使って解いてください。

			# 獲得得点の計算方法

			* 配点は素点が100点、順位点が100点の200点満点です。
			* 素点は1問2点で100点満点です。
			* 順位点は 100 × 2/(順位+1) 点です。 (1-indexed)
				* 素点の高い順に順位がつきます。
				* 素点が同率の場合は近似値問題の近い順に順位がつきます。
				* 近似値問題も同率の場合は回答送信時刻の早い順に順位がつきます。

			## 採点基準

			* 明らかに表記が誤っているものは、小さなミスであっても誤答とします。 (Google→Gogle など)
			* 通称・略称などの一般的な表記ゆれは正解とします。(Amazon.com, Inc.→アマゾン社 など)
			* 漢字表記は必要ありません。
			* 東洋人名はフルネームのみを正解とします。
			* 西洋人名はファーストネームのみで正解とします。
			* 採点には常識が適用されます。(「その挙動から『リターンキー』とも呼ばれるキーは何でしょう？」で「リターンキー」と答えても正解にはなりません)

			# 競技の流れ

			1. 競技開始時間になると、ポータルページから競技ページに飛べるようになります。リンクをクリックして、競技ページを開いてください。

			2. 時間内に問題を解き、ページ下部の「送信」ボタンを押してください。

			3. 送信後、「スコアを表示」というボタンが表示されます。採点完了まで、この画面を開いておいてください。

				![](https://user-images.githubusercontent.com/3126484/230724454-d40cd26b-5858-4acb-8e29-19766fad28d4.png)

				* 「スコアを表示」ボタンを押しても構いませんが、この時点で表示されるスコアは自動採点によるものであり、**この競技における正式なスコアではありません。**

			4. 「第6競技 競技プログラミング (早解き)」が終了したあと、採点セッションを行います。共有画面上で正解となる答えを1問ずつ発表するので、採点に不満がある場合は Google Meet のチャットかマイクでその旨を申し立ててください。

			5. 採点セッション終了後、再び「スコアを表示」からスコア表示ページを開いてください。(すでに開いている場合はページをリロードしてください) ここに表示されている点数が最終的な点数となります。

				![](https://user-images.githubusercontent.com/3126484/230725065-e269fd32-aba7-4b6e-9eca-cd1c11e7247d.png)
		`,
		endAt: null,
		tiebreakOrder: 'asc',
	});

	await upsertGame({
		// @ts-expect-error:
		athlon: db.doc('athlons/2023'),
		configuration: {},
		maxPoint: 200,
		maxRawScore: 2000,
		scoreInputNote: 'AtCoder Problem に表示されている自分の得点をそのまま入力してください。(最終提出時刻は考慮しません)',
		isScoreUserEditable: true,
		weight: 1,
		order: 6,
		// @ts-expect-error:
		rule: db.doc(`gameRules/atcoder-speedrun`),
		admins: [HAKATASHI],
		authors: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				isMain: true,
				url: 'https://kenkoooo.com/atcoder/#/contest/show/1021f8c4-0255-4398-847b-b9482005616b',
				label: '競技ページ',
			}
		],
		scoreConfiguration: {
			type: 'score',
			scoreWeight: 0.1,
		},
		description: stripIndent`
			# 実施概要

			* AtCoderのバーチャルコンテストを用いた、競技プログラミングの早解きコンテストです。
			* 競技に参加するにはAtCoderアカウントおよび AtCoder Problems アカウントが必要です。
			* 問題セットは 100-100-200-200-300-300-400-400 です。

			## 🔰初心者向けヒント

			* **プログラミング**が初めての場合は [AtCoder Programming Guide for beginners](https://atcoder.jp/contests/apg4b) で事前に学習しておきましょう。
			* **競技プログラミング**が初めての場合は [AtCoder Beginners Selection](https://atcoder.jp/contests/abs) で事前に練習しておきましょう。
					* ここまでできたなら当日1、2問は必ず解けるはずです！

			# ルール

			* 競技は外部サイトの AtCoder Problems 上で行われます。あらかじめリンク先を確認し「Join」しておいてください。
			* 競技が始まったら問題リストが公開されるので、指定された問題を解いて、AtCoderに提出してください。

			以下の行為は禁止です。

			* 過去の自分や他人の提出を読んだり、コピーする行為
			* 問題文の内容を処理することにより、プログラムの入出力以外の部分を自動生成して提出する行為

			# 獲得得点の計算方法

			* 時間内に獲得した問題の合計得点の10分の1がこの競技の獲得得点になります。
			* ペナルティはありません。また、最終提出時刻は競技点数には影響しません。
		`,
		// @ts-expect-error:
		endAt: new Date('2023-04-15T16:30:00+0900'),
		tiebreakOrder: 'asc',
	});

	await upsertGame({
		// @ts-expect-error:
		athlon: db.doc('athlons/2023'),
		configuration: {},
		maxPoint: 100,
		maxRawScore: 200,
		scoreInputNote: '結果ページのCertificateに書かれているWPMの値を入力してください。',
		isScoreUserEditable: true,
		weight: 1,
		order: 7,
		// @ts-expect-error:
		rule: db.doc('gameRules/typing-english'),
		admins: [HAKATASHI],
		authors: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: '競技ページ',
				url: 'https://www.typingtest.com/test.html?minutes=3&textfile=certificate.txt&mode=sent&result_url=certificate.html&bt=0',
				isMain: true,
			},
		],
		scoreConfiguration: {
			type: 'score-and-rank',
			scoreWeight: 50 / 120,
			rankRatio: 0.5,
			rankWeight: 2,
		},
		description: stripIndent`
			# 実施概要

			* 英語タイピングの速度を競います。
			* 競技にはtypingtest.comの「Certificate」モードを使用します。このモードで3分間タイピングを行い、WPMの高い順にスコアをつけます。
			* **typingtest.comのトップページからではなく、必ず「競技ページ」のリンクからアクセスしてください。**
			* WPMとは結果ページに表示されている 「Net Speed」の欄の値のことを指します。
				![](https://user-images.githubusercontent.com/3126484/232177621-531bbc15-0ced-4c4b-8a56-57fe4908fe01.png)

			# ルール

			* あらかじめ競技ページを開いておいてください。DiscordやSlackで競技開始の合図を出すので、全員で同時に競技をスタートしてください。
			* 競技は一発勝負です。トラブルの場合などを除き、競技のやり直しは許可されません。
			* 競技時間が3分であれば、競技開始の遅れは問題ありません。

			# 獲得得点の計算方法

			* 配点は素点が50点、順位点が50点の100点満点です。
			* 素点は WPM / 120 * 50 点です。ただし50点を超えた場合は50点に揃えられます。
			* 順位点は 50 × 2/(順位+1) 点です。 (1-indexed)
				* 素点の高い順に順位がつきます。
		`,
		endAt: null,
		tiebreakOrder: 'asc',
	});

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/2023'),
			configuration: {
				duration: 600000,
				...{
					enabled: false,
					correctText: '',
					textUrl: 'about:blank',
				},
				...{
					enabled: true,
					correctText: stripIndent`
						　インド料理のパンといえば、まず最初にナンを思い浮かべる人が多いかもしれません。ですが、インドには数多くの種類のパンが存在しています。代表的なものには、チャパティと呼ばれる薄焼きのパンがあります。チャパティは、アーターという全粒粉に水を加えて生地を作り、発酵させずに十数分ほど休ませ、薄い円形にのばして焼いたものです。このパンはインドでは一般的な朝食のメニューであり、多くの家庭で日常的に食べられているそうです。また、チャパティをアレンジした料理もたくさんあり、例えば、プーリーという、薄い円形にのばしたチャパティの生地を油で揚げたものや、パラーターという、生地に何度も油を塗って折り畳むことを繰り返し、薄くのばしてから焼いたり、茹でたジャガイモなどの野菜や刻んだ青唐辛子などのスパイスを混ぜてから少量の油で焼いたものなどがあります。これらは、お店などで食べることもできますし、自分で作ることも可能だそうです。
						　ちなみに、日本で最初に誕生したとされるインド料理店は、１９４９年に銀座にオープンした「ナイルレストラン」であるといわれており、この店をきっかけとして、現在では日本各地にたくさんのインド料理店が誕生しています。こうした日本のインド料理店でよく食べられているナンは、生地をタンドールの内側に張り付けて焼いて作られます。そのような大きなタンドールを持つ家庭は少ないうえ、精製した小麦粉を用いるため、インドではナンは高級品とされています。そのため、少しの燃料とタワーがあればすぐに焼けるチャパティのほうが一般的なようです。また、屋外に器具と粉、水を携行し、出先で燃料を集めればどこでも焼きたてのチャパティを食べられるため、遊牧民の主食としても重宝されているそうです。
						　ところで、インドの食文化を語るうえで欠かせないのがカレーです。カレーはインドを代表する人気の料理であり、さまざまな香辛料で味付けされた煮込み料理の総称です。日本では、カレーをスプーンで食べるのが一般的ですが、インドでは、基本的に道具を使わず、手づかみで料理を食べます。また、食事の際には右手しか使わないのがマナーとされています。なぜかというと、インドでは、右手を「浄」、左手を「不浄」と考える慣習があるからです。また、他人が口をつけたものも不浄とされますので、旅行や出張などでインドへ行く場合は気を付けておいたほうがいいかもしれません。
						　このように、インドの食生活は、非常に独特で、興味深い文化が根付いています。わたしも、機会があったらぜひ食べてみたいと思います。
						　日本人にとってなじみ深い食材である海藻には、大きく分けて３つの種類があります。これらは色の違いによって分けられており、緑色をした緑藻、黄褐色をした褐藻、赤っぽい色の紅藻の３つに分類されます。海藻の色の違いは、海藻の生えている場所の水深、つまり太陽の光が届く量によって左右され、浅瀬になるほど地上の植物に近い色、つまり緑色になり、深くなるにつれて順に褐色、紅色へと変化するのです。これらの海藻のうち、日本で主に食用とされているのは、二番目の褐藻類です。ここに分類される、昆布やわかめ、もずく、ひじきなどは、日本だけでなく世界中で広く親しまれています。
						　中でも昆布は、古くから人々に愛されてきました。縄文時代の遺跡からも、昆布を使ったとみられる土器が発見されています。中世の日本では船による交易が盛んとなり、日本のさまざまな場所で昆布が食べられるようになりました。特に大阪で熟成された昆布は渋みがなく、風味豊かでおいしいといわれ、江戸時代には昆布といえば大阪の味として全国に知れ渡っていたようです。これは、乾燥させた昆布を湿気の多い大阪で倉庫に寝かせたため、熟成することでうま味や甘さが引き出されたからだと考えられています。江戸時代になると、鰹節とともに、だしをとるための調味料として使われることも多くなり、現在でも昆布は日本人の食卓には欠かすことのできない大切な食品となっています。
						　ところであなたは、なぜ昆布がおいしいのか考えたことがあるでしょうか。実は、昆布のうま味の成分は、グルタミン酸というアミノ酸の一種なのです。このアミノ酸は、鰹節に含まれるイノシン酸と並んで、和食には欠かせないものです。おでんや味噌汁などを食べて、何ともいえない深みやまろやかな味わいを感じることがありますが、それはこのグルタミン酸が関与しているからなのです。グルタミン酸は、脳の神経伝達物質の原料となるほか、血圧を下げる作用もあるといわれ、健康に良いといわれています。また、昆布に含まれているフコイダンには抗ガン効果があることが知られており、その他にもコレステロールの低下や抗ウイルス作用など、様々な効能が期待できます。最近ではサプリメントなどでも売られるようになり、手軽に摂取できるようになってきていますので、興味のある方は試してみてはいかがでしょうか。
						　幽霊について語られることは、多くの人々にとって不気味なものとなるでしょう。しかし、幽霊という存在は、時代や地域によってそのイメージや認識が異なっているといわれています。例えば、日本では幽霊というと白い着物を着た女性の姿が思い浮かびますが、アメリカでは幽霊といえばシーツをかぶった姿が一般的です。このように、幽霊のイメージは文化や伝統によって大きく異なっています。日本においては、幽霊に対する信仰や恐怖心が非常に強く、それが現代に至るまで受け継がれています。神社やお寺、墓地などでは、幽霊が出現するとされる場所があります。また、盆やお彼岸のような季節には、先祖の霊を迎えるためのお墓参りが行われます。こうした風習は、幽霊という存在を我々の身近に感じさせる一方で、この世ならざるものの存在をよりいっそう強調する結果になっているといえるかもしれません。ですが、幽霊にはどこか不思議な魅力があります。映画や小説、漫画などの作品には、幽霊を題材にしたものが数多く存在します。現代では科学技術の発展により、幽霊の存在を否定する説も根強くありますが、人々が信じるものや恐れるものは、科学的な根拠があるかどうかに関係なく存在するものです。そのため、幽霊という存在が人々の心に残り続けることには変わりがないのかもしれません。
						　幽霊に関する都市伝説で最も有名なものは、学校の怪談だと思います。あなたも、学校にまつわる怖い話を聞いたことがあるはずです。たとえば、夜中に音楽室の前を通るとピアノの音が聞こえたり、理科室の人体模型が勝手に動いたりするという話などが有名でしょう。こういった話は、おそらく学校に通う子どもたちの間で広まったものと思われますが、大人になった今でもこれらの話を覚えている人は少なくないのではないでしょうか。現在では、インターネットの普及に伴い、インターネット上で広まる都市伝説もあるそうです。わたしは、残念ながらそうした都市伝説については詳しくありませんが、もし興味があればぜひ調べてみるといいかもしれません。
						　最近では、幽霊に対してポジティブなイメージを持つ人々も増えています。例えば、幽霊が出現するとされる場所を訪れるツアーが開催されたり、心霊スポットと呼ばれる場所に肝試しに行く若者たちが増えたりしています。また、幽霊をモチーフにしたグッズやファッションも人気があります。こうした現象は、幽霊という存在が、単なる恐怖対象からある種のエンターテイメントへと変化したことを示しているといえるのではないでしょうか。わたしたちは、時に科学では解明できない不思議さや神秘性に惹かれてしまうものですが、幽霊もそうした性質を持っているのかもしれません。
					`,
					textUrl: 'https://firebasestorage.googleapis.com/v0/b/tsg-decathlon.appspot.com/o/assets%2Ftyping-japanese%2Ftyping-japanese_2023_9ff6b91de5a83cb0eabbdda8f5a717a2.pdf?alt=media&token=bcda8057-d80c-4787-ab0e-4f0b37d3b642',
				},
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 8,
			// @ts-expect-error:
			rule: db.doc('gameRules/typing-japanese'),
			authors: [],
			admins: [HAKATASHI],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'max-ratio',
			},
			description: stripIndent`
				# 実施概要

				* 日本語タイピングの速度を競います。この競技のルールは概ね[「文章入力スピード認定試験」](https://www.goukaku.ne.jp/test_pcspeed.html)のルールに準拠しています。
				* 競技ページにアクセスし、競技開始時刻になると開始ボタンが表示されます。好きなタイミングで開始ボタンをクリックし、競技を開始してください。
				* ゲームが開始すると画面左側にPDFが表示されます。PDFに記載されている文章を右側の入力エリアに正しく入力していってください。

				# ルール

				* 競技時間は開始ボタンを押してから10分間です。
				* 競技中は、打鍵によって文字を入力するものであればどのようなツールを使っても構いません。
					* つまり、キーボード配列やIMEの種類に制限はありません。
				* 競技中に他のウェブサイトを開いたりしても構いませんが、コピーアンドペーストで文字を入力するなどの行為は禁止です。

				# 獲得得点の計算方法

				* 時間内に正しく入力できた文字数が素点となります。
				* 参加者の中で最も高い素点を100点としたときの点数が各参加者の獲得得点となります。

				## 素点の計算方法

				「入力した文字列」と「正解文字列」に以下の正規化を順番に施したものをそれぞれ【入力】と【正解】とする。

				1. [NFKC正規化](https://ja.wikipedia.org/wiki/Unicode%E6%AD%A3%E8%A6%8F%E5%8C%96#%E6%AD%A3%E8%A6%8F%E5%8C%96%E5%BD%A2%E5%BC%8F)
				2. 「,」を「、」に、「.」を「。」に変換する
				3. [空白文字](https://developer.mozilla.org/ja/docs/Glossary/Whitespace#javascript_%E3%81%A7%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)の除去

				【入力】と【正解】の最長共通部分文字列を計算し、共通部分文字列の長さから【入力】で余分に挿入されている文字列の長さを引いたものを「正しく入力できた文字数」とする。

				### わかりやすい説明

				* 余分に挿入された改行や空白などはスコアに影響を及ぼしません。
				* 不足している改行や空白などもスコアに影響を及ぼしません。
				* 全角数字を半角で打ち込んでもスコアに影響を及ぼしません。
			`,
			tiebreakOrder: 'asc',
			// @ts-expect-error:
			endAt: new Date('2023-04-01T13:00:00+0900'),
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/typing-japanese?gameId=${gameRef.id}`,
			}],
		});
	}

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/2023'),
			configuration: {
				...{
					enabled: false,
					judgeType: 'ignore-whitespaces',
					description: '',
					testcases: [
					],
				},
				...{
					enabled: true,
					judgeType: 'ignore-whitespaces',
					description: stripIndent`
						## 課題

						11桁の数が64個与えられます。それぞれの数字について、奇数桁目の数字の合計と偶数桁目の数字の合計が等しい場合は \`Yes\` を、等しくない場合は \`No\` を出力してください。

						## ルール

						* 入力の改行コードはLF (U+000A) です。
						* 入力の最後には改行が与えられます。
						* 出力に含まれる空白文字は無視されます。
						* 提出には15秒のクールタイムが存在します。
						* 今回の提出システムでは提出されるコードはUTF-8として有効な文字列である必要があります。

						## ローカルでの実行

						たとえばC言語について、実行したいファイルがカレントディレクトリの \`code.c\` にあるとすると、

						\`\`\`
						docker pull esolang/c-gcc

						# Mac / Linux
						docker run --rm -v \`pwd\`:/code esolang/c-gcc script /code/code.c

						# Windows
						docker run --rm -v %CD%:/code esolang/c-gcc script /code/code.c
						\`\`\`

						でリモートと同じ環境で実行することができます。

						Dockerイメージの詳細は [esolang-box](https://github.com/hakatashi/esolang-box) を参照してください。
					`,
					testcases: [
						{
							input: `${stripIndent`
								69113343277
								72052798631
								69220499612
								27105220054
								33775857456
								50754804595
								78591284430
								87323975283
								64882792004
								97216091029
								18571678939
								28385208575
								26817715182
								60777633180
								10401732119
								25865787678
								32107610595
								20729489158
								87830455493
								38516732240
								52764215757
								80601689394
								86072825421
								98671146596
								89409783874
								46112971344
								30522972759
								70796268128
								37865849650
								78429518640
								17055521978
								24375105854
								90009420362
								55812457697
								91044026381
								24047418978
								97921748881
								65273630015
								92611778563
								29618339300
								29785254455
								86765670214
								53599178135
								69495511778
								33583796809
								35771620655
								45120974466
								52271097153
								43533653592
								23567649842
								70379953514
								38619240010
								56860559855
								66034078165
								29479863639
								27188301855
								69768744419
								31024752877
								15057973502
								38794420456
								11786904239
								36385700252
								70464541028
								35841697272
							`}\n`,
							output: `${stripIndent`
								Yes
								Yes
								Yes
								Yes
								Yes
								Yes
								No
								No
								No
								No
								Yes
								No
								No
								Yes
								No
								No
								No
								No
								Yes
								No
								No
								No
								No
								Yes
								No
								Yes
								No
								No
								No
								Yes
								Yes
								Yes
								No
								No
								Yes
								Yes
								Yes
								Yes
								No
								Yes
								Yes
								No
								No
								Yes
								No
								No
								No
								Yes
								Yes
								Yes
								No
								No
								Yes
								Yes
								No
								Yes
								No
								No
								Yes
								Yes
								Yes
								No
								No
								No
							`}\n`,
						},
						{
							input: `${stripIndent`
								55868167852
								43845647780
								22482573377
								39943883065
								39386370012
								59421399009
								64906699490
								86531737611
								92450386556
								26567928706
								62279703013
								10170188864
								23745827721
								22441387694
								28450359670
								96185861871
								18848878047
								23740107929
								36689658378
								32474341493
								10275353213
								89553369433
								74897085688
								37763411169
								55572088384
								12711186541
								67108958887
								66484217008
								32460718576
								84700159892
								95664986131
								24012724835
								53896748565
								77910807139
								48595036974
								52336822586
								50248789768
								17717122093
								47773928913
								11232630850
								40399431778
								33683340388
								22762940261
								13446479266
								45705654841
								61961327494
								14855345805
								23057319615
								52956905793
								10942910603
								16825559080
								42167191392
								90055109287
								31472243594
								72370393590
								53130204721
								60352160181
								71125395767
								28641059804
								37020668156
								48748169993
								27740483078
								86160599437
								77136165289
							`}\n`,
							output: `${stripIndent`
								No
								Yes
								Yes
								No
								Yes
								No
								No
								Yes
								No
								Yes
								Yes
								Yes
								Yes
								Yes
								No
								Yes
								No
								No
								No
								Yes
								No
								Yes
								No
								Yes
								No
								No
								No
								Yes
								No
								No
								Yes
								Yes
								Yes
								Yes
								Yes
								No
								No
								Yes
								No
								No
								No
								No
								No
								Yes
								No
								Yes
								No
								Yes
								Yes
								No
								No
								No
								Yes
								Yes
								Yes
								Yes
								No
								No
								No
								No
								No
								Yes
								Yes
								No
							`}\n`,
						},
						{
							input: `${stripIndent`
								99999999999
								10000000000
								90909090909
								19090909090
								12345678950
								80708080718
								19090919090
								99999999990
								89796989898
								31415926535
								31300494679
								55050043444
								66571202511
								46292520967
								80925620230
								66126716954
								16178555253
								75443613773
								21061989003
								65404783921
								92540832780
								80101750080
								96405340156
								25891340442
								69352257348
								85914314772
								33502788500
								59144857574
								90959205009
								81251705777
								85674949107
								19497529401
								38113688414
								27222397763
								47459212196
								30130436567
								17429455643
								24924889888
								87191149770
								67629646293
								78383327269
								60100756001
								51740130013
								53853063744
								79137897795
								49952494587
								28776255804
								84332361080
								12661021384
								11114600194
								92381541137
								36539500184
								95000764331
								43797952575
								80283357826
								46390550459
								52865132482
								94940408233
								61327039715
								27471530132
								65288321021
								85323022022
								18799375155
								11480163277
							`}\n`,
							output: `${stripIndent`
								No
								No
								No
								No
								Yes
								No
								No
								Yes
								Yes
								No
								No
								Yes
								Yes
								Yes
								No
								No
								No
								Yes
								No
								No
								Yes
								Yes
								No
								Yes
								Yes
								No
								No
								No
								No
								Yes
								Yes
								No
								No
								Yes
								Yes
								Yes
								No
								No
								No
								Yes
								No
								Yes
								No
								No
								Yes
								No
								No
								Yes
								Yes
								No
								No
								Yes
								Yes
								No
								No
								Yes
								No
								Yes
								No
								No
								Yes
								No
								Yes
								Yes
							`}\n`,
						},
					],
				},
				languages: [
					{
						id: 'c-gcc',
						label: 'C言語',
					},
					{
						id: 'python3',
						label: 'Python3',
					},
					{
						id: 'anything',
						label: '任意言語',
					},
				],
			},
			maxPoint: 200,
			maxRawScore: 200,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 9,
			// @ts-expect-error:
			rule: db.doc('gameRules/codegolf'),
			authors: [],
			admins: [HAKATASHI],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'score',
				scoreWeight: 1,
			},
			description: stripIndent`
				# 実施概要

				* コードゴルフを行います。コードゴルフは、与えられた処理を実行するプログラムを可能な限り短く書く、という競技です。
				* 競技ページにアクセスし、競技開始時刻になると、ルールと問題が表示されます。
				* ソースコードは複数回提出することができます。

				## 🔰初心者向けヒント

				* 当日は「C言語」「Python」の2言語が必須言語枠として出題されます。これらの言語を書けるようになっておくと、当日少なくとも得点を獲得することができるでしょう。
				* コードゴルフ用のテクニックを学ぶと、勝てる確率が上がります。学ぶための資料として、以下のようなページが参考になりそうです。
					* [コードゴルフ Wiki - yukicoder](https://yukicoder.me/wiki/golf)
					* [C 言語でのコードゴルフに関するメモ(随時更新)](https://gist.github.com/lpha-z/d811a975b0acd5c17493)
					* [Python ゴルフテク(AtCoder) - Qiita](https://qiita.com/c_r_5/items/bcf069487cb0060c39f2)
				* TSGでは過去にコードゴルフ大会を何度も開催しており、その時提出されたコードの解説が[Wiki](https://github.com/hakatashi/esolang-battle/wiki)にまとめられています。参考になるテクニックがたくさん掲載されているので、読んでおくと良いかもしれません。

				# ルール

				* このコードゴルフ競技は個人戦です。他の人と協力して解くことは禁止されています。

				# 獲得得点の計算方法

				* このコードゴルフ競技では複数の言語による種目が行われます。獲得得点はそれぞれの言語ごとに計算され、その合計がこの競技での獲得点数となります。
				* それぞれの言語における満点は 200 ÷ [言語の数] 点です。
				* それぞれの言語について、課題を解く全プレイヤーで最も短いコードを提出したプレイヤーは満点を獲得します。
				* 課題を解くコードを提出した他のプレイヤーは、満点 × [全プレイヤーで最も短いコードの長さ] ÷ [自分が提出した最も短いコードの長さ] を獲得します。
				* この競技における満点は200点ですが、必ずしも200点を獲得するプレイヤーがいるとは限らないことに注意してください。
			`,
			// @ts-expect-error:
			endAt: new Date('2023-04-15T18:00:00+0900'),
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/codegolf?gameId=${gameRef.id}`,
			}],
		});
	}

	await upsertGame({
		// @ts-expect-error:
		athlon: db.doc('athlons/2023'),
		configuration: {},
		maxPoint: 100,
		maxRawScore: 100,
		scoreInputNote: '競技ページ上で最終結果として表示されている点数を入力してください',
		isScoreUserEditable: true,
		weight: 1,
		order: 10,
		// @ts-expect-error:
		rule: db.doc('gameRules/sandbox-quiz'),
		admins: [HAKATASHI],
		authors: [],
		adminBonus: {
			type: 'topPlayer',
			count: 5,
		},
		links: [
			{
				label: 'サンプル問題',
				url: 'https://qalive.app/user/live/v1iz13c62jcxiv4yuj068cbbrxd9xp9tyea00h097omya76d?quizid=bfc1mczkkcofp9uy7pztk4efa6n8j9s2mzz79rsv337ghymu&playmode=archive',
				isMain: false,
			},
			{
				label: '競技ページ',
				url: 'https://qalive.app/user/live/0svu3ejpwn5xog5sehhe1o31f4rki5mgw5mj2sck31rl4jja?quizid=huei6dbh6ne9eqyufn8st2d2y8uxlzgd7zhw3blqqadexe7y',
				isMain: true,
			},
		],
		scoreConfiguration: {
			type: 'max-ratio',
		},
		description: stripIndent`
			# 実施概要

			* TSGのSlackのsandboxを生き抜くのに必要な能力を競います。

			## 🔰初心者向けヒント

			* sandboxゲームに慣れ親しんでおくと良いかもしれません。

			# ルール

			* 競技はQALive上で行います。事前に競技ページを開いて、競技開始まで待機してください。
			* 詳しいルールは当日アナウンスします。

			# 獲得得点の計算方法

			* QALive上に最終結果として表示された得点が素点となります。
			* 参加者の中で最も高い素点を100点としたときの点数が各参加者の獲得得点となります。
		`,
		endAt: null,
		tiebreakOrder: 'asc',
	});

	await (db.doc('athlons/2024') as DocumentReference<Athlon>).set({
		startAt: new Date('2024-04-14T13:00:00+0900'),
		endAt: new Date('2033-04-14T19:00:00+0900'),
		description: stripIndent`
			TSG十種競技は、TSGに関連する競技を1日で10種類行い、その総合得点でTSGの王者を決めるイベントです。

			1競技だけの参加なども歓迎です。時間が合えばぜひ参加してください！

			[参加者用マニュアル](https://github.com/hakatashi/decathlon/wiki)

			# ️タイムスケジュール (暫定)

			* 13:00-13:15 イベントの説明など
			* 13:15-15:45 **第1～5競技 CTF + diff + 量子コンピューティング**
				* CTF (Pwn), CTF (Web), CTF (Crypto), diff, 量子コンピューティング を同時に開催します
			* 16:00-16:20 **第6競技 ITクイズ**
			* 16:30-17:00 **第7競技 競プロ早解き**
			* 17:00-17:30 ITクイズ 採点結果発表&解説
			* 17:30-17:45 **第8競技 タイピング (日本語)**
			* 17:45-18:15 **第9競技 コードゴルフ**
			* 18:10-18:45 **第10競技 プロンプトエンジニアリング (鑑賞会)**
			* 18:45-19:00 結果発表
		`,
		id: '2024',
		name: 'TSG十種競技2024',
		ranking: [],
	} as FirestoreDoc<Athlon>, {merge: true});

	await db.collection('gameRules').doc('quantum-computing').set({
		name: '量子コンピューティング',
		icon: 'soccer',
		description: '量子コンピューターのプログラミング能力を競う競技',
	});

	await db.collection('gameRules').doc('prompt-engineering').set({
		name: 'プロンプトエンジニアリング',
		icon: 'sumo',
		description: 'AIにタスクを実行させる時のプロンプトをチューニングする能力を競う競技',
	});

	{
		const gameRef = await upsertGame({
			// @ts-expect-error:
			athlon: db.doc('athlons/system-test-2'),
			configuration: {
				enabled: true,
				judgeCode: stripIndent`
					import pennylane as qml
					import pennylane.numpy as np

					test_cases = [
					    (1.23456, 0.9440031218347901),
					    (2.957, 0.1835461227247332)
					]

					def check() -> None:
					    for input, expected in test_cases:
					        dev = qml.device('default.qubit', wires=1)

					        @qml.qnode(dev)
					        def test_circuit():
					            from circuit import circuit
					            circuit(input)
					            return qml.expval(qml.PauliX(0))

					        result = test_circuit()
					        assert len(test_circuit.tape.operations) <= 3, "量子ゲートは3個まで使用可能です"

					        assert np.isclose(result, expected), f"残念！ (result = {result}, expected = {expected})"

					if __name__ == "__main__":
					    check()
					    print("CORRECT")
				`,
				description: stripIndent`
					Pythonプログラムを記述し、\`circuit\` 関数を定義してください。この関数では以下の量子回路を設計してください。

					※参考: [Returning expectation values | PennyLane Challenges](https://pennylane.ai/challenges/returning_expectation_values/)

					## 入力

					* 引数として、float値 \`angle\` が与えられます。この実数は0以上pi未満の任意の値です。

					## 実装

					* 量子ビットをy軸を中心にangleだけ回転する量子回路を設計してください。

					## 制約

					* 量子ゲートは3個まで使用可能です。
				`,
				submissionTemplate: stripIndent`
					import pennylane as qml

					def circuit(angle: float) -> None:
					    pass
				`,
			},
			maxPoint: 100,
			maxRawScore: 100,
			scoreInputNote: '',
			isScoreUserEditable: false,
			weight: 1,
			order: 4,
			// @ts-expect-error:
			rule: db.doc('gameRules/quantum-computing'),
			admins: [HAKATASHI],
			authors: [],
			adminBonus: {
				type: 'topPlayer',
				count: 5,
			},
			links: [],
			scoreConfiguration: {
				type: 'timestamp',
				attenuationFactor: 0.99,
			},
			description: stripIndent`
				# 実施概要

				* 量子コンピューティングの能力を競う競技です。
				* 指定された課題をこなすことができる量子回路を組み、Pythonコードとして提出することができればクリアとなります。

				## 🔰初心者向けヒント

				* この競技ではプログラミング言語[Python](https://www.python.org/)と、[pennylane](https://pennylane.ai/)という量子コンピューティングのライブラリを使用します。事前にこれらが使用できる環境を整えておくことで当日のデバッグが容易になるでしょう。
				* この競技で出題される量子回路はごく基本的なものです。事前に量子コンピューターの基礎を抑えておくだけでも得点できる可能性が高まるでしょう。
				* 教材としては以下のようなものがおすすめです。
					* https://dojo.qulacs.org/ja/latest/index.html

				# ルール

				* 競技時間が開始すると、競技サイト上に問題が1問出題されます。指示に従ってPythonのコードを提出してください。

				# 獲得得点の計算方法

				* 提出が早い順番に順位が付きます。
				* 問題が解けた場合、この競技の獲得得点は 100 × 0.99 ^ [提出順位 (0-indexed)] 点です。
				* 問題が解けなかった場合、この競技の獲得得点は0点となります。

				# 関連Slackチャンネル

				* **#sig-qcon**: TSGでは量子系のコンテストに参加しています。TSGとしてチーム戦に参加することもあるので、初心者の人も経験者の人も気軽に覗いてみてください!
			`,
			endAt: null,
			tiebreakOrder: 'asc',
		});

		await gameRef.update({
			links: [{
				isMain: true,
				label: '競技ページ',
				url: `/arenas/quantum-computing?gameId=${gameRef.id}`,
			}],
		});
	}
})();
