<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /**
     * Send a new message
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'receiver_id' => ['required', 'exists:users,id'],
            'content' => ['nullable', 'string', 'max:10000'],
            'attachment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,gif,mp4,mov,avi,webm', 'max:51200'], // 50MB max
        ]);

        $senderId = auth()->id();
        $receiverId = $validated['receiver_id'];

        // Find or create conversation
        $conversation = Conversation::findOrCreateBetween($senderId, $receiverId);

        // Handle file upload
        $attachmentPath = null;
        $attachmentType = null;
        $attachmentMimeType = null;

        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $mimeType = $file->getMimeType();
            
            // Determine attachment type
            if (str_starts_with($mimeType, 'image/')) {
                $attachmentType = 'image';
            } elseif (str_starts_with($mimeType, 'video/')) {
                $attachmentType = 'video';
            }

            // Store file in public disk
            $attachmentPath = $file->store('attachments/' . $conversation->id, 'public');
            $attachmentMimeType = $mimeType;
        }

        // Create message
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'user_id' => $senderId,
            'content' => $validated['content'] ?? '',
            'attachment_path' => $attachmentPath,
            'attachment_type' => $attachmentType,
            'attachment_mime_type' => $attachmentMimeType,
        ]);

        // Update conversation timestamp to bring it to top
        $conversation->touch();

        // Load relationships for broadcasting
        $message->load(['user', 'conversation']);

        // Broadcast message event (wrapped in try-catch to not block message sending)
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Exception $e) {
            \Log::warning('Broadcasting failed but message was saved', [
                'error' => $e->getMessage()
            ]);
        }

        return response()->json([
            'message' => [
                'id' => $message->id,
                'content' => $message->content,
                'created_at' => $message->created_at,
                'attachment_path' => $message->attachment_path,
                'attachment_type' => $message->attachment_type,
                'attachment_url' => $message->attachment_path ? asset('storage/' . $message->attachment_path) : null,
            ],
            'conversation' => $conversation,
        ]);
    }

    /**
     * Mark message as seen
     */
    public function markAsSeen(Message $message)
    {
        // Only mark as seen if the current user is the receiver (not the sender)
        if ($message->user_id !== auth()->id()) {
            $message->markAsSeen();
            
            // Broadcast to sender that message was seen
            broadcast(new \App\Events\MessageSeen($message));
        }

        return response()->json(['success' => true]);
    }

    /**
     * Delete message for me (soft delete)
     */
    public function deleteForMe(Message $message)
    {
        $deletedBy = $message->deleted_by ?? [];
        
        if (!in_array(auth()->id(), $deletedBy)) {
            // Get the conversation and the current last visible message BEFORE deleting
            $conversation = $message->conversation;
            $oldLastMessage = $conversation->getLastMessageFor(auth()->id());
            
            // Mark message as deleted for current user
            $deletedBy[] = auth()->id();
            $message->update(['deleted_by' => $deletedBy]);
            
            // Check if the deleted message was the last visible message for this user
            $wasLastVisibleMessage = $oldLastMessage && $oldLastMessage->id === $message->id;
            
            // If this was the last visible message, broadcast the update
            if ($wasLastVisibleMessage) {
                $newLastMessage = $conversation->getLastMessageFor(auth()->id());
                $formattedLastMessage = null;
                
                if ($newLastMessage) {
                    $lastMessageContent = '';
                    if ($newLastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($newLastMessage->content) {
                        $lastMessageContent = $newLastMessage->content;
                    } elseif ($newLastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($newLastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                    
                    $formattedLastMessage = [
                        'id' => $newLastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $newLastMessage->created_at,
                        'is_mine' => $newLastMessage->user_id === auth()->id(),
                        'is_read' => $newLastMessage->seen,
                    ];
                }

                // If we have a new last message, update the conversation's updated_at
                // to reflect the timestamp of that message so conversation ordering
                // will follow the previous message's time.
                if ($newLastMessage) {
                    $conversation->updated_at = $newLastMessage->created_at;
                    $conversation->save();
                }

                // Broadcast the deletion event with the new last message (or null if no messages left)
                broadcast(new \App\Events\MessageDeleted(
                    $message->id,
                    $conversation->id,
                    auth()->id(),
                    $formattedLastMessage
                ));
            }
            
            // If both users have deleted the message, permanently delete it from database
            $bothUsers = [$conversation->user1_id, $conversation->user2_id];
            
            if (count(array_intersect($bothUsers, $deletedBy)) === 2) {
                $message->delete();
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Unsend message (delete for everyone)
     */
    public function unsend(Message $message)
    {
        // Only the sender can unsend their own message
        if ($message->user_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Load the conversation relationship
        $message->load('conversation');
        $conversation = $message->conversation;
        
        // Check if this is the last message in the conversation
        $isLastMessage = $conversation->lastMessage?->id === $message->id;
        
        // Mark message as unsent
        $message->update([
            'unsent' => true,
            'unsent_at' => now(),
        ]);

        // If this was the last message, update conversation's updated_at to trigger reordering
        if ($isLastMessage) {
            $conversation->touch();
        }

        // Broadcast unsend event to both users
        broadcast(new \App\Events\MessageUnsent($message));

        // If this was the last message, broadcast updated last message to both users
        if ($isLastMessage) {
            // Broadcast to both users with their respective last messages
            foreach ([$conversation->user1_id, $conversation->user2_id] as $userId) {
                $lastMessage = $conversation->getLastMessageFor($userId);
                $newLastMessage = null;
                
                if ($lastMessage) {
                    $lastMessageContent = '';
                    if ($lastMessage->unsent) {
                        $lastMessageContent = 'This message was deleted';
                    } elseif ($lastMessage->content) {
                        $lastMessageContent = $lastMessage->content;
                    } elseif ($lastMessage->attachment_type === 'image') {
                        $lastMessageContent = '📷 Image';
                    } elseif ($lastMessage->attachment_type === 'video') {
                        $lastMessageContent = '🎥 Video';
                    }
                    
                    $newLastMessage = [
                        'id' => $lastMessage->id,
                        'content' => $lastMessageContent,
                        'created_at' => $lastMessage->created_at,
                        'is_mine' => $lastMessage->user_id === $userId,
                        'is_read' => $lastMessage->seen,
                    ];
                }
                
                broadcast(new \App\Events\MessageDeleted(
                    $message->id,
                    $conversation->id,
                    $userId,
                    $newLastMessage
                ));
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Delete conversation for me
     */
    public function deleteConversation(Conversation $conversation)
    {
        // Check if user is part of this conversation
        if ($conversation->user1_id !== auth()->id() && $conversation->user2_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $bothUsers = [$conversation->user1_id, $conversation->user2_id];
        
        // Mark all messages as deleted for this user and check if both deleted
        $conversation->messages()->each(function ($message) use ($bothUsers) {
            $deletedBy = $message->deleted_by ?? [];
            if (!in_array(auth()->id(), $deletedBy)) {
                $deletedBy[] = auth()->id();
                $message->update(['deleted_by' => $deletedBy]);
                
                // If both users have deleted this message, permanently delete it
                if (count(array_intersect($bothUsers, $deletedBy)) === 2) {
                    $message->delete();
                }
            }
        });

        // Broadcast conversation deletion to current user
        broadcast(new \App\Events\ConversationDeleted($conversation->id, auth()->id()));

        return response()->json([
            'success' => true,
            'conversation_id' => $conversation->id
        ]);
    }
}
