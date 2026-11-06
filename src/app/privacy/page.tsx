import Link from 'next/link';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';

const sectionClass = 'space-y-2';
const headingClass = 'text-base font-bold text-slate-900';
const paragraphClass = 'text-sm leading-7 text-slate-700';
const listClass = 'list-disc space-y-1 pl-6 text-sm leading-7 text-slate-700';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans text-slate-800">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Breadcrumbs items={[{ label: 'プライバシーポリシー' }]} />
        <article className="mt-4 space-y-8 rounded border border-slate-300 bg-white p-5 shadow-sm sm:p-8">
          <header className="space-y-3 border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold text-slate-950">プライバシーポリシー</h1>
            <p className={paragraphClass}>
              東栄プロジェクト（以下「運営者」）は、東栄ポータルおよび関連サービス（以下「本サービス」）で取り扱う利用者の情報について、
              以下のとおり取り扱います。本ポリシーに関するお問い合わせは
              <Link href="/toeiken/services?tab=support" className="mx-1 font-semibold text-blue-700 underline">お問い合わせ窓口</Link>
              からご連絡ください。
            </p>
          </header>

          <section className={sectionClass}>
            <h2 className={headingClass}>1. 取得する情報</h2>
            <p className={paragraphClass}>本サービスの利用状況に応じ、次の情報を取得または利用者から提供いただくことがあります。</p>
            <ul className={listClass}>
              <li><strong>アカウント・認証情報:</strong> Supabase Authのユーザー識別子、メールアドレス、認証状態、Google等の認証プロバイダーから提供される基本プロフィール情報。</li>
              <li><strong>メール配信設定:</strong> メールマガジンの受信希望の有無、選択日時および登録方法。</li>
              <li><strong>登録・プロフィール情報:</strong> 氏名、表示名、住所、生年月日、自己紹介、プロフィール画像、希望言語、任意連携したDiscord識別情報。</li>
              <li><strong>申請・利用情報:</strong> 住民サービスの申請、書類発行依頼、問い合わせ、イベント申込み、採用応募、電話番号申請、各機能の利用・対応状況。</li>
              <li><strong>投稿・通信内容:</strong> 掲示板の投稿・コメント・通報、チャット、問い合わせメッセージ、警察無線等の文章、通話接続に必要なシグナリング情報。</li>
              <li><strong>試験照会情報:</strong> 利用者が入力する受験番号・生年月日および照会結果。照会は該当する試験情報との照合に使用します。</li>
              <li><strong>決済情報:</strong> 契約状態、Stripeの顧客・契約識別子、プラン、更新時期等。カード番号等の決済手段情報はStripe等の決済事業者が取り扱い、本サービスのデータベースには保存しません。</li>
              <li><strong>端末・接続情報:</strong> サービス提供に伴い、ブラウザーから送信されるIPアドレス、端末・ブラウザー情報、アクセス日時、エラー・セキュリティ関連情報が、運営者または利用する基盤事業者により処理される場合があります。</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. 利用目的</h2>
            <ul className={listClass}>
              <li>本人確認、ログイン、アカウント管理、住民・職員等のロールおよびアクセス権の確認。</li>
              <li>申請、書類、イベント、問い合わせ、採用応募、内部電話・無線その他の機能の提供と運用。</li>
              <li>プロフィール表示、住民間の掲示板・チャット等、利用者が選択した範囲での情報共有。</li>
              <li>審査、回答、本人への通知、本人確認、問い合わせ対応、不正利用・規約違反への対応。</li>
              <li>有料契約の開始、状態確認、請求・解約手続き、決済関連の問い合わせ対応。</li>
              <li>メールマガジンの受信希望の記録・管理、および配信を行う場合の配信対象の確認（希望した場合のみ）。</li>
              <li>障害対応、保守、品質改善、セキュリティ確保、操作監査、法令上の義務の履行。</li>
              <li>利用目的を事前に明示して別途同意を得た目的。</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. 表示範囲・機微な情報</h2>
            <p className={paragraphClass}>
              公開プロフィールでは、表示名、プロフィール画像、自己紹介が他の有効な住民に表示されることがあります。
              掲示板の投稿・コメントは機能の設定や審査状態に応じて表示されます。チャットは参加者に、職員向け通信は該当する権限を持つ職員に共有されます。
              氏名、住所、生年月日、メールアドレス等は公開プロフィールとして表示しません。
            </p>
            <p className={paragraphClass}>
              住所・生年月日・申請内容・受験情報等は、機能提供に必要な範囲で取り扱う情報です。
              これらを公開投稿やチャットに記載しないでください。アクセス権限を持つ職員は、担当業務、管理者権限、監査・セキュリティ対応の必要性に応じて
              登録情報または業務データを閲覧する場合があります。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. 第三者サービスの利用</h2>
            <p className={paragraphClass}>
              本サービスは、機能提供のために外部事業者のサービスを利用します。利用する機能に応じて、必要な情報が各事業者に送信され、
              各事業者の規約・プライバシーポリシーに基づき処理されます。
            </p>
            <ul className={listClass}>
              <li><strong>Supabase:</strong> 認証、データベース、ファイル保存、リアルタイム通信等の基盤。</li>
              <li><strong>Google等の認証プロバイダー:</strong> 利用者が選択したログイン・認証。</li>
              <li><strong>Discord:</strong> 利用者が任意でアカウント連携した場合の識別情報。</li>
              <li><strong>Stripe:</strong> 有料プランの決済、契約管理、決済状況の通知。</li>
              <li><strong>OpenStreetMap等の地図タイル提供者:</strong> 地図表示。地図を表示すると、ブラウザーから地図タイル提供者へ接続情報や閲覧に必要なリクエストが送信される場合があります。</li>
              <li><strong>Command system・通信基盤:</strong> 利用者が警察・消防向け画面、内部電話・無線等を使用した場合の画面遷移、通信または接続処理。</li>
            </ul>
            <p className={paragraphClass}>
              外部サービスの提供者、処理場所、利用条件は変更されることがあります。運営者は各事業者による独立した情報処理を管理するものではありません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. Cookie・ブラウザー内保存</h2>
            <p className={paragraphClass}>
              本サービスは、ログイン状態を維持する認証セッション、表示言語、プライバシー案内の確認状態等をブラウザーのローカルストレージ等に保存します。
              これらは広告配信・行動追跡を目的とするものではありません。ブラウザーの設定で保存データを削除できますが、
              認証情報や設定が失われ、再ログイン等が必要になる場合があります。ログイン・外部サービス側では、セッション維持等のためCookieが利用される場合があります。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. 音声通話・位置情報</h2>
            <p className={paragraphClass}>
              内部電話を利用する場合、ブラウザーのマイク許可が必要です。音声は通話相手との接続に使用され、アプリケーションによる録音・音声保存は行いません。
              接続確立のため、通話参加者間で接続情報が交換され、ネットワーク構成によってはSTUN/TURN中継事業者を経由します。
              ブラウザーの位置情報取得機能は使用しません。地図上に登録された施設等の位置情報は、登録した利用者・職員が提供する情報です。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>7. 第三者提供・委託・共同利用</h2>
            <p className={paragraphClass}>
              運営者は、法令に基づく場合、本人の同意がある場合、生命・身体・財産の保護に必要な場合その他法令で認められる場合を除き、
              個人情報を第三者に提供しません。認証、ホスティング、決済、通信等の業務を委託する場合、委託先に必要な範囲で情報を取り扱わせ、
              適切な委託先選定と管理に努めます。本ポリシーに記載する外部サービスへの送信は、機能提供に必要な範囲で行われます。
              現時点で独立した共同利用者は定めていません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>8. 保存期間・削除</h2>
            <p className={paragraphClass}>
              情報は利用目的の達成に必要な期間保持し、不要となった場合は、法令上の保存義務、不正利用防止、監査、紛争対応、バックアップの運用等を考慮して、
              削除または個人を識別できない形にするよう努めます。機能ごとの一律の保存期間は定めていません。
              アカウントの利用停止だけでは、関連データが直ちに消去されるとは限りません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>9. 安全管理</h2>
            <p className={paragraphClass}>
              運営者は、情報の漏えい、滅失、毀損、不正アクセス等を防ぐため、アクセス権限の制御、行単位のアクセス制御（RLS）、
              管理操作の記録、通信・認証基盤の保護など、サービスの構成に応じた安全管理措置を講じます。
              ただし、インターネット上の通信や情報システムに完全な安全性を保証することはできません。
              利用者も、認証情報の管理、端末の保護、共有端末からのログアウトにご協力ください。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>10. 利用者からの請求・問い合わせ</h2>
            <p className={paragraphClass}>
              利用者は、本人確認のうえ、適用法令に基づく保有個人データの開示、訂正、利用停止、削除等をお問い合わせ窓口から請求できます。
              請求内容と法令に従って確認・対応し、本人確認ができない場合、他者の権利利益を害するおそれがある場合、法令上対応義務がない場合等には、
              ご希望に沿えないことがあります。アカウント情報の一部はマイページから確認・更新できます。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>11. 未成年者の利用</h2>
            <p className={paragraphClass}>
              未成年者が本サービスを利用する場合、保護者等の法定代理人に本ポリシーの内容を確認してもらい、必要な同意を得たうえで利用してください。
              未成年者の情報は、その年齢や機能に応じて適用法令に従い取り扱います。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>12. 本ポリシーの変更</h2>
            <p className={paragraphClass}>
              法令やサービス内容の変更等に応じ、本ポリシーを改定することがあります。重要な変更を行う場合は、本サービス上での掲示その他適切な方法でお知らせします。
              改定後の内容は、本ページに掲載した時点または別途定める効力発生日から適用されます。
            </p>
          </section>

          <footer className="border-t border-slate-200 pt-5">
            <p className={paragraphClass}>
              個人情報の取扱いに関するご相談・請求は
              <Link href="/toeiken/services?tab=support" className="mx-1 font-semibold text-blue-700 underline">お問い合わせ窓口</Link>
              からご連絡ください。
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
