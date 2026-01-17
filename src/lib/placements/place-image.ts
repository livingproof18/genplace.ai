import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type PlaceImageParams = {
  userId: string;
  generationId: string;
  lat: number;
  lng: number;
};

type GenerationRequestRow = {
  id: string;
  user_id: string;
  status: "queued" | "generating" | "approved" | "rejected" | "failed";
  image_url: string | null;
  prompt: string;
  size: number;
};

type PlacementRow = {
  id: string;
  slot_id: string | null;
  user_id: string;
  generation_id: string;
  image_url: string;
  lat: number | null;
  lng: number | null;
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


export async function placeImage({
  userId,
  generationId,
  lat,
  lng,
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
    .select("id,user_id,status,image_url,prompt,size")
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

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new PlacementRequestError(
      "Valid lat/lng are required.",
      400,
      "INVALID_COORDINATE"
    );
  }

  const geom = `SRID=4326;POINT(${lng} ${lat})`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[placeImage] insert placement", { generationId, userId, lat, lng });
  }

  const { data: placement, error: placementError } = await supabase
    .from("placements")
    .insert({
      slot_id: null,
      user_id: userId,
      generation_id: generationId,
      prompt: generation.prompt,
      size: generation.size,
      image_url: generation.image_url,
      lat,
      lng,
      geom,
    })
    .select("*")
    .single<PlacementRow>();

  if (placementError || !placement) {
    throw placementError ?? new Error("Failed to create placement.");
  }

  return { placement };
}
