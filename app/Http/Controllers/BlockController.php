<?php

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\User;
use Illuminate\Http\Request;

class BlockController extends Controller
{
    /**
     * Block a user
     */
    public function block(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = $validated['user_id'];

        // Can't block yourself
        if ($userId === auth()->id()) {
            return response()->json(['error' => 'Cannot block yourself'], 400);
        }

        // Check if already blocked
        $existing = Block::where('blocker_id', auth()->id())
            ->where('blocked_id', $userId)
            ->first();

        if ($existing) {
            return response()->json(['error' => 'User already blocked'], 400);
        }

        // Create block
        Block::create([
            'blocker_id' => auth()->id(),
            'blocked_id' => $userId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'User blocked successfully',
        ]);
    }

    /**
     * Unblock a user
     */
    public function unblock(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = $validated['user_id'];

        // Find and delete the block
        $block = Block::where('blocker_id', auth()->id())
            ->where('blocked_id', $userId)
            ->first();

        if (! $block) {
            return response()->json(['error' => 'User not blocked'], 400);
        }

        $block->delete();

        return response()->json([
            'success' => true,
            'message' => 'User unblocked successfully',
        ]);
    }

    /**
     * Get list of blocked users
     */
    public function blockedUsers()
    {
        $blockedUsers = Block::where('blocker_id', auth()->id())
            ->with('blocked')
            ->get()
            ->map(function ($block) {
                return [
                    'id' => $block->blocked->id,
                    'name' => $block->blocked->name,
                    'email' => $block->blocked->email,
                    'avatar' => $block->blocked->avatar ? asset('storage/'.$block->blocked->avatar) : null,
                    'blocked_at' => $block->created_at,
                ];
            });

        return response()->json($blockedUsers);
    }
}
