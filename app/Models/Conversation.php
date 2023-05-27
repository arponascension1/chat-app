<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * App\Models\Conversation
 *
 * @property int $id
 * @property int $user1_id
 * @property int $user2_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Message> $messages
 * @property-read int|null $messages_count
 * @property-read \App\Models\User $user1
 * @property-read \App\Models\User $user2
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation query()
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation whereUser1Id($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Conversation whereUser2Id($value)
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Message>
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Message>
 * @mixin \Eloquent
 */
class Conversation extends Model
{
    use HasFactory;


    public function user1(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'user1_id');
    }

    public function user2(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'user2_id');
    }

    public function messages(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function unseenCount()
    {
        return $this->messages()->where('user_id', '!=', auth()->user()->id)->where('seen', false)->count();
    }
}
