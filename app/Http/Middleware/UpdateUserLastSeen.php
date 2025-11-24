<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UpdateUserLastSeen
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        try {
            $user = $request->user();
            if ($user) {
                // Only update if more than 30 seconds passed to reduce write load
                $last = $user->last_seen_at ? strtotime($user->last_seen_at) : 0;
                if (time() - $last > 30) {
                    $user->last_seen_at = now();
                    $user->save();
                }
            }
        } catch (\Throwable $e) {
            // Ignore errors here - next middleware will handle auth issues
        }

        return $next($request);
    }
}
