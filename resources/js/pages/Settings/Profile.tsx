import { useState, useRef, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';

interface Props {
    user: {
        id: number;
        name: string;
        email: string;
        avatar?: string | null;
    };
}

export default function Profile({ user }: Props) {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar ? `/storage/${user.avatar}` : null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const currentPasswordRef = useRef<HTMLInputElement | null>(null);
    const newPasswordRef = useRef<HTMLInputElement | null>(null);
    const newPasswordConfirmRef = useRef<HTMLInputElement | null>(null);

    const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setErrors({});
        try {
            const form = new FormData();
            form.append('name', name);
            form.append('email', email);
            if (avatarFile) form.append('avatar', avatarFile);

            await axios.post('/profile', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            // soft success toast
            // reload to update layout/header if needed
            window.location.reload();
        } catch (err: any) {
            if (err?.response?.status === 422 && err.response.data.errors) {
                // Laravel validation errors
                const mapped: Record<string, string> = {};
                Object.keys(err.response.data.errors).forEach((k) => {
                    mapped[k] = err.response.data.errors[k][0];
                });
                setErrors(mapped);
            } else {
                setErrors({ general: err?.response?.data?.message || 'Error updating profile' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const changePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});
        const current = currentPasswordRef.current?.value || '';
        const pass = newPasswordRef.current?.value || '';
        const passConfirm = newPasswordConfirmRef.current?.value || '';

        try {
            await axios.post('/profile/password', {
                current_password: current,
                password: pass,
                password_confirmation: passConfirm,
            });
            alert('Password changed successfully');
            if (currentPasswordRef.current) currentPasswordRef.current.value = '';
            if (newPasswordRef.current) newPasswordRef.current.value = '';
            if (newPasswordConfirmRef.current) newPasswordConfirmRef.current.value = '';
        } catch (err: any) {
            if (err?.response?.status === 422) {
                setErrors({ password: err.response.data.error || err.response.data.message || 'Invalid input' });
            } else {
                setErrors({ general: err?.response?.data?.message || 'Error changing password' });
            }
        }
    };

    const passwordStrength = useMemo(() => {
        const pass = newPasswordRef.current?.value || '';
        if (!pass) return { label: 'Empty', score: 0 };
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;
        const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
        return { label: labels[score], score };
    }, [/* intentionally left empty; will be recomputed on render */]);

    return (
        <div className="p-6">
            <Head title="Profile - ChatApp" />

            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow sm:rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">Profile</h2>
                        <p className="text-sm text-gray-500">Manage your account information</p>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left: Avatar + actions */}
                        <div className="col-span-1 flex flex-col items-center">
                            <div className="relative">
                                <div className="w-36 h-36 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl text-white font-bold bg-[#25D366] w-full h-full flex items-center justify-center">{user.name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <label className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow cursor-pointer">
                                    <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                                    </svg>
                                </label>
                            </div>

                            <p className="mt-4 text-sm text-gray-600 text-center">Avatar will be visible on your account.</p>
                        </div>

                        {/* Right: Forms */}
                        <div className="col-span-1 md:col-span-2">
                            <form onSubmit={saveProfile} className="space-y-4">
                                {errors.general && (
                                    <div className="p-3 bg-red-50 text-red-700 rounded">{errors.general}</div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input value={name} onChange={e => setName(e.target.value)} className={`mt-1 block w-full rounded-md border-gray-200 shadow-sm ${errors.name ? 'border-red-300' : ''}`} />
                                    {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input value={email} onChange={e => setEmail(e.target.value)} className={`mt-1 block w-full rounded-md border-gray-200 shadow-sm ${errors.email ? 'border-red-300' : ''}`} />
                                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                                </div>

                                <div className="flex items-center space-x-3">
                                    <label className="inline-flex items-center px-4 py-2 bg-[#25D366] text-white rounded-md cursor-pointer">
                                        <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
                                        Upload Avatar
                                    </label>
                                    <button type="submit" disabled={isSaving} className="px-4 py-2 bg-gray-800 text-white rounded-md shadow">
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 border-t pt-6">
                                <h3 className="text-md font-medium text-gray-900">Change password</h3>
                                <form onSubmit={changePassword} className="mt-4 space-y-4 max-w-md">
                                    {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Current password</label>
                                        <input ref={currentPasswordRef} type="password" className="mt-1 block w-full rounded-md border-gray-200 shadow-sm" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">New password</label>
                                        <input ref={newPasswordRef} type="password" className="mt-1 block w-full rounded-md border-gray-200 shadow-sm" />
                                        <p className="text-sm text-gray-500 mt-1">Use at least 8 characters. Mix letters and numbers for stronger password.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
                                        <input ref={newPasswordConfirmRef} type="password" className="mt-1 block w-full rounded-md border-gray-200 shadow-sm" />
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <button type="submit" className="px-4 py-2 bg-[#3B82F6] text-white rounded-md">Change password</button>
                                        <p className="text-sm text-gray-500">We'll never share your password.</p>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
