import { Head, Link } from '@inertiajs/react';
import Button from '@/components/UI/Button';

export default function Welcome() {
    return (
        <>
            <Head title="Welcome to ChatApp" />
            <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366]">
                <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.33-3.83-.91l-.27-.17-2.83.48.48-2.83-.17-.27C4.83 14.68 4.5 13.38 4.5 12c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zm4.5-6.5c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.17-.47-.29z" />
                                    </svg>
                                </div>
                                <h1 className="text-xl font-bold text-white">ChatApp</h1>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="flex space-x-3">
                                    <Link href="/login">
                                        <Button variant="outline" size="sm" className="text-white border-white/30 hover:bg-white/10">
                                            Login
                                        </Button>
                                    </Link>
                                    <Link href="/register">
                                        <Button variant="primary" size="sm">
                                            Sign Up
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <div className="text-center">
                        <h2 className="text-5xl font-bold text-white mb-6">Welcome to ChatApp</h2>
                        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                            Connect with friends and family instantly. Share messages, photos, videos, and more in real-time.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <Link href="/register">
                                <Button variant="primary" size="lg" className="px-8">Get Started</Button>
                            </Link>
                            <Link href="/login">
                                <Button variant="outline" size="lg" className="px-8 text-white border-white/50 hover:bg-white/10">Sign In</Button>
                            </Link>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div className="mt-20 grid md:grid-cols-3 gap-8">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Lightning Fast</h3>
                            <p className="text-white/80">Real-time messaging with instant delivery. No delays, just pure speed.</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Secure & Private</h3>
                            <p className="text-white/80">Your conversations are protected with end-to-end encryption.</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                                <svg className="w-6 h-6 text-[#25D366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Group Chats</h3>
                            <p className="text-white/80">Create groups and chat with multiple people at once.</p>
                        </div>
                    </div>
                </main>
                <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16 border-t border-white/20">
                    <div className="text-center text-white/70 text-sm">
                        <p>&copy; {new Date().getFullYear()} ChatApp. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
