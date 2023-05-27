@extends('layouts.app')

@section('content')
<div class="container">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">Chat List</div>
                <div>conversations available {{count($conversations)}}</div>
                <hr>
                 @foreach ($conversations as $conversation)
                    <div>
                        @if($conversation->user1->id == auth()->user()->id)
                            <a href="/chat/{{$conversation->user2->id}}">{{ $conversation->user2->name }}</a>
                        @else
                            <a href="/chat/{{$conversation->user1->id}}">{{ $conversation->user1->name }}</a>
                        @endif
                        @if($conversation->unseenCount() > 0)
                            ({{ $conversation->unseenCount() }})
                        @endif
                        <p>
                            @if($conversation->messages->last()->user->id ==  auth()->user()->id)
                                You:
                            @endif
                            {{ \Illuminate\Support\Str::limit($conversation->messages->last()->content, 20, $end='...') }}

                            {{ $conversation->updated_at->diffForHumans() }}
                    </div>
                    <hr>
                @endforeach

            </div>
        </div>
    </div>
</div>
@endsection
