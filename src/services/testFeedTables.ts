import { supabase } from './supabase';

// Simple test to check if feed tables exist
export async function testFeedTables(): Promise<void> {
  console.log('🧪 Testing if feed tables exist...');
  
  try {
    // Test feed_batches table
    const { data: batches, error: batchError } = await supabase
      .from('feed_batches')
      .select('id')
      .limit(1);
    
    if (batchError) {
      console.error('❌ feed_batches table error:', batchError);
      if (batchError.code === '42P01') {
        console.error('🚨 MIGRATION NOT RUN: feed_batches table does not exist!');
        console.error('📋 Please run the migration: src/database/migrations/add_feed_tables.sql');
      }
      return;
    }
    
    console.log('✅ feed_batches table exists');
    
    // Test feed_topics table
    const { data: topics, error: topicsError } = await supabase
      .from('feed_topics')
      .select('id')
      .limit(1);
    
    if (topicsError) {
      console.error('❌ feed_topics table error:', topicsError);
      if (topicsError.code === '42P01') {
        console.error('🚨 MIGRATION NOT RUN: feed_topics table does not exist!');
        console.error('📋 Please run the migration: src/database/migrations/add_feed_tables.sql');
      }
      return;
    }
    
    console.log('✅ feed_topics table exists');
    console.log('🎉 All feed tables are ready!');
    
  } catch (error) {
    console.error('❌ Unexpected error testing tables:', error);
  }
}
