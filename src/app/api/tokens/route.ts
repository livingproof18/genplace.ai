import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("tokens_current,tokens_max,cooldown_until,total_generations")
    .eq("id", authData.user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load token state." },
      { status: 500 }
    );
  }

  return NextResponse.json({ tokens: data });
}
