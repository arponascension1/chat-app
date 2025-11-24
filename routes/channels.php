<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Presence channel for online users list
Broadcast::channel('online', function ($user) {
    // Return the payload that will represent the user in the presence channel
    return [
        'id' => $user->id,
        'name' => $user->name,
    ];
});
