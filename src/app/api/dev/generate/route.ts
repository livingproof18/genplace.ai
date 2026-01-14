import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServerClient } from "@/lib/supabase/server";
import { createGenerationRequest } from "@/lib/generation/create-generation";
import {
  markApproved,
  markFailed,
  markGenerating,
} from "@/lib/generation/update-generation";
import { uploadImage } from "@/lib/storage/upload-image";
import {
  consumeTokens,
  TokenConsumeError,
} from "@/lib/tokens/consume-tokens";
import { MODEL_TOKEN_COST, type TokenModelId } from "@/lib/tokens/model-cost";

type DevGenerateRequest = {
  prompt?: string;
  model?: TokenModelId;
  tokenModel?: TokenModelId;
  size?: number;
};

const ALLOWED_SIZES = new Set([24, 48, 64, 96, 128, 256, 384, 512]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PLACEHOLDER_FILENAME = "convex-approval.png";
const PLACEHOLDER_CONTENT_TYPE = "image/png";

async function loadPlaceholderImage() {
  const filePath = path.join(process.cwd(), "public", PLACEHOLDER_FILENAME);
  return readFile(filePath);
}

export async function POST(req: Request) {
  let generationId: string | null = null;

  try {
    const body = (await req.json()) as DevGenerateRequest;
    const prompt = (body.prompt || "").trim();
    const model = body.model ?? body.tokenModel;
    const size = body.size ?? 256;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    if (!model || !(model in MODEL_TOKEN_COST)) {
      return NextResponse.json(
        { error: "Unsupported token model." },
        { status: 400 }
      );
    }

    if (!ALLOWED_SIZES.has(size)) {
      return NextResponse.json(
        { error: "Invalid size. Use 128, 256, or 512." },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    await consumeTokens(authData.user.id, model);

    const generation = await createGenerationRequest({
      userId: authData.user.id,
      prompt,
      model,
      size,
    });

    generationId = generation.id;

    await markGenerating(generation.id);
    await sleep(500 + Math.random() * 500);

    const buffer = await loadPlaceholderImage();
    const key = `raw/${generation.id}.png`;
    const imageUrl = await uploadImage({
      buffer,
      key,
      contentType: PLACEHOLDER_CONTENT_TYPE,
    });
    const approved = await markApproved(generation.id, imageUrl);

    return NextResponse.json({ generation: approved });
  } catch (err) {
    if (err instanceof TokenConsumeError) {
      const status = err.code === "COOLDOWN_ACTIVE" ? 429 : 402;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }

    if (generationId) {
      const message =
        err instanceof Error ? err.message : "Generation failed.";
      try {
        await markFailed(generationId, message);
      } catch {
        // Best effort: keep the original error response.
      }
    }

    console.error("[/api/dev/generate] error", err);
    const message =
      err instanceof Error ? err.message : "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
