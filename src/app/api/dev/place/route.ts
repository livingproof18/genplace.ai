import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  placeImage,
  PlacementConflictError,
  PlacementRequestError,
} from "@/lib/placements/place-image";

type DevPlaceRequest = {
  generationId?: string;
  lat?: number | string;
  lng?: number | string;
};

function requireNumber(value: unknown, label: string) {
  const parsed =
    typeof value === "string"
      ? Number.parseFloat(value)
      : typeof value === "number"
      ? value
      : NaN;
  if (!Number.isFinite(parsed)) {
    const debug =
      process.env.NODE_ENV !== "production"
        ? ` Received ${JSON.stringify(value)} (${typeof value}).`
        : "";
    throw new PlacementRequestError(
      `${label} must be a number.${debug}`,
      400,
      "INVALID_COORDINATE"
    );
  }
  return parsed;
}

function requireRange(value: number, label: string, min: number, max: number) {
  if (value < min || value > max) {
    throw new PlacementRequestError(
      `${label} must be between ${min} and ${max}.`,
      400,
      "INVALID_COORDINATE"
    );
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DevPlaceRequest;
    if (process.env.NODE_ENV !== "production") {
      console.log("[/api/dev/place] body", body);
    }
    const generationId = (body.generationId || "").trim();

    if (!generationId) {
      return NextResponse.json(
        { error: "generationId is required." },
        { status: 400 }
      );
    }

    const lat = requireRange(requireNumber(body.lat, "lat"), "lat", -90, 90);
    const lng = requireRange(requireNumber(body.lng, "lng"), "lng", -180, 180);

    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[/api/dev/place] insert request", {
        generationId,
        userId: authData.user.id,
        lat,
        lng,
      });
    }

    const result = await placeImage({
      userId: authData.user.id,
      generationId,
      lat,
      lng,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlacementRequestError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status }
      );
    }
    if (err instanceof PlacementConflictError) {
      return NextResponse.json(
        { error: err.message, code: "SLOT_CONFLICT" },
        { status: 409 }
      );
    }
    console.error("[/api/dev/place] error", err);
    const message =
      err instanceof Error ? err.message : "Placement failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
