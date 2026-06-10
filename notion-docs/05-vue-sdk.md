# Vue 3 SDK Integration

A complete, copy-paste-ready Vue 3 integration. No React. No adapters. Just `livekit-client` + Vue composables.

---

## Setup

```bash
npm install livekit-client
```

That's the only package you need.

---

## Project structure

```
src/
  config.js                     ← API base URL and key
  services/
    api.js                      ← REST calls (createSession, endSession)
  composables/
    useVoiceSession.js          ← Room connection + bot state
    useTranscript.js            ← Live transcript + echo detection
    useCallTimer.js             ← Call duration timer
    useHeartbeat.js             ← Auto-reconnect
  components/
    SessionRoom.vue             ← Full call UI
    SetupView.vue               ← Session creation / persona picker
  App.vue
  main.js
```

---

## config.js

```js
// src/config.js
export const config = Object.freeze({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1',
  apiKey:     import.meta.env.VITE_API_KEY     || '',
})
```

```env
# .env
VITE_API_BASE_URL=http://localhost:8000/v1
VITE_API_KEY=sk_dev_testkey
```

---

## useVoiceSession.js — Room connection + bot state

```js
// src/composables/useVoiceSession.js
import { ref, onUnmounted } from 'vue'
import { Room, RoomEvent, ConnectionState, Track } from 'livekit-client'

export function useVoiceSession() {
  const connectionState = ref('disconnected')
  const botState        = ref('idle')
  const isMicEnabled    = ref(false)
  const audioElements   = []

  const AGENT_STATE_KEY = 'lk.agent.state'

  const room = new Room({
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl:  true,
    },
    adaptiveStream: true,
    dynacast:       true,
  })

  // Connection state
  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    connectionState.value = state
  })

  // Bot state
  room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
    if (participant.isAgent && AGENT_STATE_KEY in changed) {
      botState.value = changed[AGENT_STATE_KEY]
    }
  })
  room.on(RoomEvent.ParticipantConnected, (participant) => {
    if (participant.isAgent) {
      botState.value = participant.attributes?.[AGENT_STATE_KEY] ?? 'idle'
    }
  })

  // Audio rendering
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach()
      el.style.display = 'none'
      document.body.appendChild(el)
      audioElements.push(el)
    }
  })
  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      track.detach().forEach(el => el.remove())
    }
  })

  // Mic state sync
  room.on(RoomEvent.TrackMuted, (pub, participant) => {
    if (participant === room.localParticipant) isMicEnabled.value = false
  })
  room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
    if (participant === room.localParticipant) isMicEnabled.value = true
  })

  async function connect(livekitUrl, token) {
    await room.connect(livekitUrl, token)
    await room.localParticipant.setMicrophoneEnabled(true)
    isMicEnabled.value = true
  }

  async function disconnect() {
    await room.disconnect()
    audioElements.forEach(el => el.remove())
    audioElements.length = 0
    isMicEnabled.value = false
  }

  async function toggleMic() {
    const next = !isMicEnabled.value
    await room.localParticipant.setMicrophoneEnabled(next)
    isMicEnabled.value = next
  }

  onUnmounted(disconnect)

  return {
    room,
    connectionState,
    botState,
    isMicEnabled,
    connect,
    disconnect,
    toggleMic,
  }
}
```

---

## useTranscript.js — Live transcript with echo detection

```js
// src/composables/useTranscript.js
import { ref, nextTick } from 'vue'
import { RoomEvent } from 'livekit-client'
import { config } from '../config.js'

export function useTranscript(room, scrollRef) {
  const transcript = ref([])
  const recentAgentPhrases = []

  function normalise(text) {
    return (text ?? '').toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  }

  function rememberAgentPhrase(text) {
    const norm = normalise(text)
    if (!norm) return
    const now = Date.now()
    const fresh = recentAgentPhrases.filter(e => now - e.at < 14_000)
    fresh.push({ norm, at: now })
    recentAgentPhrases.splice(0, Infinity, ...fresh.slice(-16))
  }

  function isEcho(text) {
    const norm = normalise(text)
    if (!norm) return false
    const now = Date.now()
    recentAgentPhrases.splice(0, Infinity, ...recentAgentPhrases.filter(e => now - e.at < 14_000))
    return recentAgentPhrases.some(({ norm: a }) =>
      norm === a ||
      (a.startsWith(norm) && norm.split(' ').length <= 5) ||
      (norm.length <= a.length && a.includes(norm))
    )
  }

  async function scrollToBottom() {
    await nextTick()
    if (scrollRef?.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }

  function upsert(entry) {
    const idx = transcript.value.findIndex(m => m.id === entry.id)
    if (idx >= 0) {
      transcript.value[idx] = { ...transcript.value[idx], ...entry }
    } else {
      transcript.value.push(entry)
      scrollToBottom()
    }
  }

  room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
    const isAgent = !!participant?.isAgent
    for (const seg of segments) {
      if (isAgent) {
        rememberAgentPhrase(seg.text)
      } else if (isEcho(seg.text)) {
        continue
      }
      upsert({
        id:        seg.id,
        speaker:   isAgent ? 'agent' : 'user',
        text:      seg.text,
        final:     seg.final,
        timestamp: new Date().toLocaleTimeString(),
      })
    }
  })

  room.on(RoomEvent.DataReceived, (payload, _p, _k, topic) => {
    if (topic !== 'backchannel') return
    try {
      const data = JSON.parse(new TextDecoder().decode(payload))
      if (data.type === 'backchannel' && data.text) {
        rememberAgentPhrase(data.text)
        transcript.value.push({
          id:           `bc-${Date.now()}`,
          speaker:      'agent',
          text:         data.text,
          final:        true,
          isBackchannel: true,
          timestamp:    new Date().toLocaleTimeString(),
        })
        if (data.audio_url) {
          const origin = config.apiBaseUrl.replace(/\/v1\/?$/, '')
          const url = /^https?:\/\//.test(data.audio_url) ? data.audio_url : `${origin}${data.audio_url}`
          new Audio(url).play().catch(() => {})
        }
        scrollToBottom()
      }
    } catch {}
  })

  return {
    transcript,
    clear: () => { transcript.value = [] },
    finalMessages: () => transcript.value.filter(m => m.final)
      .map(({ speaker, text, timestamp }) => ({ speaker, text, timestamp })),
  }
}
```

---

## SessionRoom.vue — Full call component

```vue
<!-- src/components/SessionRoom.vue -->
<script setup>
import { computed, ref, onMounted } from 'vue'
import { ConnectionState }   from 'livekit-client'
import { useVoiceSession }   from '../composables/useVoiceSession.js'
import { useTranscript }     from '../composables/useTranscript.js'
import { useCallTimer }      from '../composables/useCallTimer.js'
import { api }               from '../services/api.js'

const props = defineProps({
  connectionDetails: Object,   // { session_id, livekit_url, token }
  persona:           Object,   // { name, avatar_url, influencer_id }
})
const emit = defineEmits(['leave'])

const scrollRef = ref(null)
const { room, connectionState, botState, isMicEnabled, connect, disconnect, toggleMic }
  = useVoiceSession()
const { transcript, clear, finalMessages } = useTranscript(room, scrollRef)
const { formatted: callDuration, isRunning: timerRunning }  = useCallTimer(room)

const isConnected  = computed(() => connectionState.value === ConnectionState.Connected)
const isSpeaking   = computed(() => botState.value === 'speaking')
const isListening  = computed(() => botState.value === 'listening')
const isThinking   = computed(() => botState.value === 'thinking')

onMounted(() => connect(props.connectionDetails.livekit_url, props.connectionDetails.token))

async function handleLeave() {
  await disconnect()
  await api.endSession(props.connectionDetails.session_id)
  emit('leave')
}
</script>

<template>
  <div class="session-room">
    <!-- Header: status + timer -->
    <div class="header">
      <span class="status">
        <span v-if="connectionState === 'connecting'">🔄 Connecting...</span>
        <span v-else-if="connectionState === 'reconnecting'">⚠️ Reconnecting...</span>
        <span v-else-if="isConnected">
          <span v-if="isSpeaking">🗣 Speaking</span>
          <span v-else-if="isListening">👂 Listening</span>
          <span v-else-if="isThinking">💭 Thinking</span>
          <span v-else>🟢 Ready</span>
        </span>
        <span v-else>❌ Disconnected</span>
      </span>
      <span v-if="timerRunning" class="timer">🕐 {{ callDuration }}</span>
    </div>

    <!-- Transcript -->
    <div ref="scrollRef" class="transcript">
      <div
        v-for="msg in transcript"
        :key="msg.id"
        :class="['message', msg.speaker, { backchannel: msg.isBackchannel, partial: !msg.final }]"
      >
        <span class="speaker">{{ msg.speaker === 'agent' ? '🤖' : '👤' }}</span>
        <span class="text">{{ msg.text }}</span>
        <span class="time">{{ msg.timestamp }}</span>
      </div>
      <!-- Typing indicator -->
      <div v-if="isThinking" class="thinking-indicator">
        <span>💭</span>
        <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button @click="toggleMic" :class="{ muted: !isMicEnabled }">
        {{ isMicEnabled ? '🎤 Mic On' : '🔇 Mic Off' }}
      </button>
      <button @click="handleLeave" class="end-call">📵 End Call</button>
    </div>
  </div>
</template>
```

---

## App.vue — Wiring it together

```vue
<!-- src/App.vue -->
<script setup>
import { ref }        from 'vue'
import SetupView      from './components/SetupView.vue'
import SessionRoom    from './components/SessionRoom.vue'

const connectionDetails = ref(null)
const persona           = ref(null)

function onSessionStart({ session, selectedPersona }) {
  connectionDetails.value = session
  persona.value           = selectedPersona
}
function onLeave() {
  connectionDetails.value = null
  persona.value           = null
}
</script>

<template>
  <SessionRoom
    v-if="connectionDetails"
    :connection-details="connectionDetails"
    :persona="persona"
    @leave="onLeave"
  />
  <SetupView
    v-else
    @session-start="onSessionStart"
  />
</template>
```

> 📸 **Screenshot to add**: The running Vue app showing SetupView (persona cards) on one side and SessionRoom (active call with transcript) on the other.

---

## Running the reference implementation

```bash
git clone https://github.com/FUSS-AI/influenceai-vue-client.git
cd influenceai-vue-client
cp .env.example .env      # set VITE_API_BASE_URL and VITE_API_KEY
npm install
npm run dev               # opens http://localhost:5173
```
