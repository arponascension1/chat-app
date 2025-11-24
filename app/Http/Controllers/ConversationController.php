<?php

namespace App\Http\Controllers;

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
                // Only show conversations that have at least one message visible to the current user
                return $conversation->getLastMessageFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id() 
                    ? $conversation->userTwo 
                    : $conversation->userOne;
                
                $lastMessage = $conversation->getLastMessageFor(auth()->id());
                
                // Format last message content
                $lastMessageContent = '';
                if ($lastMessage) {
                    if ($lastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($lastMessage->content) {
                        $lastMessageContent = $lastMessage->content;
                    } elseif ($lastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($lastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                }
                
                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        // Provide a best-effort last active timestamp for client-side "active ago" display
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $lastMessage ? [
                        'id' => $lastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $lastMessage->created_at,
                        'is_mine' => $lastMessage->user_id === auth()->id(),
                        'is_read' => $lastMessage->is_read,
                    ] : null,
                    'unread_count' => $conversation->unread_count,
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        return \Inertia\Inertia::render('Chats/Index', [
            'auth' => [
                'user' => auth()->user(),
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
                // Only show conversations that have at least one message visible to the current user
                return $conversation->getLastMessageFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->getOtherUser(auth()->id());
                $lastMessage = $conversation->getLastMessageFor(auth()->id());

                // Format last message content
                $lastMessageContent = '';
                if ($lastMessage) {
                    if ($lastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($lastMessage->content) {
                        $lastMessageContent = $lastMessage->content;
                    } elseif ($lastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($lastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                }

                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $lastMessage ? [
                        'id' => $lastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $lastMessage->created_at,
                        'is_mine' => $lastMessage->user_id === auth()->id(),
                        'is_read' => $lastMessage->is_read,
                    ] : null,
                    'unread_count' => $conversation->messages()
                        ->where('user_id', '!=', auth()->id())
                        ->where('seen', false)
                        ->count(),
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

        // Get the latest 50 messages
        $messages = $conversation->messages()
            ->with(['user'])
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->filter(function ($message) {
                // Filter out messages deleted by current user
                $deletedBy = $message->deleted_by ?? [];
                return !in_array(auth()->id(), $deletedBy);
            })
            ->reverse()
            ->values()
            ->map(function ($message) {
                return [
                    'id' => $message->id,
                    'content' => $message->unsent ? null : $message->content,
                    'sender' => [
                        'id' => $message->user->id,
                        'name' => $message->user->name,
                    ],
                    'is_mine' => $message->user_id === auth()->id(),
                    'is_read' => $message->seen,
                    'created_at' => $message->created_at,
                    'attachment_path' => $message->unsent ? null : $message->attachment_path,
                    'attachment_type' => $message->unsent ? null : $message->attachment_type,
                    'attachment_url' => $message->unsent ? null : ($message->attachment_path ? asset('storage/' . $message->attachment_path) : null),
                    'unsent' => $message->unsent,
                ];
            });

        // Check if there are more messages
        $hasMore = $conversation->messages()->count() > 50;

        // NOTE: We no longer auto-mark messages as seen when loading a conversation.
        // Seen status is managed from the client when the user scrolls to the bottom
        // to ensure messages are only marked read when actually viewed.

        $otherUser = $conversation->getOtherUser(auth()->id());

        return response()->json([
            'conversation' => [
                'id' => $conversation->id,
                'other_user' => [
                    'id' => $otherUser->id,
                    'name' => $otherUser->name,
                    'email' => $otherUser->email,
                ],
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

        $query = $conversation->messages()
            ->with(['user'])
            ->orderBy('created_at', 'desc');

        if ($beforeMessageId) {
            $beforeMessage = $conversation->messages()->find($beforeMessageId);
            if ($beforeMessage) {
                $query->where('created_at', '<', $beforeMessage->created_at);
            }
        }

        $messages = $query->limit($limit)
            ->get()
            ->filter(function ($message) {
                // Filter out messages deleted by current user
                $deletedBy = $message->deleted_by ?? [];
                return !in_array(auth()->id(), $deletedBy);
            })
            ->reverse()
            ->values()
            ->map(function ($message) {
                return [
                    'id' => $message->id,
                    'content' => $message->unsent ? null : $message->content,
                    'sender' => [
                        'id' => $message->user->id,
                        'name' => $message->user->name,
                    ],
                    'is_mine' => $message->user_id === auth()->id(),
                    'is_read' => $message->seen,
                    'created_at' => $message->created_at,
                    'attachment_path' => $message->unsent ? null : $message->attachment_path,
                    'attachment_type' => $message->unsent ? null : $message->attachment_type,
                    'attachment_url' => $message->unsent ? null : ($message->attachment_path ? asset('storage/' . $message->attachment_path) : null),
                    'unsent' => $message->unsent,
                ];
            });

        // Check if there are more messages before the oldest one we just loaded
        $hasMore = false;
        if ($messages->count() > 0) {
            $oldestLoadedMessage = $conversation->messages()->find($messages->first()['id']);
            if ($oldestLoadedMessage) {
                $hasMore = $conversation->messages()
                    ->where('created_at', '<', $oldestLoadedMessage->created_at)
                    ->exists();
            }
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
        $users = User::where('id', '!=', auth()->id())
            ->select('id', 'name', 'email')
            ->get();

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
                'users' => []
            ]);
        }

        $searchTerm = strtolower($query);

        // Search conversations
        $conversations = auth()->user()->conversations()
            ->with(['userOne', 'userTwo'])
            ->get()
            ->filter(function ($conversation) use ($searchTerm) {
                // Only show conversations that have at least one message visible to the current user
                $lastMessage = $conversation->getLastMessageFor(auth()->id());
                if ($lastMessage === null) {
                    return false;
                }
                
                $otherUser = $conversation->user1_id === auth()->id() 
                    ? $conversation->userTwo 
                    : $conversation->userOne;
                
                // Search in user name and email
                $nameMatch = str_contains(strtolower($otherUser->name), $searchTerm);
                $emailMatch = str_contains(strtolower($otherUser->email), $searchTerm);
                
                // Search in last message content
                $messageMatch = str_contains(strtolower($lastMessage->content ?? ''), $searchTerm);
                
                return $nameMatch || $emailMatch || $messageMatch;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id() 
                    ? $conversation->userTwo 
                    : $conversation->userOne;
                
                $lastMessage = $conversation->getLastMessageFor(auth()->id());
                
                // Format last message content
                $lastMessageContent = '';
                if ($lastMessage) {
                    if ($lastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($lastMessage->content) {
                        $lastMessageContent = $lastMessage->content;
                    } elseif ($lastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($lastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                }
                
                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                        'last_active_at' => $otherUser->last_seen_at ?? $otherUser->updated_at,
                    ],
                    'last_message' => $lastMessage ? [
                        'id' => $lastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $lastMessage->created_at,
                        'is_mine' => $lastMessage->user_id === auth()->id(),
                        'is_read' => $lastMessage->is_read,
                    ] : null,
                    'unread_count' => $conversation->messages()
                        ->where('user_id', '!=', auth()->id())
                        ->where('seen', false)
                        ->count(),
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        // Search users (excluding those already in filtered conversations)
        $conversationUserIds = $conversations->pluck('other_user.id')->toArray();
        
        $users = User::where('id', '!=', auth()->id())
            ->whereNotIn('id', $conversationUserIds)
            ->where(function ($q) use ($searchTerm) {
                $q->whereRaw('LOWER(name) LIKE ?', ['%' . $searchTerm . '%'])
                  ->orWhereRaw('LOWER(email) LIKE ?', ['%' . $searchTerm . '%']);
            })
            ->select('id', 'name', 'email')
            ->get();

        return response()->json([
            'conversations' => $conversations,
            'users' => $users
        ]);
    }

    /**
     * Open chat with a specific user by receiver_id
     */
    public function chatWithUser($receiverId)
    {
        // Validate receiver exists
        $receiver = User::find($receiverId);
        if (!$receiver) {
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
            // Get latest 50 messages
            $messages = $conversation->messages()
                ->with('user')
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get()
                ->filter(function ($message) {
                    // Filter out messages deleted by current user
                    $deletedBy = $message->deleted_by ?? [];
                    return !in_array(auth()->id(), $deletedBy);
                })
                ->reverse()
                ->values()
                ->map(function ($message) {
                    return [
                        'id' => $message->id,
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
                        'attachment_url' => $message->unsent ? null : ($message->attachment_path ? asset('storage/' . $message->attachment_path) : null),
                        'unsent' => $message->unsent,
                    ];
                });

            // Check if there are more messages
            $hasMore = $conversation->messages()->count() > 50;

            // Format initial conversation
            $initialConversation = [
                'id' => $conversation->id,
                'other_user' => [
                    'id' => $receiver->id,
                    'name' => $receiver->name,
                    'email' => $receiver->email,
                    'last_active_at' => $receiver->last_seen_at ?? $receiver->updated_at,
                ],
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
                // Only show conversations that have at least one message visible to the current user
                return $conversation->getLastMessageFor(auth()->id()) !== null;
            })
            ->map(function ($conversation) {
                $otherUser = $conversation->user1_id === auth()->id() 
                    ? $conversation->userTwo 
                    : $conversation->userOne;
                
                $lastMessage = $conversation->getLastMessageFor(auth()->id());
                
                // Format last message content
                $lastMessageContent = '';
                if ($lastMessage) {
                    if ($lastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($lastMessage->content) {
                        $lastMessageContent = $lastMessage->content;
                    } elseif ($lastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($lastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                }
                
                return [
                    'id' => $conversation->id,
                    'other_user' => [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ],
                    'last_message' => $lastMessage ? [
                        'id' => $lastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $lastMessage->created_at,
                        'is_mine' => $lastMessage->user_id === auth()->id(),
                        'is_read' => $lastMessage->is_read,
                    ] : null,
                    'unread_count' => $conversation->unread_count,
                    'updated_at' => $conversation->updated_at,
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        return \Inertia\Inertia::render('Chats/Index', [
            'auth' => [
                'user' => auth()->user(),
            ],
            'receiver_id' => (int) $receiverId,
            // Provide receiver details so the client can open a new chat immediately
            'initialReceiver' => $receiver ? [
                'id' => $receiver->id,
                'name' => $receiver->name,
                'email' => $receiver->email,
            ] : null,
            'initialConversation' => $initialConversation,
            'initialMessages' => $messages,
            'initialConversations' => $conversations,
            'hasMoreMessages' => $hasMore,
        ]);
    }
}
