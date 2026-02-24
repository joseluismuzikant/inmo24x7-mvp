import { getSupabaseClient } from "../lib/supabase.js";

export type SourceType = 'web_chat' | 'whatsapp' | 'form' | 'backoffice';

export interface AuthUser {
  id: string;
  email?: string;
  tenant_id: string;
  role: string;
  source_type?: SourceType;
}

export async function getAuthUser(token: string): Promise<AuthUser> {
  const supabase = getSupabaseClient();

  console.log("🔍 getAuthUser called with token:", token.substring(0, 20) + "...");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  console.log("🔍 getAuthUser user:", user);
  console.log("🔍 getAuthUser error:", error);

  if (error || !user) {
    throw new Error("Invalid token");
  }

  const userId = user.id;
  console.log("🔍 getAuthUser userId:", userId);

  // Debug: Check all profiles
  const { data: allProfiles, error: allProfilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);

  console.log("🔍 All profiles (debug):", allProfiles);
  console.log("🔍 All profiles error:", allProfilesError);

  // Try direct query with explicit UUID string
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .single();

  console.log("🔍 getAuthUser profile:", profile);
  console.log("🔍 getAuthUser profileError:", profileError);

  if (profileError || !profile) {
    throw new Error("No profile found");
  }

  if (!profile.tenant_id) {
    throw new Error("No tenant assigned");
  }

  return {
    id: user.id,
    email: user.email,
    tenant_id: profile.tenant_id,
    role: profile.role,
  };
}
