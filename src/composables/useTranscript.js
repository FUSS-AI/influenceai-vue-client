import { ref, nextTick } from 'vue'
import { RoomEvent } from 'livekit-client'
import { config } from '../config.js'

/**
 * Transcript management composable.
 *
 * Handles:
 *   - Native LiveKit STT transcription events (RoomEvent.TranscriptionReceived)
 *   - Backchannel data-channel messages from the agent (topic: 'backchannel')
 *   - Echo detection: suppresses user STT segments that mirror recent agent speech
 *     (exact port of the algorithm in InfluenceAI SessionRoom.jsx)
 *   - Auto-scroll to latest message
 *
 * Usage:
 *   const { transcript, addBackchannelEntry, clear, finalMessages } = useTranscript(room, scrollRef)
 *
 * @param {import('livekit-client').Room} room
 * @param {import('vue').Ref<HTMLElement|null>}  scrollContainerRef
 */
export function useTranscript(room, scrollContainerRef) {
  const transcript = ref([])  // TranscriptEntry[]

  // ── Echo-detection state ────────────────────────────────────────────────────
  // Plain array (not reactive) — only referenced imperatively, never rendered.
  // Each entry: { norm: string, at: number (ms timestamp) }
  const recentAgentPhrases = []

  // ── Text normalisation (mirrors SessionRoom.jsx exactly) ───────────────────
  function normaliseEchoText(text) {
    return (text ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function rememberAgentPhrase(text) {
    const norm = normaliseEchoText(text)
    if (!norm) return
    const now = Date.now()
    // Prune phrases older than 14 s, then append; cap at 16 entries
    const fresh = recentAgentPhrases.filter(e => now - e.at < 14_000)
    fresh.push({ norm, at: now })
    recentAgentPhrases.splice(0, Infinity, ...fresh.slice(-16))
  }

  function isUserEcho(text) {
    const norm = normaliseEchoText(text)
    if (!norm) return false
    const now = Date.now()
    // Prune stale entries in-place
    const fresh = recentAgentPhrases.filter(e => now - e.at < 14_000)
    recentAgentPhrases.splice(0, Infinity, ...fresh)

    return recentAgentPhrases.some(({ norm: agentNorm }) => {
      if (norm === agentNorm) return true
      // Short phrase (≤5 words) that starts the agent's utterance → likely echo
      if (agentNorm.startsWith(norm) && norm.split(' ').length <= 5) return true
      // User phrase is a substring of what agent said → echo fragment
      if (norm.length <= agentNorm.length && agentNorm.includes(norm)) return true
      return false
    })
  }

  // ── Scroll helper ───────────────────────────────────────────────────────────

  async function scrollToBottom() {
    await nextTick()
    const el = scrollContainerRef?.value
    if (el) el.scrollTop = el.scrollHeight
  }

  // ── Entry management ────────────────────────────────────────────────────────

  function upsertEntry(entry) {
    const idx = transcript.value.findIndex(m => m.id === entry.id)
    if (idx >= 0) {
      // Preserve original timestamp; update text and finality
      transcript.value[idx] = { ...transcript.value[idx], ...entry, timestamp: transcript.value[idx].timestamp }
    } else {
      transcript.value.push(entry)
      scrollToBottom()
    }
  }

  // ── Backchannel messages ────────────────────────────────────────────────────
  // The Python agent sends { type: 'backchannel', text: string, audio_url?: string }
  // on the 'backchannel' LiveKit data channel.

  room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic !== 'backchannel') return
    try {
      const data = JSON.parse(new TextDecoder().decode(payload))
      if (data.type === 'backchannel' && data.text) {
        addBackchannelEntry(data.text, data.audio_url)
      }
    } catch (err) {
      console.warn('[Transcript] Failed to parse backchannel message:', err)
    }
  })

  function addBackchannelEntry(text, audioUrl) {
    rememberAgentPhrase(text)

    transcript.value.push({
      speaker:        'agent',
      text,
      id:             `bc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      final:          true,
      isBackchannel:  true,
      timestamp:      _now(),
    })

    if (audioUrl) {
      // audio_url from the agent may be a relative path (/recordings/...) or
      // an absolute URL. Relative paths must be resolved against the router
      // origin (strip /v1 suffix) so the browser fetches from the right server.
      const routerOrigin = config.apiBaseUrl.replace(/\/v1\/?$/, '')
      const fullUrl = /^https?:\/\//.test(audioUrl) ? audioUrl : `${routerOrigin}${audioUrl}`
      const audio = new Audio(fullUrl)
      audio.volume = 1.0
      audio.play().catch(e => console.warn('[Transcript] Backchannel audio blocked:', e))
    }

    scrollToBottom()
  }

  // ── Native LiveKit STT ──────────────────────────────────────────────────────

  room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
    const isAgent = !!participant?.isAgent

    for (const segment of segments) {
      const speaker = isAgent ? 'agent' : 'user'

      if (speaker === 'agent') {
        rememberAgentPhrase(segment.text)
      } else if (isUserEcho(segment.text)) {
        console.debug('[Transcript] Suppressed user STT echo:', segment.text)
        continue
      }

      upsertEntry({
        speaker,
        text:      segment.text,
        id:        segment.id,
        final:     segment.final,
        timestamp: _now(),
      })
    }
  })

  // ── Public helpers ──────────────────────────────────────────────────────────

  function clear() {
    transcript.value = []
  }

  /** Returns only finalised messages ready for server persistence. */
  function finalMessages() {
    return transcript.value
      .filter(m => m.final)
      .map(({ speaker, text, timestamp }) => ({
        speaker,
        text,
        timestamp: timestamp || _now(),
      }))
  }

  function _now() {
    return new Date().toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return {
    transcript,
    rememberAgentPhrase,
    addBackchannelEntry,
    clear,
    finalMessages,
  }
}
