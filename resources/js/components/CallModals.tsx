import { Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IncomingCallModalProps {
    callerName: string;
    onAnswer: () => void;
    onReject: () => void;
}

export function IncomingCallModal({ callerName, onAnswer, onReject }: IncomingCallModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                        <Phone className="h-10 w-10 animate-pulse text-blue-600 dark:text-blue-400" />
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Incoming Call
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {callerName} is calling...
                        </p>
                    </div>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onReject}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-white transition hover:bg-red-700"
                        >
                            <PhoneOff className="h-5 w-5" />
                            <span>Decline</span>
                        </button>
                        <button
                            onClick={onAnswer}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-white transition hover:bg-green-700"
                        >
                            <Phone className="h-5 w-5" />
                            <span>Answer</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ActiveCallModalProps {
    receiverName: string;
    isConnected: boolean;
    onEndCall: () => void;
}

export function ActiveCallModal({ receiverName, isConnected, onEndCall }: ActiveCallModalProps) {
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (isConnected) {
            const interval = setInterval(() => {
                setDuration((prev) => prev + 1);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [isConnected]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        setIsMuted((prev) => !prev);
        // TODO: Implement actual mute functionality with media stream
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <div className="flex flex-col items-center gap-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                        <Phone className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {receiverName}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {isConnected ? formatDuration(duration) : 'Connecting...'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={toggleMute}
                            className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                                isMuted
                                    ? 'bg-gray-300 dark:bg-gray-600'
                                    : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                        >
                            {isMuted ? (
                                <VolumeX className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                            ) : (
                                <Volume2 className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                            )}
                        </button>

                        <button
                            onClick={onEndCall}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-700"
                        >
                            <PhoneOff className="h-6 w-6 text-white" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface CallingModalProps {
    receiverName: string;
    onCancel: () => void;
}

export function CallingModal({ receiverName, onCancel }: CallingModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                        <Phone className="h-10 w-10 animate-pulse text-blue-600 dark:text-blue-400" />
                    </div>

                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Calling...
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {receiverName}
                        </p>
                    </div>

                    <button
                        onClick={onCancel}
                        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-white transition hover:bg-red-700"
                    >
                        <PhoneOff className="h-5 w-5" />
                        <span>Cancel</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
