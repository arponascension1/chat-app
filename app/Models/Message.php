<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'user_id',
        'content',
        'seen',
        'attachment_path',
        'attachment_type',
        'attachment_mime_type',
        'deleted_by',
        'unsent',
        'unsent_at',
    ];

    protected $casts = [
        'seen' => 'boolean',
        'deleted_by' => 'array',
        'unsent' => 'boolean',
        'unsent_at' => 'datetime',
    ];

    protected $appends = ['is_read'];

    /**
     * Get the is_read attribute (alias for seen)
     */
    public function getIsReadAttribute(): bool
    {
        return $this->seen;
    }

    /**
     * Get the conversation this message belongs to
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who sent the message
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Mark message as seen
     */
    public function markAsSeen(): void
    {
        if (!$this->seen) {
            $this->update([
                'seen' => true,
            ]);
        }
    }
}