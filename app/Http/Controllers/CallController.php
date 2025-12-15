<?php

namespace App\Http\Controllers;

use App\Events\CallAnswered;
use App\Events\CallEnded;
use App\Events\CallHistoryUpdated;
use App\Events\CallInitiated;
use App\Events\CallRejected;
use App\Events\ICECandidateShared;
use App\Models\CallHistory;
use App\Models\Conversation;
use Illuminate\Http\Request;

class CallController extends Controller
{
    /**
     * Initiate a call to another user
     */
    public function initiate(Request $request)
    {
        $validated = $request->validate([
            'receiver_id' => ['required', 'integer', 'exists:users,id'],
            'offer' => ['required', 'array'],
        ]);

        // Check if blocked or blocked by receiver
        $isBlocked = auth()->user()->hasBlocked($validated['receiver_id']);
        $isBlockedBy = auth()->user()->isBlockedBy($validated['receiver_id']);

        if ($isBlocked || $isBlockedBy) {
            return response()->json(['error' => 'Cannot call this user'], 403);
        }

        // Get or create conversation
        $conversation = Conversation::where(function ($query) use ($validated) {
            $query->where('user1_id', auth()->id())
                ->where('user2_id', $validated['receiver_id']);
        })->orWhere(function ($query) use ($validated) {
            $query->where('user1_id', $validated['receiver_id'])
                ->where('user2_id', auth()->id());
        })->first();

        if (! $conversation) {
            $conversation = Conversation::create([
                'user1_id' => auth()->id(),
                'user2_id' => $validated['receiver_id'],
            ]);
        }

        // Create call history record
        $callHistory = CallHistory::create([
            'caller_id' => auth()->id(),
            'receiver_id' => $validated['receiver_id'],
            'conversation_id' => $conversation->id,
            'status' => 'initiated',
            'call_type' => 'audio',
            'started_at' => now(),
        ]);

        // Update conversation timestamp to move it to top of list
        $conversation->touch();

        broadcast(new CallInitiated(
            auth()->id(),
            $validated['receiver_id'],
            auth()->user()->name,
            'audio',
            $validated['offer'],
            $callHistory->id
        ))->toOthers();

        return response()->json([
            'status' => 'call initiated',
            'call_id' => $callHistory->id,
        ]);
    }

    /**
     * Answer an incoming call
     */
    public function answer(Request $request)
    {
        $validated = $request->validate([
            'caller_id' => ['required', 'integer', 'exists:users,id'],
            'answer' => ['required', 'array'],
            'call_id' => ['nullable', 'integer', 'exists:call_history,id'],
        ]);

        // Update call history status
        if (isset($validated['call_id'])) {
            $callHistory = CallHistory::with(['caller', 'receiver', 'conversation'])->find($validated['call_id']);
            if ($callHistory) {
                $callHistory->update([
                    'status' => 'answered',
                    'is_seen' => true, // Mark as seen when answered
                ]);

                // Refresh to get updated data
                $callHistory->refresh();
                $callHistory->load(['caller', 'receiver', 'conversation']);

                // Update conversation timestamp to move it to top of list
                $callHistory->conversation->touch();

                broadcast(new CallHistoryUpdated($callHistory));
            }
        }

        broadcast(new CallAnswered(
            $validated['caller_id'],
            auth()->id(),
            $validated['answer']
        ))->toOthers();

        return response()->json(['status' => 'call answered']);
    }

    /**
     * Reject an incoming call
     */
    public function reject(Request $request)
    {
        $validated = $request->validate([
            'caller_id' => ['required', 'integer', 'exists:users,id'],
            'call_id' => ['nullable', 'integer', 'exists:call_history,id'],
        ]);

        // Update call history status
        if (isset($validated['call_id'])) {
            $callHistory = CallHistory::with(['caller', 'receiver', 'conversation'])->find($validated['call_id']);
            if ($callHistory) {
                $callHistory->update([
                    'status' => 'rejected',
                    'ended_at' => now(),
                ]);

                // Refresh to get latest data including is_seen
                $callHistory->refresh();
                $callHistory->load(['caller', 'receiver', 'conversation']);

                // Update conversation timestamp to move it to top of list
                $callHistory->conversation->touch();

                broadcast(new CallHistoryUpdated($callHistory));
            }
        }

        broadcast(new CallRejected(
            $validated['caller_id'],
            auth()->id()
        ))->toOthers();

        return response()->json(['status' => 'call rejected']);
    }

    /**
     * End an ongoing call
     */
    public function end(Request $request)
    {
        $validated = $request->validate([
            'receiver_id' => ['required', 'integer', 'exists:users,id'],
            'call_id' => ['nullable', 'integer', 'exists:call_history,id'],
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);

        // Update call history status
        if (isset($validated['call_id'])) {
            $callHistory = CallHistory::with(['caller', 'receiver', 'conversation'])->find($validated['call_id']);
            if ($callHistory) {
                $endedAt = now();
                $duration = $validated['duration'] ?? ($callHistory->started_at ? $callHistory->started_at->diffInSeconds($endedAt) : 0);

                // Determine if call was answered or cancelled
                $wasAnswered = $callHistory->status === 'answered';
                $isCaller = $callHistory->caller_id === auth()->id();

                // If caller ends before receiver answers, mark as cancelled/missed
                $finalStatus = $wasAnswered ? 'ended' : ($isCaller ? 'cancelled' : 'missed');

                // Only mark as seen if call was actually answered and completed
                $isSeen = $wasAnswered ? true : $callHistory->is_seen;

                $callHistory->update([
                    'status' => $finalStatus,
                    'ended_at' => $endedAt,
                    'duration' => $duration,
                    'is_seen' => $isSeen,
                ]);

                // Refresh to get updated data
                $callHistory->refresh();
                $callHistory->load(['caller', 'receiver', 'conversation']);

                // Update conversation timestamp to move it to top of list
                $callHistory->conversation->touch();

                broadcast(new CallHistoryUpdated($callHistory));
            }
        }

        broadcast(new CallEnded(
            auth()->id(),
            $validated['receiver_id']
        ));

        return response()->json(['status' => 'call ended']);
    }

    /**
     * Share ICE candidate for WebRTC connection
     */
    public function shareCandidate(Request $request)
    {
        $validated = $request->validate([
            'receiver_id' => ['required', 'integer', 'exists:users,id'],
            'candidate' => ['required', 'array'],
        ]);

        broadcast(new ICECandidateShared(
            auth()->id(),
            $validated['receiver_id'],
            $validated['candidate']
        ))->toOthers();

        return response()->json(['status' => 'candidate shared']);
    }

    /**
     * Mark a call as missed (when receiver doesn't answer in time)
     */
    public function missed(Request $request)
    {
        $validated = $request->validate([
            'call_id' => ['required', 'integer', 'exists:call_history,id'],
        ]);

        $callHistory = CallHistory::with(['caller', 'receiver', 'conversation'])->find($validated['call_id']);
        if ($callHistory && $callHistory->receiver_id === auth()->id()) {
            $callHistory->update([
                'status' => 'missed',
                'ended_at' => now(),
            ]);

            // Refresh to get latest data including is_seen
            $callHistory->refresh();
            $callHistory->load(['caller', 'receiver', 'conversation']);

            // Update conversation timestamp to move it to top of list
            $callHistory->conversation->touch();

            broadcast(new CallHistoryUpdated($callHistory));
        }

        return response()->json(['status' => 'call marked as missed']);
    }

    /**
     * Mark all unseen calls in a conversation as seen
     */
    public function markCallsAsSeen(\App\Models\Conversation $conversation)
    {
        // Check if user is part of this conversation
        if ($conversation->user1_id !== auth()->id() && $conversation->user2_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Mark unseen missed/rejected/cancelled calls as seen for the receiver
        $unseenCalls = CallHistory::where('conversation_id', $conversation->id)
            ->where('receiver_id', auth()->id())
            ->whereIn('status', ['missed', 'rejected', 'cancelled'])
            ->where('is_seen', false)
            ->get();

        foreach ($unseenCalls as $call) {
            $call->update(['is_seen' => true]);
            // Refresh and load relationships for broadcast
            $call->refresh();
            $call->load(['caller', 'receiver', 'conversation']);
            broadcast(new CallHistoryUpdated($call));
        }

        return response()->json([
            'success' => true,
            'marked_count' => $unseenCalls->count(),
        ]);
    }
}
