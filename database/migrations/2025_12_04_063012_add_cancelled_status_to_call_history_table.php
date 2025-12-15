<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // SQLite doesn't support modifying enum constraints easily
        // We need to recreate the table with the new status value
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // For SQLite, we need to recreate the table with updated CHECK constraint
            Schema::table('call_history', function (Blueprint $table) {
                $table->dropColumn('status');
            });

            Schema::table('call_history', function (Blueprint $table) {
                $table->enum('status', ['initiated', 'answered', 'rejected', 'missed', 'cancelled', 'ended'])
                    ->default('initiated')
                    ->after('conversation_id');
            });
        } else {
            // For MySQL/PostgreSQL, alter the enum
            DB::statement("ALTER TABLE call_history MODIFY COLUMN status ENUM('initiated', 'answered', 'rejected', 'missed', 'cancelled', 'ended') DEFAULT 'initiated'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // We don't remove 'cancelled' status in down migration to avoid data loss
        // Existing 'cancelled' records will be preserved
    }
};
