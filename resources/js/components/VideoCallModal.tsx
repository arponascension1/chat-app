
import React, { useRef, useEffect } from 'react';
import Pusher from 'pusher-js';

export interface VideoCallModalProps {
    onClose: () => void;
    remoteUserName: string;
    conversationId?: number;
    userId?: number;
    remoteUserId?: number;
}

const VideoCallModal: React.FC<VideoCallModalProps> = (props) => {
    const { onClose, remoteUserName, conversationId, userId, remoteUserId } = props;
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let peerConnection: RTCPeerConnection | null = null;
        let localStream: MediaStream | null = null;
        let pusher: Pusher | null = null;
    let channel: any = null;

        const startWebRTC = async () => {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStream;
            }

            peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            localStream.getTracks().forEach(track => {
                peerConnection!.addTrack(track, localStream!);
            });

            peerConnection.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && channel && props.userId && props.remoteUserId) {
                    channel.trigger('client-ice-candidate', {
                        candidate: event.candidate,
                        from: props.userId,
                        to: props.remoteUserId
                    });
                }
            };

            // Setup Pusher for signaling
            pusher = new Pusher('YOUR_PUSHER_KEY', {
                cluster: 'ap3',
                authEndpoint: '/broadcasting/auth',
                auth: {
                    headers: {
                        // Add any needed auth headers
                    }
                }
            });
            channel = pusher.subscribe(`private-video-call.${props.conversationId}`);

            // Listen for offer/answer/ICE
            channel.bind('client-offer', async (data: any) => {
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    channel.trigger('client-answer', {
                        answer,
                        from: props.userId,
                        to: props.remoteUserId
                    });
                }
            });
            channel.bind('client-answer', async (data: any) => {
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            channel.bind('client-ice-candidate', async (data: any) => {
                if (peerConnection && data.candidate) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch {}
                }
            });

            // If caller, create offer
            if (props.userId && props.userId < props.remoteUserId!) {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                channel.trigger('client-offer', {
                    offer,
                    from: props.userId,
                    to: props.remoteUserId
                });
                // Notify receiver of incoming call
                channel.trigger('client-call-started', {
                    from: props.userId,
                    to: props.remoteUserId,
                    remoteUserName: props.remoteUserName
                });
            }
        };

        startWebRTC();

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            if (peerConnection) {
                peerConnection.close();
            }
            if (pusher && channel) {
                channel.unbind_all();
                pusher.unsubscribe(`private-video-call.${props.conversationId}`);
                pusher.disconnect();
            }
        };
    }, [props.conversationId, props.userId, props.remoteUserId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-lg flex flex-col items-center">
                <h2 className="text-lg font-bold mb-4">Video Call with {remoteUserName}</h2>
                <div className="flex space-x-4 mb-4">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-48 h-32 bg-gray-200 rounded" />
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-48 h-32 bg-gray-200 rounded" />
                </div>
                <button
                    className="mt-2 px-4 py-2 bg-[#25D366] text-white rounded hover:bg-[#1DA851]"
                    onClick={onClose}
                >
                    End Call
                </button>
            </div>
        </div>
    );
};

export default VideoCallModal;
