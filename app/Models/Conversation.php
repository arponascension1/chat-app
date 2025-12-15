<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'user1_id',
        'user2_id',
    ];

    /**
     * Get the first user in the conversation
     */
    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user1_id');
    }

    /**
     * Get the second user in the conversation
     */
    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user2_id');
    }

    /**
     * Get all messages in this conversation
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * Get the last message in this conversation
     */
    public function lastMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Get the other user in conversation
     */
    public function getOtherUser(int $userId): ?User
    {
        if ($this->user1_id === $userId) {
            return $this->userTwo;
        }

        return $this->userOne;
    }

    /**
     * Get the last message that's not deleted by the specified user
     */
    public function getLastMessageFor(int $userId): ?Message
    {
        return $this->messages()
            ->where(function ($query) use ($userId) {
                $query->whereJsonDoesntContain('deleted_by', $userId)
                    ->orWhereNull('deleted_by');
            })
            ->latest()
            ->first();
    }

    /**
     * Get the last activity (message or call) for display in conversation list
     */
    public function getLastActivityFor(int $userId)
    {
        $lastMessage = $this->getLastMessageFor($userId);
        $lastCall = CallHistory::where('conversation_id', $this->id)
            ->where(function ($query) use ($userId) {
                $query->whereJsonDoesntContain('deleted_by', $userId)
                    ->orWhereNull('deleted_by');
            })
            ->latest()
            ->first();

        // Compare timestamps and return the most recent
        if (! $lastMessage && ! $lastCall) {
            return null;
        }

        if (! $lastMessage) {
            return $lastCall;
        }

        if (! $lastCall) {
            return $lastMessage;
        }

        return $lastMessage->created_at > $lastCall->created_at ? $lastMessage : $lastCall;
    }

    /**
     * Get unseen call count for a user (missed, rejected, and cancelled calls not seen by receiver)
     */
    public function getUnseenCallCountFor(int $userId): int
    {
        return CallHistory::where('conversation_id', $this->id)
            ->where('receiver_id', $userId)
            ->whereIn('status', ['missed', 'rejected', 'cancelled'])
            ->where('is_seen', false)
            ->count();
    }

    /**
     * Find or create conversation between two users
     */
    public static function findOrCreateBetween(int $userId1, int $userId2): self
    {
        // Ensure user1_id is always the smaller ID for consistency
        $userOneId = min($userId1, $userId2);
        $userTwoId = max($userId1, $userId2);

        return self::firstOrCreate([
            'user1_id' => $userOneId,
            'user2_id' => $userTwoId,
        ]);
    }
}
