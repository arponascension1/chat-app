@extends('layouts.app')

@section('content')
<div class="container">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">{{$userInfo->name}}</div>
                @if(!$messages)
                    <p>no message</p>
                @else
                    @if($paginator->nextPageUrl())
                        <a href="{{$paginator->nextPageUrl()}}">See Older Messages</a>
                    @endif
                    @foreach ($messages as $message)
                        <small>{{$message->user->name}} : {{$message->content}}</small>
                        {{ $message->created_at->format('F j, Y, g:i a') }}
                        <hr>
                    @endforeach
                    @if($paginator->previousPageUrl())
                            <a href="{{$paginator->previousPageUrl()}}">See newer messages</a>
                    @endif
                @endif
                <form method="POST" action="/chat/{{$userInfo->id}}">
                    @csrf
                    <textarea name="content"></textarea>
                    <button type="submit">Submit</button>
                </form>
                @if($messages)
                <form action="/conversations/{{$userInfo->id}}" method="POST">
                    @csrf
                    @method('DELETE')
                    <button type="submit">Delete</button>
                </form>
                @endif
            </div>
        </div>
    </div>
</div>
@endsection
