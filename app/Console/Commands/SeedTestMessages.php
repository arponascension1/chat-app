<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Console\Command;

class SeedTestMessages extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'messages:seed {count=100 : Number of messages to create}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Seed test messages for the current conversation';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $count = (int) $this->argument('count');
        
        // Get or create two users
        $user1 = User::first();
        $user2 = User::skip(1)->first();
        
        if (!$user1 || !$user2) {
            $this->error('Need at least 2 users in the database. Please register users first.');
            return 1;
        }
        
        // Get or create conversation between them
        $conversation = Conversation::firstOrCreate([
            'user1_id' => $user1->id,
            'user2_id' => $user2->id,
        ]);
        
        $this->info("Creating {$count} messages between {$user1->name} and {$user2->name}...");
        
        $bar = $this->output->createProgressBar($count);
        $bar->start();
        
        for ($i = 1; $i <= $count; $i++) {
            Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $i % 2 == 0 ? $user1->id : $user2->id,
                'content' => "Test message number {$i}. This is a sample message to test pagination.",
                'seen' => false,
                'created_at' => now()->subMinutes($count - $i),
                'updated_at' => now()->subMinutes($count - $i),
            ]);
            
            $bar->advance();
        }
        
        $bar->finish();
        $this->newLine();
        
        $this->info("✓ Created {$count} messages successfully!");
        $this->info("Conversation ID: {$conversation->id}");
        $this->info("User 1: {$user1->name} (ID: {$user1->id})");
        $this->info("User 2: {$user2->name} (ID: {$user2->id})");
        $this->newLine();
        $this->info("To test pagination:");
        $this->info("1. Login as {$user1->name}");
        $this->info("2. Open chat with {$user2->name}");
        $this->info("3. Scroll to the top to load older messages");
        
        return 0;
    }
}
