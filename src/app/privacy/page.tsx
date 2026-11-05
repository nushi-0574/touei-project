import Header from '../components/Header';
import Breadcrumbs from '../components/Breadcrumbs';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Breadcrumbs items={[{ label: 'プライバシーポリシー' }]} />
        <div className="bg-white border border-slate-300 rounded shadow-sm p-8 space-y-6">
          <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-3">プライバシーポリシー</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            東栄プロジェクトは、ユーザーの個人情報およびアカウントデータの適切な保護に努めます。
          </p>
          <div className="space-y-4 text-xs text-slate-700">
            <section>
              <h2 className="font-bold text-slate-900 mb-1">1. 取得する情報</h2>
              <p className="leading-relaxed">認証サービス（Google、Discord等）を介して取得される識別子、メールアドレス、その他連携時に同意いただいた情報。</p>
            </section>
            <section>
              <h2 className="font-bold text-slate-900 mb-1">2. 情報の利用目的</h2>
              <p className="leading-relaxed">本ポータルにおける本人確認、住民権限の付与、問い合わせ対応のためにのみ利用します。</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}