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
        Schema::table('call_history', function (Blueprint $table) {
            $table->json('deleted_by')->nullable()->after('is_seen');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('call_history', function (Blueprint $table) {
            $table->dropColumn('deleted_by');
        });
    }
};
