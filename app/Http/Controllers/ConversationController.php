<?php

namespace App\Http\Controllers;

use App\Models\CallHistory;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    /**
     * Home page with initial conversations (/)
     */
    public function home()
    {
        // Load all conversations for sidebar
        $conversations = auth()->user()->conversations()
            ->with(['userOne', 'userTwo'])
            ->withCount(['messages as unread_count' => function ($query) {
                $query->where('user_id', '!=', auth()->id())
                    ->where('seen', false);
            }])
            ->get()
            ->filter(function ($conversation) {
                // Only show conversations that have at least one message or call
                return $conversation->getLastActivityFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id()
                    ? $conversation->userTwo
                    : $conversation->userOne;

                $lastActivity = $conversation->getLastActivityFor(auth()->id());

                // Get unseen call count
                $unseenCallCount = $conversation->getUnseenCallCountFor(auth()->id());

                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        // Return fully-resolved URL for avatar when available
                        'avatar' => $otherUser->avatar ? asset('storage/'.$otherUser->avatar) : null,
                        // Provide a best-effort last active timestamp for client-side "active ago" display
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $this->formatLastActivity($lastActivity, auth()->id()),
                    'unread_count' => $conversation->unread_count + $unseenCallCount,
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        // Provide a minimal auth user payload with fully-resolved avatar URL so the frontend
        // can render images without needing to prefix /storage/ itself.
        $authUser = auth()->user();
        $authPayload = [
            'id' => $authUser->id,
            'name' => $authUser->name,
            'email' => $authUser->email,
            'avatar' => $authUser->avatar ? asset('storage/'.$authUser->avatar) : null,
        ];

        return \Inertia\Inertia::render('Chats/Index', [
            'auth' => [
                'user' => $authPayload,
            ],
            'initialConversations' => $conversations,
        ]);
    }

    /**
     * Get all conversations for authenticated user
     */
    public function index()
    {
        $conversations = auth()->user()->conversations()->get();

        $formattedConversations = $conversations
            ->filter(function ($conversation) {
                // Only show conversations that have at least one message or call
                return $conversation->getLastActivityFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->getOtherUser(auth()->id());
                $lastActivity = $conversation->getLastActivityFor(auth()->id());

                // Get unseen call count
                $unseenCallCount = $conversation->getUnseenCallCountFor(auth()->id());

                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'avatar' => $otherUser->avatar ? asset('storage/'.$otherUser->avatar) : null,
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $this->formatLastActivity($lastActivity, auth()->id()),
                    'unread_count' => $conversation->messages()
                        ->where('user_id', '!=', auth()->id())
                        ->where('seen', false)
                        ->count() + $unseenCallCount,
                    'updated_at' => $conversation->updated_at,
                ];
            });

        return response()->json($formattedConversations);
    }

    /**
     * Get messages for a specific conversation
     */
    public function show(Conversation $conversation)
    {
        // Check if user is part of this conversation
        if ($conversation->user1_id !== auth()->id() && $conversation->user2_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Mark unseen missed/rejected/cancelled calls as seen for the receiver
        $unseenCalls = CallHistory::where('conversation_id', $conversation->id)
            ->where('receiver_id', auth()->id())
            ->whereIn('status', ['missed', 'rejected', 'cancelled'])
            ->where('is_seen', false)
            ->get();

        foreach ($unseenCalls as $call) {
            $call->update(['is_seen' => true]);
            // Refresh and load relationships for broadcast
            $call->refresh();
            $call->load(['caller', 'receiver', 'conversation']);
            broadcast(new \App\Events\CallHistoryUpdated($call));
        }

        // Get messages with call history merged
        $messages = $this->getMessagesWithCallHistory($conversation, 50);

        // Check if there are more messages (including call history)
        $totalCount = $conversation->messages()->count() + CallHistory::where('conversation_id', $conversation->id)->count();
        $hasMore = $totalCount > 50;

        // NOTE: We no longer auto-mark messages as seen when loading a conversation.
        // Seen status is managed from the client when the user scrolls to the bottom
        // to ensure messages are only marked read when actually viewed.

        $otherUser = $conversation->getOtherUser(auth()->id());

        // Check if blocked
        $isBlocked = auth()->user()->hasBlocked($otherUser->id);
        $isBlockedBy = auth()->user()->isBlockedBy($otherUser->id);

        return response()->json([
            'conversation' => [
                'id' => $conversation->id,
                'other_user' => [
                    'id' => $otherUser->id,
                    'name' => $otherUser->name,
                    'email' => $otherUser->email,
                    'avatar' => $otherUser->avatar ? asset('storage/'.$otherUser->avatar) : null,
                    'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                ],
                'is_blocked' => $isBlocked,
                'is_blocked_by' => $isBlockedBy,
            ],
            'messages' => $messages,
            'has_more' => $hasMore,
        ]);
    }

    /**
     * Load more messages for pagination
     */
    public function loadMore(Request $request, Conversation $conversation)
    {
        // Check if user is part of this conversation
        if ($conversation->user1_id !== auth()->id() && $conversation->user2_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $beforeMessageId = $request->input('before_id');
        $limit = 50;

        // Get messages with call history merged
        $messages = $this->getMessagesWithCallHistory($conversation, $limit, $beforeMessageId);

        // Check if there are more messages
        $hasMore = false;
        if ($messages->count() > 0) {
            $firstMessage = $messages->first();
            $oldestCreatedAt = $firstMessage['created_at'];

            // Check if there are more messages or calls before this timestamp
            $hasMoreMessages = $conversation->messages()
                ->where('created_at', '<', $oldestCreatedAt)
                ->exists();

            $hasMoreCalls = CallHistory::where('conversation_id', $conversation->id)
                ->where('created_at', '<', $oldestCreatedAt)
                ->exists();

            $hasMore = $hasMoreMessages || $hasMoreCalls;
        }

        return response()->json([
            'messages' => $messages,
            'has_more' => $hasMore,
        ]);
    }

    /**
     * Get all users for starting new conversation
     */
    public function users()
    {
        // Get blocked user IDs (users I blocked + users who blocked me)
        $blockedUserIds = auth()->user()->blockedUsers()->pluck('blocked_id')->toArray();
        $blockedByUserIds = auth()->user()->blockedByUsers()->pluck('blocker_id')->toArray();
        $allBlockedIds = array_unique(array_merge($blockedUserIds, $blockedByUserIds));

        $users = User::where('id', '!=', auth()->id())
            ->whereNotIn('id', $allBlockedIds)
            ->select('id', 'name', 'email', 'avatar')
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'avatar' => $u->avatar ? asset('storage/'.$u->avatar) : null,
                ];
            });

        return response()->json($users);
    }

    /**
     * Search conversations and users
     */
    public function search(Request $request)
    {
        $query = $request->input('q', '');

        if (empty($query)) {
            return response()->json([
                'conversations' => [],
                'users' => [],
            ]);
        }

        $searchTerm = strtolower($query);

        // Search conversations
        $conversations = auth()->user()->conversations()
            ->with(['userOne', 'userTwo'])
            ->get()
            ->filter(function ($conversation) use ($searchTerm) {
                // Only show conversations that have at least one message or call
                $lastActivity = $conversation->getLastActivityFor(auth()->id());
                if ($lastActivity === null) {
                    return false;
                }

                $otherUser = $conversation->user1_id === auth()->id()
                    ? $conversation->userTwo
                    : $conversation->userOne;

                // Search in user name and email
                $nameMatch = str_contains(strtolower($otherUser->name), $searchTerm);
                $emailMatch = str_contains(strtolower($otherUser->email), $searchTerm);

                // Search in last message/activity content
                $contentToSearch = isset($lastActivity->content) ? ($lastActivity->content ?? '') : '';
                $messageMatch = str_contains(strtolower($contentToSearch), $searchTerm);

                return $nameMatch || $emailMatch || $messageMatch;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id()
                    ? $conversation->userTwo
                    : $conversation->userOne;

                $lastActivity = $conversation->getLastActivityFor(auth()->id());

                // Get unseen call count
                $unseenCallCount = $conversation->getUnseenCallCountFor(auth()->id());

                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'avatar' => $otherUser->avatar ? asset('storage/'.$otherUser->avatar) : null,
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $this->formatLastActivity($lastActivity, auth()->id()),
                    'unread_count' => $conversation->messages()
                        ->where('user_id', '!=', auth()->id())
                        ->where('seen', false)
                        ->count() + $unseenCallCount,
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        // Search users (excluding those already in filtered conversations)
        $conversationUserIds = $conversations->pluck('other_user.id')->toArray();

        // Get blocked user IDs (users I blocked + users who blocked me)
        $blockedUserIds = auth()->user()->blockedUsers()->pluck('blocked_id')->toArray();
        $blockedByUserIds = auth()->user()->blockedByUsers()->pluck('blocker_id')->toArray();
        $allBlockedIds = array_unique(array_merge($blockedUserIds, $blockedByUserIds));

        $users = User::where('id', '!=', auth()->id())
            ->whereNotIn('id', $conversationUserIds)
            ->whereNotIn('id', $allBlockedIds)
            ->where(function ($q) use ($searchTerm) {
                $q->whereRaw('LOWER(name) LIKE ?', ['%'.$searchTerm.'%'])
                    ->orWhereRaw('LOWER(email) LIKE ?', ['%'.$searchTerm.'%']);
            })
            ->select('id', 'name', 'email')
            ->get();

        return response()->json([
            'conversations' => $conversations,
            'users' => $users,
        ]);
    }

    /**
     * Open chat with a specific user by receiver_id
     */
    public function chatWithUser($receiverId)
    {
        // Validate receiver exists
        $receiver = User::find($receiverId);
        if (! $receiver) {
            abort(404, 'User not found');
        }

        // Can't chat with yourself
        if ($receiverId == auth()->id()) {
            return redirect('/');
        }

        // Try to find existing conversation (don't create yet)
        $conversation = Conversation::where(function ($query) use ($receiverId) {
            $query->where('user1_id', auth()->id())
                ->where('user2_id', $receiverId);
        })->orWhere(function ($query) use ($receiverId) {
            $query->where('user1_id', $receiverId)
                ->where('user2_id', auth()->id());
        })->first();

        // Load messages if conversation exists
        $messages = [];
        $initialConversation = null;
        $hasMore = false;

        if ($conversation) {
            // Mark unseen missed/rejected/cancelled calls as seen for the receiver
            $unseenCalls = CallHistory::where('conversation_id', $conversation->id)
                ->where('receiver_id', auth()->id())
                ->whereIn('status', ['missed', 'rejected', 'cancelled'])
                ->where('is_seen', false)
                ->get();

            foreach ($unseenCalls as $call) {
                $call->update(['is_seen' => true]);
                // Refresh and load relationships for broadcast
                $call->refresh();
                $call->load(['caller', 'receiver', 'conversation']);
                broadcast(new \App\Events\CallHistoryUpdated($call));
            }

            // Get messages with call history merged
            $messages = $this->getMessagesWithCallHistory($conversation, 50);

            // Check if there are more messages
            $totalCount = $conversation->messages()->count() + CallHistory::where('conversation_id', $conversation->id)->count();
            $hasMore = $totalCount > 50;

            // Check if blocked
            $isBlocked = auth()->user()->hasBlocked($receiver->id);
            $isBlockedBy = auth()->user()->isBlockedBy($receiver->id);

            // Format initial conversation
            $initialConversation = [
                'id' => $conversation->id,
                'other_user' => [
                    'id' => $receiver->id,
                    'name' => $receiver->name,
                    'email' => $receiver->email,
                    'avatar' => $receiver->avatar ? asset('storage/'.$receiver->avatar) : null,
                    'last_active_at' => $receiver->last_seen_at ?? $receiver->updated_at,
                ],
                'is_blocked' => $isBlocked,
                'is_blocked_by' => $isBlockedBy,
            ];
        }

        // Load all conversations for sidebar
        $conversations = auth()->user()->conversations()
            ->with(['userOne', 'userTwo'])
            ->withCount(['messages as unread_count' => function ($query) {
                $query->where('user_id', '!=', auth()->id())
                    ->where('seen', false);
            }])
            ->get()
            ->filter(function ($conversation) {
                // Only show conversations that have at least one message or call
                return $conversation->getLastActivityFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id()
                    ? $conversation->userTwo
                    : $conversation->userOne;

                $lastActivity = $conversation->getLastActivityFor(auth()->id());

                // Get unseen call count
                $unseenCallCount = $conversation->getUnseenCallCountFor(auth()->id());

                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'avatar' => $otherUser->avatar ? asset('storage/'.$otherUser->avatar) : null,
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $this->formatLastActivity($lastActivity, auth()->id()),
                    'unread_count' => $conversation->unread_count + $unseenCallCount,
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        $authUser = auth()->user();
        $authPayload = [
            'id' => $authUser->id,
            'name' => $authUser->name,
            'email' => $authUser->email,
            'avatar' => $authUser->avatar ? asset('storage/'.$authUser->avatar) : null,
        ];

        return \Inertia\Inertia::render('Chats/Index', [
            'auth' => [
                'user' => $authPayload,
            ],
            'receiver_id' => (int) $receiverId,
            // Provide receiver details so the client can open a new chat immediately
            'initialReceiver' => $receiver ? [
                'id' => $receiver->id,
                'name' => $receiver->name,
                'email' => $receiver->email,
                'avatar' => $receiver->avatar ? asset('storage/'.$receiver->avatar) : null,
            ] : null,
            'initialConversation' => $initialConversation,
            'initialMessages' => $messages,
            'initialConversations' => $conversations,
            'hasMoreMessages' => $hasMore,
        ]);
    }

    /**
     * Helper method to format last activity (message or call) for display
     */
    private function formatLastActivity($lastActivity, $authUserId)
    {
        if (! $lastActivity) {
            return null;
        }

        // Check if it's a call history record
        if (isset($lastActivity->status)) {
            // It's a call
            $isMine = $lastActivity->caller_id === $authUserId;
            $status = $lastActivity->status;

            // Format call content based on status and who initiated
            if ($status === 'missed') {
                $content = $isMine ? '📞 Outgoing call (unanswered)' : '📞 Missed call';
            } elseif ($status === 'cancelled') {
                $content = $isMine ? '📞 Cancelled call' : '📞 Missed call';
            } elseif ($status === 'rejected') {
                $content = $isMine ? '📞 Call declined' : '📞 Declined call';
            } elseif ($status === 'answered' || $status === 'ended') {
                $duration = $lastActivity->duration ?? 0;
                $durationFormatted = gmdate('i:s', (int) $duration);
                $content = $isMine ? "📞 Outgoing call ({$durationFormatted})" : "📞 Incoming call ({$durationFormatted})";
            } else {
                $content = $isMine ? '📞 Outgoing call' : '📞 Incoming call';
            }

            return [
                'id' => 'call_'.$lastActivity->id,
                'content' => $content,
                'created_at' => $lastActivity->created_at,
                'is_mine' => $isMine,
                'is_read' => $lastActivity->is_seen ?? false,
            ];
        } else {
            // It's a regular message
            $lastMessageContent = '';
            if ($lastActivity->unsent) {
                $lastMessageContent = 'This message was deleted';
            } elseif ($lastActivity->content) {
                $lastMessageContent = $lastActivity->content;
            } elseif ($lastActivity->attachment_type === 'image') {
                $lastMessageContent = '📷 Image';
            } elseif ($lastActivity->attachment_type === 'video') {
                $lastMessageContent = '🎥 Video';
            } elseif ($lastActivity->attachment_type === 'voice') {
                $lastMessageContent = '🎤 Voice message';
            }

            return [
                'id' => $lastActivity->id,
                'content' => $lastMessageContent,
                'created_at' => $lastActivity->created_at,
                'is_mine' => $lastActivity->user_id === $authUserId,
                'is_read' => $lastActivity->is_read,
            ];
        }
    }

    /**
     * Helper method to merge messages and call history
     */
    private function getMessagesWithCallHistory($conversation, $limit = 50, $beforeMessageId = null)
    {
        $beforeTimestamp = null;

        // If beforeMessageId is provided, get its timestamp for filtering
        if ($beforeMessageId) {
            // Check if it's a call history ID (starts with "call_")
            if (is_string($beforeMessageId) && str_starts_with($beforeMessageId, 'call_')) {
                $callId = str_replace('call_', '', $beforeMessageId);
                $call = CallHistory::find($callId);
                if ($call) {
                    $beforeTimestamp = $call->created_at;
                }
            } else {
                // It's a regular message ID
                $message = $conversation->messages()->find($beforeMessageId);
                if ($message) {
                    $beforeTimestamp = $message->created_at;
                }
            }
        }

        // Get regular messages
        $messagesQuery = $conversation->messages()
            ->with(['user'])
            ->orderBy('created_at', 'desc');

        if ($beforeTimestamp) {
            $messagesQuery->where('created_at', '<', $beforeTimestamp);
        }

        $messages = $messagesQuery
            ->limit($limit)
            ->get()
            ->filter(function ($message) {
                $deletedBy = $message->deleted_by ?? [];

                return ! in_array(auth()->id(), $deletedBy);
            });

        // Get call history for this conversation
        $callHistoryQuery = CallHistory::where('conversation_id', $conversation->id)
            ->with(['caller', 'receiver'])
            ->orderBy('created_at', 'desc');

        if ($beforeTimestamp) {
            $callHistoryQuery->where('created_at', '<', $beforeTimestamp);
        }

        $callHistory = $callHistoryQuery
            ->limit($limit)
            ->get()
            ->filter(function ($call) {
                $deletedBy = $call->deleted_by ?? [];

                return ! in_array(auth()->id(), $deletedBy);
            });

        // Merge messages and call history
        $merged = collect([]);

        foreach ($messages as $message) {
            $merged->push([
                'id' => $message->id,
                'type' => 'message',
                'content' => $message->unsent ? null : $message->content,
                'sender' => [
                    'id' => $message->user->id,
                    'name' => $message->user->name,
                    'email' => $message->user->email,
                ],
                'is_mine' => $message->user_id === auth()->id(),
                'is_read' => $message->seen,
                'created_at' => $message->created_at,
                'attachment_path' => $message->unsent ? null : $message->attachment_path,
                'attachment_type' => $message->unsent ? null : $message->attachment_type,
                'attachment_url' => $message->unsent ? null : ($message->attachment_path ? asset('storage/'.$message->attachment_path) : null),
                'unsent' => $message->unsent,
            ]);
        }

        foreach ($callHistory as $call) {
            $merged->push([
                'id' => 'call_'.$call->id,
                'type' => 'call',
                'call_status' => $call->status,
                'call_type' => $call->call_type,
                'duration' => $call->duration,
                'is_mine' => $call->caller_id === auth()->id(),
                'caller' => [
                    'id' => $call->caller->id,
                    'name' => $call->caller->name,
                ],
                'receiver' => [
                    'id' => $call->receiver->id,
                    'name' => $call->receiver->name,
                ],
                'created_at' => $call->created_at,
            ]);
        }

        // Sort by created_at and reverse
        return $merged->sortByDesc('created_at')->take($limit)->reverse()->values();
    }
}
