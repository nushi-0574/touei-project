# Toei Project

東栄県ポータルのNext.jsアプリケーションです。Next.js 16、React 19、TypeScript、Tailwind CSS 4、Supabaseを使用しています。

## 開発環境

Node.jsとnpmをインストールし、依存関係を復元します。

```bash
npm ci
```

`.env.local` を作成し、SupabaseのプロジェクトURLと公開用anon keyを設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Service role keyなどの秘密鍵を `NEXT_PUBLIC_` 変数に設定したり、Gitへ登録したりしないでください。

Supabase AuthでGoogleプロバイダーを有効にし、ローカルおよび本番サイトの認証リダイレクトURLを登録してください。Discordプロバイダーは東栄アカウントへのログインには使用せず、ログイン後にマイページから任意連携する場合に有効化します。アプリが使用するデータテーブルとRLS（Row Level Security）ポリシーは、Supabase側で用意する必要があります。このリポジトリには既存テーブル全体のスキーマ定義はありません。画面で使用する主なテーブルは `profiles`、`site_settings`、`news_items`、`police_exam_results`、`custom_pages`、`main_menu_cards`、`billing_subscriptions` です。各テーブルでアプリが読み書きする列と、利用者・管理者それぞれのアクセス範囲を確認してから運用してください。特に `profiles.is_admin` の変更を一般利用者に許可しないでください。

警察官採用試験の公開照会では、受験者情報をテーブルから直接取得しないようにしています。デプロイ前に `supabase/migrations/20261106000000_lookup_police_exam_result.sql` を適用してください。照会には `police_exam_results` の `exam_number`、`birth_date`、`name`、`exam_name`、`result` 列が必要です。

## Stripe決済

Stripe Dashboardで定期プランのPriceを作成し、Customer Portalを有効化してから、次のサーバー専用環境変数を設定してください。価格はコードに埋め込まず、`STRIPE_PRICE_ID` で指定します。

```dotenv
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_URL=http://localhost:3000
```

本番の `APP_URL` にはHTTPSの公開URLを設定してください。Supabase Service role key、Stripe Secret key、Webhook secretを `NEXT_PUBLIC_` 変数にしたり、Gitへ登録したりしないでください。`supabase/migrations/20261107000000_billing_subscriptions.sql` を適用すると、契約情報の参照を本人のみに制限するテーブルが作成されます。WebhookだけがService role keyで契約状態を書き込みます。

Stripe DashboardにWebhookエンドポイント `${APP_URL}/api/billing/webhook` を登録し、`checkout.session.completed` と `customer.subscription.*` イベントを送信する設定にしてください。Checkout、契約状態同期、Customer Portalには、Stripe側で有効なPrice・Webhook・Customer Portalの設定と、環境変数の登録が必要です。

## 住民サービス・職員業務・採用・地図

デプロイ前に `supabase/migrations/20261107000100_resident_services.sql` を適用してください。申請、住民証、通知、イベント予約、住民コミュニティ、問い合わせ、職員権限、採用募集・応募、地図情報のテーブルとRLSが作成されます。デモ用の住民・施設・イベント・募集データは登録しません。

住民プロフィール、掲示板の表示名・プロフィールリンク、個人／グループチャットを有効にするには `supabase/migrations/20261107000500_resident_profiles_community_chat.sql` を適用してください。プロフィール画像は非公開のSupabase Storageバケットへ保存し、ログイン中の有効な住民向けの署名付きURLで表示します（JPEG・PNG・WebP、2MB以内）。公開プロフィールで他の住民に共有される情報は表示名、アイコン、自己紹介だけです。氏名、住所、生年月日、メールアドレスは公開プロフィールに含みません。掲示板投稿・コメントは既存の審査機能を維持します。チャットの会話とメッセージは参加者のみ閲覧でき、1グループ50人まで、本文は4000字までです。

住民を管理画面から追加するには `SUPABASE_SERVICE_ROLE_KEY` と `APP_URL` が必要です。Supabase Authの招待メール送信・SMTPを設定し、`APP_URL/toeiken/dashboard` を認証リダイレクト許可リストに含めてください。住民登録簿では既存情報を検索・確認でき、招待メールを送って新規アカウントを登録できます。住民を利用停止にすると住民向けデータへのアクセスもRLSで拒否され、再有効化すると利用を再開できます。生年月日・住所は機微な個人情報として取り扱い、適切な管理者・担当職員だけにアクセスを付与してください。

主任管理者は住民登録簿から、申請審査、イベント、通知、コミュニティ審査、問い合わせ、地図、採用の担当権限を職員へ付与できます。一般管理者は既存の管理者権限で全業務を管理できます。権限チェックはアプリ画面だけでなくSupabaseのRLSでも行われます。担当者の異動・退職時には不要な権限を解除してください。

住民サービスは `/toeiken/services`、採用情報・応募管理は `/recruitment`、施設地図は `/map` で利用できます。採用募集は管理者が応募期間、応募条件、採用条件、備考を登録して公開します。地図情報は管理者または地図管理権限を持つ職員が、地図上で座標を選択して追加・編集・公開・削除できます。

## セキュリティ運用

デプロイ前に `supabase/migrations/20261107000200_security_hardening.sql` を適用してください。主任管理者の権限はメールアドレスによる実行時判定ではなく、`profiles.is_super_admin` に保存されたロールで判定します。既存の主任管理者アカウントがプロフィールに存在しない場合は、先に `supabase/migrations/20261106030000_promote_chief_administrator.sql` の手順を実行してください。

HTTPレスポンスにはクリックジャッキング対策、MIMEスニッフィング抑止、参照元制限、カメラ・マイクの無効化を設定しています。本番ではHTTPS Strict Transport Securityも有効になります。運用環境ではSupabase Authのメール確認を有効にし、管理者アカウントには多要素認証を必須化し、Service Role Keyをサーバー環境変数だけに保管してください。

地図はOpenStreetMap標準タイルを使用し、地図上に必須の著作権表示を行います。住所からの自動ジオコーディングや外部検索には住所情報を送信しません。OpenStreetMap標準タイルは無制限の商用配信を保証するものではありません。公開前にアクセス規模とタイル利用ポリシーを確認し、必要なら適切なタイルサービスへ変更してください。

画面表示は日本語・英語・簡体字中国語・韓国語に切り替えられます。管理画面のCMSでは、公開ページごとに各言語のタイトル・概要・本文を入力でき、翻訳が未登録の言語では日本語を表示します。投稿本文・採用情報など利用者や管理者が登録するデータは自動翻訳されません。アクセシビリティ対応としてキーボードフォーカス、本文へのスキップリンク、動きを抑える設定を含みます。

## 警察職員ロールとCommand system

デプロイ前に `supabase/migrations/20261106010000_police_roles_command_system.sql` を適用してください。主任管理者 `reimari.nusi@gmail.com` が既存プロフィールに設定され、管理者画面から一般管理者が警察職員ロールを、主任管理者が管理者権限を設定できるようになります。

`20261106010000_police_roles_command_system.sql` をすでに適用済みで、このアカウントが一般管理者のままの場合は、`supabase/migrations/20261106030000_promote_chief_administrator.sql` の内容をSupabase SQL Editorで実行してください。このSQLだけで必要なロール列を追加し、対象プロフィールを主任管理者へ更新して、結果を表示します。対象のSupabase Authアカウントまたはプロフィールが見つからない場合はエラーを返します。管理画面と職員管理APIもこのメールアドレスを主任管理者として扱います。

`/pages` の公開資料一覧を利用するには `supabase/migrations/20261106020000_custom_pages_metadata.sql` も適用してください。既存の `custom_pages` テーブルに不足している公開設定・検索メタデータ列を追加します。

管理画面の「警察向けCommand system接続設定」に、Command systemを起動しているPCのLAN URL（例: `http://192.168.1.10:8765`）を登録します。警察職員ページの「110番通報を開始」ボタンは、既存Command systemの110番通報確認画面を開きます。Command systemを起動している端末と通報を行う端末がネットワーク経由で接続できる必要があります。

警察無線を利用するには `supabase/migrations/20261107000300_police_radio.sql` を適用してください。警察職員と管理者は「県内」「Ch1」「CH2」「非常用」「教育」の各チャンネルでリアルタイムのテキスト連絡ができます。履歴はチャンネルごとに最新100件を表示します。

警察内の「教官」「学生」「一般」「指令」役割を管理画面から設定するには、`supabase/migrations/20261107000400_police_organization_roles.sql` を適用してください。役割設定は管理者専用で、警察職員ロールを持つユーザーに限り設定できます。役割による無線チャンネルの制限はありません。

## 起動と検証

```bash
npm run dev
```

通常は [http://localhost:3000](http://localhost:3000) で利用できます。

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

## 主な画面

- `/` — お知らせ、緊急情報、管理画面で設定したメニュー
- `/login`、`/signup` — メールアドレスおよびGoogle認証。登録時はメールアドレスと8文字以上のパスワードのみを入力し、氏名・住所・生年月日は必要に応じてマイページから登録します。メール確認が有効な環境では、登録完了後に確認メールを再送できます。
- `/toeiken` — Googleまたはメールアドレスによる東栄アカウントの作成・ログイン
- `/toeiken/portal` — 住民ポータルの機能一覧
- `/toeiken/services` — 住民申請、住民証、通知、イベント、コミュニティ、問い合わせ
- `/toeiken/dashboard` — 住民プロフィール（表示名、アイコン、自己紹介）と任意のDiscord連携
- `/toeiken/profile/[id]` — 住民の公開プロフィールと個人チャット開始
- `/toeiken/messages` — 住民同士の個人チャット・グループチャット
- `/toeiken/police-result` — 受験番号・生年月日による合否照会
- `/dashboard` — 通常ポータルのメニューとStripe契約管理
- `/police` — 警察職員専用ページとCommand systemの110番通報
- `/admin` — 管理者向けコンテンツ・ユーザー管理
- `/admin/residents` — 住民登録簿、招待、職員権限
- `/admin/services` — 担当業務の申請・イベント・通知・投稿・問い合わせ管理
- `/map` — 施設・地域情報マップ
- `/recruitment` — 採用募集・応募と選考状況の管理
- `/admin/residents` — 住民の検索・登録および職員権限管理
- `/pages`、`/pages/[slug]` — 公開資料一覧と動的ページ
