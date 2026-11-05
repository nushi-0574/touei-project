
import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: '利用規約' }]} />
        <div className="bg-white border border-slate-300 rounded shadow-sm p-8 space-y-6">
          <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">利用規約</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            本規約は、東栄プロジェクト（以下「当運営」）が提供する「東栄ポータルサイト」および関連サービスの利用条件を定めるものです。
          </p>
          <div className="space-y-4 text-xs text-slate-700">
            <section>
              <h2 className="font-bold text-slate-900 mb-1">第1条（適用）</h2>
              <p className="leading-relaxed">本規約は、ユーザーと当運営との間の本サービスの利用に関わる一切の関係に適用されます。</p>
            </section>
            <section>
              <h2 className="font-bold text-slate-900 mb-1">第2条（ユーザー登録およびアカウント連携）</h2>
              <p className="leading-relaxed">ユーザーは自らの責任において登録を行い、マイページ等からDiscordアカウント等の連携を管理するものとします。</p>
            </section>
            <section>
              <h2 className="font-bold text-slate-900 mb-1">第3条（禁止事項）</h2>
              <p className="leading-relaxed">不正アクセス、公序良俗に反する行為、コミュニティ秩序を乱す行為を禁止します。</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}