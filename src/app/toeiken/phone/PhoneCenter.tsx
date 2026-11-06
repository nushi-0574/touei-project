'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import Header from '../../components/Header';
import Breadcrumbs from '../../components/Breadcrumbs';
import { ContentSkeleton } from '@/src/app/components/LoadingScreen';
import { supabase } from '../../../lib/supabase';

type Department = 'operations' | 'administration' | 'development' | 'police' | 'fire' | 'corporate';
type CallStatus = 'queued' | 'connecting' | 'completed' | 'cancelled' | 'declined';
type PhoneNumber = { phone_number: string; status: 'active' | 'suspended' };
type NumberRequest = { id: string; preferred_number: string | null; status: string; staff_response: string | null; created_at: string };
type PhoneCall = {
  id: string;
  caller_id: string;
  caller_number: string;
  department: Department;
  status: CallStatus;
  assigned_to: string | null;
  created_at: string;
};
type CallSignal = {
  id: number;
  call_id: string;
  sender_id: string;
  signal_type: 'offer' | 'answer' | 'ice_candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
};
type IceServerResponse = { iceServers: RTCIceServer[]; turnAvailable: boolean };

const departments: { id: Department; label: string; roles: string[] }[] = [
  { id: 'operations', label: '運営局', roles: ['operations_bureau'] },
  { id: 'administration', label: '管理局', roles: ['administration_bureau'] },
  { id: 'development', label: '開発局', roles: ['development_bureau'] },
  { id: 'police', label: '警察', roles: ['police'] },
  { id: 'fire', label: '消防', roles: ['fire'] },
  { id: 'corporate', label: '企業窓口', roles: ['corporate'] },
];

const activeStatuses: CallStatus[] = ['queued', 'connecting'];
const inputClass = 'w-full rounded border border-slate-300 px-3 py-2 text-sm';
const errorText = (error: unknown) => error instanceof Error ? error.message : '処理を完了できませんでした。';

function isDepartment(value: unknown): value is Department {
  return departments.some((department) => department.id === value);
}

function upsertCall(calls: PhoneCall[], call: PhoneCall): PhoneCall[] {
  return [call, ...calls.filter((item) => item.id !== call.id)]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 100);
}

function callStatusLabel(status: CallStatus): string {
  return ({
    queued: '職員の応答を待っています',
    connecting: '音声を接続しています',
    completed: '通話終了',
    cancelled: '発信を取り消しました',
    declined: '応答できませんでした',
  })[status];
}

export default function PhoneCenter() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState<PhoneNumber | null>(null);
  const [isActiveResident, setIsActiveResident] = useState(false);
  const [numberRequests, setNumberRequests] = useState<NumberRequest[]>([]);
  const [calls, setCalls] = useState<PhoneCall[]>([]);
  const [staffDepartments, setStaffDepartments] = useState<Department[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>('operations');
  const [preferredNumber, setPreferredNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [callState, setCallState] = useState('待機中');
  const [turnAvailable, setTurnAvailable] = useState<boolean | null>(null);
  const [muted, setMuted] = useState(false);
  const [incomingSignals, setIncomingSignals] = useState<CallSignal[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerCallIdRef = useRef('');
  const processedSignalsRef = useRef(new Set<number>());
  const processingSignalsRef = useRef(new Set<number>());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const loadData = useCallback(async (currentUser: User) => {
    const [{ data: phoneData, error: phoneError }, { data: requestData, error: requestError }, { data: roleRows, error: rolesError }, { data: permissionRows, error: permissionError }, { data: profile, error: profileError }] = await Promise.all([
      supabase.from('phone_numbers').select('phone_number, status').eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('phone_number_requests').select('id, preferred_number, status, staff_response, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('staff_roles').select('role').eq('user_id', currentUser.id),
      supabase.from('staff_permissions').select('permission').eq('user_id', currentUser.id),
      supabase.from('profiles').select('is_admin, is_police_staff, resident_status').eq('id', currentUser.id).maybeSingle(),
    ]);
    if (phoneError) throw phoneError;
    if (requestError) throw requestError;
    if (rolesError) throw rolesError;
    if (permissionError) throw permissionError;
    if (profileError) throw profileError;

    const roleSet = new Set((roleRows ?? []).map((item) => item.role as string));
    const permissionSet = new Set((permissionRows ?? []).map((item) => item.permission as string));
    const admin = profile?.is_admin === true;
    const canManageAllSupportCalls = admin || permissionSet.has('manage_support');
    const eligible = departments
      .filter((department) => canManageAllSupportCalls
        || department.roles.some((role) => roleSet.has(role))
        || (department.id === 'police' && profile?.is_police_staff === true))
      .map((department) => department.id);
    setPhone(phoneData as PhoneNumber | null);
    setNumberRequests((requestData ?? []) as NumberRequest[]);
    setStaffDepartments(eligible);
    setIsAdmin(admin);
    setIsActiveResident(profile?.resident_status === 'active');

    const { data: callRows, error: callsError } = await supabase.from('phone_calls')
      .select('id, caller_id, caller_number, department, status, assigned_to, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (callsError) throw callsError;
    setCalls((callRows ?? []).filter((item): item is PhoneCall => isDepartment(item.department)));
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) throw new Error('電話サービスを利用するにはログインしてください。');
        await loadData(session.user);
        if (active) setUser(session.user);
      } catch (error) {
        console.error('電話サービスの初期化に失敗しました:', error);
        if (active) setErrorMessage(errorText(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadData]);

  useEffect(() => {
    if (!user) return;
    const callsChannel = supabase.channel(`telephone-calls-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phone_calls' }, (payload) => {
        const row = payload.new as Partial<PhoneCall>;
        if (row.id && row.caller_id && row.caller_number && isDepartment(row.department)
          && row.status && row.assigned_to !== undefined && row.created_at) {
          setCalls((current) => upsertCall(current, row as PhoneCall));
          if (!activeStatuses.includes(row.status)) {
            setRemoteStream(null);
            setMuted(false);
            setCallState('待機中');
          }
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setErrorMessage('着信のリアルタイム接続に失敗しました。ページを再読み込みしてください。');
        }
      });
    const signalsChannel = supabase.channel(`telephone-signals-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'phone_call_signals' }, (payload) => {
        const signal = payload.new as CallSignal;
        if (signal.sender_id !== user.id) setIncomingSignals((current) => [...current, signal]);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setErrorMessage('音声シグナリングの接続に失敗しました。ページを再読み込みしてください。');
        }
      });
    return () => {
      void supabase.removeChannel(callsChannel);
      void supabase.removeChannel(signalsChannel);
    };
  }, [user]);

  const activeCall = useMemo(() => {
    if (!user) return null;
    return calls.find((call) => call.caller_id === user.id && activeStatuses.includes(call.status))
      ?? calls.find((call) => call.assigned_to === user.id && activeStatuses.includes(call.status))
      ?? null;
  }, [calls, user]);

  const queuedCalls = useMemo(() => calls.filter((call) =>
    call.status === 'queued' && staffDepartments.includes(call.department)),
  [calls, staffDepartments]);

  const sendSignal = useCallback(async (callId: string, type: CallSignal['signal_type'], payload: CallSignal['payload']) => {
    if (!user) return;
    const { error } = await supabase.from('phone_call_signals').insert({
      call_id: callId,
      sender_id: user.id,
      signal_type: type,
      payload,
    });
    if (error) throw error;
  }, [user]);

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peerCallIdRef.current = '';
    pendingCandidatesRef.current = [];
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = remoteStream;
    if (remoteStream) void audioRef.current.play().catch((error: unknown) => {
      console.error('通話音声を再生できませんでした:', error);
      setErrorMessage('音声の自動再生がブロックされました。画面の音声再生ボタンを押してください。');
    });
  }, [remoteStream]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connecting' || !user) {
      closePeer();
      return;
    }
    const isCaller = activeCall.caller_id === user.id;
    if (peerCallIdRef.current === activeCall.id) return;
    peerCallIdRef.current = activeCall.id;
    let active = true;

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('このブラウザーでは音声通話を利用できません。HTTPS対応のブラウザーで開いてください。');
        }
        setErrorMessage('');
        setCallState('マイクへのアクセスを待っています');
        const tokenResult = await supabase.auth.getSession();
        if (tokenResult.error) throw tokenResult.error;
        const token = tokenResult.data.session?.access_token;
        if (!token) throw new Error('ログイン状態を確認できませんでした。');
        const response = await fetch('/api/phone/ice-servers', { headers: { Authorization: `Bearer ${token}` } });
        const iceConfig = await response.json() as IceServerResponse | { error?: string };
        if (!response.ok || !('iceServers' in iceConfig)) {
          throw new Error('error' in iceConfig && iceConfig.error ? iceConfig.error : '音声接続の設定を取得できませんでした。');
        }
        setTurnAvailable(iceConfig.turnAvailable);
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!active) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = localStream;
        const peer = new RTCPeerConnection({ iceServers: iceConfig.iceServers });
        peerRef.current = peer;
        localStream.getAudioTracks().forEach((track) => peer.addTrack(track, localStream));
        peer.ontrack = (event) => {
          const stream = event.streams[0];
          if (stream) setRemoteStream(stream);
        };
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            void sendSignal(activeCall.id, 'ice_candidate', event.candidate.toJSON())
              .catch((error: unknown) => {
                console.error('通話ネットワーク情報を送信できませんでした:', error);
                setErrorMessage('音声接続情報を送信できませんでした。通話を終了して再試行してください。');
              });
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') setCallState('通話中');
          else if (peer.connectionState === 'connecting') setCallState('相手に接続しています');
          else if (peer.connectionState === 'failed') {
            setCallState('音声接続に失敗しました');
            setErrorMessage('音声接続に失敗しました。ネットワークまたはTURNサーバー設定を確認してください。');
          } else if (peer.connectionState === 'disconnected') setCallState('接続が不安定です');
        };
        setCallState('相手に接続しています');
        if (isCaller) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await sendSignal(activeCall.id, 'offer', offer);
        }
      } catch (error) {
        console.error('電話の音声接続を初期化できませんでした:', error);
        if (active) {
          peerCallIdRef.current = '';
          setCallState('接続できません');
          setErrorMessage(errorText(error));
        }
      }
    })();

    return () => {
      active = false;
      if (peerCallIdRef.current === activeCall.id) closePeer();
    };
  }, [activeCall, closePeer, sendSignal, user]);

  useEffect(() => {
    const currentCallId = activeCall?.id;
    const peer = peerRef.current;
    if (!currentCallId || !peer || !user) return;
    const pending = incomingSignals.filter((signal) =>
      signal.call_id === currentCallId && signal.sender_id !== user.id
      && !processedSignalsRef.current.has(signal.id) && !processingSignalsRef.current.has(signal.id));
    if (!pending.length) return;

    for (const signal of pending) processingSignalsRef.current.add(signal.id);
    void (async () => {
      for (const signal of pending) {
        try {
          if (signal.signal_type === 'offer' && activeCall.assigned_to === user.id) {
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            while (pendingCandidatesRef.current.length) {
              await peer.addIceCandidate(pendingCandidatesRef.current.shift()!);
            }
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await sendSignal(currentCallId, 'answer', answer);
          } else if (signal.signal_type === 'answer' && activeCall.caller_id === user.id) {
            await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
            while (pendingCandidatesRef.current.length) {
              await peer.addIceCandidate(pendingCandidatesRef.current.shift()!);
            }
          } else if (signal.signal_type === 'ice_candidate') {
            const candidate = signal.payload as RTCIceCandidateInit;
            if (peer.remoteDescription) await peer.addIceCandidate(candidate);
            else pendingCandidatesRef.current.push(candidate);
          }
          processedSignalsRef.current.add(signal.id);
        } catch (error) {
          console.error('着信した通話情報を処理できませんでした:', error);
          setErrorMessage('通話の接続処理に失敗しました。通話を終了して再試行してください。');
          processedSignalsRef.current.add(signal.id);
        } finally {
          processingSignalsRef.current.delete(signal.id);
        }
      }
    })();
  }, [activeCall, incomingSignals, sendSignal, user]);

  async function requestPhoneNumber() {
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    try {
      if (!user) throw new Error('ログインしてください。');
      const requestedNumber = preferredNumber.trim();
      if (requestedNumber && !/^030-\d{3}-\d{3}$/.test(requestedNumber)) {
        throw new Error('希望番号は030-123-456の形式で入力してください。');
      }
      const { error } = await supabase.from('phone_number_requests').insert({
        user_id: user.id,
        preferred_number: requestedNumber || null,
      });
      if (error) throw error;
      await loadData(user);
      setNotice('電話番号の申請を受け付けました。審査結果はこの画面で確認できます。');
    } catch (error) {
      console.error('電話番号を申請できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function callDepartment(department: Department) {
    if (!user || !phone || activeCall) return;
    setBusy(true);
    setErrorMessage('');
    setNotice('');
    setCallState('発信しています');
    try {
      const { data, error } = await supabase.from('phone_calls')
        .insert({ caller_id: user.id, department, status: 'queued' })
        .select('id, caller_id, caller_number, department, status, assigned_to, created_at')
        .single();
      if (error) throw error;
      setCalls((current) => upsertCall(current, data as PhoneCall));
    } catch (error) {
      console.error('電話を発信できませんでした:', error);
      setCallState('待機中');
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function acceptCall(call: PhoneCall) {
    setBusy(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.rpc('accept_phone_call', { target_call_id: call.id });
      if (error) throw error;
      if (data?.id !== call.id || data.status !== 'connecting' || data.assigned_to !== user?.id) {
        throw new Error('着信の応答状態を確認できませんでした。');
      }
      setCalls((current) => upsertCall(current, data as PhoneCall));
    } catch (error) {
      console.error('着信に応答できませんでした:', error);
      setErrorMessage(errorText(error));
      if (user) await loadData(user);
    } finally {
      setBusy(false);
    }
  }

  async function endCall() {
    if (!activeCall || !user) return;
    setBusy(true);
    setErrorMessage('');
    const status = activeCall.caller_id === user.id ? 'cancelled' : 'completed';
    try {
      const { error } = await supabase.rpc('finish_phone_call', { target_call_id: activeCall.id, final_status: status });
      if (error) throw error;
      setRemoteStream(null);
      setMuted(false);
      setNotice(status === 'cancelled' ? '発信を終了しました。' : '通話を終了しました。');
    } catch (error) {
      console.error('電話を終了できませんでした:', error);
      setErrorMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMute() {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) {
      setErrorMessage('マイクがまだ接続されていません。');
      return;
    }
    audioTrack.enabled = !audioTrack.enabled;
    setMuted(!audioTrack.enabled);
  }

  const hasOpenRequest = numberRequests.some((request) => request.status === 'submitted');
  const inputStyle = inputClass;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Breadcrumbs items={[{ label: '住民ポータル', href: '/toeiken/portal' }, { label: '電話窓口' }]} />
        <div className="mt-4 border-b border-slate-300 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Toei Telephone Service</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">電話窓口</h1>
          <p className="mt-2 text-sm text-slate-600">電話番号の申請、担当窓口への音声通話を利用できます。</p>
        </div>
        {errorMessage && <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>}
        {notice && <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {loading ? <div className="mt-5"><ContentSkeleton rows={4} /></div> : !user ? (
          <section className="mt-5 rounded border border-slate-200 bg-white p-5">
            <p className="text-sm">電話窓口を利用するには東栄アカウントでログインしてください。</p>
            <Link href="/toeiken" className="mt-3 inline-block rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white">ログインへ</Link>
          </section>
        ) : (
          <div className="mt-5 grid gap-5">
            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">住民電話番号</h2>
              {phone?.status === 'active' ? (
                <p className="mt-3 text-2xl font-bold tracking-wider text-blue-800">{phone.phone_number}</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-600">電話番号の発行後に窓口への発信ができます。番号は内部通話用です。</p>
                  {!isActiveResident ? (
                    <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">電話番号の申請には有効な住民登録が必要です。</p>
                  ) : hasOpenRequest ? (
                    <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">電話番号の申請を審査中です。</p>
                  ) : numberRequests.some((request) => request.status === 'approved') ? (
                    <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">電話番号は現在利用できません。管理局へお問い合わせください。</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <label className="grid gap-1 text-sm font-semibold">希望番号（任意）
                        <input type="text" inputMode="numeric" autoComplete="tel-national" maxLength={11} placeholder="030-123-456" value={preferredNumber} onChange={(event) => setPreferredNumber(event.target.value)} className={inputStyle} />
                        <span className="text-xs font-normal text-slate-500">重複時は自動発行番号を選択できます。</span>
                      </label>
                      <button type="button" disabled={busy} onClick={() => void requestPhoneNumber()} className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {busy ? '申請中...' : '電話番号を申請'}
                      </button>
                    </div>
                  )}
                  {numberRequests.filter((request) => request.status !== 'submitted').map((request) => (
                    <p key={request.id} className="mt-3 text-sm text-slate-600">
                      申請状況: {request.status === 'approved' ? '発行済み' : request.status === 'rejected' ? '却下' : '取消'}
                      {request.staff_response && <span className="mt-1 block">{request.staff_response}</span>}
                    </p>
                  ))}
                </>
              )}
            </section>

            {activeCall && (
              <section className="rounded border border-blue-300 bg-blue-50 p-5" aria-live="polite">
                <h2 className="text-lg font-bold text-blue-950">{callStatusLabel(activeCall.status)}</h2>
                <p className="mt-2 text-sm">{departments.find((department) => department.id === activeCall.department)?.label} · {activeCall.caller_number}</p>
                {activeCall.status === 'connecting' && (
                  <>
                    <p className="mt-2 text-sm text-blue-900">{callState}</p>
                    <audio ref={audioRef} autoPlay controls className="mt-3 w-full" aria-label="通話音声" />
                    {!turnAvailable && <p className="mt-2 text-xs text-amber-900">TURN中継が未設定です。一部のネットワークでは音声が接続できない場合があります。</p>}
                    <button type="button" onClick={() => void toggleMute()} className="mt-3 rounded border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-900">{muted ? 'マイクをオンにする' : 'マイクをミュート'}</button>
                  </>
                )}
                <button type="button" disabled={busy} onClick={() => void endCall()} className="mt-3 ml-2 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {activeCall.caller_id === user.id ? '発信を終了' : '通話を終了'}
                </button>
              </section>
            )}

            {phone?.status === 'active' && !activeCall && (
              <section className="rounded border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold">窓口へ発信</h2>
                <p className="mt-2 text-sm text-slate-600">通話を開始すると、選択した窓口の職員に着信します。マイクへのアクセスを許可してください。</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="grid gap-1 text-sm font-semibold">発信先
                    <select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value as Department)} className={inputStyle}>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.label}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={busy} onClick={() => void callDepartment(selectedDepartment)} className="self-end rounded bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {busy ? '発信中...' : '音声通話を開始'}
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">音声は通話相手と直接接続し、録音・保存しません。ブラウザーのマイク利用許可が必要です。</p>
              </section>
            )}

            {staffDepartments.length > 0 && (
              <section className="rounded border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold">窓口の着信</h2>
                  <p className="text-xs text-slate-500">対応可能な窓口: {staffDepartments.map((id) => departments.find((department) => department.id === id)?.label).join('、')}</p>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {queuedCalls.map((call) => (
                    <article key={call.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold">{departments.find((department) => department.id === call.department)?.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{call.caller_number} · {new Date(call.created_at).toLocaleString()}</p>
                      </div>
                      <button type="button" disabled={busy || Boolean(activeCall)} onClick={() => void acceptCall(call)} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">応答する</button>
                    </article>
                  ))}
                  {!queuedCalls.length && <p className="py-3 text-sm text-slate-500">現在、着信はありません。</p>}
                </div>
              </section>
            )}

            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold">最近の通話</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {calls.filter((call) => !activeStatuses.includes(call.status) && (call.caller_id === user.id || call.assigned_to === user.id)).slice(0, 20).map((call) => (
                  <div key={call.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span>{departments.find((department) => department.id === call.department)?.label} · {call.caller_number}</span>
                    <span className="text-slate-500">{callStatusLabel(call.status)} · {new Date(call.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {!calls.some((call) => !activeStatuses.includes(call.status) && (call.caller_id === user.id || call.assigned_to === user.id)) && (
                  <p className="py-3 text-sm text-slate-500">通話履歴はありません。</p>
                )}
              </div>
            </section>
            {(isAdmin || staffDepartments.includes('administration')) && <Link href="/admin/phone-numbers" className="text-sm font-semibold text-blue-700 underline">電話番号申請の管理</Link>}
          </div>
        )}
      </main>
    </div>
  );
}
