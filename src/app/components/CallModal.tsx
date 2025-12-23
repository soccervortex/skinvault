"use client";

import React, { useEffect, useRef, useState } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface CallModalProps {
  callId: string | null;
  callerId: string;
  receiverId: string;
  callType: 'voice';
  isIncoming: boolean;
  callerName?: string;
  callerAvatar?: string;
  onAnswer?: () => void;
  onDecline?: () => void;
  onEnd?: () => void;
  currentUserId: string;
}

export default function CallModal({
  callId,
  callerId,
  receiverId,
  callType,
  isIncoming,
  callerName,
  callerAvatar,
  onAnswer,
  onDecline,
  onEnd,
  currentUserId,
}: CallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState<'ringing' | 'active' | 'ended'>('ringing');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!callId || callStatus !== 'active') return;

    // Initialize WebRTC
    const initWebRTC = async () => {
      try {
        // Get user media (voice only)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        // Add local stream tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && callId) {
            fetch('/api/chat/call/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId,
                type: 'ice-candidate',
                from: currentUserId,
                to: currentUserId === callerId ? receiverId : callerId,
                data: event.candidate,
              }),
            }).catch(console.error);
          }
        };

        peerConnectionRef.current = pc;

        // If we're the caller, create offer
        if (currentUserId === callerId) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          await fetch('/api/chat/call/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callId,
              type: 'offer',
              from: callerId,
              to: receiverId,
              data: offer,
            }),
          });
        }

        // Poll for signaling data
        let lastSignalTime = new Date().toISOString();
        signalingIntervalRef.current = setInterval(async () => {
          try {
            const res = await fetch(
              `/api/chat/call/signal?callId=${callId}&userId=${currentUserId}&lastSignalTime=${lastSignalTime}`
            );
            if (res.ok) {
              const { signals } = await res.json();
              for (const signal of signals) {
                if (signal.type === 'offer' && currentUserId === receiverId) {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await fetch('/api/chat/call/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      callId,
                      type: 'answer',
                      from: receiverId,
                      to: callerId,
                      data: answer,
                    }),
                  });
                } else if (signal.type === 'answer' && currentUserId === callerId) {
                  await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
                } else if (signal.type === 'ice-candidate') {
                  await pc.addIceCandidate(new RTCIceCandidate(signal.data));
                }
                lastSignalTime = signal.timestamp;
              }
            }
          } catch (error) {
            console.error('Signaling error:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('WebRTC init error:', error);
      }
    };

    initWebRTC();

    return () => {
      if (signalingIntervalRef.current) {
        clearInterval(signalingIntervalRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [callId, callStatus, callType, callerId, receiverId, currentUserId]);

  const handleAnswer = () => {
    setCallStatus('active');
    if (onAnswer) onAnswer();
  };

  const handleDecline = () => {
    setCallStatus('ended');
    if (onDecline) onDecline();
  };

  const handleEnd = () => {
    setCallStatus('ended');
    if (onEnd) onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  if (!callId || callStatus === 'ended') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#11141d] rounded-2xl border border-white/10 p-6 max-w-md w-full mx-4">
        {/* Call Header */}
        <div className="text-center mb-6">
          <img
            src={callerAvatar || '/icons/web-app-manifest-192x192.png'}
            alt={callerName || 'User'}
            className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-500"
          />
          <h3 className="text-xl font-bold text-white mb-1">
            {callerName || 'Unknown User'}
          </h3>
          <p className="text-sm text-gray-400">
            {callStatus === 'ringing' 
              ? (isIncoming ? 'Incoming call' : 'Calling...')
              : callType === 'video' ? 'Video call' : 'Voice call'}
          </p>
        </div>


        {/* Call Controls */}
        <div className="flex items-center justify-center gap-4">
          {callStatus === 'ringing' ? (
            <>
              {isIncoming && (
                <>
                  <button
                    onClick={handleDecline}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                  >
                    <PhoneOff size={24} className="text-white" />
                  </button>
                  <button
                    onClick={handleAnswer}
                    className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors"
                  >
                    <Phone size={24} className="text-white" />
                  </button>
                </>
              )}
              {!isIncoming && (
                <button
                  onClick={handleDecline}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                >
                  <PhoneOff size={24} className="text-white" />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
              </button>
              <button
                onClick={() => setIsSpeakerEnabled(!isSpeakerEnabled)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  !isSpeakerEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isSpeakerEnabled ? <Volume2 size={20} className="text-white" /> : <VolumeX size={20} className="text-white" />}
              </button>
              <button
                onClick={handleEnd}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
              >
                <PhoneOff size={24} className="text-white" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

