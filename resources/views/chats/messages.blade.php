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
                        <a href="{{$paginator->nextPageUrl()}}">Previous Messages</a>
                    @endif

                    @foreach ($messages as $message)
                        <small>{{$message->user->name}} : {{$message->content}}</small>
                        {{ $message->created_at->diffForHumans() }}
                        <hr>
                    @endforeach
                        @if($paginator->previousPageUrl())
                            <a href="{{$paginator->previousPageUrl()}}">Next Messages</a>
                        @endif
                @endif
                <form method="POST" action="/chat/{{$userInfo->id}}">
                    @csrf
                    <textarea name="content"></textarea>
                    <button type="submit">Submit</button>
                </form>

            </div>
        </div>
    </div>
</div>
@endsection
