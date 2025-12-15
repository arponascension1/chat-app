<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CallHistory extends Model
{
    protected $table = 'call_history';

    protected $fillable = [
        'caller_id',
        'receiver_id',
        'conversation_id',
        'status',
        'call_type',
        'duration',
        'started_at',
        'ended_at',
        'is_seen',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'deleted_by' => 'array',
        ];
    }

    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
