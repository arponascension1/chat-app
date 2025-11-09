<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * The name of the queue connection to use when broadcasting the event.
     */
    public $connection = 'sync';

    public $message;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message)
    {
        $this->message = $message;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Get the other user in the conversation
        $conversation = $this->message->conversation;
        $receiverId = $conversation->user1_id === $this->message->user_id 
            ? $conversation->user2_id 
            : $conversation->user1_id;

        return [
            new PrivateChannel('user.' . $receiverId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'content' => $this->message->content,
            'sender' => [
                'id' => $this->message->user->id,
                'name' => $this->message->user->name,
            ],
            'created_at' => $this->message->created_at,
            'attachment_path' => $this->message->attachment_path,
            'attachment_type' => $this->message->attachment_type,
            'attachment_url' => $this->message->attachment_path ? asset('storage/' . $this->message->attachment_path) : null,
        ];
    }
}
