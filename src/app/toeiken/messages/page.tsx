'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, Plus, Search, Send, Users, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import ResidentAvatar from '../../components/ResidentAvatar';
import { supabase } from '../../../lib/supabase';
import { getErrorMessage } from '../../../lib/errors';

type Resident = {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
};

type Conversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  last_message_at: string;
  residents: Resident[];
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ResidentMessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageConversationId, setMessageConversationId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [conversationKind, setConversationKind] = useState<'direct' | 'group'>('direct');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryResults, setDirectoryResults] = useState<Resident[]>([]);
  const [selectedResidents, setSelectedResidents] = useState<Resident[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [searchingResidents, setSearchingResidents] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [composerError, setComposerError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const residentNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const conversation of conversations) {
      for (const resident of conversation.residents) names.set(resident.user_id, resident.display_name);
    }
    return names;
  }, [conversations]);

  const loadConversations = useCallback(async (currentUser: User, preferredId?: string) => {
    const { data: memberships, error: membershipsError } = await supabase
      .from('resident_conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUser.id);
    if (membershipsError) throw membershipsError;

    const conversationIds = [...new Set((memberships ?? []).map((membership) => membership.conversation_id))];
    if (conversationIds.length === 0) {
      setConversations([]);
      setSelectedConversationId('');
      return;
    }

    const { data: conversationRows, error: conversationsError } = await supabase
      .from('resident_conversations')
      .select('id, kind, title, last_message_at')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false });
    if (conversationsError) throw conversationsError;

    const { data: memberRows, error: membersError } = await supabase
      .from('resident_conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds);
    if (membersError) throw membersError;

    const memberIds = [...new Set((memberRows ?? []).map((member) => member.user_id))];
    const residentProfiles: Resident[] = [];
    for (let index = 0; index < memberIds.length; index += 100) {
      const { data, error } = await supabase.rpc('get_resident_public_profiles', {
        target_user_ids: memberIds.slice(index, index + 100),
      });
      if (error) throw error;
      residentProfiles.push(...(data ?? []).map((profile: Resident) => ({
        user_id: profile.user_id,
        display_name: profile.display_name,
        avatar_path: profile.avatar_path,
      })));
    }

    const profileById = new Map(residentProfiles.map((resident) => [resident.user_id, resident]));
    const residentsByConversation = new Map<string, Resident[]>();
    for (const member of memberRows ?? []) {
      const resident = profileById.get(member.user_id);
      if (!resident) continue;
      const residents = residentsByConversation.get(member.conversation_id) ?? [];
      residents.push(resident);
      residentsByConversation.set(member.conversation_id, residents);
    }

    const nextConversations = (conversationRows ?? []).map((conversation) => ({
      id: conversation.id,
      kind: conversation.kind as Conversation['kind'],
      title: conversation.title,
      last_message_at: conversation.last_message_at,
      residents: residentsByConversation.get(conversation.id) ?? [],
    }));
    setConversations(nextConversations);
    setSelectedConversationId((current) => {
      if (preferredId && nextConversations.some((conversation) => conversation.id === preferredId)) return preferredId;
      if (current && nextConversations.some((conversation) => conversation.id === current)) return current;
      return nextConversations[0]?.id ?? '';
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace('/toeiken');
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('resident_status')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.resident_status !== 'active') {
          setPageError('有効な住民アカウントのみチャットを利用できます。');
          return;
        }
        if (!active) return;
        setUser(session.user);

        const requestedResidentId = new URLSearchParams(window.location.search).get('user');
        let preferredId: string | undefined;
        if (requestedResidentId && requestedResidentId !== session.user.id) {
          const { data, error } = await supabase.rpc('create_resident_conversation', {
            conversation_kind: 'direct',
            conversation_title: null,
            target_user_ids: [requestedResidentId],
          });
          if (error) throw error;
          preferredId = data;
        }
        await loadConversations(session.user, preferredId);
      } catch (error) {
        console.error('住民チャットを読み込めませんでした:', error);
        if (active) setPageError(getErrorMessage(error, 'チャットを読み込めませんでした。住民登録をご確認ください。'));
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [loadConversations, router]);

  useEffect(() => {
    if (!selectedConversationId) return;

    let active = true;

    async function loadMessages() {
      setLoadingMessages(true);
      setMessageError('');
      const { data, error } = await supabase
        .from('resident_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      if (active) {
        setMessages((data ?? []).reverse());
        setMessageConversationId(selectedConversationId);
      }
    }

    void loadMessages()
      .catch((error: unknown) => {
        console.error('チャットメッセージを読み込めませんでした:', error);
        if (active) setMessageError(getErrorMessage(error, 'メッセージを読み込めませんでした。'));
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });

    return () => {
      active = false;
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !user) return;

    const channel = supabase
      .channel(`resident-chat-${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'resident_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((current) => current.some((message) => message.id === incoming.id)
            ? current
            : [...current, incoming]);
          void loadConversations(user, selectedConversationId).catch((error: unknown) => {
            console.error('会話一覧を更新できませんでした:', error);
            setPageError(getErrorMessage(error, '会話一覧を更新できませんでした。'));
          });
        },
      )
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('チャットのリアルタイム接続に失敗しました:', error);
          setMessageError('リアルタイム接続に失敗しました。ページを再読み込みしてください。');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversations, selectedConversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const searchResidents = async (event?: React.FormEvent, searchText = directorySearch) => {
    event?.preventDefault();
    setSearchingResidents(true);
    setComposerError('');
    try {
      const { data, error } = await supabase.rpc('search_resident_directory', {
        search_text: searchText.trim(),
        result_limit: 50,
      });
      if (error) throw error;
      setDirectoryResults((data ?? []).map((resident: Resident) => ({
        user_id: resident.user_id,
        display_name: resident.display_name,
        avatar_path: resident.avatar_path,
      })));
    } catch (error) {
      console.error('住民を検索できませんでした:', error);
      setComposerError(getErrorMessage(error, '住民を検索できませんでした。'));
    } finally {
      setSearchingResidents(false);
    }
  };

  const openComposer = (kind: 'direct' | 'group') => {
    setConversationKind(kind);
    setDirectorySearch('');
    setDirectoryResults([]);
    setSelectedResidents([]);
    setGroupTitle('');
    setComposerError('');
    setComposerOpen(true);
    void searchResidents(undefined, '');
  };

  const toggleResident = (resident: Resident) => {
    setSelectedResidents((current) => current.some((item) => item.user_id === resident.user_id)
      ? current.filter((item) => item.user_id !== resident.user_id)
      : [...current, resident]);
  };

  const createConversation = async () => {
    if (selectedResidents.length === 0) {
      setComposerError('参加する住民を選択してください。');
      return;
    }
    if (conversationKind === 'group' && selectedResidents.length < 2) {
      setComposerError('グループには自分以外に2人以上を選択してください。');
      return;
    }
    if (conversationKind === 'group' && selectedResidents.length > 49) {
      setComposerError('グループの参加者は自分を含めて50人までです。');
      return;
    }
    if (conversationKind === 'group' && !groupTitle.trim()) {
      setComposerError('グループ名を入力してください。');
      return;
    }

    setCreatingConversation(true);
    setComposerError('');
    try {
      const { data, error } = await supabase.rpc('create_resident_conversation', {
        conversation_kind: conversationKind,
        conversation_title: conversationKind === 'group' ? groupTitle.trim() : null,
        target_user_ids: selectedResidents.map((resident) => resident.user_id),
      });
      if (error) throw error;
      if (!user) throw new Error('ログイン状態を確認できませんでした。');
      await loadConversations(user, data);
      setSelectedConversationId(data);
      setComposerOpen(false);
    } catch (error) {
      console.error('会話を作成できませんでした:', error);
      setComposerError(getErrorMessage(error, '会話を作成できませんでした。'));
    } finally {
      setCreatingConversation(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedConversationId || !user) return;
    if (body.length > 4000) {
      setMessageError('メッセージは4000文字以内で入力してください。');
      return;
    }

    setSending(true);
    setMessageError('');
    try {
      const { data, error } = await supabase
        .from('resident_messages')
        .insert({ conversation_id: selectedConversationId, sender_id: user.id, body })
        .select('id, conversation_id, sender_id, body, created_at')
        .single();
      if (error) throw error;
      setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data]);
      setDraft('');
      await loadConversations(user, selectedConversationId);
    } catch (error) {
      console.error('メッセージを送信できませんでした:', error);
      setMessageError(getErrorMessage(error, 'メッセージを送信できませんでした。'));
    } finally {
      setSending(false);
    }
  };

  const conversationLabel = (conversation: Conversation) => conversation.kind === 'group'
    ? conversation.title || 'グループ'
    : conversation.residents.find((resident) => resident.user_id !== user?.id)?.display_name || '住民';
  const visibleMessages = messageConversationId === selectedConversationId ? messages : [];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Breadcrumbs items={[{ label: '住民チャット' }]} />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">住民チャット</h1>
            <p className="mt-1 text-sm text-slate-600">住民同士で個人チャットやグループ会話ができます。</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => openComposer('direct')}
              className="inline-flex min-h-10 items-center gap-2 rounded border border-blue-700 bg-white px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              <Plus className="size-4" aria-hidden="true" />
              個人チャット
            </button>
            <button
              type="button"
              onClick={() => openComposer('group')}
              className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <Users className="size-4" aria-hidden="true" />
              グループ作成
            </button>
          </div>
        </div>

        {pageError && (
          <p role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {pageError}
          </p>
        )}

        <section className="grid min-h-[65vh] overflow-hidden rounded border border-slate-200 bg-white shadow-sm md:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className={`border-b border-slate-200 md:border-b-0 md:border-r ${selectedConversationId ? 'hidden md:block' : ''}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-900">会話一覧</h2>
              <span className="text-xs text-slate-500">{conversations.length}件</span>
            </div>
            {loading ? (
              <p className="p-5 text-sm text-slate-500">読み込み中...</p>
            ) : conversations.length === 0 ? (
              <div className="p-5 text-center">
                <MessageCircle className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                <p className="mt-2 text-sm text-slate-600">まだ会話がありません。</p>
                <button type="button" onClick={() => openComposer('direct')} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">
                  住民を探してチャットを始める
                </button>
              </div>
            ) : (
              <ul className="max-h-[65vh] overflow-y-auto">
                {conversations.map((conversation) => {
                  const otherResident = conversation.residents.find((resident) => resident.user_id !== user?.id);
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedConversationId(conversation.id)}
                        aria-current={selectedConversationId === conversation.id ? 'true' : undefined}
                        className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${selectedConversationId === conversation.id ? 'bg-blue-50' : ''}`}
                      >
                        {conversation.kind === 'direct' ? (
                          <ResidentAvatar path={otherResident?.avatar_path} name={otherResident?.display_name || '住民'} size="small" />
                        ) : (
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                            <Users className="size-4" aria-hidden="true" />
                          </div>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{conversationLabel(conversation)}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {conversation.kind === 'group' ? `${conversation.residents.length}人のグループ` : '個人チャット'}
                          </span>
                        </span>
                        <time className="shrink-0 text-[10px] text-slate-400">{formatMessageTime(conversation.last_message_at)}</time>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className={`flex min-h-[65vh] flex-col ${selectedConversationId ? '' : 'hidden md:flex'}`}>
            {selectedConversation ? (
              <>
                <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId('')}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 md:hidden"
                    aria-label="会話一覧に戻る"
                  >
                    <ArrowLeft className="size-5" aria-hidden="true" />
                  </button>
                  {selectedConversation.kind === 'direct' ? (
                    <ResidentAvatar
                      path={selectedConversation.residents.find((resident) => resident.user_id !== user?.id)?.avatar_path}
                      name={conversationLabel(selectedConversation)}
                      size="small"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                      <Users className="size-4" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-900">{conversationLabel(selectedConversation)}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.kind === 'group' ? `${selectedConversation.residents.length}人のグループ` : '個人チャット'}
                    </p>
                  </div>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
                  {loadingMessages ? (
                    <p className="py-8 text-center text-sm text-slate-500">メッセージを読み込み中...</p>
                  ) : messageError && visibleMessages.length === 0 ? (
                    <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{messageError}</p>
                  ) : visibleMessages.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-500">
                      <MessageCircle className="mx-auto size-8 text-slate-300" aria-hidden="true" />
                      <p className="mt-2">会話が始まりました。最初のメッセージを送ってみましょう。</p>
                    </div>
                  ) : visibleMessages.map((message) => {
                    const ownMessage = message.sender_id === user?.id;
                    return (
                      <div key={message.id} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${ownMessage ? 'items-end' : 'items-start'}`}>
                          {!ownMessage && <span className="mb-1 px-1 text-xs text-slate-500">{residentNames.get(message.sender_id) || '住民'}</span>}
                          <p className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${ownMessage ? 'rounded-br-sm bg-blue-700 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'}`}>
                            {message.body}
                          </p>
                          <time className="mt-1 px-1 text-[10px] text-slate-400">{formatMessageTime(message.created_at)}</time>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {messageError && visibleMessages.length > 0 && (
                  <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">{messageError}</p>
                )}
                <form onSubmit={(event) => void sendMessage(event)} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4">
                  <label className="sr-only" htmlFor="resident-message">メッセージ</label>
                  <textarea
                    id="resident-message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    maxLength={4000}
                    placeholder="メッセージを入力（Enterで送信、Shift+Enterで改行）"
                    className="min-h-12 flex-1 resize-y rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex min-h-12 items-center gap-2 rounded bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{sending ? '送信中...' : '送信'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <MessageCircle className="size-12 text-slate-300" aria-hidden="true" />
                <h2 className="mt-3 font-semibold text-slate-700">会話を選択してください</h2>
                <p className="mt-1 text-sm text-slate-500">住民を探して個人チャットを始めたり、グループを作成できます。</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {composerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resident-chat-dialog-title"
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded bg-white shadow-xl"
          >
            <header className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h2 id="resident-chat-dialog-title" className="text-lg font-bold text-slate-900">
                  {conversationKind === 'direct' ? '個人チャットを始める' : 'グループを作成'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">チャットする住民を検索して選んでください。</p>
              </div>
              <button type="button" onClick={() => setComposerOpen(false)} aria-label="閉じる" className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>

            <div className="space-y-4 overflow-y-auto p-4">
              {conversationKind === 'group' && (
                <div>
                  <label htmlFor="group-title" className="mb-1 block text-sm font-semibold text-slate-700">グループ名</label>
                  <input
                    id="group-title"
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.target.value)}
                    maxLength={60}
                    placeholder="例：町内会"
                    className="min-h-10 w-full rounded border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
              <form onSubmit={(event) => void searchResidents(event)} className="flex gap-2">
                <label className="sr-only" htmlFor="resident-search">住民を検索</label>
                <input
                  id="resident-search"
                  value={directorySearch}
                  onChange={(event) => setDirectorySearch(event.target.value)}
                  maxLength={40}
                  placeholder="表示名で検索"
                  className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button type="submit" disabled={searchingResidents} className="inline-flex min-h-10 items-center gap-2 rounded bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                  <Search className="size-4" aria-hidden="true" />
                  検索
                </button>
              </form>
              {selectedResidents.length > 0 && (
                <p className="text-xs text-blue-800">
                  選択中：{selectedResidents.map((resident) => resident.display_name).join('、')}
                  {conversationKind === 'group' && `（自分を含めて${selectedResidents.length + 1}人）`}
                </p>
              )}
              {composerError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{composerError}</p>}
              <ul className="divide-y divide-slate-100 rounded border border-slate-200">
                {searchingResidents ? (
                  <li className="p-4 text-center text-sm text-slate-500">検索中...</li>
                ) : directoryResults.length === 0 ? (
                  <li className="p-4 text-center text-sm text-slate-500">該当する住民がいません。</li>
                ) : directoryResults.map((resident) => {
                  const isSelected = selectedResidents.some((item) => item.user_id === resident.user_id);
                  return (
                    <li key={resident.user_id}>
                      <button
                        type="button"
                        onClick={() => conversationKind === 'direct'
                          ? setSelectedResidents([resident])
                          : toggleResident(resident)}
                        aria-pressed={isSelected}
                        className={`flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <ResidentAvatar path={resident.avatar_path} name={resident.display_name} size="small" />
                        <span className="flex-1 text-sm font-semibold text-slate-800">{resident.display_name}</span>
                        <span className="text-xs font-semibold text-blue-700">{isSelected ? '選択中' : '選択'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
              <span className="text-xs text-slate-500">
                {conversationKind === 'group' ? '参加者は自分以外2〜49人' : '個人チャットは1人選択'}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setComposerOpen(false)} className="min-h-10 rounded border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  disabled={creatingConversation}
                  className="min-h-10 rounded bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {creatingConversation ? '作成中...' : conversationKind === 'direct' ? 'チャットを開始' : 'グループを作成'}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
