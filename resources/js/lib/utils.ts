import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UserForAvatar {
    avatar?: string | null;
}

export function getUserAvatarUrl(user: UserForAvatar): string | null {
    // Server now returns fully-resolved URLs (e.g., http://app.test/storage/avatars/1/xxx.jpg)
    // or null if no avatar exists. Simply return what the server provides.
    // The default avatar fallback is handled by the rendering component checking for null.
    if (!user || !user.avatar) {
        return null;
    }

    // Return the server-provided avatar URL as-is (should be a full URL from asset())
    return user.avatar;
}

