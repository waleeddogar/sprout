const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/systemone";
// OpenRouter publishes the pinned Jev snapshot under its own model namespace.
export const OPENROUTER_JEV_MODEL = "typesafe/jev-1.13";

/** @param {Record<string, string | undefined>} [env] */
export function jevConnection(env = process.env) {
  if (env.JEV_PROVIDER === "openrouter")
    return env.OPENROUTER_API_KEY
      ? { endpoint: OPENROUTER_ENDPOINT, key: env.OPENROUTER_API_KEY, model: OPENROUTER_JEV_MODEL }
      : null;
  if (env.JEV_PROVIDER && env.JEV_PROVIDER !== "typesafe") return null;
  return env.TYPESAFE_API_KEY ? { endpoint: TYPESAFE_ENDPOINT, key: env.TYPESAFE_API_KEY, model: "jev-1.13.0" } : null;
}
