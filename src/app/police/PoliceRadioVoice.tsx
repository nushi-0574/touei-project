'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Radio, AlertCircle, RefreshCw } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

type VoiceSignal = {
  type: 'hello' | 'hello-ack' | 'offer' | 'answer' | 'ice' | 'leave';
  peerId: string;
  toPeerId?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type VoiceSession = {
  peerId: string;
  channel: RealtimeChannel;
  stream: MediaStream;
  iceServers: RTCIceServer[];
  active: boolean;
  peers: Map<string, RTCPeerConnection>;
  audioElements: Map<string, HTMLAudioElement>;
  pendingCandidates: Map<string, RTCIceCandidateInit[]>;
  senderReady: Map<string, Promise<void>>;
  negotiating: Set<string>;
};

const VOICE_BITRATE = 20_000;

async function sendSignal(session: VoiceSession, signal: VoiceSignal) {
  const status = await session.channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: signal,
  });
  if (status !== 'ok') throw new Error(`音声シグナリングの送信に失敗しました: ${status}`);
}

function createPeer(
  session: VoiceSession,
  remotePeerId: string,
  onPeerCount: (count: number) => void,
  onAudioBlocked: () => void,
  onError: (message: string) => void,
) {
  const existing = session.peers.get(remotePeerId);
  if (existing) return existing;

  const peer = new RTCPeerConnection({
    iceServers: session.iceServers,
    bundlePolicy: 'max-bundle',
  });
  const capabilities = RTCRtpSender.getCapabilities?.('audio');
  const codecs = capabilities?.codecs ?? [];
  const opusCodecs = codecs.filter((codec) => codec.mimeType.toLowerCase() === 'audio/opus');

  session.peers.set(remotePeerId, peer);
  onPeerCount(session.peers.size);

  const senderConfiguration: Promise<void> = Promise.all(session.stream.getAudioTracks().map(async (track) => {
    const sender = peer.addTrack(track, session.stream);
    const parameters = sender.getParameters();
    if (parameters.encodings?.length) {
      parameters.encodings = parameters.encodings.map((encoding) => ({
        ...encoding,
        maxBitrate: VOICE_BITRATE,
      }));
      await sender.setParameters(parameters);
    }
  })).then(() => undefined).catch((error: unknown) => {
    console.error('警察無線の音声ビットレートを設定できませんでした:', error);
    onError('音声の低ビットレート設定を適用できませんでした。このまま通話を続けます。');
  });
  if (opusCodecs.length > 0) {
    for (const transceiver of peer.getTransceivers()) {
      if (transceiver.sender.track?.kind === 'audio') {
        transceiver.setCodecPreferences([...opusCodecs, ...codecs.filter((codec) => !opusCodecs.includes(codec))]);
      }
    }
  }
  session.senderReady.set(remotePeerId, senderConfiguration);

  peer.onicecandidate = (event) => {
    if (!event.candidate || !session.active) return;
    void sendSignal(session, {
      type: 'ice',
      peerId: session.peerId,
      toPeerId: remotePeerId,
      candidate: event.candidate.toJSON(),
    }).catch((error: unknown) => {
      console.error('警察無線の接続候補を送信できませんでした:', error);
      onError('音声接続の情報を送信できませんでした。');
    });
  };
  peer.ontrack = (event) => {
    const audio = session.audioElements.get(remotePeerId) ?? new Audio();
    audio.autoplay = true;
    audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
    session.audioElements.set(remotePeerId, audio);
    void audio.play().catch((error: unknown) => {
      console.warn('受信音声の自動再生には操作が必要です:', error);
      onAudioBlocked();
    });
  };
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === 'failed') {
      onError('音声接続に失敗しました。ネットワークが音声通話に対応しているかご確認ください。');
    }
  };

  return peer;
}

function removePeer(session: VoiceSession, peerId: string, onPeerCount: (count: number) => void) {
  session.peers.get(peerId)?.close();
  session.peers.delete(peerId);
  session.senderReady.delete(peerId);
  session.pendingCandidates.delete(peerId);
  const audio = session.audioElements.get(peerId);
  if (audio) {
    audio.pause();
    audio.srcObject = null;
    session.audioElements.delete(peerId);
  }
  onPeerCount(session.peers.size);
}

function closeSession(session: VoiceSession, onPeerCount: (count: number) => void) {
  if (!session.active) return;
  session.active = false;
  void sendSignal(session, { type: 'leave', peerId: session.peerId }).catch((error: unknown) => {
    console.error('警察無線の退出通知を送信できませんでした:', error);
  });
  for (const peerId of session.peers.keys()) removePeer(session, peerId, onPeerCount);
  session.stream.getTracks().forEach((track) => track.stop());
  void supabase.removeChannel(session.channel);
}

export default function PoliceRadioVoice({ channel }: { channel: string }) {
  const sessionRef = useRef<VoiceSession | null>(null);
  const generationRef = useRef(0);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transmitting, setTransmitting] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [turnAvailable, setTurnAvailable] = useState<boolean | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  useEffect(() => () => {
    generationRef.current += 1;
    if (sessionRef.current) closeSession(sessionRef.current, () => {});
    sessionRef.current = null;
  }, []);

  // マイク権限状態の事前確認
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((result) => {
          setPermissionState(result.state);
          result.onchange = () => setPermissionState(result.state);
        })
        .catch(() => setPermissionState('unknown'));
    }
  }, []);

  async function connectVoice() {
    setConnecting(true);
    setErrorMessage('');
    const generation = generationRef.current;
    let stream: MediaStream | null = null;
    let session: VoiceSession | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('このブラウザー環境ではマイク機能を利用できません。HTTPS接続の標準ブラウザーをご利用ください。');
      }

      const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!authSession?.access_token) throw new Error('ログイン状態を確認できませんでした。');

      const iceResponse = await fetch('/api/phone/ice-servers', {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
        cache: 'no-store',
      });
      const iceConfiguration = await iceResponse.json() as {
        iceServers?: RTCIceServer[];
        turnAvailable?: boolean;
        error?: string;
      };
      if (!iceResponse.ok || !iceConfiguration.iceServers || !Array.isArray(iceConfiguration.iceServers)) {
        throw new Error(iceConfiguration.error || '音声接続の設定を取得できませんでした。');
      }
      setTurnAvailable(iceConfiguration.turnAvailable === true);

      // マイク取得ストリーム（安全な標準パラメータ設定）
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        setPermissionState('granted');
      } catch (micErr: unknown) {
        if (micErr instanceof DOMException && (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError')) {
          setPermissionState('denied');
          throw new Error('マイクへのアクセスが拒否されています。ブラウザーのアドレスバー左側の設定/鍵マークからマイク許可をオンにして再試行してください。');
        } else if (micErr instanceof DOMException && (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError')) {
          throw new Error('利用可能なマイク機器が検出されませんでした。マイクが正しく接続されているかご確認ください。');
        } else {
          // パラメータ制約エラーのフォールバック
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setPermissionState('granted');
        }
      }

      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => { track.stop(); });
        return;
      }
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });

      session = {
        peerId: crypto.randomUUID(),
        channel: supabase.channel(`police-radio-voice:${channel}`, {
          config: { private: true, broadcast: { ack: false, self: false } },
        }),
        stream,
        iceServers: iceConfiguration.iceServers,
        active: true,
        peers: new Map(),
        audioElements: new Map(),
        pendingCandidates: new Map(),
        senderReady: new Map(),
        negotiating: new Set(),
      };
      sessionRef.current = session;

      const reportError = (message: string) => {
        if (generation === generationRef.current) setErrorMessage(message);
      };

      const flushCandidates = async (peerId: string, peer: RTCPeerConnection) => {
        const queued = session?.pendingCandidates.get(peerId) ?? [];
        session?.pendingCandidates.delete(peerId);
        for (const candidate of queued) await peer.addIceCandidate(candidate);
      };

      const negotiate = async (peerId: string, peer: RTCPeerConnection) => {
        if (session?.negotiating.has(peerId)) return;
        session?.negotiating.add(peerId);
        try {
          await session?.senderReady.get(peerId);
          if (!session?.active || peer.signalingState !== 'stable') return;
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          if (peer.localDescription) {
            await sendSignal(session, {
              type: 'offer',
              peerId: session.peerId,
              toPeerId: peerId,
              description: peer.localDescription.toJSON(),
            });
          }
        } finally {
          session?.negotiating.delete(peerId);
        }
      };

      const handleSignal = async (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        const signal = value as VoiceSignal;
        if (
          !session?.active
          || typeof signal.peerId !== 'string'
          || signal.peerId === session.peerId
          || (signal.toPeerId && signal.toPeerId !== session.peerId)
          || !['hello', 'hello-ack', 'offer', 'answer', 'ice', 'leave'].includes(signal.type)
        ) return;

        if (signal.type === 'leave') {
          removePeer(session, signal.peerId, (count) => {
            if (generation === generationRef.current) setPeerCount(count);
          });
          return;
        }

        const peer = createPeer(
          session,
          signal.peerId,
          (count) => { if (generation === generationRef.current) setPeerCount(count); },
          () => { if (generation === generationRef.current) setAudioBlocked(true); },
          reportError,
        );

        if (signal.type === 'hello') {
          await sendSignal(session, {
            type: 'hello-ack',
            peerId: session.peerId,
            toPeerId: signal.peerId,
          });
          if (session.peerId.localeCompare(signal.peerId) < 0) await negotiate(signal.peerId, peer);
        } else if (signal.type === 'hello-ack') {
          if (session.peerId.localeCompare(signal.peerId) < 0) await negotiate(signal.peerId, peer);
        } else if (signal.type === 'offer' && signal.description) {
          await peer.setRemoteDescription(signal.description);
          await flushCandidates(signal.peerId, peer);
          await session.senderReady.get(signal.peerId);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          if (peer.localDescription) {
            await sendSignal(session, {
              type: 'answer',
              peerId: session.peerId,
              toPeerId: signal.peerId,
              description: peer.localDescription.toJSON(),
            });
          }
        } else if (signal.type === 'answer' && signal.description) {
          if (peer.signalingState !== 'have-local-offer') return;
          await peer.setRemoteDescription(signal.description);
          await flushCandidates(signal.peerId, peer);
        } else if (signal.type === 'ice' && signal.candidate) {
          if (peer.remoteDescription) {
            await peer.addIceCandidate(signal.candidate);
          } else {
            const queued = session.pendingCandidates.get(signal.peerId) ?? [];
            queued.push(signal.candidate);
            session.pendingCandidates.set(signal.peerId, queued);
          }
        }
      };

      session.channel
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          void handleSignal(payload).catch((error: unknown) => {
            console.error('警察無線の音声接続を確立できませんでした:', error);
            reportError('音声接続を確立できませんでした。再接続してください。');
          });
        });

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('音声チャンネルへの接続がタイムアウトしました。')), 15_000);
        session?.channel.subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            window.clearTimeout(timeout);
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            window.clearTimeout(timeout);
            reject(error ?? new Error('音声チャンネルに接続できません。Realtime権限を確認してください。'));
          }
        });
      });
      if (generation !== generationRef.current || !session.active) return;

      await sendSignal(session, { type: 'hello', peerId: session.peerId });
      if (generation === generationRef.current) setConnected(true);
    } catch (error) {
      if (session) closeSession(session, () => {});
      else stream?.getTracks().forEach((track) => { track.stop(); });
      if (sessionRef.current === session) sessionRef.current = null;
      if (generation === generationRef.current) {
        console.error('警察無線の音声に接続できませんでした:', error);
        setErrorMessage(error instanceof Error ? error.message : '音声通話に接続できませんでした。');
      }
    } finally {
      if (generation === generationRef.current) setConnecting(false);
    }
  }

  function disconnectVoice() {
    const session = sessionRef.current;
    if (session) closeSession(session, setPeerCount);
    sessionRef.current = null;
    setConnected(false);
    setTransmitting(false);
    setPeerCount(0);
    setAudioBlocked(false);
  }

  function setTransmit(enabled: boolean) {
    if (!sessionRef.current?.active) return;
    sessionRef.current.stream.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    setTransmitting(enabled);
  }

  function replayAudio() {
    const audioElements = [...(sessionRef.current?.audioElements.values() ?? [])];
    for (const audio of audioElements) {
      void audio.play().catch((error: unknown) => {
        console.error('受信音声を再生できませんでした:', error);
        setErrorMessage('受信音声を再生できませんでした。ブラウザーの音量と設定をご確認ください。');
      });
    }
    setAudioBlocked(false);
  }

  return (
    <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-700" aria-hidden="true" />
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">{channel} 音声無線回線</h3>
            <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 text-[11px] font-mono">
              Opus / 20kbps
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {connected
              ? `接続状態: 受信中${peerCount > 0 ? ` (${peerCount}名と同期中)` : ' (待機中)'}${transmitting ? ' [発言送信中]' : ''}`
              : '音声無線に接続後、「押して話す」ボタンを押しながら発言できます。'}
          </p>
        </div>

        {connected ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={connecting}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setTransmit(true);
              }}
              onPointerUp={() => setTransmit(false)}
              onPointerCancel={() => setTransmit(false)}
              onLostPointerCapture={() => setTransmit(false)}
              onKeyDown={(event) => {
                if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
                  event.preventDefault();
                  setTransmit(true);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  setTransmit(false);
                }
              }}
              onBlur={() => setTransmit(false)}
              aria-pressed={transmitting}
              className={`inline-flex min-h-[44px] touch-none items-center gap-2 rounded-sm px-4 text-xs font-bold text-white transition-colors ${
                transmitting ? 'bg-red-800 hover:bg-red-900' : 'bg-blue-800 hover:bg-blue-900'
              }`}
            >
              {transmitting ? <Mic className="w-4 h-4" aria-hidden="true" /> : <MicOff className="w-4 h-4" aria-hidden="true" />}
              <span>{transmitting ? '送信中 (離して停止)' : '押して話す'}</span>
            </button>
            <button
              type="button"
              onClick={disconnectVoice}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <PhoneOff className="w-4 h-4" aria-hidden="true" />
              <span>切断</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void connectVoice()}
            disabled={connecting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors"
          >
            <Mic className="w-4 h-4" aria-hidden="true" />
            <span>{connecting ? 'マイク接続中...' : '音声無線に接続'}</span>
          </button>
        )}
      </div>

      {permissionState === 'denied' && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-xs text-red-900 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-700" />
            <span>マイク利用許可が拒否されています</span>
          </p>
          <p className="leading-relaxed">
            音声無線を利用するには、ブラウザーのアドレスバー左側の［鍵マーク］または［設定］を選択し、マイクを「許可」に変更してから下の「再試行」を押してください。
          </p>
          <button
            type="button"
            onClick={() => void connectVoice()}
            className="px-3 py-1.5 bg-slate-900 text-white font-semibold text-xs rounded-sm inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>マイク接続を再試行</span>
          </button>
        </div>
      )}

      {audioBlocked && (
        <button type="button" onClick={replayAudio} className="mt-3 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          受信音声を再生
        </button>
      )}

      {connected && turnAvailable === false && (
        <p className="mt-3 text-xs text-slate-600">
          ※TURN中継未設定のため、一部のネットワーク環境では音声が相互接続されない場合があります。
        </p>
      )}

      {errorMessage && (
        <div role="alert" className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
