<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class MessagesController extends Controller{
    public function showMessages($user, Request $request): \Illuminate\Foundation\Application|\Illuminate\Contracts\View\View|\Illuminate\Contracts\View\Factory|\Illuminate\Routing\Redirector|\Illuminate\Contracts\Foundation\Application|\Illuminate\Http\RedirectResponse
    {
        $loggedInUserId = auth()->user()->id;
        if( $user == $loggedInUserId){
            return redirect('/home');
        }
        $userInfo = User::find($user);
        if(!$userInfo){
            return redirect('/home');
        }
        // Find the conversation where the logged-in user and the given user ID are participants
        $conversation = Conversation::where(function ($query) use ($loggedInUserId, $user) {
            $query->where('user1_id', $loggedInUserId)->where('user2_id', $user);
        })->orWhere(function ($query) use ($loggedInUserId, $user) {
            $query->where('user1_id', $user)->where('user2_id', $loggedInUserId);
        })->first();

        // Handle case where conversation does not exist
        if (!$conversation) {
            $messages = null;
            return view('chats.messages', compact('userInfo', 'messages'));
        }


        $messagesReversed = $conversation->messages()
            ->orderBy('created_at', 'desc') // Retrieve messages in descending order of their creation time
            ->simplePaginate(5);

        $messages = $messagesReversed->sortBy('created_at');

// Calculate the total number of messages
        $totalMessages = $conversation->messages()->count();

// Create a new LengthAwarePaginator instance with the reversed messages
        $paginator = new LengthAwarePaginator(
            $messages,
            $totalMessages,
            $messagesReversed->perPage(),
            $messagesReversed->currentPage(),
            ['path' => ''] // Replace empty string with the appropriate URL path
        );

        return view('chats.messages', compact('userInfo', 'messages', 'paginator'));
    }
    public function sentMessage(Request $request, $user): \Illuminate\Foundation\Application|\Illuminate\Routing\Redirector|\Illuminate\Http\RedirectResponse|\Illuminate\Contracts\Foundation\Application
    {

        $loggedInUserId = auth()->user()->id;
        if( $user == $loggedInUserId){
            return redirect('/home');
        }
        $request->validate([
            'content' => 'required'
        ]);
        // Find or create the conversation between the logged-in user and the given user ID
        $conversation = Conversation::where(function ($query) use ($loggedInUserId, $user) {
            $query->where('user1_id', $loggedInUserId)->where('user2_id', $user);
        })->orWhere(function ($query) use ($loggedInUserId, $user) {
            $query->where('user1_id', $user)->where('user2_id', $loggedInUserId);
        })->first();

        if (!$conversation) {
            // Create a new conversation if it does not exist
            $conversation = new Conversation();
            $conversation->user1_id = $loggedInUserId;
            $conversation->user2_id = $user;
            $conversation->save();
        }

        // Update the conversation's update time
        $conversation->touch();

        // Create a new message and associate it with the conversation
        $message = new Message();
        $message->content = $request->input('content');
        $message->user_id = $loggedInUserId;

        $conversation->messages()->save($message);

        return redirect("/chat/$user");
    }
}
