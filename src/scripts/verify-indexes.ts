// Run this in Supabase Dashboard > SQL Editor to verify indexes:
/*
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'media'
AND indexname LIKE 'idx_media_%';
*/

// Expected indexes:
// idx_media_event_taken_at  -- event_id, taken_at DESC WHERE is_approved = true
// idx_media_event_guest     -- event_id, guest_id
// idx_media_event_approved  -- event_id, is_approved WHERE is_approved = false

console.log('Manual verification required.');
console.log('Go to Supabase Dashboard > SQL Editor and run:');
console.log('');
console.log("SELECT indexname, indexdef");
console.log("FROM pg_indexes");
console.log("WHERE tablename = 'media'");
console.log("AND indexname LIKE 'idx_media_%';");
console.log('');
console.log('Expected: idx_media_event_taken_at, idx_media_event_guest, idx_media_event_approved');