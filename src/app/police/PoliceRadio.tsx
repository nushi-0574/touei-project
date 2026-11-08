'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import PoliceRadioVoice from './PoliceRadioVoice';
import { Radio, Send, Clock, AlertCircle } from 'lucide-react';

const CHANNELS = ['県内', 'Ch1', 'CH2', '非常用', '教育'] as const;
type RadioChannel = (typeof CHANNELS)[number];
type RadioMessage = {
  id: string;
  channel: RadioChannel;
  author_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

function isRadioChannel(value: string): value is RadioChannel {
  return CHANNELS.some((channel) => channel === value);
}

function mergeMessages(current: RadioMessage[], incoming: RadioMessage[]): RadioMessage[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()]
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(-100);
}

export default function PoliceRadio() {
  const [channel, setChannel] = useState<RadioChannel>('県内');
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const subscription = supabase
      .channel(`police-radio:${channel}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'police_radio_messages', filter: `channel=eq.${channel}` },
        (payload) => {
          const row = payload.new as RadioMessage;
          if (active && isRadioChannel(row.channel)) {
            setMessages((current) => mergeMessages(current, [row]));
          }
        },
      )
      .subscribe((status) => {
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          setErrorMessage('無線のリアルタイム接続に失敗しました。ページを再読み込みしてください。');
        }
      });

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('police_radio_messages')
          .select('id, channel, author_id, sender_name, body, created_at')
          .eq('channel', channel)
          .order('created_at', { ascending: false })
          .limit(100);
        if (!active) return;
        if (error) throw error;
        const history = (data ?? []).filter((row): row is RadioMessage => isRadioChannel(row.channel)).reverse();
        setMessages((current) => mergeMessages(history, current));
      } catch (error) {
        console.error('警察無線の履歴を取得できませんでした:', error);
        if (active) setErrorMessage('無線の履歴を読み込めませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, [channel]);

  function selectChannel(nextChannel: RadioChannel) {
    if (nextChannel === channel) return;
    setMessages([]);
    setErrorMessage('');
    setLoading(true);
    setChannel(nextChannel);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('police_radio_messages')
        .insert({ channel, body })
        .select('id, channel, author_id, sender_name, body, created_at')
        .single();
      if (error) throw error;
      if (!isRadioChannel(data.channel)) throw new Error('無線メッセージのチャンネルが不正です。');
      setMessages((current) => mergeMessages(current, [data]));
      setDraft('');
    } catch (error) {
      console.error('警察無線の送信に失敗しました:', error);
      setErrorMessage('メッセージを送信できませんでした。入力内容と接続を確認してください。');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="bg-white border border-slate-300 rounded-sm font-sans overflow-hidden">
      {/* 統括ヘッダー */}
      <div className="bg-slate-900 text-white border-b border-slate-800 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 border border-slate-700 text-slate-200">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase block">
                POLICE RADIO SYSTEM
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                警察無線統括通信卓 (県内・各種通信回線)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">通信回線:</span>
            <span className="bg-slate-800 text-emerald-300 border border-slate-700 px-2.5 py-1 font-bold">
              {channel} チャンネル
            </span>
          </div>
        </div>

        {/* チャンネル切替タブ */}
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="無線チャンネル">
          {CHANNELS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={channel === item}
              onClick={() => selectChannel(item)}
              className={`px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                channel === item
                  ? 'bg-slate-800 text-white border-slate-600'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {item} チャンネル
            </button>
          ))}
        </div>
      </div>

      <PoliceRadioVoice key={channel} channel={channel} />

      {/* 無線ログ表示領域 */}
      <div
        className="h-80 space-y-2 overflow-y-auto bg-[#f8fafc] p-4 text-xs border-b border-slate-300"
        role="tabpanel"
        aria-label={`${channel}チャンネルの通信ログ`}
        aria-live="polite"
      >
        {loading ? (
          <p className="text-center text-slate-500 py-12 font-mono">暗号化無線回線に接続中...</p>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-slate-500 font-mono">{channel}チャンネルの通信ログはありません。</p>
        ) : messages.map((message) => (
          <article key={message.id} className="bg-white border border-slate-200 p-3 space-y-1 rounded-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-900 text-xs">{message.sender_name}</span>
              <span className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {new Date(message.created_at).toLocaleString('ja-JP')}
              </span>
            </div>
            <p className="whitespace-pre-wrap break-words text-slate-800 leading-relaxed text-xs pt-1 font-sans">
              {message.body}
            </p>
          </article>
        ))}

        {errorMessage && (
          <div role="alert" className="bg-red-50 border border-red-300 p-3 text-red-900 text-xs flex items-center gap-2 rounded-sm">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 送信フォーム */}
      <form onSubmit={sendMessage} className="flex items-stretch gap-2 bg-slate-50 p-3">
        <label className="sr-only" htmlFor="police-radio-message">無線伝送メッセージ</label>
        <textarea
          id="police-radio-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={2}
          placeholder={`${channel} チャンネルへ無線通信メッセージを伝送`}
          className="min-h-[44px] min-w-0 flex-1 resize-y bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-800 focus:outline-none rounded-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sending ? '送信中...' : '送信'}</span>
        </button>
      </form>
    </section>
  );
}
