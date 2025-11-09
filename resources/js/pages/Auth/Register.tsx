import { FormEvent, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AuthLayout from '@/components/Layout/AuthLayout';
import Input from '@/components/UI/Input';
import Button from '@/components/UI/Button';

interface RegisterProps {
    errors?: {
        name?: string;
        email?: string;
        password?: string;
        password_confirmation?: string;
    };
}

export default function Register({ errors = {} }: RegisterProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        router.post('/register', formData, {
            onFinish: () => setIsLoading(false),
        });
    };

    return (
        <AuthLayout>
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create an account</h2>
                <p className="text-gray-600 mb-6">Join ChatApp to start messaging</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="text"
                        label="Full Name"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        error={errors.name}
                        required
                        autoComplete="name"
                        autoFocus
                    />

                    <Input
                        type="email"
                        label="Email Address"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        error={errors.email}
                        required
                        autoComplete="email"
                    />

                    <Input
                        type="password"
                        label="Password"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        error={errors.password}
                        required
                        autoComplete="new-password"
                        helperText="Must be at least 8 characters"
                    />

                    <Input
                        type="password"
                        label="Confirm Password"
                        placeholder="Confirm your password"
                        value={formData.password_confirmation}
                        onChange={(e) =>
                            setFormData({ ...formData, password_confirmation: e.target.value })
                        }
                        error={errors.password_confirmation}
                        required
                        autoComplete="new-password"
                    />

                    <div className="flex items-start">
                        <input
                            type="checkbox"
                            id="terms"
                            required
                            className="w-4 h-4 mt-1 text-[#25D366] border-gray-300 rounded focus:ring-[#25D366]"
                        />
                        <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                            I agree to the{' '}
                            <Link href="#" className="text-[#25D366] hover:text-[#20BD5A]">
                                Terms of Service
                            </Link>{' '}
                            and{' '}
                            <Link href="#" className="text-[#25D366] hover:text-[#20BD5A]">
                                Privacy Policy
                            </Link>
                        </label>
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full"
                        isLoading={isLoading}
                    >
                        Create Account
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link
                            href="/login"
                            className="text-[#25D366] hover:text-[#20BD5A] font-medium"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Divider */}
                <div className="mt-6 relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or sign up with</span>
                    </div>
                </div>

                {/* Social Signup Buttons */}
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-full"
                        onClick={() => alert('Google signup not implemented yet')}
                    >
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Google
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="w-full"
                        onClick={() => alert('Facebook signup not implemented yet')}
                    >
                        <svg className="w-5 h-5 mr-2" fill="#1877F2" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        Facebook
                    </Button>
                </div>
            </div>
        </AuthLayout>
    );
}
