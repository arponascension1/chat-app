<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Broadcasting auth routes
Broadcast::routes(['middleware' => ['web', 'auth']]);

// Welcome page for guests
Route::get('/welcome', function () {
    return Inertia::render('welcome');
})->middleware('guest')->name('welcome');

// Guest routes
Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);

    Route::get('/register', [RegisterController::class, 'create'])->name('register');
    Route::post('/register', [RegisterController::class, 'store']);

    // Google Authentication routes
    Route::get('/auth/google', [GoogleAuthController::class, 'redirect'])->name('auth.google');
    Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback']);
});

// Authenticated routes
Route::middleware('auth')->group(function () {
    Route::get('/', [ConversationController::class, 'home'])->name('home');

    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

    // User profile and password management
    Route::get('/profile', [UserController::class, 'edit']);
    Route::post('/profile', [UserController::class, 'update']);
    Route::post('/profile/password', [UserController::class, 'updatePassword']);
    Route::delete('/profile/avatar', [UserController::class, 'deleteAvatar']);

    // Conversation & Message routes
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::get('/conversations/{conversation}/load-more', [ConversationController::class, 'loadMore']);
    Route::get('/users', [ConversationController::class, 'users']);
    Route::get('/search', [ConversationController::class, 'search']);
    Route::post('/messages', [MessageController::class, 'store']);
    Route::post('/messages/{message}/seen', [MessageController::class, 'markAsSeen']);
    Route::delete('/messages/{message}/delete-for-me', [MessageController::class, 'deleteForMe']);
    Route::delete('/messages/{message}/unsend', [MessageController::class, 'unsend']);
    Route::delete('/conversations/{conversation}/delete', [MessageController::class, 'deleteConversation']);

    // Audio call routes
    Route::post('/calls/initiate', [CallController::class, 'initiate']);
    Route::post('/calls/answer', [CallController::class, 'answer']);
    Route::post('/calls/reject', [CallController::class, 'reject']);
    Route::post('/calls/end', [CallController::class, 'end']);
    Route::post('/calls/missed', [CallController::class, 'missed']);
    Route::post('/calls/ice-candidate', [CallController::class, 'shareCandidate']);
    Route::post('/conversations/{conversation}/calls/mark-seen', [CallController::class, 'markCallsAsSeen']);

    // Block routes
    Route::post('/users/block', [BlockController::class, 'block']);
    Route::post('/users/unblock', [BlockController::class, 'unblock']);
    Route::get('/blocked-users', [BlockController::class, 'blockedUsers']);

    // Direct chat route with receiver_id
    Route::get('/{receiver_id}', [ConversationController::class, 'chatWithUser'])->where('receiver_id', '[0-9]+');
});
