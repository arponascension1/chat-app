<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class UserController extends Controller
{
    /**
     * Show profile edit page
     */
    public function edit()
    {
        $user = auth()->user();

        return Inertia::render('Settings/Profile', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar' => $user->avatar ? asset('storage/' . $user->avatar) : null,
            ],
        ]);
    }

    /**
     * Update profile (name, email, avatar)
     */
    public function update(UpdateProfileRequest $request)
    {
        $user = auth()->user();

        $validated = $request->validated();

        // Only update avatar if a file was uploaded
        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists before uploading new one
            if ($user->avatar) {
                $this->deleteAvatarFile($user->avatar);
            }

            // Store new avatar
            $path = $request->file('avatar')->store('avatars/'.$user->id, 'public');
            $validated['avatar'] = $path;
        } else {
            // Remove avatar from validated data to prevent it from being set to null
            unset($validated['avatar']);
        }

        $user->update($validated);

        return back();
    }

    /**
     * Change password
     */
    public function updatePassword(UpdatePasswordRequest $request)
    {
        $user = auth()->user();

        $user->password = $request->validated()['password'];
        $user->save();

        return back();
    }

    /**
     * Delete avatar
     */
    public function deleteAvatar()
    {
        $user = auth()->user();

        if ($user->avatar) {
            $this->deleteAvatarFile($user->avatar);
            $user->avatar = null;
            $user->save();
        }

        return back();
    }

    /**
     * Helper method to delete avatar file from storage
     */
    private function deleteAvatarFile(string $avatarPath): void
    {
        // Delete the avatar file
        if (Storage::disk('public')->exists($avatarPath)) {
            Storage::disk('public')->delete($avatarPath);
        }

        // Delete the user's avatar directory (e.g., avatars/1/)
        $directory = dirname($avatarPath);
        if (Storage::disk('public')->exists($directory)) {
            Storage::disk('public')->deleteDirectory($directory);
        }
    }
}
