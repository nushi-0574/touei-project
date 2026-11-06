import Link from 'next/link';
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';

const sectionClass = 'space-y-2';
const headingClass = 'text-base font-bold text-slate-900';
const paragraphClass = 'text-sm leading-7 text-slate-700';
const listClass = 'list-disc space-y-1 pl-6 text-sm leading-7 text-slate-700';

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans text-slate-800">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Breadcrumbs items={[{ label: '利用規約' }]} />
        <article className="mt-4 space-y-8 rounded border border-slate-300 bg-white p-5 shadow-sm sm:p-8">
          <header className="space-y-3 border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold text-slate-950">利用規約</h1>
            <p className={paragraphClass}>
              この利用規約（以下「本規約」）は、東栄プロジェクト（以下「運営者」）が提供する東栄ポータルおよび関連機能（以下「本サービス」）の利用条件を定めます。
              利用を開始する前に本規約と<Link href="/privacy" className="font-semibold text-blue-700 underline">プライバシーポリシー</Link>をお読みください。
            </p>
          </header>

          <section className={sectionClass}>
            <h2 className={headingClass}>第1条（適用・サービスの位置付け）</h2>
            <p className={paragraphClass}>
              本規約は、本サービスの利用に関する運営者と利用者との関係に適用されます。本サービスは東栄プロジェクトが運営するオンラインサービスであり、
              国・地方公共団体その他の公的機関が提供する行政サービスまたは緊急通報サービスであることを意味しません。
              本サービス上の案内、申請、採用情報、通知その他の表示は、別途明示する場合を除き、正式な行政処分・証明・採用決定を構成しません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第2条（提供機能と変更）</h2>
            <p className={paragraphClass}>
              本サービスには、アカウント・プロフィール、住民向け申請や書類依頼、掲示板・チャット、問い合わせ、イベント、地図、採用情報、
              警察・消防職員向け画面、内部電話・無線、決済その他の機能が含まれる場合があります。
              運営者は、機能の追加・変更・停止、保守または障害対応のため、本サービスの全部または一部を予告なく変更・中断・終了することがあります。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第3条（アカウントと登録情報）</h2>
            <ul className={listClass}>
              <li>利用者は、正確で最新の情報を登録し、変更があった場合は速やかに更新してください。</li>
              <li>認証情報を適切に管理し、第三者との共有、貸与、譲渡をしないでください。自己のアカウントで行われた操作は、法令上許される範囲で利用者の操作として扱われます。</li>
              <li>他人になりすますこと、権限のないアカウントを利用すること、審査や本人確認を回避することは禁止します。</li>
              <li>管理者は、登録情報や利用状況を確認し、付与された管理権限の範囲でユーザー・職員の権限を設定することがあります。</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第4条（緊急機能に関する重要事項）</h2>
            <p className={paragraphClass}>
              本サービスに表示される110番・119番等のボタンは、設定された外部Command systemの画面を開く機能です。
              公的な警察・消防機関への接続、通報の受理、出動、救助または対応を保証せず、現実の緊急通報の代わりにはなりません。
              現実の事件・事故・火災・救急など緊急の場合は、本サービスを使わず、所在地で利用できる公的な緊急通報手段に直接連絡してください。
              内部電話・無線も、公的な通信網や緊急連絡網ではありません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第5条（利用者投稿・通信）</h2>
            <p className={paragraphClass}>
              利用者は、自ら投稿・送信する文章、画像、申請内容その他の情報について必要な権利を有し、内容の正確性と適法性に責任を負います。
              投稿・プロフィールのうち公開または共有範囲が設定された情報は、他の利用者や該当する職員に表示されることがあります。
              運営者は、サービスの提供、表示、保存、バックアップ、モデレーションおよび不正利用への対応に必要な範囲で投稿等を取り扱います。
            </p>
            <p className={paragraphClass}>
              掲示板投稿等は審査・通報対応の対象となる場合があります。チャットや内部通信は参加者・権限を有する職員に共有されるため、
              パスワード、決済情報、不要な機微情報などを送信しないでください。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第6条（禁止事項）</h2>
            <p className={paragraphClass}>利用者は、次の行為をしてはなりません。</p>
            <ul className={listClass}>
              <li>法令、本規約、第三者の権利または公序良俗に反する行為。</li>
              <li>虚偽の申請、なりすまし、詐欺、嫌がらせ、差別、脅迫、スパム、無断の営業・勧誘。</li>
              <li>本人の同意または正当な権限なく、他人の個人情報・画像・通信内容を収集、公開、送信する行為。</li>
              <li>本サービス、アカウント、データ、ネットワークまたはセキュリティ機能への不正アクセス、過度な負荷、妨害、解析、回避。</li>
              <li>権限のない管理画面・職員向け機能の利用、管理権限の不正取得・共有。</li>
              <li>緊急通報機能や内部電話・無線を用いた虚偽通報、いたずら、または実際の緊急対応であると誤認させる行為。</li>
              <li>その他、運営者が本サービスの安全な運用に照らして不適切と判断する行為。</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第7条（知的財産権）</h2>
            <p className={paragraphClass}>
              本サービスおよび運営者が提供する文章、画像、ソフトウェア等に関する権利は、運営者または正当な権利者に帰属します。
              利用者は、権利者の許可なく、複製、転載、改変、再配布または商用利用をしてはなりません。
              利用者が投稿したコンテンツの権利は利用者または当該権利者に留保されますが、利用者は本サービスの運営・保守・表示に必要な範囲で、
              運営者が当該コンテンツを利用することを許諾します。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第8条（有料機能・外部サービス）</h2>
            <p className={paragraphClass}>
              有料プランを利用する場合、料金、請求周期、更新、解約および返金条件は、申込画面と決済事業者の画面に表示される条件に従います。
              決済はStripe等の外部事業者を通じて処理され、外部事業者の規約・プライバシー方針も適用されます。
              Google、Discord、Supabase、地図タイル提供者、Command systemその他の外部サービスは、それぞれの提供条件に従い、
              運営者は外部サービスの可用性・内容を保証しません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第9条（利用制限・退会）</h2>
            <p className={paragraphClass}>
              利用者が本規約に違反した場合、または安全確保・保守・法令対応に必要な場合、運営者は事前の通知なく、
              投稿の非表示、機能の制限、アカウントの一時停止・利用停止その他必要な措置をとることがあります。
              利用者は運営者所定の方法で利用停止等を申し出ることができます。
              利用停止・退会後も、法令遵守、不正防止、紛争対応、監査またはサービス運営に必要な情報は、必要な範囲・期間で保持されることがあります。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第10条（保証の否認・責任）</h2>
            <p className={paragraphClass}>
              運営者は、本サービスの正確性、完全性、継続性、特定目的への適合性、エラーがないことを保証しません。
              利用者は、自らの責任で本サービスを利用し、重要な情報は必要に応じて別途確認してください。
              運営者は、運営者の故意または重過失による場合その他法令上免責が認められない場合を除き、
              本サービスに関連して利用者に生じた損害について、法令で認められる範囲で責任を負いません。
              利用者が消費者に該当する場合、消費者契約法その他の強行法規により無効となる範囲には本条を適用しません。
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>第11条（規約の変更・準拠法）</h2>
            <p className={paragraphClass}>
              運営者は、必要に応じて本規約を変更し、変更後の内容を本ページに掲載します。変更後に本サービスを利用した場合、
              適用法令上必要な手続きを経たうえで変更後の規約が適用されます。
              本規約は日本法に準拠し、本サービスに関する紛争は、法令に従い適切な裁判所で解決します。
            </p>
          </section>

          <footer className="border-t border-slate-200 pt-5">
            <p className={paragraphClass}>
              本規約に関するお問い合わせは
              <Link href="/toeiken/services?tab=support" className="mx-1 font-semibold text-blue-700 underline">お問い合わせ窓口</Link>
              からご連絡ください。
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
