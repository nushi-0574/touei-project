'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import Toast from '../components/Toast';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/errors';
import { normalizeCommandSystemUrl } from '../../lib/commandSystem';

type NewsItem = { id: number; date_str: string; title: string; link_url: string; category: string; };
type ExamResultItem = { id: number; exam_number: string; name: string; birth_date: string; result: string; exam_name: string; };
type CustomPageItem = {
  id: string;
  slug: string;
  title: string;
  content: string;
  description?: string;
  keywords?: string;
  category?: string;
  is_published: boolean;
  display_order?: number;
  created_at?: string;
  translations?: Record<string, { title?: string; description?: string; content?: string }>;
};
type MenuCardItem = { id: string; title: string; description: string; link_url: string; display_order: number; is_visible: boolean; };
type UserProfileItem = {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  is_super_admin: boolean;
  is_police_staff: boolean;
  police_org_role: '教官' | '学生' | '一般' | '指令';
  created_at: string;
};

function isSafeDestination(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // 1. サイト緊急情報
  const [emergencyText, setEmergencyText] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  // 2. 新着情報一覧ステート
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsCategory, setNewsCategory] = useState('お知らせ');
  const [newsLink, setNewsLink] = useState('');

  // 3. 警察官採用試験 合否データ管理ステート
  const [examResultsList, setExamResultsList] = useState<ExamResultItem[]>([]);
  const [examNumber, setExamNumber] = useState('');
  const [examName, setExamName] = useState('');
  const [examFullName, setExamFullName] = useState('');
  const [examBirthDate, setExamBirthDate] = useState('');
  const [examResult, setExamResult] = useState('');
  const [editingExamId, setEditingExamId] = useState<number | null>(null);

  // 4. カスタムページ高度管理ステート
  const [customPages, setCustomPages] = useState<CustomPageItem[]>([]);
  const [pageSlug, setPageSlug] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [pageCategory, setPageCategory] = useState('一般案内');
  const [pageDescription, setPageDescription] = useState('');
  const [pageKeywords, setPageKeywords] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [pageTranslations, setPageTranslations] = useState<Record<string, { title: string; description: string; content: string }>>({
    en: { title: '', description: '', content: '' },
    'zh-CN': { title: '', description: '', content: '' },
    ko: { title: '', description: '', content: '' },
  });
  const [pageIsPublished, setPageIsPublished] = useState(true);
  const [pageDisplayOrder, setPageDisplayOrder] = useState('0');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // 5. メインメニューカード管理ステート
  const [menuCards, setMenuCards] = useState<MenuCardItem[]>([]);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDesc, setCardDesc] = useState('');
  const [cardLink, setCardLink] = useState('');
  const [cardOrder, setCardOrder] = useState('0');
  const [cardVisible, setCardVisible] = useState(true);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  // 6. ユーザー一覧ステート
  const [userProfiles, setUserProfiles] = useState<UserProfileItem[]>([]);
  const [commandSystemUrl, setCommandSystemUrl] = useState('');

  const checkUserAndFetchData = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setLoading(true);
      if (!session) {
        setIsAuthenticated(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, is_super_admin')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setIsSuperAdmin(profile?.is_super_admin === true);
      if (!profile?.is_admin) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      const [settingRes, newsRes, examRes, pagesRes, cardsRes, usersRes] = await Promise.all([
        supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('news_items').select('*').order('id', { ascending: false }),
        supabase.from('police_exam_results').select('*').order('id', { ascending: false }),
        supabase.from('custom_pages').select('*').order('display_order', { ascending: true }),
        supabase.from('main_menu_cards').select('*').order('display_order', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, email, full_name, is_admin, is_super_admin, is_police_staff, police_org_role, created_at')
          .order('created_at', { ascending: false }),
      ]);

      const queryError = [settingRes, newsRes, examRes, pagesRes, cardsRes, usersRes]
        .find((result) => result.error)?.error;
      if (queryError) throw queryError;

      if (settingRes.data) {
        setEmergencyText(settingRes.data.emergency_text || '');
        setIsEmergencyActive(settingRes.data.is_emergency_active || false);
        setCommandSystemUrl(settingRes.data.command_system_url || '');
      }
      if (newsRes.data) setNewsList(newsRes.data);
      if (examRes.data) setExamResultsList(examRes.data);
      if (pagesRes.data) setCustomPages(pagesRes.data);
      if (cardsRes.data) setMenuCards(cardsRes.data);
      if (usersRes.data) {
        setUserProfiles(usersRes.data);
      }

    } catch (err) {
      console.error('データ取得エラー:', err);
      setIsAuthenticated(false);
      setToast({
        message: `データの取得中にエラーが発生しました: ${getErrorMessage(err, '不明なエラー')}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkUserAndFetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [checkUserAndFetchData]);

  // --- 緊急情報の保存 ---
  const handleSaveEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ id: 1, emergency_text: emergencyText, is_emergency_active: isEmergencyActive });
      if (error) throw error;
      setToast({ message: '緊急情報を更新しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '緊急情報の保存に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  // --- 新着情報の追加 / 削除 ---
  const handleAddNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim()) {
      setToast({ message: 'お知らせタイトルを入力してください。', type: 'error' });
      return;
    }
    if (newsLink.trim() && !isSafeDestination(newsLink.trim())) {
      setToast({ message: 'リンク先はサイト内パス（/で開始）または http(s) URL を入力してください。', type: 'error' });
      return;
    }
    try {
      const today = new Date().toLocaleDateString('sv-SE').replace(/-/g, '.');
      const { error } = await supabase
        .from('news_items')
        .insert([{ date_str: today, title: newsTitle.trim(), category: newsCategory, link_url: newsLink.trim() }]);

      if (error) throw error;
      setToast({ message: '新着情報を追加しました。', type: 'success' });
      setNewsTitle('');
      setNewsLink('');
      checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: '新着情報の追加に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  const handleDeleteNews = async (id: number) => {
    if (!confirm('この新着情報を削除しますか？')) return;
    try {
      const { error } = await supabase.from('news_items').delete().eq('id', id);
      if (error) throw error;
      setNewsList(newsList.filter((n) => n.id !== id));
      setToast({ message: '新着情報を削除しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '削除に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  // --- 警察官採用試験 合否データ ---
  const handleSaveExamResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examNumber.trim() || !examName.trim() || !examFullName.trim() || !examBirthDate || !examResult) {
      setToast({ message: '試験名、受験番号、氏名、生年月日、合否結果を入力してください。', type: 'error' });
      return;
    }

    try {
      if (editingExamId !== null) {
        const { error } = await supabase
          .from('police_exam_results')
          .update({
            exam_number: examNumber.trim(),
            exam_name: examName.trim(),
            name: examFullName.trim(),
            birth_date: examBirthDate,
            result: examResult.trim(),
          })
          .eq('id', editingExamId);

        if (error) throw error;
        setToast({ message: '合否データを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('police_exam_results')
          .insert([{
            exam_number: examNumber.trim(),
            exam_name: examName.trim(),
            name: examFullName.trim(),
            birth_date: examBirthDate,
            result: examResult.trim(),
          }]);

        if (error) throw error;
        setToast({ message: '合否データを新しく登録しました。', type: 'success' });
      }

      setExamNumber('');
      setExamName('');
      setExamFullName('');
      setExamBirthDate('');
      setExamResult('');
      setEditingExamId(null);
      checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: '合否データの保存に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  const handleEditExamClick = (item: ExamResultItem) => {
    setEditingExamId(item.id);
    setExamNumber(item.exam_number);
    setExamName(item.exam_name || '');
    setExamFullName(item.name);
    setExamBirthDate(item.birth_date || '');
    setExamResult(item.result || '');
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm('この合否データを削除しますか？')) return;
    try {
      const { error } = await supabase.from('police_exam_results').delete().eq('id', id);
      if (error) throw error;
      setExamResultsList(examResultsList.filter((item) => item.id !== id));
      setToast({ message: '合否データを削除しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '削除に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  // --- 高度カスタムページ保存・編集 ---
  const resetCustomPageForm = () => {
    setPageSlug('');
    setPageTitle('');
    setPageCategory('一般案内');
    setPageDescription('');
    setPageKeywords('');
    setPageContent('');
    setPageTranslations({
      en: { title: '', description: '', content: '' },
      'zh-CN': { title: '', description: '', content: '' },
      ko: { title: '', description: '', content: '' },
    });
    setPageIsPublished(true);
    setPageDisplayOrder('0');
    setEditingPageId(null);
    setPreviewMode(false);
  };

  const handleSaveCustomPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageSlug.trim() || !pageTitle.trim()) {
      setToast({ message: 'URLスラッグとタイトルを入力してください。', type: 'error' });
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pageSlug.trim().toLowerCase())) {
      setToast({ message: 'URLスラッグは半角英小文字・数字とハイフンで入力してください。', type: 'error' });
      return;
    }

    try {
      const payload = {
        slug: pageSlug.trim().toLowerCase(),
        title: pageTitle.trim(),
        category: pageCategory.trim(),
        description: pageDescription.trim(),
        keywords: pageKeywords.trim(),
        content: pageContent,
        translations: pageTranslations,
        is_published: pageIsPublished,
        display_order: parseInt(pageDisplayOrder, 10) || 0,
        updated_at: new Date().toISOString(),
      };

      if (editingPageId) {
        const { error } = await supabase
          .from('custom_pages')
          .update(payload)
          .eq('id', editingPageId);
        if (error) throw error;
        setToast({ message: 'ページを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('custom_pages')
          .insert([payload]);
        if (error) throw error;
        setToast({ message: '新しい拡張ページを作成しました。', type: 'success' });
      }

      resetCustomPageForm();
      checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: 'ページの保存に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  const handleEditPageClick = (page: CustomPageItem) => {
    setEditingPageId(page.id);
    setPageSlug(page.slug);
    setPageTitle(page.title);
    setPageCategory(page.category || '一般案内');
    setPageDescription(page.description || '');
    setPageKeywords(page.keywords || '');
    setPageContent(page.content || '');
    setPageTranslations({
      en: { title: page.translations?.en?.title || '', description: page.translations?.en?.description || '', content: page.translations?.en?.content || '' },
      'zh-CN': { title: page.translations?.['zh-CN']?.title || '', description: page.translations?.['zh-CN']?.description || '', content: page.translations?.['zh-CN']?.content || '' },
      ko: { title: page.translations?.ko?.title || '', description: page.translations?.ko?.description || '', content: page.translations?.ko?.content || '' },
    });
    setPageIsPublished(page.is_published ?? true);
    setPageDisplayOrder(String(page.display_order || 0));
    setPreviewMode(false);
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm('このページを削除しますか？')) return;
    try {
      const { error } = await supabase.from('custom_pages').delete().eq('id', id);
      if (error) throw error;
      setCustomPages(customPages.filter((p) => p.id !== id));
      setToast({ message: 'ページを削除しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '削除に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  // --- メインメニューカード ---
  const handleSaveMenuCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim() || !cardLink.trim()) {
      setToast({ message: 'カードタイトルと遷移先URLを入力してください。', type: 'error' });
      return;
    }
    if (!isSafeDestination(cardLink.trim())) {
      setToast({ message: '遷移先URLはサイト内パス（/で開始）または http(s) URL を入力してください。', type: 'error' });
      return;
    }

    try {
      const orderVal = Number.parseInt(cardOrder, 10) || 0;
      const payload = {
        title: cardTitle.trim(),
        description: cardDesc.trim(),
        link_url: cardLink.trim(),
        display_order: orderVal,
        is_visible: cardVisible,
      };
      if (editingCardId) {
        const { error } = await supabase
          .from('main_menu_cards')
          .update(payload)
          .eq('id', editingCardId);
        if (error) throw error;
        setToast({ message: 'メニューカードを更新しました。', type: 'success' });
      } else {
        const { error } = await supabase
          .from('main_menu_cards')
          .insert([payload]);
        if (error) throw error;
        setToast({ message: 'メニューカードを追加しました。', type: 'success' });
      }

      setCardTitle('');
      setCardDesc('');
      setCardLink('');
      setCardOrder('0');
      setCardVisible(true);
      setEditingCardId(null);
      checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: 'カードの保存に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('このメニューカードを削除しますか？')) return;
    try {
      const { error } = await supabase.from('main_menu_cards').delete().eq('id', id);
      if (error) throw error;
      setMenuCards(menuCards.filter((c) => c.id !== id));
      setToast({ message: 'メニューカードを削除しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '削除に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  const handleUpdateUserRoles = async (
    user: UserProfileItem,
    roles: { isAdmin: boolean; isPoliceStaff: boolean },
  ) => {
    if (user.is_super_admin) {
      setToast({ message: '主任管理者の権限は変更できません。', type: 'error' });
      return;
    }

    const changes: string[] = [];
    if (roles.isAdmin !== user.is_admin) changes.push(`管理者権限を${roles.isAdmin ? '付与' : '解除'}`);
    if (roles.isPoliceStaff !== user.is_police_staff) changes.push(`警察職員ロールを${roles.isPoliceStaff ? '付与' : '解除'}`);
    if (!changes.length) return;
    if (!confirm(`${user.email || user.full_name} の${changes.join('、')}を行いますか？`)) return;

    setUpdatingRoleId(user.id);
    try {
      const { error } = await supabase.rpc('set_profile_roles', {
        target_user_id: user.id,
        new_is_admin: roles.isAdmin,
        new_is_police_staff: roles.isPoliceStaff,
      });
      if (error) throw error;
      setToast({ message: 'ユーザー権限を更新しました。', type: 'success' });
      await checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: '権限変更に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleUpdatePoliceOrganizationRole = async (
    user: UserProfileItem,
    role: UserProfileItem['police_org_role'],
  ) => {
    if (!user.is_police_staff || role === user.police_org_role) return;
    if (!confirm(`${user.email || user.full_name} の警察内役割を「${role}」に変更しますか？`)) return;

    setUpdatingRoleId(user.id);
    try {
      const { error } = await supabase.rpc('set_police_organization_role', {
        target_user_id: user.id,
        new_role: role,
      });
      if (error) throw error;
      setToast({ message: '警察内役割を更新しました。', type: 'success' });
      await checkUserAndFetchData();
    } catch (err: unknown) {
      setToast({ message: '警察内役割を変更できませんでした: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
      await checkUserAndFetchData();
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleSaveCommandSystemUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUrl = normalizeCommandSystemUrl(commandSystemUrl);
    if (commandSystemUrl.trim() && !normalizedUrl) {
      setToast({
        message: 'Command systemのURLには、httpまたはhttpsで始まるサーバーURLを入力してください。',
        type: 'error',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 1,
          emergency_text: emergencyText,
          is_emergency_active: isEmergencyActive,
          command_system_url: normalizedUrl,
        });
      if (error) throw error;
      setCommandSystemUrl(normalizedUrl || '');
      setToast({ message: 'Command systemの接続先を保存しました。', type: 'success' });
    } catch (err: unknown) {
      setToast({ message: '接続先の保存に失敗しました: ' + getErrorMessage(err, '不明なエラー'), type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        <div className="border-b border-slate-300 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 border-l-4 border-slate-800 pl-3">
              東栄ポータル 統合管理パネル
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              緊急情報、新着お知らせ、合否照会データ、高機能動的ページ、メニューカード、ユーザー権限を一元管理します。
            </p>
            <p className="text-xs text-slate-600 mt-1">
              権限: {isSuperAdmin ? '主任管理者（管理者権限も管理可能）' : '一般管理者'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded text-xs font-semibold ${isAuthenticated ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
            {isAuthenticated ? '最高管理者認証済み' : 'アクセス制限'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/residents"
            className="inline-flex items-center gap-2 rounded bg-[#0046ff] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            住民登録
          </Link>
          <Link
            href="/admin/services"
            className="inline-flex items-center gap-2 rounded border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            業務管理
          </Link>
        </div>

        {loading ? (
          <ContentSkeleton />
        ) : !isAuthenticated ? (
          <div className="bg-white border border-slate-300 rounded p-8 text-center space-y-4">
            <p className="text-xs text-red-600 font-bold">管理者権限が必要です。ログインを行ってください。</p>
            <Link href="/toeiken" className="inline-block px-4 py-2 bg-[#5865F2] text-white text-xs font-semibold rounded shadow">
              認証ページへ移動
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 0. 全体統計サマリー */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded border border-slate-300 shadow-sm">
                <p className="text-[11px] text-slate-500 font-bold">登録受験者数</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{examResultsList.length}<span className="text-xs font-normal text-slate-500 ml-1">名</span></p>
              </div>
              <div className="bg-white p-4 rounded border border-slate-300 shadow-sm">
                <p className="text-[11px] text-slate-500 font-bold">動的公開ページ</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{customPages.filter(p => p.is_published).length}<span className="text-xs font-normal text-slate-500 ml-1">件</span></p>
              </div>
              <div className="bg-white p-4 rounded border border-slate-300 shadow-sm">
                <p className="text-[11px] text-slate-500 font-bold">メニューカード</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{menuCards.length}<span className="text-xs font-normal text-slate-500 ml-1">件</span></p>
              </div>
              <div className="bg-white p-4 rounded border border-slate-300 shadow-sm">
                <p className="text-[11px] text-slate-500 font-bold">登録住民アカウント</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{userProfiles.length}<span className="text-xs font-normal text-slate-500 ml-1">名</span></p>
              </div>
            </div>

            {/* 1. 高機能カスタムページ作成・管理（拡張仕様） */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                <h2 className="text-sm font-bold text-slate-900">
                  [ 高機能Webページ・コンテンツ構築エディタ ]
                </h2>
                <span className="text-[11px] text-slate-500">/pages/[slug] で即時配信</span>
              </div>

              <form onSubmit={handleSaveCustomPage} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">
                    {editingPageId ? 'ページの高度編集' : '新規拡張ページの作成'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-[11px]"
                  >
                    {previewMode ? 'フォーム編集に戻る' : 'プレビュー切り替え'}
                  </button>
                </div>

                {!previewMode ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">URLスラッグ (英数字小文字)</label>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 font-mono text-[11px]">/pages/</span>
                          <input type="text" value={pageSlug} onChange={(e) => setPageSlug(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ページタイトル</label>
                        <input type="text" value={pageTitle} onChange={(e) => setPageTitle(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">カテゴリー分類</label>
                        <input type="text" value={pageCategory} onChange={(e) => setPageCategory(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">概要・SEO説明文 (Description)</label>
                        <input type="text" value={pageDescription} onChange={(e) => setPageDescription(e.target.value)} placeholder="検索結果に表示される簡単な説明文" className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">検索用キーワード (Comma区切り)</label>
                        <input type="text" value={pageKeywords} onChange={(e) => setPageKeywords(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold mb-1">表示順序</label>
                          <input type="number" value={pageDisplayOrder} onChange={(e) => setPageDisplayOrder(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                            <input type="checkbox" checked={pageIsPublished} onChange={(e) => setPageIsPublished(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
                            一般公開する
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">ページ本文（テキスト・改行対応）</label>
                      <textarea rows={8} value={pageContent} onChange={(e) => setPageContent(e.target.value)} placeholder="ページの文章を入力してください..." className="w-full px-3 py-2 border border-slate-300 rounded font-sans leading-relaxed" />
                    </div>
                    <details className="rounded border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer font-bold text-slate-800">英語・中国語・韓国語のページ翻訳</summary>
                      <p className="mt-2 text-[11px] text-slate-500">翻訳欄が空の場合は日本語の内容を表示します。翻訳済みの公開可能な内容を入力してください。</p>
                      <div className="mt-3 space-y-4">
                        {([
                          ['en', 'English'],
                          ['zh-CN', '简体中文'],
                          ['ko', '한국어'],
                        ] as const).map(([locale, label]) => (
                          <fieldset key={locale} className="grid gap-2 rounded border border-slate-200 p-3">
                            <legend className="px-1 font-bold">{label}</legend>
                            <label className="grid gap-1">タイトル
                              <input value={pageTranslations[locale].title} onChange={(event) => setPageTranslations((current) => ({ ...current, [locale]: { ...current[locale], title: event.target.value } }))} className="w-full rounded border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="grid gap-1">概要
                              <input value={pageTranslations[locale].description} onChange={(event) => setPageTranslations((current) => ({ ...current, [locale]: { ...current[locale], description: event.target.value } }))} className="w-full rounded border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="grid gap-1">本文
                              <textarea rows={5} value={pageTranslations[locale].content} onChange={(event) => setPageTranslations((current) => ({ ...current, [locale]: { ...current[locale], content: event.target.value } }))} className="w-full rounded border border-slate-300 px-3 py-2" />
                            </label>
                          </fieldset>
                        ))}
                      </div>
                    </details>
                  </>
                ) : (
                  <div className="bg-white border border-slate-300 p-6 rounded space-y-4">
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded mr-2">{pageCategory}</span>
                      <h1 className="text-xl font-bold text-slate-900 inline">{pageTitle || '（タイトル未入力）'}</h1>
                    </div>
                    <p className="text-xs text-slate-500 italic">{pageDescription || '（概要なし）'}</p>
                    <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed border-t border-slate-100 pt-3">
                      {pageContent || '（本文なし）'}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  {editingPageId && (
                    <button type="button" onClick={resetCustomPageForm} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded shadow">
                    {editingPageId ? '拡張ページを更新' : '新しい拡張ページを即時公開'}
                  </button>
                </div>
              </form>

              {/* 一覧表示 */}
              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {customPages.map((page) => (
                  <div key={page.id} className="p-3 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px]">/pages/{page.slug}</span>
                        <span className="font-bold text-slate-800">{page.title}</span>
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px]">{page.category || '一般案内'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${page.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {page.is_published ? '公開中' : '下書き/非公開'}
                        </span>
                      </div>
                      {page.description && <p className="text-[11px] text-slate-500 line-clamp-1">{page.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {page.is_published && (
                        <a href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-blue-600 border border-blue-200 hover:bg-blue-50 rounded text-[11px]">表示確認</a>
                      )}
                      <button onClick={() => handleEditPageClick(page)} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                      <button onClick={() => handleDeletePage(page.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. 緊急情報アラート設定 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ サイトトップ 緊急情報発令設定 ]
              </h2>
              <form onSubmit={handleSaveEmergency} className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="emergencyActive"
                    checked={isEmergencyActive}
                    onChange={(e) => setIsEmergencyActive(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="emergencyActive" className="font-bold text-red-600">
                    緊急情報バナーをトップページに表示する（発令中）
                  </label>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">緊急アナウンス内容</label>
                  <input
                    type="text"
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <button type="submit" className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded">
                  緊急情報を即時更新
                </button>
              </form>
            </section>

            {/* 3. 新着情報（お知らせ）管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 新着情報・お知らせ管理 ]
              </h2>
              <form onSubmit={handleAddNews} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold mb-1">お知らせタイトル</label>
                    <input type="text" value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">カテゴリ</label>
                    <select value={newsCategory} onChange={(e) => setNewsCategory(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="お知らせ">お知らせ</option>
                      <option value="採用情報">採用情報</option>
                      <option value="広報">広報</option>
                      <option value="緊急">緊急</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">詳細リンクURL（任意）</label>
                  <input type="text" value={newsLink} onChange={(e) => setNewsLink(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                </div>
                <button type="submit" className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded">お知らせを追加投稿</button>
              </form>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                {newsList.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-500 text-[11px]">{item.date_str}</span>
                      <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px]">{item.category}</span>
                      <span className="font-bold text-slate-800">{item.title}</span>
                    </div>
                    <button onClick={() => handleDeleteNews(item.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. 警察官採用試験 合否データ管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 警察官採用試験 合否データの登録・変更 ]
              </h2>

              <form onSubmit={handleSaveExamResult} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">
                  {editingExamId !== null ? '合否データの編集' : '新規受験者の合否登録'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">試験名</label>
                    <input required type="text" value={examName} onChange={(e) => setExamName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">受験番号</label>
                    <input required type="text" value={examNumber} onChange={(e) => setExamNumber(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">氏名</label>
                    <input required type="text" value={examFullName} onChange={(e) => setExamFullName(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">生年月日</label>
                    <input required type="date" value={examBirthDate} onChange={(e) => setExamBirthDate(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">合否結果</label>
                    <select required value={examResult} onChange={(e) => setExamResult(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="">選択してください</option>
                      <option value="合格">合格</option>
                      <option value="不合格">不合格</option>
                      <option value="第一次合格">第一次合格</option>
                      <option value="最終合格">最終合格</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingExamId !== null && (
                    <button type="button" onClick={() => { setEditingExamId(null); setExamNumber(''); setExamName(''); setExamFullName(''); setExamBirthDate(''); setExamResult(''); }} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded">
                    {editingExamId !== null ? '変更を保存' : '合否データを登録'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs overflow-x-auto">
                {examResultsList.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-4 min-w-[500px]">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px]">{item.exam_number}</span>
                        <span className="font-bold text-slate-800">{item.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.result?.includes('合格') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                          {item.result}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">生年月日: {item.birth_date} / 試験名: {item.exam_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditExamClick(item)} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                      <button onClick={() => handleDeleteExam(item.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. メインメニューカード管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ メインメニューカード・並び替え管理 ]
              </h2>

              <form onSubmit={handleSaveMenuCard} className="bg-slate-50 border border-slate-200 rounded p-4 mb-6 space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">
                  {editingCardId ? 'メニューカードの編集' : '新規メニューカードの追加'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">カードタイトル</label>
                    <input type="text" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">遷移先URL</label>
                    <input type="text" value={cardLink} onChange={(e) => setCardLink(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">表示順（数字が小さいほど先頭）</label>
                    <input type="number" value={cardOrder} onChange={(e) => setCardOrder(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">カードの説明文</label>
                  <input type="text" value={cardDesc} onChange={(e) => setCardDesc(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded" />
                </div>
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={cardVisible}
                    onChange={(e) => setCardVisible(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  トップページに表示する
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  {editingCardId && (
                    <button type="button" onClick={() => { setEditingCardId(null); setCardTitle(''); setCardDesc(''); setCardLink(''); setCardOrder('0'); setCardVisible(true); }} className="px-3 py-1.5 border border-slate-300 bg-white rounded">
                      キャンセル
                    </button>
                  )}
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded">
                    {editingCardId ? '変更を保存' : 'カードを追加'}
                  </button>
                </div>
              </form>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {menuCards.map((card) => (
                  <div key={card.id} className="p-3 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px] mr-2">順序: {card.display_order}</span>
                      <span className="font-bold text-slate-800 mr-2">{card.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${card.is_visible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {card.is_visible ? '表示中' : '非表示'}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">({card.link_url})</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">{card.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingCardId(card.id); setCardTitle(card.title); setCardDesc(card.description || ''); setCardLink(card.link_url); setCardOrder(String(card.display_order)); setCardVisible(card.is_visible); }} className="px-2.5 py-1 text-slate-700 border border-slate-300 bg-white rounded text-[11px]">編集</button>
                      <button onClick={() => handleDeleteCard(card.id)} className="px-2.5 py-1 text-red-600 border border-red-200 hover:bg-red-50 rounded text-[11px]">削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. ユーザーアカウント & 権限管理 */}
            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 登録ユーザー・ロール管理 ]
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                管理者は警察職員ロールを変更できます。管理者権限の付与・解除は主任管理者のみ行えます。
              </p>

              <div className="border border-slate-200 rounded divide-y divide-slate-100 text-xs">
                {userProfiles.map((user) => (
                  <div key={user.id} className="p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{user.full_name || '名前未設定'}</span>
                        <span className="text-slate-500 font-mono text-[11px] break-all">({user.email || user.id})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${user.is_admin ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-slate-100 text-slate-700'}`}>
                          {user.is_super_admin ? '主任管理者' : user.is_admin ? '一般管理者' : '一般ユーザー'}
                        </span>
                        {user.is_police_staff && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            警察職員・{user.police_org_role}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {user.is_police_staff && (
                        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                          警察内役割
                          <select
                            value={user.police_org_role}
                            disabled={updatingRoleId === user.id}
                            onChange={(event) => {
                              const role = event.target.value;
                              if (role === '教官' || role === '学生' || role === '一般' || role === '指令') {
                                void handleUpdatePoliceOrganizationRole(user, role);
                              }
                            }}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] disabled:opacity-50"
                          >
                            <option value="一般">一般</option>
                            <option value="教官">教官</option>
                            <option value="学生">学生</option>
                            <option value="指令">指令</option>
                          </select>
                        </label>
                      )}
                      <button
                        type="button"
                        disabled={user.is_super_admin || updatingRoleId === user.id}
                        onClick={() => handleUpdateUserRoles(user, {
                          isAdmin: user.is_admin,
                          isPoliceStaff: !user.is_police_staff,
                        })}
                        className="px-3 py-1 rounded text-[11px] font-semibold border border-emerald-300 text-emerald-800 bg-emerald-50 disabled:opacity-50"
                      >
                        {user.is_police_staff ? '警察職員を解除' : '警察職員に設定'}
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={user.is_super_admin || updatingRoleId === user.id}
                          onClick={() => handleUpdateUserRoles(user, {
                            isAdmin: !user.is_admin,
                            isPoliceStaff: user.is_police_staff,
                          })}
                          className={`px-3 py-1 rounded text-[11px] font-semibold ${user.is_admin ? 'border border-amber-300 text-amber-800 bg-amber-50' : 'border border-blue-300 text-blue-800 bg-blue-50'} disabled:opacity-50`}
                        >
                          {user.is_admin ? '管理者権限を解除' : '管理者権限を付与'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-300 rounded shadow-sm p-6">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">
                [ 警察向けCommand system接続設定 ]
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                Command systemを起動しているPCのIPアドレスとポートを入力します。警察専用ページの110番通報ボタンから通報確認画面を開きます。
              </p>
              <form onSubmit={handleSaveCommandSystemUrl} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={commandSystemUrl}
                  onChange={(e) => setCommandSystemUrl(e.target.value)}
                  aria-label="Command systemサーバーURL"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-xs font-mono"
                />
                <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded">
                  接続先を保存
                </button>
              </form>
              <p className="text-[11px] text-slate-500 mt-2">
                空欄にして保存すると接続先を解除します。警察職員の端末から設定URLへ接続できる必要があります。
              </p>
            </section>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}