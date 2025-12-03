import { useState, useRef, useMemo } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';

interface Props {
    user: {
        id: number;
        name: string;
        email: string;
        avatar?: string | null;
    };
}

export default function Profile({ user }: Props) {
    const { data, setData, post, errors, wasSuccessful, processing } = useForm({
        name: user.name,
        email: user.email,
        avatar: null as File | null,
    });
    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    // Server now returns fully-resolved URLs (http://...test/storage/avatars/...jpg) or null.
    // Use the server-provided URL directly instead of constructing /storage/... prefix.
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar || null);
    const [password, setPassword] = useState('');

    const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('avatar', file);
            const reader = new FileReader();
            reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const saveProfile = (e: React.FormEvent) => {
        e.preventDefault();
        post('/profile', {
            onSuccess: () => {
                // After saving, keep local preview updated. Do NOT reload Inertia props here so
                // receiver avatars in the chat index only change after a full page refresh.
            },
        });
    };

    const changePassword = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.data.password = password;
        passwordForm.post('/profile/password', {
            onSuccess: () => {
                passwordForm.reset();
                setPassword('');
            },
        });
    };

    const deleteAvatar = (e: React.FormEvent) => {
        e.preventDefault();
        if (confirm('Are you sure you want to delete your avatar?')) {
            router.delete('/profile/avatar', {
                onSuccess: () => {
                    setAvatarPreview(null);
                    // Do not reload Inertia props here; let receiver/avatar updates appear on full refresh.
                }
            });
        }
    }

    const handleLogout = () => {
        router.post('/logout');
    };

    const passwordStrength = useMemo(() => {
        if (!password) return { label: 'Empty', score: 0, color: 'bg-gray-200' };
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
        return { label: labels[score-1], score, color: colors[score-1] };
    }, [password]);

    return (
        <>
            <Head title="Profile Settings" />
            <div className="flex h-screen bg-[#F0F2F5]">
                {/* Left Menu Bar - Same as Chat */}
                <div className="flex flex-col bg-[#008069] w-16 items-center justify-end py-4 space-y-6">
                    <Link href="/" className="p-2 hover:bg-[#017561] rounded-full transition" title="Chats">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </Link>
                    <Link href="/profile" className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition" title="Profile">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <span className="text-white font-bold text-sm">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </Link>
                    <Link href="/profile" className="p-2 hover:bg-[#017561] rounded-full transition bg-[#017561]" title="Settings">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="p-2 hover:bg-[#017561] rounded-full transition"
                        title="Logout"
                    >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto">
                    {/* Header */}
                    <div className="bg-[#F0F2F5] px-6 py-4 border-b border-gray-200 flex items-center">
                        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Chat
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-800 ml-6">Profile Settings</h1>
                    </div>

                    <div className="p-6 md:p-8 max-w-4xl mx-auto">
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {/* Avatar Section */}
                            <div className="bg-gradient-to-r from-[#008069] to-[#00a884] px-6 py-8">
                                <div className="flex items-center space-x-6">
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-white rounded-full overflow-hidden flex items-center justify-center ring-4 ring-white/30">
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl text-white font-bold bg-[#008069] w-full h-full flex items-center justify-center">{user.name.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-white text-[#008069] p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </label>
                                    </div>
                                    <div className="text-white">
                                        <h2 className="text-2xl font-bold">{user.name}</h2>
                                        <p className="text-white/90 mt-1">{user.email}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Profile Form */}
                            <div className="p-6">
                                <form onSubmit={saveProfile} className="space-y-5">
                                    {wasSuccessful && (
                                        <div className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Profile updated successfully.
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                                        <input 
                                            value={data.name} 
                                            onChange={e => setData('name', e.target.value)} 
                                            className={`w-full px-4 py-3 rounded-lg border ${errors.name ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-[#008069] focus:border-transparent transition`} 
                                            placeholder="Enter your name"
                                        />
                                        {errors.name && <p className="text-xs text-red-600 mt-2">{errors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                                        <input 
                                            value={data.email} 
                                            onChange={e => setData('email', e.target.value)} 
                                            className={`w-full px-4 py-3 rounded-lg border ${errors.email ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-[#008069] focus:border-transparent transition`} 
                                            placeholder="Enter your email"
                                        />
                                        {errors.email && <p className="text-xs text-red-600 mt-2">{errors.email}</p>}
                                    </div>
                                    <div className="flex items-center space-x-3 pt-2">
                                        <button type="submit" disabled={processing} className="px-6 py-3 bg-[#008069] text-white rounded-lg hover:bg-[#017561] disabled:opacity-50 transition-colors font-medium">
                                            {processing ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        {user.avatar && (
                                            <button type="button" onClick={deleteAvatar} className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                                                Delete Avatar
                                            </button>
                                        )}
                                    </div>
                                </form>

                                {/* Password Section */}
                                <div className="mt-8 pt-8 border-t border-gray-200">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Change Password</h3>
                                    <p className="text-sm text-gray-500 mb-6">Choose a strong password to keep your account secure.</p>
                                    <form onSubmit={changePassword} className="space-y-5">
                                        {passwordForm.wasSuccessful && (
                                            <div className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Password updated successfully.
                                            </div>
                                        )}
                                        {passwordForm.errors.current_password && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{passwordForm.errors.current_password}</p>}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                                            <input
                                                value={passwordForm.data.current_password}
                                                onChange={e => passwordForm.setData('current_password', e.target.value)}
                                                type="password"
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#008069] focus:border-transparent transition"
                                                placeholder="Enter current password"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                                            <input
                                                value={password}
                                                onChange={e => {
                                                    setPassword(e.target.value);
                                                    passwordForm.setData('password', e.target.value);
                                                }}
                                                type="password"
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#008069] focus:border-transparent transition"
                                                placeholder="Enter new password"
                                            />
                                            {password && (
                                                <div className="mt-3">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <div className={`flex-1 h-2 rounded-full ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-gray-200'}`}></div>
                                                        <div className={`flex-1 h-2 rounded-full ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-gray-200'}`}></div>
                                                        <div className={`flex-1 h-2 rounded-full ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-gray-200'}`}></div>
                                                        <div className={`flex-1 h-2 rounded-full ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-gray-200'}`}></div>
                                                    </div>
                                                    <span className="text-sm font-medium text-gray-600">Password strength: {passwordStrength.label}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                                            <input
                                                value={passwordForm.data.password_confirmation}
                                                onChange={e => passwordForm.setData('password_confirmation', e.target.value)}
                                                type="password"
                                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#008069] focus:border-transparent transition"
                                                placeholder="Confirm new password"
                                            />
                                            {passwordForm.errors.password && <p className="text-xs text-red-600 mt-2">{passwordForm.errors.password}</p>}
                                        </div>
                                        <div className="pt-2">
                                            <button type="submit" disabled={passwordForm.processing} className="px-6 py-3 bg-[#008069] text-white rounded-lg hover:bg-[#017561] disabled:opacity-50 transition-colors font-medium">
                                                {passwordForm.processing ? 'Updating...' : 'Update Password'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
