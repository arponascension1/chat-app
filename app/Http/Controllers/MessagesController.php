<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Http\Request;

class MessagesController extends Controller{
    public function showMessages($user): \Illuminate\Foundation\Application|\Illuminate\Contracts\View\View|\Illuminate\Contracts\View\Factory|\Illuminate\Routing\Redirector|\Illuminate\Contracts\Foundation\Application|\Illuminate\Http\RedirectResponse
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

        if (!$conversation) {
            $messages = null;
            // Handle case where conversation does not exist
            return view('chats.messages', compact('userInfo', 'messages'));
        }
        // change message seen status
        $conversation
            ->messages()
            ->where('user_id', '!=', $loggedInUserId)
            ->where('seen', false)
            ->update(['seen' => true]);
        // Load the messages for the conversation
        $messages = $conversation->messages()->orderBy('created_at')->get();


        return view('chats.messages', compact('userInfo', 'messages'));
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

        return redirect()->back();


    }
}
