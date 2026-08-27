import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // admin.generateLink with magiclink returns a token but not session.
  // Use admin.generateLink with the new verify==true path won't give session.
  // Instead, directly create a session via admin: use generateLink to get the otp token
  // then exchange it through signInWithOTP with the token.
  const email = 'carve-lance-chummy@duck.com';
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    redirectTo: 'https://seriez.app/',
  });
  if (linkErr) { console.log('link err:', linkErr.message); process.exit(1); }
  // For magiclink generateLink, the properties contain hashed_token used as the OTP token
  const props = linkData.properties || {};
  console.log('properties keys:', Object.keys(props));
  console.log('hashes:', JSON.stringify(linkData.user?.email_confirmed_at ? 'confirmed' : 'unconfirmed'));
  console.log('action_link:', linkData.properties?.action_link);
  await client?.end?.();
}
main().catch(e=>{console.error('FATAL', e.message); process.exit(1);});
