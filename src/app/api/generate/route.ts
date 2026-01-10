import OpenAI from "openai";
import { NextResponse } from "next/server";
import { applyStyle, type Style } from "@/lib/image-styles";
import { createServerClient } from "@/lib/supabase/server";
import {
  consumeTokens,
  TokenConsumeError,
} from "@/lib/tokens/consume-tokens";
import { MODEL_TOKEN_COST, type TokenModelId } from "@/lib/tokens/model-cost";

type GenerateRequest = {
    prompt?: string;
    style?: Style;
    size?: number;
    n?: number;
    provider?: "openai" | "google" | "stability";
    modelId?: string;
    tokenModel?: TokenModelId;
};

const ALLOWED_SIZES = new Set([24, 48, 64, 96, 128, 256, 384, 512]);

function toOpenAISize(): "1024x1024" {
  // gpt-image-1 defaults to 1024x1024; use that for compatibility.
  return "1024x1024";
}

function stabilityEndpoint() {
  if (process.env.STABILITY_IMAGE_ENDPOINT) {
    return process.env.STABILITY_IMAGE_ENDPOINT;
  }
  const model = (
    process.env.STABILITY_IMAGE_MODEL || "stable-image-core"
  ).trim();
  const name = model.replace(/^stable-image-/, "");
  const path =
    name === "ultra" || name === "fast" || name === "sd3" ? name : "core";
  return `https://api.stability.ai/v2beta/stable-image/generate/${path}`;
}

async function generateWithStability(prompt: string, n: number) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("Stability API key is not configured.");
  }

  const endpoint = stabilityEndpoint();
  const calls = Array.from({ length: n }, async () => {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("output_format", "png");
    form.append("aspect_ratio", "1:1");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Stability API error: ${errText || res.statusText}`);
    }

    const data = await res.json().catch(() => ({}));
    const b64 = data?.image;
    if (!b64) {
      throw new Error("Stability API returned no image data.");
    }

    return { id: crypto.randomUUID(), url: `data:image/png;base64,${b64}` };
  });

  return Promise.all(calls);
}

function extractGeminiInlineImage(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part?.inlineData;
    if (inline?.data) {
      const mime = inline.mimeType || "image/png";
      return `data:${mime};base64,${inline.data}`;
    }
  }
  return null;
}

async function generateWithGoogle(prompt: string, n: number, modelOverride?: string) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("Google API key is not configured.");
    }

    const model = modelOverride || process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";
  const endpoint =
    process.env.GOOGLE_IMAGE_ENDPOINT ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const variants: { id: string; url: string }[] = [];
    const responseModalities = ["TEXT", "IMAGE"];
    const imageConfig = model.startsWith("gemini-3-pro")
        ? { aspectRatio: "1:1", imageSize: "1K" }
        : { aspectRatio: "1:1" };

  // Gemini returns images as base64 inlineData; request IMAGE modality and parallelize
  // calls to reduce latency for multiple variants (n).
  const calls = Array.from({ length: n }, async () => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { responseModalities, imageConfig },
            }),
        });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || "Google image generation failed.";
      throw new Error(message);
    }

    const url = extractGeminiInlineImage(data);
    if (!url) {
      throw new Error("Google image generation returned no image data.");
    }

    return { id: crypto.randomUUID(), url };
  });

  const results = await Promise.all(calls);
  variants.push(...results);

  return variants;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const prompt = (body.prompt || "").trim();
    const style = body.style ?? "auto";
    const size = body.size ?? 256;
    const n = Math.max(1, Math.min(4, body.n ?? 2));
    const provider = body.provider ?? "openai";
    const tokenModel = body.tokenModel;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }
    if (!ALLOWED_SIZES.has(size)) {
      return NextResponse.json(
        { error: "Invalid size. Use 128, 256, or 512." },
        { status: 400 }
      );
    }

    if (!tokenModel || !(tokenModel in MODEL_TOKEN_COST)) {
      return NextResponse.json(
        { error: "Unsupported token model." },
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

    // MVP: consume tokens up-front; refunds for provider failures are deferred.
    const tokenState = await consumeTokens(authData.user.id, tokenModel);

        const styledPrompt = applyStyle(prompt, style);
        let variants: { id: string; url: string }[] = [];

        if (provider === "google") {
            variants = await generateWithGoogle(styledPrompt, n, body.modelId);
        } else if (provider === "stability") {
            variants = await generateWithStability(styledPrompt, n);
        } else {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured." },
          { status: 500 }
        );
      }

      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const modelId = body.modelId || "gpt-image-1";
            const result = await client.images.generate({
                model: modelId,
                prompt: styledPrompt,
                size: toOpenAISize(),
                n,
            });

      variants = (result.data || [])
        .map((img) => img.b64_json)
        .filter((b64): b64 is string => Boolean(b64))
        .map((b64) => ({
          id: crypto.randomUUID(),
          url: `data:image/png;base64,${b64}`,
        }));
    }

    return NextResponse.json({ variants, tokens: tokenState });
  } catch (err) {
    if (err instanceof TokenConsumeError) {
      const status = err.code === "COOLDOWN_ACTIVE" ? 429 : 402;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error("[/api/generate] error", err);
    const message =
      err instanceof Error ? err.message : "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
