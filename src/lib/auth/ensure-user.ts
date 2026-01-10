import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type PublicUser = {
  id: string;
  handle: string | null;
  avatar_url: string | null;
  provider: string | null;
  tokens_current: number;
  tokens_max: number;
  cooldown_until: string | null;
  total_generations: number;
};

function buildHandle(authUser: User) {
  const metadata = authUser.user_metadata ?? {};
  const raw =
    metadata.full_name ||
    metadata.name ||
    authUser.email?.split("@")[0] ||
    `user-${authUser.id.slice(0, 8)}`;

  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export async function ensureUserExists(
  supabaseAdmin: SupabaseClient,
  authUser: User
) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing as PublicUser;
  }

  const metadata = authUser.user_metadata ?? {};

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("users")
    .insert({
      id: authUser.id,
      handle: buildHandle(authUser),
      avatar_url: metadata.avatar_url ?? null,
      provider: authUser.app_metadata?.provider ?? null,
      tokens_current: 0,
      tokens_max: 0,
      cooldown_until: null,
      total_generations: 0,
    })
    .select("*")
    .single();

  if (insertError) {
    // If another request inserted in parallel, fetch the row and continue.
    if (insertError.code === "23505") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();
      if (error) throw error;
      return data as PublicUser;
    }
    throw insertError;
  }

  return inserted as PublicUser;
}
