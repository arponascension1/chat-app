import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';

interface CallState {
    isInCall: boolean;
    isCalling: boolean;
    isReceivingCall: boolean;
    callerId: number | null;
    callerName: string | null;
    receiverId: number | null;
    callId: number | null;
}

export function useAudioCall(userId: number) {
    const [callState, setCallState] = useState<CallState>({
        isInCall: false,
        isCalling: false,
        isReceivingCall: false,
        callerId: null,
        callerName: null,
        receiverId: null,
        callId: null,
    });

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const remoteAudio = useRef<HTMLAudioElement | null>(null);
    const callStartTime = useRef<number | null>(null);
    const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

    // WebRTC configuration
    const rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // Initialize peer connection
    const initializePeerConnection = (targetUserId: number) => {
        peerConnection.current = new RTCPeerConnection(rtcConfig);

        // Handle ICE candidates
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                axios.post('/calls/ice-candidate', {
                    receiver_id: targetUserId,
                    candidate: event.candidate.toJSON(),
                }).catch(console.error);
            }
        };

        // Handle remote stream
        peerConnection.current.ontrack = (event) => {
            if (remoteAudio.current && event.streams[0]) {
                remoteAudio.current.srcObject = event.streams[0];
            }
        };

        // Add local stream tracks
        if (localStream.current) {
            localStream.current.getTracks().forEach((track) => {
                peerConnection.current!.addTrack(track, localStream.current!);
            });
        }
    };

    // Initiate a call
    const initiateCall = async (receiverId: number) => {
        try {
            // Get user media
            localStream.current = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });

            setCallState((prev) => ({
                ...prev,
                isCalling: true,
                receiverId,
            }));

            initializePeerConnection(receiverId);

            // Create offer
            const offer = await peerConnection.current!.createOffer();
            await peerConnection.current!.setLocalDescription(offer);

            // Send offer to receiver
            const response = await axios.post('/calls/initiate', {
                receiver_id: receiverId,
                offer: offer,
            });
            
            // Store call_id
            if (response.data.call_id) {
                setCallState((prev) => ({
                    ...prev,
                    callId: response.data.call_id,
                }));
            }
        } catch (error) {
            console.error('Error initiating call:', error);
            endCall();
        }
    };

    // Answer incoming call
    const answerCall = async (callerId: number, offer: RTCSessionDescriptionInit) => {
        try {
            // Clear pending call from localStorage
            localStorage.removeItem(`pendingCall_${userId}`);
            
            // Get user media
            localStream.current = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });

            // Set call start time when call is answered
            callStartTime.current = Date.now();

            setCallState((prev) => ({
                ...prev,
                isReceivingCall: false,
                isInCall: true,
                callerId,
            }));

            initializePeerConnection(callerId);

            // Set remote description
            await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offer));

            // Process any queued ICE candidates
            for (const candidate of pendingIceCandidates.current) {
                try {
                    await peerConnection.current!.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding queued ICE candidate:', error);
                }
            }
            pendingIceCandidates.current = [];

            // Create answer
            const answer = await peerConnection.current!.createAnswer();
            await peerConnection.current!.setLocalDescription(answer);

            // Send answer to caller
            await axios.post('/calls/answer', {
                caller_id: callerId,
                answer: answer,
                call_id: callState.callId,
            });
        } catch (error) {
            console.error('Error answering call:', error);
            endCall();
        }
    };

    // Reject incoming call
    const rejectCall = async (callerId: number) => {
        try {
            // Clear pending call from localStorage
            localStorage.removeItem(`pendingCall_${userId}`);
            
            await axios.post('/calls/reject', {
                caller_id: callerId,
                call_id: callState.callId,
            });

            setCallState({
                isInCall: false,
                isCalling: false,
                isReceivingCall: false,
                callerId: null,
                callerName: null,
                receiverId: null,
                callId: null,
            });
        } catch (error) {
            console.error('Error rejecting call:', error);
        }
    };

    // End call
    const endCall = async () => {
        try {
            // Clear pending call from localStorage
            localStorage.removeItem(`pendingCall_${userId}`);
            
            const receiverId = callState.isCalling ? callState.receiverId : callState.callerId;
            
            // Calculate duration in seconds if call was connected
            let duration = 0;
            if (callStartTime.current && callState.isInCall) {
                duration = Math.floor((Date.now() - callStartTime.current) / 1000);
            }

            if (receiverId) {
                await axios.post('/calls/end', {
                    receiver_id: receiverId,
                    call_id: callState.callId,
                    duration: duration,
                });
            }
        } catch (error) {
            console.error('Error ending call:', error);
        } finally {
            // Clean up
            if (localStream.current) {
                localStream.current.getTracks().forEach((track) => track.stop());
                localStream.current = null;
            }

            if (peerConnection.current) {
                peerConnection.current.close();
                peerConnection.current = null;
            }

            // Reset call start time
            callStartTime.current = null;
            
            // Clear pending ICE candidates
            pendingIceCandidates.current = [];

            setCallState({
                isInCall: false,
                isCalling: false,
                isReceivingCall: false,
                callerId: null,
                callerName: null,
                receiverId: null,
                callId: null,
            });
        }
    };

    // Check for pending call on mount
    useEffect(() => {
        const pendingCall = localStorage.getItem(`pendingCall_${userId}`);
        if (pendingCall) {
            try {
                const callData = JSON.parse(pendingCall);
                const callTimestamp = callData.timestamp;
                const now = Date.now();
                
                // Only restore call if it's less than 60 seconds old
                if (now - callTimestamp < 60000) {
                    setCallState({
                        isInCall: false,
                        isCalling: false,
                        isReceivingCall: true,
                        callerId: callData.callerId,
                        callerName: callData.callerName,
                        receiverId: null,
                        callId: callData.callId,
                    });
                    (window as any).pendingCallOffer = callData.offer;
                } else {
                    // Call is too old, remove it
                    localStorage.removeItem(`pendingCall_${userId}`);
                }
            } catch (error) {
                console.error('Error restoring pending call:', error);
                localStorage.removeItem(`pendingCall_${userId}`);
            }
        }
    }, [userId]);

    // Listen for call events
    useEffect(() => {
        const channel = window.Echo.private(`user.${userId}`);
        
        channel.listen('.call.initiated', (data: any) => {
            // Store in localStorage for page refresh persistence
            const callData = {
                callerId: data.callerId,
                callerName: data.callerName,
                offer: data.offer,
                callId: data.callId,
                timestamp: Date.now(),
            };
            localStorage.setItem(`pendingCall_${userId}`, JSON.stringify(callData));
            
            setCallState((prev) => ({
                ...prev,
                isReceivingCall: true,
                callerId: data.callerId,
                callerName: data.callerName,
                callId: data.callId,
            }));

            // Store offer for later use
            (window as any).pendingCallOffer = data.offer;
        });

        // Call answered
        channel.listen('.call.answered', async (data: any) => {
            // Set call start time when call is answered
            callStartTime.current = Date.now();
            
            setCallState((prev) => ({
                ...prev,
                isCalling: false,
                isInCall: true,
            }));

            // Set remote description
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );
                
                // Process any queued ICE candidates
                for (const candidate of pendingIceCandidates.current) {
                    try {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (error) {
                        console.error('Error adding queued ICE candidate:', error);
                    }
                }
                pendingIceCandidates.current = [];
            }
        });

        // Call rejected
        channel.listen('.call.rejected', () => {
            localStorage.removeItem(`pendingCall_${userId}`);
            endCall();
        });

        // Call ended
        channel.listen('.call.ended', () => {
            localStorage.removeItem(`pendingCall_${userId}`);
            endCall();
        });

        // ICE candidate
        channel.listen('.ice.candidate', async (data: any) => {
            if (peerConnection.current && data.candidate) {
                try {
                    // Check if remote description is set
                    if (peerConnection.current.remoteDescription) {
                        // Remote description is set, add candidate immediately
                        await peerConnection.current.addIceCandidate(
                            new RTCIceCandidate(data.candidate)
                        );
                    } else {
                        // Remote description not set yet, queue the candidate
                        pendingIceCandidates.current.push(data.candidate);
                    }
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        return () => {
            channel.stopListening('.call.initiated');
            channel.stopListening('.call.answered');
            channel.stopListening('.call.rejected');
            channel.stopListening('.call.ended');
            channel.stopListening('.ice.candidate');
        };
    }, [userId]);

    return {
        callState,
        initiateCall,
        answerCall: (callerId: number) => {
            const offer = (window as any).pendingCallOffer;
            if (offer) {
                answerCall(callerId, offer);
                delete (window as any).pendingCallOffer;
            }
        },
        rejectCall,
        endCall,
        remoteAudio,
    };
}
