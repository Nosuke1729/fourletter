# よもじ

ひらがな4文字を一文字ずつ止めるスロットゲームです。確認済みの広辞苑見出し語に出会うと図鑑に記録されます。Supabase Auth で登録すると、図鑑、回数、おきにいりがクラウドに保存され、ほかの人もプロフィールを見られます。

## 開発

```bash
npm ci
npm run dev
```

Supabase の設定がない場合はゲスト用のおためし版として動き、記録はそのブラウザーの `localStorage` に残ります。公開プロフィールとクラウド保存は使えません。

## Supabase

1. 専用プロジェクトで [`database/schema.sql`](database/schema.sql) を適用します。
2. プロジェクトの URL と **publishable key** を `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` に設定します。`service_role` や secret key はブラウザーに渡さないでください。
3. Auth の URL Configuration で Site URL と Redirect URLs に `https://nosuke1729.github.io/fourletter/` を追加します。ローカルでメール確認を試す場合は `http://localhost:5173/fourletter/` も追加します。
4. Email provider を有効にします。メール確認をオンにする場合、利用者は確認リンクから登録を完了します。

スロットの結果、回数、図鑑への追加は `spin_four_letters` RPC がデータベース内で決めます。クライアントが結果や回数を書き換える API はありません。ことばになる抽選確率は約32%。それ以外は46文字からそれぞれランダムに選ぶため、偶然の一致が加わる場合があります。

## ことばの追加

初期の11語は、岩波書店の[広辞苑第七版の紹介](https://kojien.iwanami.co.jp/feature/)と、[CASIO](https://www.casio.com/jp/exword/student/junior-high-school/features/search/)・[SHARP](https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf)の広辞苑検索例で見出しを確認したものです。著作物である辞典本文や語釈は収録していません。`public.words` に4文字の読み、表記、独自の短い説明と確認資料 URL を追加すると、図鑑と抽選対象に反映されます。版によって見出しの読みが異なる場合があるため、追加時はその版の見出し語を確認してください。

## 公開

Vite は GitHub Pages の `/fourletter/` パスに設定済みです。`main` に push すると GitHub Actions が `dist` をビルドして公開します。リポジトリの Settings → Pages → Build and deployment の Source は **GitHub Actions** にします。
