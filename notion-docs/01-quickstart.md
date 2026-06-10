# Quick Start — Voice Call in 15 Minutes

By the end of this page your browser will be talking to the AI bot.

> **API gateway**: All API calls go to **soulchat-ai** on port 8004, not InfluenceAI.

---

## Step 1 — Create a session

> **What this does**: Tells the server "start a bot for this user".
> The server returns a LiveKit token your browser uses to join the voice room.

```js
const response = await fetch('http://your-server:8004/client/v1/influencer/session', {
  method: 'POST',
  headers: {
    'Content-Type':       'application/json',
    'X-API-Key':          'sk_dev_testkey',    // ← your API key
    'X-External-User-ID': 'user_123',          // ← your user's ID
  },
  body: JSON.stringify({
    agent_config: {
      influencer_id: 'vlog_star',              // ← which AI character to use
    },
  }),
})

const { session_id, livekit_url, token } = await response.json()
// session_id  → identifies this call (included in webhook callbacks)
// livekit_url → WebSocket address of the voice server
// token       → your browser's pass to join the room (expires in 1 hour)
```

> 📸 **Screenshot to add**: Show the Network tab in DevTools with the POST /session request and the JSON response body containing session_id, livekit_url, token.

---

## Step 2 — Connect to the voice room

```js
import { Room, RoomEvent, Track } from 'livekit-client'

const room = new Room({
  audioCaptureDefaults: {
    echoCancellation: true,   // prevents the bot hearing its own voice
    noiseSuppression: true,
    autoGainControl:  true,
  },
})

// Auto-play the bot's voice
room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === Track.Kind.Audio) {
    const audio = track.attach()
    audio.style.display = 'none'
    document.body.appendChild(audio)
  }
})

await room.connect(livekit_url, token)
await room.localParticipant.setMicrophoneEnabled(true)
```

> 📸 **Screenshot to add**: Browser with mic permission popup appearing. Arrow pointing to "Allow".

---

## Step 3 — Know when you're connected

```js
import { ConnectionState } from 'livekit-client'

room.on(RoomEvent.ConnectionStateChanged, (state) => {
  if (state === ConnectionState.Connected) {
    console.log('✅ Connected! Bot should join in a few seconds.')
  }
})
```

---

## Step 4 — See the conversation

```js
room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
  const who = participant?.isAgent ? '🤖 Bot' : '👤 You'
  for (const seg of segments) {
    if (seg.final) {
      console.log(`${who}: ${seg.text}`)
    }
  }
})
```

---

## Step 5 — End the call

```js
// When the user clicks "Hang up" — just disconnect from the room.
// The session is cleaned up automatically on the server.
await room.disconnect()
```

> **No DELETE call needed.** When the LiveKit room closes, soulchat-ai and InfluenceAI automatically clean up the session and trigger the `call.ended` webhook to your server.

---

## Full working example (copy-paste ready)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Voice Call Test</title>
  <script type="module">
    import { Room, RoomEvent, Track, ConnectionState } from
      'https://cdn.jsdelivr.net/npm/livekit-client@latest/+esm'

    // ← Replace with your soulchat-ai server URL and API key
    const API_BASE    = 'http://localhost:8004/client/v1/influencer'
    const API_KEY     = 'sk_dev_testkey'
    const MY_USER_ID  = 'test_user_001'

    let room, sessionId

    async function startCall() {
      document.getElementById('status').textContent = 'Connecting...'

      const res = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: {
          'Content-Type':       'application/json',
          'X-API-Key':          API_KEY,
          'X-External-User-ID': MY_USER_ID,
        },
        body: JSON.stringify({ agent_config: { influencer_id: 'vlog_star' } }),
      })
      const { session_id, livekit_url, token } = await res.json()
      sessionId = session_id

      room = new Room({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true } })

      room.on(RoomEvent.ConnectionStateChanged, s => {
        document.getElementById('status').textContent = s
      })

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.style.display = 'none'
          document.body.appendChild(el)
        }
      })

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const who = participant?.isAgent ? '🤖' : '👤'
        segments.filter(s => s.final).forEach(s => {
          document.getElementById('transcript').innerHTML += `<p>${who} ${s.text}</p>`
        })
      })

      await room.connect(livekit_url, token)
      await room.localParticipant.setMicrophoneEnabled(true)
      document.getElementById('start').disabled = true
      document.getElementById('end').disabled = false
    }

    async function endCall() {
      await room.disconnect()  // session auto-cleans up on the server
      document.getElementById('status').textContent = 'Disconnected'
      document.getElementById('start').disabled = false
      document.getElementById('end').disabled = true
    }

    window.startCall = startCall
    window.endCall   = endCall
  </script>
</head>
<body>
  <h2>Status: <span id="status">idle</span></h2>
  <button id="start" onclick="startCall()">Start Call</button>
  <button id="end"   onclick="endCall()" disabled>End Call</button>
  <div id="transcript"></div>
</body>
</html>
```

> 📸 **Screenshot to add**: The HTML page open in browser. Status showing "connected". Transcript showing bot greeting text.

---

## What you should see

| Time | What happens |
|---|---|
| 0s | Button clicked → status shows `connecting` |
| 1–2s | Status changes to `connected` |
| 3–5s | Bot joins the room |
| 5s | Bot says hello — transcript shows bot text |
| Any time | You speak — transcript shows your text |
| Hang up | `room.disconnect()` → server sends `call.ended` webhook to you |
