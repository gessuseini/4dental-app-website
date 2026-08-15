import {
  Environment,
  LogLevel,
  Paddle,
  type PaddleOptions,
} from "@paddle/paddle-node-sdk";

/** Full sandbox keys look like: pdl_sdbx_apikey_... (≈69 chars). */
export function assertPaddleApiKeyConfigured() {
  const apiKey = process.env.PADDLE_API_KEY?.trim() ?? "";
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not set");
  }
  if (!apiKey.startsWith("pdl_") || !apiKey.includes("apikey_")) {
    throw new Error(
      "PADDLE_API_KEY looks invalid. Paste the full key from Paddle → Developer tools → Authentication (starts with pdl_sdbx_apikey_ or pdl_live_apikey_).",
    );
  }
  return apiKey;
}

export function getPaddleServer() {
  const apiKey = assertPaddleApiKeyConfigured();

  const options: PaddleOptions = {
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
    logLevel: LogLevel.error,
  };

  return new Paddle(apiKey, options);
}
