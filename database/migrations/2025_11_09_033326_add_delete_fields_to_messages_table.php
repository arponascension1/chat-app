<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // For "delete for me" - stores user IDs who deleted this message
            $table->json('deleted_by')->nullable()->after('attachment_mime_type');
            
            // For "unsend" - when sender unsends, it's removed for everyone
            $table->boolean('unsent')->default(false)->after('deleted_by');
            $table->timestamp('unsent_at')->nullable()->after('unsent');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['deleted_by', 'unsent', 'unsent_at']);
        });
    }
};
