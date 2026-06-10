# Display States — Show What the Bot is Doing

The bot goes through different states during a conversation. Your UI should reflect each one so the user always knows what's happening.

---

## The 6 states

```
                    ┌──────────────┐
     startCall()    │              │
    ─────────────►  │  CONNECTING  │   Browser trying to reach server
                    │              │
                    └──────┬───────┘
                           │ room joined
                           ▼
                    ┌──────────────┐
                    │              │
                    │  CONNECTED   │   In room, waiting for bot
                    │              │
                    └──────┬───────┘
                           │ bot joins + lk.agent.state
                    ┌──────┴──────────────────────────┐
                    ▼                                  ▼
            ┌──────────────┐                  ┌──────────────┐
            │              │                  │              │
            │  LISTENING   │ ◄──────────────► │   THINKING   │
            │              │   user stops      │              │
            └──────┬───────┘   speaking        └──────┬───────┘
                   │                                  │ bot has answer
                   │                                  ▼
                   │                          ┌──────────────┐
                   │◄─────────────────────────│              │
                   │         bot finishes     │   SPEAKING   │
                   │                          │              │
                   │                          └──────────────┘
                   │
                   │  [sensitive word detected]
                   ▼
            ┌──────────────┐
            │              │
            │   BLOCKED    │   Bot refuses to respond
            │              │
            └──────────────┘
```

---

## How to read the bot's state

The bot publishes its state as a participant attribute named `lk.agent.state`.

```js
const AGENT_STATE_KEY = 'lk.agent.state'

// When the bot's state changes
room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
  if (participant.isAgent && AGENT_STATE_KEY in changed) {
    const state = changed[AGENT_STATE_KEY]
    updateUI(state)
    // state is one of: 'idle' | 'listening' | 'thinking' | 'speaking'
  }
})

// Also read it when the bot first joins (it may already have a state)
room.on(RoomEvent.ParticipantConnected, (participant) => {
  if (participant.isAgent) {
    const state = participant.attributes?.[AGENT_STATE_KEY] ?? 'idle'
    updateUI(state)
  }
})
```

---

## Mapping states to your UI

```js
function updateUI(botState) {
  const statusEl = document.getElementById('bot-status')

  switch (botState) {
    case 'idle':
      statusEl.textContent = '🟢 Connected'
      statusEl.style.color = 'green'
      break
    case 'listening':
      statusEl.textContent = '👂 Listening...'
      statusEl.style.color = 'blue'
      break
    case 'thinking':
      statusEl.textContent = '💭 Thinking...'
      statusEl.style.color = 'orange'
      break
    case 'speaking':
      statusEl.textContent = '🗣 Speaking'
      statusEl.style.color = 'purple'
      break
  }
}
```

---

## Connection states (room level)

These fire on `RoomEvent.ConnectionStateChanged` — separate from bot state.

```js
import { ConnectionState } from 'livekit-client'

room.on(RoomEvent.ConnectionStateChanged, (state) => {
  switch (state) {
    case ConnectionState.Connecting:
      showBanner('🔄 Connecting to voice server...')
      break
    case ConnectionState.Connected:
      showBanner('✅ Connected')
      break
    case ConnectionState.Reconnecting:
      showBanner('⚠️ Network issue — reconnecting...')
      break
    case ConnectionState.Disconnected:
      showBanner('❌ Disconnected')
      break
  }
})
```

> 📸 **Screenshot to add**: Side-by-side screenshots of the UI in each state — Connecting (spinner), Connected (green dot), AI Thinking (pulsing dots), AI Speaking (waveform animation), AI Listening (mic icon lit).

---

## Blocked state (sensitive word detected)

When the bot hits a blocked intent (sensitive words), it stops speaking and returns a fixed response. Your client does not need to detect this — the bot will send a transcript segment with the canned response, and its state will return to `listening`.

However, if you want to show a special UI:

```js
room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
  if (!participant?.isAgent) return
  for (const seg of segments) {
    if (seg.final && seg.text.includes('[CONTENT_BLOCKED]')) {
      showBlockedBanner('⚠️ Content not available')
    }
  }
})
```

> 📸 **Screenshot to add**: UI showing "⚠️ Content not available" banner appearing over the chat interface.

---

## Vue 3 example (reactive)

```vue
<script setup>
import { ref } from 'vue'
import { RoomEvent } from 'livekit-client'

const props = defineProps(['room'])

const connectionState = ref('disconnected')  // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
const botState        = ref('idle')          // 'idle' | 'listening' | 'thinking' | 'speaking'

const AGENT_STATE_KEY = 'lk.agent.state'

props.room.on(RoomEvent.ConnectionStateChanged, (s) => {
  connectionState.value = s.toLowerCase()
})

props.room.on(RoomEvent.ParticipantAttributesChanged, (changed, participant) => {
  if (participant.isAgent && AGENT_STATE_KEY in changed) {
    botState.value = changed[AGENT_STATE_KEY]
  }
})

props.room.on(RoomEvent.ParticipantConnected, (participant) => {
  if (participant.isAgent) {
    botState.value = participant.attributes?.[AGENT_STATE_KEY] ?? 'idle'
  }
})
</script>

<template>
  <div class="status-bar">
    <!-- Connection state -->
    <span v-if="connectionState === 'connecting'">🔄 Connecting...</span>
    <span v-else-if="connectionState === 'reconnecting'">⚠️ Reconnecting...</span>
    <span v-else-if="connectionState === 'disconnected'">❌ Disconnected</span>

    <!-- Bot state (only shown when connected) -->
    <template v-else>
      <span v-if="botState === 'idle'">🟢 Ready</span>
      <span v-else-if="botState === 'listening'">👂 Listening</span>
      <span v-else-if="botState === 'thinking'">💭 Thinking</span>
      <span v-else-if="botState === 'speaking'">🗣 Speaking</span>
    </template>
  </div>
</template>
```
