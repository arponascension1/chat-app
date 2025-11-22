<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
                'avatar' => $user->avatar,
            ]
        ]);
    }

    /**
     * Update profile (name, email, avatar)
     */
    public function update(Request $request)
    {
        $user = auth()->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'avatar' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('avatars/' . $user->id, 'public');

            // Delete old avatar if exists
            if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
                Storage::disk('public')->delete($user->avatar);
            }

            $validated['avatar'] = $path;
        }

        $user->update($validated);

        return response()->json(['success' => true, 'user' => $user]);
    }

    /**
     * Change password
     */
    public function updatePassword(Request $request)
    {
        $user = auth()->user();

        $validated = $request->validate([
            'current_password' => ['required'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['error' => 'Current password is incorrect'], 422);
        }

        $user->password = $validated['password'];
        $user->save();

        return response()->json(['success' => true]);
    }
}
