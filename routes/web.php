<?php

use App\Http\Controllers\ConversationsController;
use App\Http\Controllers\MessagesController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

Auth::routes();

Route::get('/home', [App\Http\Controllers\HomeController::class, 'index'])->name('home');

Route::group(['middleware' => 'auth'], function (){
    Route::get('/conversations', [ConversationsController::class, 'getIndex']);
    Route::delete('/conversations/{user}', [ConversationsController::class, 'delete']);
    Route::get('/chat/{user}', [MessagesController::class, 'showMessages']);
    Route::post('/chat/{user}', [MessagesController::class, 'sentMessage']);
});
