"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Snapshot } from '@/lib/multiplayer';

export default function WebRTCVoice({ snapshot }: { snapshot: Snapshot }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [incomingOffers, setIncomingOffers] = useState<Map<string, RTCSessionDescriptionInit>>(new Map());
  const [activeCalls, setActiveCalls] = useState<Set<string>>(new Set());
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const snapshotRef = useRef(snapshot);
  const streamRef = useRef<MediaStream | null>(null);
  
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Adjust volume based on distance for active calls
  useEffect(() => {
    const updateVolumes = () => {
      const self = snapshotRef.current.players.find(p => p.id === snapshotRef.current.self);
      if (!self) return;

      audioElementsRef.current.forEach((audio, id) => {
        const other = snapshotRef.current.players.find(p => p.id === id);
        if (other) {
          const dist = Math.hypot(self.x - other.x, self.z - other.z);
          const maxDist = 100;
          let volume = 1;
          if (dist > maxDist) volume = 0;
          else if (dist > 10) volume = 1 - (dist - 10) / (maxDist - 10);
          audio.volume = Math.max(0, Math.min(1, volume));
        } else {
          audio.volume = 0;
        }
      });
    };

    const interval = setInterval(updateVolumes, 100);
    return () => clearInterval(interval);
  }, []);

  // Request microphone when enabled
  useEffect(() => {
    if (!audioEnabled) return;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(s => setStream(s))
      .catch(err => console.warn('Microphone access denied or error:', err));

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      audioElementsRef.current.forEach(a => {
        a.pause();
        a.srcObject = null;
      });
      audioElementsRef.current.clear();
      setActiveCalls(new Set());
      setIncomingOffers(new Map());
    };
  }, [audioEnabled]);

  const createPeer = useCallback((id: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        window.dispatchEvent(new CustomEvent('rtc-send', {
          detail: { target: id, payload: { candidate: event.candidate } }
        }));
      }
    };

    pc.ontrack = (event) => {
      let audio = audioElementsRef.current.get(id);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElementsRef.current.set(id, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch(e => console.warn("Audio play blocked", e));
    };

    return pc;
  }, []);

  // Handle incoming RTC messages
  useEffect(() => {
    if (!audioEnabled) return;

    const handleRtcMessage = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      const { source, payload } = data;
      if (source === snapshot.self) return;

      if (payload.offer) {
        // Store incoming offer to show UI prompt
        setIncomingOffers(prev => {
          const next = new Map(prev);
          next.set(source, payload.offer);
          return next;
        });
      } else if (payload.answer) {
        const pc = peersRef.current.get(source);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      } else if (payload.candidate) {
        const pc = peersRef.current.get(source);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.error("Error adding ice candidate", e);
          }
        } else {
          // Store candidates if pc not ready
          const arr = pendingCandidatesRef.current.get(source) || [];
          arr.push(payload.candidate);
          pendingCandidatesRef.current.set(source, arr);
        }
      }
    };

    window.addEventListener('rtc-receive', handleRtcMessage);
    return () => {
      window.removeEventListener('rtc-receive', handleRtcMessage);
    };
  }, [audioEnabled, snapshot.self]);

  const callPlayer = async (id: string) => {
    if (activeCalls.has(id)) return;
    const pc = createPeer(id);
    peersRef.current.set(id, pc);
    setActiveCalls(prev => new Set(prev).add(id));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      window.dispatchEvent(new CustomEvent('rtc-send', {
        detail: { target: id, payload: { offer: pc.localDescription } }
      }));
    } catch (err) {
      console.error("Error creating offer", err);
    }
  };

  const acceptCall = async (id: string) => {
    const offer = incomingOffers.get(id);
    if (!offer) return;

    setIncomingOffers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    const pc = createPeer(id);
    peersRef.current.set(id, pc);
    setActiveCalls(prev => new Set(prev).add(id));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    window.dispatchEvent(new CustomEvent('rtc-send', {
      detail: { target: id, payload: { answer: pc.localDescription } }
    }));

    // Add any pending candidates
    const pending = pendingCandidatesRef.current.get(id) || [];
    for (const c of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => console.error(e));
    }
    pendingCandidatesRef.current.delete(id);
  };

  const declineCall = (id: string) => {
    setIncomingOffers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    pendingCandidatesRef.current.delete(id);
  };

  const selfPlayer = snapshot.players.find(p => p.id === snapshot.self);
  const nearbyPlayers = selfPlayer ? snapshot.players.filter(p => {
    if (p.id === snapshot.self) return false;
    const dist = Math.hypot(selfPlayer.x - p.x, selfPlayer.z - p.z);
    return dist < 100; // max voice distance
  }) : [];

  if (!audioEnabled) {
    return (
      <div className="voice-chat-overlay">
        <span>Voice Chat Offline</span>
        <button onClick={() => setAudioEnabled(true)}
          style={{ background: '#4CAF50', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
          Enable
        </button>
      </div>
    );
  }

  return (
    <div className="voice-chat-overlay voice-chat-active">
      <div style={{ fontWeight: 'bold', color: '#4CAF50', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
        Voice Active (Local: {stream ? 'Mic On' : 'Connecting...'})
      </div>

      {incomingOffers.size > 0 && (
        <div style={{ background: 'rgba(255, 165, 0, 0.2)', padding: '10px', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', marginBottom: '5px', color: '#FFD700' }}>Incoming Calls:</div>
          {Array.from(incomingOffers.keys()).map(id => {
            const p = snapshot.players.find(p => p.id === id);
            return (
              <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span>{p ? p.name : id}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => acceptCall(id)} style={{ background: '#4CAF50', border: 'none', color: 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Accept</button>
                  <button onClick={() => declineCall(id)} style={{ background: '#f44336', border: 'none', color: 'white', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Decline</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <div style={{ fontSize: '12px', marginBottom: '5px', color: '#aaa' }}>Nearby Players:</div>
        {nearbyPlayers.length === 0 && <div style={{ fontSize: '12px', color: '#666' }}>No one nearby</div>}
        {nearbyPlayers.map(p => {
          const isActive = activeCalls.has(p.id);
          const hasIncoming = incomingOffers.has(p.id);
          return (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '5px' }}>
              <span>{p.name}</span>
              {!isActive && !hasIncoming && (
                <button onClick={() => callPlayer(p.id)} style={{ background: '#2196F3', border: 'none', color: 'white', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Call</button>
              )}
              {isActive && <span style={{ color: '#4CAF50', fontSize: '12px' }}>In Call</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
