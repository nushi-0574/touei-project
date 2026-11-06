'use client';

import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';

type WorkItemType = 'application' | 'support_ticket' | 'profile_change' | 'document_request';
type WorkItemNote = { id: string; author_id: string; body: string; created_at: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : '処理を完了できませんでした。';

export default function WorkItemNotes({ workItemType, workItemId, authorId }: {
  workItemType: WorkItemType;
  workItemId: string;
  authorId: string;
}) {
  const [notes, setNotes] = useState<WorkItemNote[]>([]);
  const [body, setBody] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase.from('staff_work_item_notes')
      .select('id, author_id, body, created_at')
      .eq('work_item_type', workItemType)
      .eq('work_item_id', workItemId)
      .order('created_at');
    if (error) throw error;
    setNotes(data ?? []);
  }, [workItemId, workItemType]);

  function onToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || loaded || loading) return;
    setLoading(true);
    setErrorMessage('');
    loadNotes().then(() => setLoaded(true)).catch((error: unknown) => {
      console.error('内部メモを取得できませんでした:', error);
      setErrorMessage(errorText(error));
    }).finally(() => setLoading(false));
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!authorId || !body.trim()) return;
    setSaving(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('staff_work_item_notes').insert({
        work_item_type: workItemType,
        work_item_id: workItemId,
        author_id: authorId,
        body: body.trim(),
      });
      if (error) throw error;
      setBody('');
      await loadNotes();
      setLoaded(true);
    } catch (error) {
      console.error('内部メモを保存できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details onToggle={onToggle} className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-xs font-semibold">職員用の内部メモ ({notes.length})</summary>
      {errorMessage && <p role="alert" className="mt-2 text-xs text-red-700">{errorMessage}</p>}
      {loading && <p className="mt-2 text-xs text-slate-500">読み込み中...</p>}
      <div className="mt-2 space-y-2">
        {notes.map((item) => (
          <p key={item.id} className="rounded bg-white p-2 text-xs">
            <span className="font-semibold">{item.author_id.slice(0, 8)}</span> · {new Date(item.created_at).toLocaleString()}
            <span className="mt-1 block whitespace-pre-wrap">{item.body}</span>
          </p>
        ))}
      </div>
      <form onSubmit={addNote} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`workflow-note-${workItemId}`}>内部メモ</label>
        <input id={`workflow-note-${workItemId}`} required maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={saving} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{saving ? '保存中...' : 'メモを追加'}</button>
      </form>
    </details>
  );
}
