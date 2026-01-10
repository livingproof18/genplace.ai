export const MODEL_TOKEN_COST = {
  "google-nano-banana": 1,
  "stability-core": 1,
  "openai-gpt-image-1": 2,
  "openai-gpt-image-1.5": 3,
  "google-nano-banana-pro": 3,
} as const;

export type TokenModelId = keyof typeof MODEL_TOKEN_COST;
