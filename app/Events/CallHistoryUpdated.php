<?php

namespace App\Events;

use App\Models\CallHistory;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallHistoryUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callHistory;

    public $callerId;

    public $receiverId;

    /**
     * Create a new event instance.
     */
    public function __construct(CallHistory $callHistory)
    {
        $this->callHistory = [
            'id' => 'call_'.$callHistory->id,
            'type' => 'call',
            'call_status' => $callHistory->status,
            'call_type' => 'audio',
            'duration' => $callHistory->duration,
            'created_at' => $callHistory->created_at->toISOString(),
            'conversation_id' => $callHistory->conversation_id,
            'is_seen' => $callHistory->is_seen,
            'caller' => [
                'id' => $callHistory->caller->id,
                'name' => $callHistory->caller->name,
                'avatar' => $callHistory->caller->avatar,
            ],
            'receiver' => [
                'id' => $callHistory->receiver->id,
                'name' => $callHistory->receiver->name,
                'avatar' => $callHistory->receiver->avatar,
            ],
            'is_mine' => false, // Will be determined on frontend based on auth user
        ];

        $this->callerId = $callHistory->caller_id;
        $this->receiverId = $callHistory->receiver_id;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->callerId),
            new PrivateChannel('user.'.$this->receiverId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'call.history.updated';
    }
}
