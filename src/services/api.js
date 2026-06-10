import { config } from '../config.js'

// ── Typed error ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
  }
}

// ── Base request ──────────────────────────────────────────────────────────────
// Auth: soulchat-ai accepts X-API-Key + X-External-User-ID for machine clients.
// X-External-User-ID is the end-user's identifier (not the platform API key).

async function request(path, options = {}, userId = null) {
  if (!config.apiKey) {
    throw new ApiError('VITE_API_KEY is not set. Check your .env file.', 0)
  }

  const url = `${config.apiBaseUrl}${path}`

  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key':    config.apiKey,
    ...options.headers,
  }
  if (userId) headers['X-External-User-ID'] = userId

  let res
  try {
    res = await fetch(url, { ...options, headers })
  } catch (networkErr) {
    throw new ApiError(`Network error: ${networkErr.message}`, 0)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.message || detail
    } catch { /* non-JSON error body */ }
    throw new ApiError(detail, res.status)
  }

  if (res.status === 204) return null
  return res.json()
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  /**
   * Create a voice session via soulchat-ai.
   * Calls POST /session on soulchat-ai which internally dispatches
   * to InfluenceAI and returns a LiveKit token.
   *
   * @param {string}      personaId  - Influencer/character ID (e.g. 'vlog_star')
   * @param {string|null} userId     - Your user's identifier (sent as X-External-User-ID)
   * @param {object=}     opts
   * @param {string=}     opts.instructionsOverride
   * @param {string=}     opts.webhookUrl  - Your server's URL to receive call events
   * @returns {{ session_id, livekit_url, token, room_name }}
   */
  createSession(personaId, userId = null, opts = {}) {
    const body = { agent_config: { influencer_id: personaId } }
    if (opts.instructionsOverride) body.agent_config.instructions_override = opts.instructionsOverride
    if (opts.webhookUrl)           body.webhook_url = opts.webhookUrl

    return request('/session', { method: 'POST', body: JSON.stringify(body) }, userId)
  },

  /**
   * Sessions end automatically when the LiveKit room closes.
   * This method is a no-op kept for API compatibility.
   */
  endSession(_sessionId) {
    return Promise.resolve(null)
  },

  /** Get list of available personas/characters. */
  getPersonas() {
    return request('/list')
  },

  /**
   * Get a user's conversation memory for a specific persona.
   * Returns { context_text } with long-term facts and past conversations.
   */
  getMemory(personaId, userId = null) {
    const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
    return request(`/memory/${personaId}${qs}`, {}, userId)
  },

  // Recording is managed server-side.
  // Contact your integration team to enable per-session recording.
  startRecording(_sessionId) { return Promise.resolve(null) },
  stopRecording(_sessionId)  { return Promise.resolve(null) },

  // Transcripts are persisted automatically by soulchat-ai after each call
  // via the internal InfluenceAI webhook. This method is kept for local download.
  saveTranscript(_sessionId, _messages) { return Promise.resolve(null) },
}
