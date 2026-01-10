import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type GenerationRequestRow = {
  id: string;
  user_id: string;
  prompt: string;
  model: string;
  size: number;
  status: "queued" | "generating" | "approved" | "rejected" | "failed";
  token_cost: number;
  image_url: string | null;
  rejection_reason: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// Lifecycle: queued -> generating -> approved | rejected | failed.
// Approved stores image_url, rejected stores rejection_reason, failed stores error_message.

async function updateGeneration(
  id: string,
  updates: Partial<
    Pick<
      GenerationRequestRow,
      "status" | "image_url" | "rejection_reason" | "error_message"
    >
  >
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generation_requests")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single<GenerationRequestRow>();

  if (error) {
    throw error;
  }

  return data;
}

export async function markGenerating(id: string) {
  return updateGeneration(id, { status: "generating" });
}

export async function markApproved(id: string, imageUrl: string) {
  return updateGeneration(id, {
    status: "approved",
    image_url: imageUrl,
    rejection_reason: null,
    error_message: null,
  });
}

export async function markRejected(id: string, reason: string) {
  return updateGeneration(id, {
    status: "rejected",
    rejection_reason: reason,
    error_message: null,
  });
}

export async function markFailed(id: string, errorMessage: string) {
  return updateGeneration(id, {
    status: "failed",
    error_message: errorMessage,
  });
}
