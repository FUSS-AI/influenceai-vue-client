/**
 * Runtime configuration sourced exclusively from environment variables.
 * Set VITE_API_BASE_URL and VITE_API_KEY in your .env file.
 * Values are baked in at build time by Vite — never expose secret keys in
 * a public/production build that is served over the internet.
 */
export const config = Object.freeze({
  // Base URL for soulchat-ai — the external-facing API gateway.
  // External team → soulchat-ai → InfluenceAI (internal, not directly accessible).
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8004/client/v1/influencer',
  apiKey:     import.meta.env.VITE_API_KEY     || '',
})
