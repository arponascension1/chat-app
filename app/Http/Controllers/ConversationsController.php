<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Support\Facades\Auth;

class ConversationsController extends Controller{
    public function getIndex(): \Illuminate\Contracts\View\View|\Illuminate\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\Foundation\Application
    {
        $user = Auth::user();
        $conversations = Conversation::where('user1_id', $user->id)
        ->orWhere('user2_id', $user->id)
        ->orderByDesc('updated_at')
        ->get();

        return view('chats.conversations', compact('conversations'));
    }
}
