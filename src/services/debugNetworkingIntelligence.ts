import { supabase } from './supabase';

/**
 * Debug helper to see what data is actually being retrieved for a target user
 * Call this with a matched user's ID to see what the intelligence feature has access to
 */
export const debugUserContext = async (currentUserId: string, targetUserId: string) => {
  console.log('\n========================================');
  console.log('🔍 DEBUG: Networking Intelligence Data');
  console.log('========================================\n');
  
  console.log('Current User ID:', currentUserId);
  console.log('Target User ID:', targetUserId);
  
  // 1. Check if there's a match
  const { data: match, error: matchError } = await supabase
    .from('user_matches')
    .select('*')
    .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`)
    .or(`user_id_1.eq.${targetUserId},user_id_2.eq.${targetUserId}`)
    .maybeSingle();
  
  console.log('\n1️⃣ MATCH CHECK:');
  if (matchError) {
    console.log('❌ Error:', matchError);
  } else if (match) {
    console.log('✅ Match found:', match.id);
    console.log('   Status:', match.status);
  } else {
    console.log('❌ No match found between these users');
  }
  
  // 2. Check target user's profile (via direct query)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', targetUserId)
    .maybeSingle();
  
  console.log('\n2️⃣ PROFILE CHECK (Direct Query):');
  if (profileError) {
    console.log('❌ Error:', profileError);
    console.log('   Error Code:', profileError.code);
    console.log('   Error Message:', profileError.message);
    console.log('   Error Details:', JSON.stringify(profileError.details));
  } else if (profile) {
    console.log('✅ Profile found:');
    console.log('   Name:', profile.full_name || 'Not set');
    console.log('   Email:', profile.email);
  } else {
    console.log('❌ No profile found');
    console.log('   This could mean:');
    console.log('   - Profile does not exist in database for this user ID');
    console.log('   - RLS policy is blocking access');
  }

  // 2b. Try using the RPC function (should bypass some RLS)
  console.log('\n2️⃣b PROFILE CHECK (Via RPC):');
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_matched_user_profile', { 
      target_user_id: targetUserId 
    });
    if (rpcError) {
      console.log('❌ RPC Error:', rpcError);
      console.log('   This means the RPC function may not exist or has issues');
    } else {
      const p = Array.isArray(rpcData) ? rpcData?.[0] : rpcData;
      if (p && (p.full_name || p.email)) {
        console.log('✅ Profile found via RPC:');
        console.log('   Name:', p.full_name || 'Not set');
        console.log('   Email:', p.email);
      } else {
        console.log('⚠️ RPC returned empty/null data');
      }
    }
  } catch (e) {
    console.log('❌ RPC Exception:', e);
  }
  
  // 3. Check interests
  const { data: interests, error: interestsError } = await supabase
    .from('user_interests')
    .select('interest')
    .eq('user_id', targetUserId);
  
  console.log('\n3️⃣ INTERESTS CHECK:');
  if (interestsError) {
    console.log('❌ Error:', interestsError);
  } else if (interests && interests.length > 0) {
    console.log('✅ Interests found:', interests.length);
    console.log('   List:', interests.map(i => i.interest).join(', '));
  } else {
    console.log('⚠️ No interests found for this user');
  }
  
  // 4. Check conversation pattern
  const { data: pattern, error: patternError } = await supabase
    .from('user_conversation_patterns')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle();
  
  console.log('\n4️⃣ CONVERSATION PATTERN CHECK:');
  if (patternError) {
    console.log('❌ Error:', patternError);
  } else if (pattern) {
    console.log('✅ Pattern found:');
    console.log('   Style:', pattern.communication_style || 'Not analyzed');
    console.log('   Curiosity:', pattern.curiosity_level);
    console.log('   Depth:', pattern.topic_depth);
    console.log('   Interests:', pattern.interests?.length || 0);
  } else {
    console.log('⚠️ No conversation pattern found for this user');
  }
  
  // 5. Check messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      created_at,
      role,
      chats!inner(user_id, title)
    `)
    .eq('chats.user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n5️⃣ MESSAGES CHECK:');
  if (messagesError) {
    console.log('❌ Error:', messagesError);
    console.log('   Error Code:', messagesError.code);
    console.log('   Error Message:', messagesError.message);
    console.log('   Error Details:', JSON.stringify(messagesError.details));
    console.log('   Hint: Check if messages table RLS policy allows matched users to read');
  } else if (messages && messages.length > 0) {
    console.log('✅ Messages found:', messages.length);
    console.log('\n   Recent messages:');
    messages.slice(0, 3).forEach((msg, idx) => {
      console.log(`   ${idx + 1}. [${msg.role || 'unknown'}] ${msg.content.substring(0, 100)}...`);
    });
  } else {
    console.log('⚠️ No messages found for this user');
    console.log('   This could mean:');
    console.log('   - No messages exist in database for this user');
    console.log('   - RLS policy is blocking access to messages');
    console.log('   - User has not created any chats yet');
  }
  
  console.log('\n========================================');
  console.log('✅ Debug Complete');
  console.log('========================================\n');
  
  return {
    hasMatch: !!match,
    hasProfile: !!profile,
    profileName: profile?.full_name || profile?.email,
    interestsCount: interests?.length || 0,
    interests: interests?.map(i => i.interest) || [],
    hasPattern: !!pattern,
    messagesCount: messages?.length || 0,
    pattern: pattern ? {
      style: pattern.communication_style,
      curiosity: pattern.curiosity_level,
      depth: pattern.topic_depth
    } : null
  };
};
