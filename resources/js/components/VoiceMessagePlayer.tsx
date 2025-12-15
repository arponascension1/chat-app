import { useState, useRef, useEffect } from 'react';

interface VoiceMessagePlayerProps {
    audioUrl: string;
    isOwnMessage: boolean;
}

export default function VoiceMessagePlayer({ audioUrl, isOwnMessage }: VoiceMessagePlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Generate waveform bars with more varied heights for a natural look
    const bars = Array.from({ length: 50 }, (_, i) => {
        const wave1 = Math.sin(i * 0.35) * 25;
        const wave2 = Math.cos(i * 0.5) * 20;
        const wave3 = Math.sin(i * 0.15) * 15;
        const height = 45 + wave1 + wave2 + wave3;
        return Math.max(20, Math.min(90, height));
    });

    return (
        <div 
            className={`flex items-center gap-3 py-2 px-3 rounded-xl min-w-[260px] max-w-[360px] transition-all ${
                isOwnMessage 
                    ? 'bg-white/20 hover:bg-white/30' 
                    : 'bg-black/10 hover:bg-black/15'
            }`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
            
            {/* Play/Pause Button - Improved Design */}
            <button
                onClick={togglePlay}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isOwnMessage 
                        ? 'bg-[#DCF8C6] hover:bg-[#C8E6B8] shadow-sm' 
                        : 'bg-white hover:bg-gray-50 shadow-sm'
                }`}
            >
                {isPlaying ? (
                    <svg className="w-3.5 h-3.5 text-[#128C7E]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4 ml-0.5 text-[#128C7E]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </button>

            {/* Waveform Container */}
            <div className="flex-1 flex items-center gap-2">
                {/* Waveform Bars with Animation */}
                <div 
                    className="flex-1 flex items-center gap-[1.5px] cursor-pointer h-8 group"
                    onClick={(e) => {
                        if (audioRef.current && duration > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const percentage = x / rect.width;
                            audioRef.current.currentTime = percentage * duration;
                        }
                    }}
                >
                    {bars.map((height, i) => {
                        const barProgress = (i / bars.length) * 100;
                        const isPassed = barProgress <= progress;
                        
                        return (
                            <div
                                key={i}
                                className={`w-[2.5px] rounded-full transition-all duration-150 ${
                                    isPassed
                                        ? isOwnMessage 
                                            ? 'bg-[#128C7E]' 
                                            : 'bg-[#0084FF]'
                                        : isOwnMessage
                                            ? 'bg-[#128C7E]/25'
                                            : 'bg-[#0084FF]/25'
                                } ${isPlaying && isPassed ? 'animate-pulse' : ''} ${
                                    isHovering ? 'hover:scale-y-110' : ''
                                }`}
                                style={{
                                    height: `${height}%`,
                                    animationDelay: `${i * 20}ms`,
                                }}
                            />
                        );
                    })}
                </div>
                
                {/* Time Display - Better Positioning */}
                <span className={`text-[11px] font-medium tabular-nums flex-shrink-0 w-10 text-right ${
                    isOwnMessage ? 'text-gray-700' : 'text-gray-600'
                }`}>
                    {isPlaying ? formatTime(currentTime) : formatTime(duration)}
                </span>
            </div>

            {/* Microphone Icon - Visual Indicator */}
            <svg 
                className={`w-4 h-4 flex-shrink-0 ${
                    isOwnMessage ? 'text-[#128C7E]/40' : 'text-gray-400'
                }`} 
                fill="currentColor" 
                viewBox="0 0 24 24"
            >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
        </div>
    );
}
