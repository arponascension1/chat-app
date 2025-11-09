import { ReactNode } from 'react';
import { Link } from '@inertiajs/react';

interface AuthLayoutProps {
    children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#075E54] to-[#128C7E] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <Link href="/welcome">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
                            <svg
                                className="w-12 h-12 text-[#25D366]"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.33-3.83-.91l-.27-.17-2.83.48.48-2.83-.17-.27C4.83 14.68 4.5 13.38 4.5 12c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zm4.5-6.5c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.17-.47-.29z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-white">ChatApp</h1>
                        <p className="text-white/80 mt-2">Connect with your loved ones</p>
                    </Link>
                </div>

                {/* Auth Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {children}
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-white/70 text-sm">
                    <p>&copy; {new Date().getFullYear()} ChatApp. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
