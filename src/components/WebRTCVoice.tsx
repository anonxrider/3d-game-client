"use client";

import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@/lib/multiplayer';

export default function WebRTCVoice({ snapshot }: { snapshot: Snapshot }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const snapshotRef = useRef(snapshot);
  
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // Adjust volume based on distance
  useEffect(() => {
    const updateVolumes = () => {
      const self = snapshotRef.current.players.find(p => p.id === snapshotRef.current.self);
      if (!self) return;

      audioElementsRef.current.forEach((audio, id) => {
        const other = snapshotRef.current.players.find(p => p.id === id);
        if (other) {
          const dist = Math.hypot(self.x - other.x, self.z - other.z);
          // Roll-off volume starting from 10m to 100m
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

  useEffect(() => {
    // Request microphone access
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(s => setStream(s))
      .catch(err => console.warn('Microphone access denied or error:', err));

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      audioElementsRef.current.forEach(a => {
        a.pause();
        a.srcObject = null;
      });
      audioElementsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!stream) return;

    const createPeer = (id: string, initiator: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

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
      };

      if (initiator) {
        pc.createOffer().then(offer => {
          return pc.setLocalDescription(offer);
        }).then(() => {
          window.dispatchEvent(new CustomEvent('rtc-send', {
            detail: { target: id, payload: { offer: pc.localDescription } }
          }));
        }).catch(err => console.error("Error creating offer", err));
      }

      return pc;
    };

    const handleRtcMessage = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      const { source, payload } = data;
      if (source === snapshot.self) return;

      let pc = peersRef.current.get(source);
      if (!pc && payload.offer) {
        pc = createPeer(source, false);
        peersRef.current.set(source, pc);
      }

      if (!pc) return;

      if (payload.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        window.dispatchEvent(new CustomEvent('rtc-send', {
          detail: { target: source, payload: { answer: pc.localDescription } }
        }));
      } else if (payload.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      } else if (payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.error("Error adding ice candidate", e);
        }
      }
    };

    window.addEventListener('rtc-receive', handleRtcMessage);

    // Initiator logic: connect to any existing player we haven't connected to
    // We assume the joining player initiates connections to all existing players.
    // In our snapshot, we look for players that aren't us and we don't have a PC for.
    snapshot.players.forEach(p => {
      if (p.id !== snapshot.self && !peersRef.current.has(p.id)) {
        // Tie-breaker to prevent both creating offers: lexicographical comparison
        if (snapshot.self < p.id) {
          const pc = createPeer(p.id, true);
          peersRef.current.set(p.id, pc);
        }
      }
    });

    return () => {
      window.removeEventListener('rtc-receive', handleRtcMessage);
    };
  }, [stream, snapshot.players, snapshot.self]);

  return null;
}
