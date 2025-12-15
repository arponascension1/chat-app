import { useState, useRef, useCallback } from 'react';

export type RecordingState = 'idle' | 'recording' | 'paused';

interface UseVoiceRecorderReturn {
    recordingState: RecordingState;
    recordingTime: number;
    audioBlob: Blob | null;
    audioUrl: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    pauseRecording: () => void;
    resumeRecording: () => void;
    cancelRecording: () => void;
    error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedTimeRef = useRef<number>(0);

    const startTimer = useCallback(() => {
        startTimeRef.current = Date.now() - pausedTimeRef.current;
        timerIntervalRef.current = window.setInterval(() => {
            setRecordingTime(Date.now() - startTimeRef.current);
        }, 100);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    }, []);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            audioChunksRef.current = [];
            pausedTimeRef.current = 0;
            setRecordingTime(0);

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create MediaRecorder with webm format (widely supported)
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setRecordingState('recording');
            startTimer();
        } catch (err) {
            console.error('Error starting recording:', err);
            setError('Failed to start recording. Please check microphone permissions.');
        }
    }, [startTimer]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && recordingState !== 'idle') {
            mediaRecorderRef.current.stop();
            setRecordingState('idle');
            stopTimer();
        }
    }, [recordingState, stopTimer]);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && recordingState === 'recording') {
            mediaRecorderRef.current.pause();
            setRecordingState('paused');
            pausedTimeRef.current = recordingTime;
            stopTimer();
        }
    }, [recordingState, recordingTime, stopTimer]);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && recordingState === 'paused') {
            mediaRecorderRef.current.resume();
            setRecordingState('recording');
            startTimer();
        }
    }, [recordingState, startTimer]);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current) {
            // Stop the media recorder
            const stream = mediaRecorderRef.current.stream;
            mediaRecorderRef.current.stop();
            stream.getTracks().forEach(track => track.stop());
        }

        // Clean up
        audioChunksRef.current = [];
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioUrl(null);
        setRecordingState('idle');
        setRecordingTime(0);
        pausedTimeRef.current = 0;
        stopTimer();
    }, [audioUrl, stopTimer]);

    return {
        recordingState,
        recordingTime,
        audioBlob,
        audioUrl,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        cancelRecording,
        error,
    };
}
