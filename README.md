# よもじ

ひらがな4文字を一文字ずつ止めるスロットゲームです。辞書にある語を図鑑に集めます。Firebase Authentication でメール登録すると、図鑑、回転数、お気に入りを Realtime Database に保存します。公開プロフィールから他の人の収集数・回転数・お気に入り・図鑑を見られます。

公開: https://nosuke1729.github.io/fourletter/

## 開発

```bash
npm ci
npm run dev
npm run build
```

`src/firebase-config.json` は Firebase Console の Web アプリ設定です。これは公開用の識別情報です。サービスアカウント鍵・管理者トークンは入れません。設定が空ならゲストモードになります。ゲスト記録はブラウザーの `localStorage` に保存し、登録後の記録とは別です。

## Firebase

プロジェクト `fourletter` は無料の **Spark プラン**を使用します。メール・パスワード認証と Realtime Database（シンガポール）を使用し、Cloud Functions や有料プランは使いません。Spark のデータベース枠は同時接続100、保存1GB、ダウンロード10GB/月です。枠を超えるとサービスが制限されるため、規模に応じて使用状況を確認してください。料金: https://firebase.google.com/pricing

再構築する場合:

1. Firebase Console で Web アプリを登録し、その設定と実際の `databaseURL` を `src/firebase-config.json` に記入します。
2. Authentication のメール・パスワードを有効にし、承認済みドメインに `nosuke1729.github.io` を追加します。
3. Realtime Database をロックモードで作成します。
4. `npm run export:dictionary-firebase` で生成した JSON を **`/catalog` のみ**にインポートします。ルートを置き換えないでください。
5. `database.rules.json` をルールエディタで公開します。Firebase CLI にログイン済みなら `npx firebase deploy --only database --project fourletter` でも適用できます。

公開データは表示名、ユーザーID、回転数、収集数、結果、お気に入り、収集語と日時です。メール・パスワードは Authentication だけで管理します。各ユーザーは自分の記録のみ書き込めます。辞書一致、図鑑追加とカウンターの整合性、お気に入りの所有、最短500msの回転間隔をデータベース側で検証します。

**抽選はブラウザーの Web Crypto で行います。** 約32%で辞書語を選び、残りは46文字から4文字を選びます。偶然の一致も収集されます。無料構成では抽選の公平性をサーバーで保証していないため、改造クライアントによる辞書語の選択までは防げません。対戦・賞品・厳密なランキングには信頼できるサーバーでの抽選が必要です。

## 保存ルールのテスト

Java 21 以上を用意し、`npm run test:rules` を実行します。`demo-fourletter` のエミュレーターで実行し、本番データには接続しません。通常の保存、再発見、お気に入り、他人への書き込み拒否、偽カウント、未収集語、削除拒否を検証します。

ローカルの画面もエミュレーターに接続する場合は `.env.example` を `.env.local` にコピーし、`npx firebase emulators:start --project fourletter --only auth,database` と `npm run dev` を起動します。辞書判定用の `/catalog` をエミュレーターにも読み込んでください。

## ことばの追加

公開版の候補は **31,428語**です。うち31,426語は [EDRDG の JMdict](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) の2026-09-30版から「読みがひらがな4文字」の見出しを抽出し、同音の見出しを一つにまとめています。内容による除外はしていません。代表表記と英語グロスを表示します。JMdict 由来のデータは CC BY-SA 4.0 です。[出典・利用条件](DICTIONARY-LICENSE.md)を確認してください。

別途11語は岩波書店の[広辞苑第七版の紹介](https://kojien.iwanami.co.jp/feature/)、[CASIO](https://www.casio.com/jp/exword/student/junior-high-school/features/search/)・[SHARP](https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf)の広辞苑検索例で確認したものです。そのうち9語は JMdict と重なります。JMdict の全見出しが広辞苑にあるという意味ではありません。広辞苑の本文・語釈は収録していません。

毎月 `npm run update:dictionary` を実行し、差分を確認して公開します。`npm run export:dictionary-firebase` を実行し、同じ候補を Firebase の `/catalog` にインポートしてください。既存の収集記録は変更しません。候補から消えた見出しはアプリの図鑑に表示されなくなるため、更新時に扱いを確認してください。

## 公開

Vite は GitHub Pages の `/fourletter/` に設定済みです。`main` に push すると GitHub Actions が `dist` をビルドして公開します。Pages の Source は **GitHub Actions**です。Firebase の接続設定は公開設定ファイルから読み込むため、GitHub のシークレット設定は不要です。
