# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Slack ワークスペース(TSG)のメンバー。社内の競技会「Athlon」に参加し、競技中はリアルタイムに提出・スコア・順位を確認し、終了後はランキングや解説(Writeup)、過去の Athlon の結果を振り返る。
運営(admin)はゲーム・ルール・参考記録を管理し、公開前にプレビューする。

## Product Purpose
複数種目(codegolf、typing、SQL、reversing、bitflip procon、量子計算、プロンプトエンジニアリング、esolang など)で競う競技会「Athlon」を運営・参加するためのフルスタック Web アプリ。提出の実行・採点・ランキング算出を自動化し、結果をリアルタイムに表示する。

## Positioning
Slack メンバー限定の内輪の競技会に特化し、種目横断のランキングポイントと、AI エージェントなどの参考記録(「参考」バッジ。他参加者の順位には影響しない)を同じランキングに並べられる。

## Operating Context
- 認証は Firebase Auth + Slack OIDC。Slack チームのメンバーかどうかで利用資格を判定する。
- 提出は Firestore に書かれ、Cloud Functions と別リポジトリのワーカー(esolang-battle-2)が Docker で実行・採点し、フロントはリアルタイム購読で結果を表示する。
- ランキングは事前計算されて保存され、フロントは計算しない。
- 画面の名称は `getAthlonName(n)` で動的生成する(「Decathlon」「Heptathlon」など)。

## Capabilities and Constraints
- スタックは SolidStart + Solid.js、UI は SUID(Material Design)、スタイルは CSS Modules。データは Firestore を直接購読する。
- UI の言語は日本語。
- 主要画面: アリーナ(各種目の提出画面)、Athlon・ランキング、ルール(`/rules`)、ユーザー一覧・プロフィール(`/users`)、設定。
- 技術的な制約や運用ルールは `AGENTS.md` を参照する。

## Brand Commitments
特になし。名称・文言・認証方式は現状のコードを維持する。

## Evidence on Hand
README は未整備。ブランド資産やテスト用のユーザー声などは未確認で、捏造しないこと。

## Product Principles
- 競技中は、提出・実行結果・順位の状態が一目で分かることを最優先にする。
- リアルタイムに変わる情報(実行中、成功、失敗、順位変動)は、読み込み・エラー・空の状態まで含めて明確に示す。
- 終了後の振り返り(ランキング、Writeup、ユーザー履歴)は、種目をまたいで比較しやすくする。
- 参考記録は参加者の順位に影響しないことが、見た目からも誤解なく伝わるようにする。
