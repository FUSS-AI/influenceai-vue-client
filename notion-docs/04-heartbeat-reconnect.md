# Heartbeat & Auto-Reconnect

Networks are unreliable. This page shows how to automatically reconnect when the connection drops and disconnect cleanly when the browser goes idle.

---

## What LiveKit already does for you (for free)

LiveKit's SDK automatically:
- Detects when the WebSocket connection drops
- Tries to reconnect (emits `RoomEvent.Reconnecting`)
- Re-subscribes to all tracks when it succeeds (emits `RoomEvent.Reconnected`)

You do **not** need to call `room.connect()` again yourself. Just listen to the events.

```
Network drops
     │
     ▼
RoomEvent.Reconnecting   ← show "reconnecting..." banner
     │
     │  SDK tries automatically
     │
     ├── success ──► RoomEvent.Reconnected   ← hide banner, call continues
     │
     └── failure ──► RoomEvent.Disconnected  ← show error, redirect to lobby
```

---

## Minimum reconnect handler

```js
room.on(RoomEvent.Reconnecting, () => {
  showBanner('⚠️ Network issue — reconnecting...')
})

room.on(RoomEvent.Reconnected, () => {
  hideBanner()
  console.log('✅ Reconnected — call continues')
})

room.on(RoomEvent.Disconnected, (reason) => {
  hideBanner()
  console.log('Disconnected. Reason:', reason)
  // reason: 'DUPLICATE_IDENTITY' | 'ROOM_DELETED' | 'PARTICIPANT_REMOVED' | 'JOIN_FAILURE' | 'ROOM_CLOSED'
  redirectToLobby()
})
```

> 📸 **Screenshot to add**: UI with a yellow "Reconnecting..." banner at the top during a network drop. Below it the call interface is greyed out but still visible.

---

## Application-level heartbeat (detect frozen connections)

Sometimes WebSocket connections appear alive but are actually frozen (no data flowing). Add a heartbeat to detect this:

```js
const HEARTBEAT_INTERVAL = 15_000   // check every 15 seconds
const HEARTBEAT_TIMEOUT  = 30_000   // give up after 30 seconds of silence

let lastActivityAt = Date.now()
let heartbeatTimer = null
let timeoutTimer   = null

function resetHeartbeat() {
  lastActivityAt = Date.now()
  clearTimeout(timeoutTimer)
  timeoutTimer = setTimeout(() => {
    // No activity for 30s — force disconnect
    console.warn('Heartbeat timeout — disconnecting')
    room.disconnect()
  }, HEARTBEAT_TIMEOUT)
}

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    const silentMs = Date.now() - lastActivityAt
    console.debug(`Heartbeat: last activity ${silentMs}ms ago`)
  }, HEARTBEAT_INTERVAL)
  resetHeartbeat()
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer)
  clearTimeout(timeoutTimer)
}

// Reset on any room activity
room.on(RoomEvent.ConnectionStateChanged, (state) => {
  if (state === ConnectionState.Connected) startHeartbeat()
  if (state === ConnectionState.Disconnected) stopHeartbeat()
  resetHeartbeat()
})
room.on(RoomEvent.TranscriptionReceived, resetHeartbeat)
room.on(RoomEvent.ActiveSpeakersChanged,  resetHeartbeat)
room.on(RoomEvent.DataReceived,           resetHeartbeat)
```

---

## Automatic disconnect when page closes / user navigates away

```js
// Fires when user closes tab, refreshes, or navigates away
window.addEventListener('beforeunload', async () => {
  if (room && room.state === ConnectionState.Connected) {
    await room.disconnect()
    await fetch(`http://your-server:8000/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': API_KEY },
      keepalive: true,   // ← important: allows fetch to complete even as page unloads
    })
  }
})
```

---

## Vue 3 composable

```js
// composables/useHeartbeat.js
import { ref } from 'vue'
import { RoomEvent, ConnectionState } from 'livekit-client'

export function useHeartbeat(room, { onTimeout } = {}) {
  const isReconnecting = ref(false)
  const TIMEOUT_MS = 30_000

  let lastActivityAt = Date.now()
  let timeoutTimer   = null

  function reset() {
    lastActivityAt = Date.now()
    clearTimeout(timeoutTimer)
    timeoutTimer = setTimeout(() => onTimeout?.(), TIMEOUT_MS)
  }

  function start() { reset() }
  function stop()  { clearTimeout(timeoutTimer) }

  room.on(RoomEvent.Reconnecting,  () => { isReconnecting.value = true })
  room.on(RoomEvent.Reconnected,   () => { isReconnecting.value = false; reset() })
  room.on(RoomEvent.Disconnected,  () => { isReconnecting.value = false; stop() })
  room.on(RoomEvent.ConnectionStateChanged, (s) => {
    if (s === ConnectionState.Connected) start()
  })
  room.on(RoomEvent.TranscriptionReceived, reset)
  room.on(RoomEvent.ActiveSpeakersChanged,  reset)
  room.on(RoomEvent.DataReceived,           reset)

  return { isReconnecting }
}
```

```vue
<script setup>
import { useHeartbeat } from './composables/useHeartbeat.js'

const { isReconnecting } = useHeartbeat(room, {
  onTimeout: () => {
    // 30 seconds of silence — end the call
    endSession()
  }
})
</script>

<template>
  <div v-if="isReconnecting" class="reconnect-banner">
    ⚠️ Connection lost — trying to reconnect...
  </div>
</template>
```

---

## Summary

| Scenario | What handles it |
|---|---|
| Short network blip (< 10s) | LiveKit SDK auto-reconnects — no code needed |
| Longer outage | `RoomEvent.Reconnecting` → `Reconnected` / `Disconnected` |
| Frozen connection (no data) | Application heartbeat → force disconnect after 30s |
| Tab close / navigate away | `beforeunload` handler → clean disconnect + session end |
| Server kicks user | `RoomEvent.Disconnected` with reason `PARTICIPANT_REMOVED` |
