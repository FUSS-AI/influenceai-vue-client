import { ref, onUnmounted } from 'vue'
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client'

// Agent state attribute key published by the LiveKit agent SDK
const AGENT_STATE_KEY = 'lk.agent.state'

/**
 * Core voice-session composable.
 *
 * Creates one LiveKit Room per component instance, handles:
 *   - Connection lifecycle with state tracking
 *   - Agent-state updates via participant attributes
 *   - Automatic audio rendering (replaces <RoomAudioRenderer />)
 *   - Mic toggle with sync to room state
 *   - Cleanup on component unmount
 *
 * Usage:
 *   const { room, connectionState, agentState, micEnabled, error, connect, disconnect, toggleMic } = useVoiceSession()
 */
export function useVoiceSession() {
  // ── Reactive state ──────────────────────────────────────────────────────────
  const connectionState = ref('disconnected')  // 'disconnected'|'connecting'|'connected'|'reconnecting'|'failed'
  const agentState      = ref('idle')          // 'idle'|'listening'|'thinking'|'speaking'
  const micEnabled      = ref(false)
  const error           = ref(null)

  // ── Room instance ───────────────────────────────────────────────────────────
  const room = new Room({
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    adaptiveStream: true,   // auto-adjusts quality to bandwidth
    dynacast:       true,   // publishes only layers that subscribers need
  })

  // Track detached audio elements so we can clean them up
  const attachedAudioEls = []

  // ── Connection state mapping ────────────────────────────────────────────────
  const LK_STATE_MAP = {
    [ConnectionState.Connecting]:    'connecting',
    [ConnectionState.Connected]:     'connected',
    [ConnectionState.Disconnected]:  'disconnected',
    [ConnectionState.Reconnecting]:  'reconnecting',
  }

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    connectionState.value = LK_STATE_MAP[state] ?? 'disconnected'
    if (state === ConnectionState.Connected) error.value = null
  })

  room.on(RoomEvent.Disconnected, () => {
    connectionState.value = 'disconnected'
    agentState.value      = 'idle'
    micEnabled.value      = false
    _cleanupAudio()
  })

  room.on(RoomEvent.ConnectionError, (err) => {
    connectionState.value = 'failed'
    error.value = err?.message ?? 'Connection failed. Check your network and server URL.'
  })

  // ── Agent state ─────────────────────────────────────────────────────────────
  // The agent SDK publishes its state as a participant attribute.
  room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
    if (participant.isAgent && AGENT_STATE_KEY in changed) {
      agentState.value = changed[AGENT_STATE_KEY] || 'idle'
    }
  })

  // Handle agent joining after our own connect (race condition guard)
  room.on(RoomEvent.ParticipantConnected, (participant) => {
    if (participant.isAgent) {
      const state = participant.attributes?.[AGENT_STATE_KEY]
      if (state) agentState.value = state
    }
  })

  // ── Audio rendering ─────────────────────────────────────────────────────────
  // Replaces <RoomAudioRenderer /> from @livekit/components-react.
  // All remote audio tracks (agent voice) are attached to hidden <audio> elements.
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio) return
    const el = track.attach()
    el.style.display = 'none'
    document.body.appendChild(el)
    attachedAudioEls.push(el)
  })

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio) return
    const detached = track.detach()
    detached.forEach((el) => {
      el.remove()
      const i = attachedAudioEls.indexOf(el)
      if (i >= 0) attachedAudioEls.splice(i, 1)
    })
  })

  // ── Mic state sync ──────────────────────────────────────────────────────────
  room.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (
      participant === room.localParticipant &&
      publication.source === Track.Source.Microphone
    ) {
      micEnabled.value = false
    }
  })

  room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (
      participant === room.localParticipant &&
      publication.source === Track.Source.Microphone
    ) {
      micEnabled.value = true
    }
  })

  // ── Public API ──────────────────────────────────────────────────────────────

  async function connect(serverUrl, token) {
    error.value           = null
    connectionState.value = 'connecting'
    try {
      await room.connect(serverUrl, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      micEnabled.value = true
    } catch (err) {
      connectionState.value = 'failed'
      error.value           = err?.message ?? 'Failed to connect to voice server.'
      throw err
    }
  }

  async function disconnect() {
    await room.disconnect()
    // State is updated by the Disconnected event handler above
  }

  async function toggleMic() {
    const next = !micEnabled.value
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      micEnabled.value = next
    } catch (err) {
      console.warn('[VoiceSession] toggleMic failed:', err)
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  function _cleanupAudio() {
    attachedAudioEls.forEach((el) => { try { el.remove() } catch {} })
    attachedAudioEls.length = 0
  }

  onUnmounted(async () => {
    await room.disconnect()
    _cleanupAudio()
  })

  return {
    room,
    connectionState,
    agentState,
    micEnabled,
    error,
    connect,
    disconnect,
    toggleMic,
  }
}
