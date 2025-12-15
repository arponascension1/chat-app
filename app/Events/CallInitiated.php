<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallInitiated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callerId;

    public $receiverId;

    public $callerName;

    public $callType;

    public $offer;

    public $callId;

    /**
     * Create a new event instance.
     */
    public function __construct($callerId, $receiverId, $callerName, $callType = 'audio', $offer = null, $callId = null)
    {
        $this->callerId = $callerId;
        $this->receiverId = $receiverId;
        $this->callerName = $callerName;
        $this->callType = $callType;
        $this->offer = $offer;
        $this->callId = $callId;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->receiverId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'call.initiated';
    }
}
