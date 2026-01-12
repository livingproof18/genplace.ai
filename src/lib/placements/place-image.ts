import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type PlaceImageParams = {
  userId: string;
  generationId: string;
  z: number;
  x: number;
  y: number;
};

type GenerationRequestRow = {
  id: string;
  user_id: string;
  status: "queued" | "generating" | "approved" | "rejected" | "failed";
  image_url: string | null;
};

type SlotRow = {
  id: string;
  z: number;
  x: number;
  y: number;
  current_placement_id: string | null;
  version: number;
};

type PlacementRow = {
  id: string;
  slot_id: string;
  user_id: string;
  generation_id: string;
  image_url: string;
  created_at: string;
};

export class PlacementConflictError extends Error {
  constructor(message = "Slot was updated by another placement.") {
    super(message);
    this.name = "PlacementConflictError";
  }
}

export class PlacementRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PlacementRequestError";
    this.status = status;
    this.code = code;
  }
}

const SLOT_SELECT = "id,z,x,y,current_placement_id,version";

async function resolveSlot(
  supabase: ReturnType<typeof createAdminClient>,
  z: number,
  x: number,
  y: number
) {
  const { data: existing, error: existingError } = await supabase
    .from("slots")
    .select(SLOT_SELECT)
    .eq("z", z)
    .eq("x", x)
    .eq("y", y)
    .maybeSingle<SlotRow>();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("slots")
    .insert({ z, x, y, version: 0 })
    .select(SLOT_SELECT)
    .single<SlotRow>();

  if (!createError) {
    return created;
  }

  if (createError.code === "23505") {
    const { data: retry, error: retryError } = await supabase
      .from("slots")
      .select(SLOT_SELECT)
      .eq("z", z)
      .eq("x", x)
      .eq("y", y)
      .maybeSingle<SlotRow>();

    if (retryError) {
      throw retryError;
    }
    if (retry) {
      return retry;
    }
  }

  throw createError;
}

export async function placeImage({
  userId,
  generationId,
  z,
  x,
  y,
}: PlaceImageParams) {
  if (!userId) {
    throw new PlacementRequestError("User is required.", 400, "USER_REQUIRED");
  }
  if (!generationId) {
    throw new PlacementRequestError(
      "Generation id is required.",
      400,
      "GENERATION_REQUIRED"
    );
  }

  const supabase = createAdminClient();
  const { data: generation, error: generationError } = await supabase
    .from("generation_requests")
    .select("id,user_id,status,image_url")
    .eq("id", generationId)
    .single<GenerationRequestRow>();

  if (generationError || !generation) {
    throw new PlacementRequestError(
      "Generation request not found.",
      404,
      "GENERATION_NOT_FOUND"
    );
  }

  if (generation.user_id !== userId) {
    throw new PlacementRequestError(
      "Generation does not belong to this user.",
      403,
      "GENERATION_FORBIDDEN"
    );
  }

  if (generation.status !== "approved") {
    throw new PlacementRequestError(
      "Generation is not approved for placement.",
      409,
      "GENERATION_NOT_APPROVED"
    );
  }

  if (!generation.image_url) {
    throw new PlacementRequestError(
      "Generation is missing an image URL.",
      409,
      "GENERATION_IMAGE_MISSING"
    );
  }

  const slot = await resolveSlot(supabase, z, x, y);

  const { data: placement, error: placementError } = await supabase
    .from("placements")
    .insert({
      slot_id: slot.id,
      user_id: userId,
      generation_id: generationId,
      image_url: generation.image_url,
    })
    .select("*")
    .single<PlacementRow>();

  if (placementError || !placement) {
    throw placementError ?? new Error("Failed to create placement.");
  }

  const { data: updatedSlot, error: updateError } = await supabase
    .from("slots")
    .update({
      current_placement_id: placement.id,
      version: slot.version + 1,
    })
    .eq("id", slot.id)
    .eq("version", slot.version)
    .select(SLOT_SELECT)
    .maybeSingle<SlotRow>();

  if (updateError || !updatedSlot) {
    await supabase.from("placements").delete().eq("id", placement.id);
    if (updateError) {
      throw updateError;
    }
    throw new PlacementConflictError();
  }

  return { placement, slot: updatedSlot };
}
