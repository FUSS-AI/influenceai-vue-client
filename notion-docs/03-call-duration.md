# Call Duration — Display and Record Call Length

Call duration is **tracked on the server** (soulchat-ai records `created_at` and `ended_at` for every session). Your client receives the duration in the `call.ended` webhook payload — you do not need to calculate it yourself.

For displaying a live running timer in your UI while the call is in progress, you start a client-side clock when the LiveKit room connects and stop it on disconnect. The authoritative duration comes from the server.

---

## How it works

```
User clicks Start Call
        │
        ▼
   room.connect()
        │
        ▼
ConnectionState.Connected  ←── START CLIENT TIMER (display only)
        │
        │   (call in progress — timer ticks every second)
        │
        ▼
   room.disconnect()       ←── STOP THE TIMER HERE
        │
        ▼
   Save duration to your backend
```

---

## Plain JavaScript implementation

```js
let callStartTime = null
let timerInterval = null

function startTimer() {
  callStartTime = Date.now()
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - callStartTime
    document.getElementById('call-timer').textContent = formatDuration(elapsed)
  }, 1000)
}

function stopTimer() {
  clearInterval(timerInterval)
  timerInterval = null
  const duration = callStartTime ? Date.now() - callStartTime : 0
  console.log('Call lasted:', formatDuration(duration))
  return duration   // milliseconds — save this to your backend
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  // Output examples: "00:00", "01:23", "12:45"
}

// Hook into room events
room.on(RoomEvent.ConnectionStateChanged, (state) => {
  if (state === ConnectionState.Connected) {
    startTimer()
  }
  if (state === ConnectionState.Disconnected) {
    const durationMs = stopTimer()
    saveCallRecord(sessionId, durationMs)
  }
})
```

---

## Displaying the timer in HTML

```html
<!-- Add this where you want the timer to appear -->
<div id="call-timer-wrapper" style="display: none;">
  <span>🕐 Call duration: </span>
  <span id="call-timer">00:00</span>
</div>
```

```js
// Show when connected, hide when disconnected
room.on(RoomEvent.ConnectionStateChanged, (state) => {
  const wrapper = document.getElementById('call-timer-wrapper')
  wrapper.style.display = (state === ConnectionState.Connected) ? 'block' : 'none'
})
```

> 📸 **Screenshot to add**: Call UI showing "🕐 Call duration: 02:47" in the header or bottom bar.

---

## Vue 3 composable (drop-in)

```js
// composables/useCallTimer.js
import { ref, computed } from 'vue'
import { RoomEvent, ConnectionState } from 'livekit-client'

export function useCallTimer(room) {
  const startTime    = ref(null)
  const elapsedMs    = ref(0)
  let   interval     = null

  const formatted = computed(() => {
    const total = Math.floor(elapsedMs.value / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  const isRunning = computed(() => interval !== null)

  function start() {
    startTime.value = Date.now()
    elapsedMs.value = 0
    interval = setInterval(() => {
      elapsedMs.value = Date.now() - startTime.value
    }, 1000)
  }

  function stop() {
    clearInterval(interval)
    interval = null
    return elapsedMs.value   // total duration in ms
  }

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    if (state === ConnectionState.Connected) start()
    if (state === ConnectionState.Disconnected) stop()
  })

  return { formatted, isRunning, elapsedMs, stop }
}
```

```vue
<!-- In your session component -->
<script setup>
import { useCallTimer } from './composables/useCallTimer.js'
const { formatted, isRunning } = useCallTimer(room)
</script>

<template>
  <div v-if="isRunning" class="call-timer">
    🕐 {{ formatted }}
  </div>
</template>
```

---

## Saving call duration to your backend

After the call ends, send the duration to your own server to log it:

```js
async function saveCallRecord(sessionId, durationMs) {
  await fetch('https://your-server.com/api/call-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      duration_ms: durationMs,
      ended_at: new Date().toISOString(),
    }),
  })
}
```

> **Note**: The platform itself records `created_at` and `ended_at` for each session. You can also retrieve this from the session end callback event (see [Callback Events](./09-callback-events.md)).
