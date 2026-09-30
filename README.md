# よもじ

ひらがな4文字を一文字ずつ止めるスロットゲームです。辞書にある語に出会うと図鑑に記録されます。Supabase Auth で登録すると、図鑑、回数、おきにいりがクラウドに保存され、ほかの人もプロフィールを見られます。

## 開発

```bash
npm ci
npm run dev
```

Supabase の設定がない場合はゲスト用のおためし版として動き、記録はそのブラウザーの `localStorage` に残ります。公開プロフィールとクラウド保存は使えません。

## Supabase

1. 専用プロジェクトで [`database/schema.sql`](database/schema.sql) を適用します。
2. `npm run export:dictionary-sql` で `public/catalog.json` から SQL を生成し、表示されたディレクトリ内の `catalog-001.sql` から番号順に適用します。スキーマ内の広辞苑確認例11語は保持されます。
3. プロジェクトの URL と **publishable key** を `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` に設定します。`service_role` や secret key はブラウザーに渡さないでください。
4. Auth の URL Configuration で Site URL と Redirect URLs に `https://nosuke1729.github.io/fourletter/` を追加します。ローカルでメール確認を試す場合は `http://localhost:5173/fourletter/` も追加します。
5. Email provider を有効にします。メール確認をオンにする場合、利用者は確認リンクから登録を完了します。

スロットの結果、回数、図鑑への追加は `spin_four_letters` RPC がデータベース内で決めます。クライアントが結果や回数を書き換える API はありません。ことばになる抽選確率は約32%。それ以外は46文字からそれぞれランダムに選ぶため、偶然の一致が加わる場合があります。

## ことばの追加

公開版の候補は **31,428語** です。うち31,426語は [EDRDG の JMdict](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) の2026-09-30版から「読みがひらがな4文字」の見出しを抽出し、同音の見出しを一つにまとめたものです。内容による除外はしていません。代表表記と英語グロスを表示します。JMdict 由来のデータは CC BY-SA 4.0 です。[出典・利用条件](DICTIONARY-LICENSE.md)を確認してください。

別途11語は、岩波書店の[広辞苑第七版の紹介](https://kojien.iwanami.co.jp/feature/)と、[CASIO](https://www.casio.com/jp/exword/student/junior-high-school/features/search/)・[SHARP](https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf)の広辞苑検索例で個別に見出しを確認したものです。そのうち9語は JMdict と重なります。JMdict の全見出しが広辞苑にもある、という意味ではありません。広辞苑の本文・語釈は収録していません。

JMdict の更新は毎月 `npm run update:dictionary` を実行し、生成差分を確認して公開します。Supabase を使っている場合は同じスナップショットから SQL を再生成して適用します。既存の収集記録を守るため、更新時に DB の旧語は自動削除しません。更新の都度、候補から消えた見出しと DB に残った語の扱いを確認してください。

## 公開

Vite は GitHub Pages の `/fourletter/` パスに設定済みです。`main` に push すると GitHub Actions が `dist` をビルドして公開します。リポジトリの Settings → Pages → Build and deployment の Source は **GitHub Actions** にします。
