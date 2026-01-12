import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  placeImage,
  PlacementConflictError,
  PlacementRequestError,
} from "@/lib/placements/place-image";

type DevPlaceRequest = {
  generationId?: string;
  z?: number;
  x?: number;
  y?: number;
};

function requireInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new PlacementRequestError(
      `${label} must be an integer.`,
      400,
      "INVALID_COORDINATE"
    );
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DevPlaceRequest;
    const generationId = (body.generationId || "").trim();

    if (!generationId) {
      return NextResponse.json(
        { error: "generationId is required." },
        { status: 400 }
      );
    }

    const z = requireInteger(body.z, "z");
    const x = requireInteger(body.x, "x");
    const y = requireInteger(body.y, "y");

    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const result = await placeImage({
      userId: authData.user.id,
      generationId,
      z,
      x,
      y,
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
