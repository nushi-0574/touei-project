'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

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
    <section className="overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">警察無線</h2>
        <p className="mt-1 text-sm text-slate-600">チャンネルを選択して、警察職員間でテキスト連絡できます。</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="無線チャンネル">
          {CHANNELS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={channel === item}
              onClick={() => selectChannel(item)}
              className={`min-h-10 rounded border px-4 text-sm font-semibold ${
                channel === item
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-80 space-y-3 overflow-y-auto bg-slate-50 p-4"
        role="tabpanel"
        aria-label={`${channel}チャンネルのメッセージ`}
        aria-live="polite"
      >
        {loading ? (
          <p className="text-center text-sm text-slate-500">無線を接続しています...</p>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">このチャンネルにメッセージはありません。</p>
        ) : messages.map((message) => (
          <article key={message.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-slate-800">{message.sender_name}</p>
              <time className="text-xs text-slate-500" dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString('ja-JP')}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{message.body}</p>
          </article>
        ))}
        {errorMessage && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
      </div>

      <form onSubmit={sendMessage} className="flex items-end gap-3 border-t border-slate-200 p-4">
        <label className="sr-only" htmlFor="police-radio-message">無線メッセージ</label>
        <textarea
          id="police-radio-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={2}
          placeholder={`${channel}へメッセージを送信`}
          className="min-h-12 min-w-0 flex-1 resize-y rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-12 rounded bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? '送信中...' : '送信'}
        </button>
      </form>
    </section>
  );
}
