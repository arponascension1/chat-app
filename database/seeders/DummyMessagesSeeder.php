<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Conversation;
use App\Models\Message;
use Carbon\Carbon;

class DummyMessagesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get users with ID 2 and 3
        $user2 = User::find(2);
        $user3 = User::find(3);

        if (!$user2 || !$user3) {
            $this->command->error('Users with ID 2 and 3 must exist!');
            return;
        }

        // Find or create conversation between user 2 and 3
        $conversation = Conversation::where(function ($query) use ($user2, $user3) {
            $query->where('user1_id', $user2->id)
                  ->where('user2_id', $user3->id);
        })->orWhere(function ($query) use ($user2, $user3) {
            $query->where('user1_id', $user3->id)
                  ->where('user2_id', $user2->id);
        })->first();

        if (!$conversation) {
            $conversation = Conversation::create([
                'user1_id' => $user2->id,
                'user2_id' => $user3->id,
            ]);
        }

        // Sample messages to make conversation realistic
        $messages = [
            "Hey! How are you doing?",
            "I'm doing great, thanks! How about you?",
            "Pretty good! Just finished a project at work.",
            "That's awesome! What kind of project was it?",
            "A web application using Laravel and React.",
            "Nice! I've been working with Laravel too recently.",
            "It's such a powerful framework, isn't it?",
            "Absolutely! The Eloquent ORM is amazing.",
            "Have you tried using Inertia.js?",
            "Yes! It makes building SPAs so much easier.",
            "I agree. No need for separate API endpoints.",
            "Exactly! It's like the best of both worlds.",
            "What other technologies do you work with?",
            "Mainly TypeScript, Vue, and sometimes Node.js",
            "TypeScript is great for catching errors early.",
            "Yeah, it really improves code quality.",
            "Do you prefer Vue or React?",
            "I like both, but I lean towards React lately.",
            "React's hooks are really powerful.",
            "Definitely! They make state management cleaner.",
            "Have you tried using Redux?",
            "I have, but I prefer React Context API for smaller apps.",
            "That makes sense. Redux can be overkill sometimes.",
            "What about testing? Do you write tests?",
            "Yes, I use PHPUnit for backend and Jest for frontend.",
            "Testing is so important but often overlooked.",
            "I know, right? It saves so much time in the long run.",
            "Do you do TDD?",
            "Sometimes, but not always. It depends on the project.",
            "Fair enough. TDD can slow you down initially.",
            "But the benefits are worth it for complex features.",
            "Agreed! It forces you to think about edge cases.",
            "What's your favorite code editor?",
            "VS Code all the way! You?",
            "Same here. The extensions are incredible.",
            "Have you tried GitHub Copilot?",
            "Yes! It's like having a coding assistant.",
            "It really speeds up development.",
            "Though sometimes it suggests weird stuff 😄",
            "Haha true! You still need to review everything.",
            "What are you working on now?",
            "Building a real-time chat application!",
            "That sounds exciting! Using WebSockets?",
            "Yes, with Laravel Reverb and Pusher.",
            "Real-time features are always fun to build.",
            "They are! Though debugging can be tricky.",
            "Yeah, WebSocket debugging is a different beast.",
            "But when it works, it's so satisfying!",
            "I bet! Let me know when you launch it.",
            "Will do! Want to grab coffee sometime?",
            "Sure! How about this weekend?",
            "Saturday works for me. 3 PM?",
            "Perfect! See you then 👍",
            "Looking forward to it!",
            "Same here. Have a great day!",
            "You too! Talk soon 😊",
        ];

        $this->command->info('Creating 50+ dummy messages between User 2 and User 3...');

        // Create messages with alternating senders
        $baseTime = Carbon::now()->subDays(2);
        
        foreach ($messages as $index => $content) {
            // Alternate between user 2 and user 3
            $senderId = ($index % 2 === 0) ? $user2->id : $user3->id;

            Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $senderId,
                'content' => $content,
                'seen' => false,
                'created_at' => $baseTime->copy()->addMinutes($index * 5),
                'updated_at' => $baseTime->copy()->addMinutes($index * 5),
            ]);
        }

        $this->command->info("Successfully created " . count($messages) . " messages!");
        $this->command->info("Conversation ID: {$conversation->id}");
    }
}
