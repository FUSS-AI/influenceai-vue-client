# Server Callbacks — Get Notified When Events Happen

When your users connect/disconnect with the AI bot, our server can notify your backend in real time. This page explains how to set up and receive those callbacks.

---

## How it works

```
User connects to bot
        │
        ▼
Our Server  ──── POST ────►  Your Webhook URL
                             {
                               "event": "call.connected",
                               "user_id": "user_123",
                               "character_id": "vlog_star",
                               "session_id": "sess_abc",
                               "status": "connected",
                               "timestamp": "2026-06-10T12:00:00Z"
                             }
```

You give us your webhook URL when creating the session. We call it on every status change.

---

## Step 1 — Register your webhook URL

Add `webhook_url` to the session creation request:

```js
const res = await fetch('http://your-server:8004/client/v1/influencer/session', {
  method: 'POST',
  headers: {
    'Content-Type':       'application/json',
    'X-API-Key':          'sk_dev_testkey',
    'X-External-User-ID': 'user_123',
  },
  body: JSON.stringify({
    agent_config: {
      influencer_id: 'vlog_star',
    },
    webhook_url: 'https://your-backend.com/hooks/voice-events',  // ← add this
  }),
})
```

---

## Step 2 — Receive events on your server

Your endpoint will receive POST requests with a JSON body.

### Node.js / Express example

```js
app.post('/hooks/voice-events', express.json(), (req, res) => {
  const event = req.body

  switch (event.event) {
    case 'call.connected':
      console.log(`User ${event.user_id} connected to bot ${event.character_id}`)
      break

    case 'call.disconnected':
      console.log(`Call ended. Duration: ${event.duration_ms}ms`)
      break

    case 'call.bot_failed':
      console.error(`Bot failed to start for session ${event.session_id}`)
      break

    case 'call.ended':
      console.log(`Normal call end at ${event.timestamp}`)
      break
  }

  res.status(200).json({ received: true })  // ← always respond 200
})
```

### Python / FastAPI example

```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/hooks/voice-events")
async def voice_webhook(request: Request):
    event = await request.json()
    
    if event["event"] == "call.connected":
        print(f"User {event['user_id']} connected")
    elif event["event"] == "call.disconnected":
        print(f"Call ended after {event['duration_ms']}ms")
    
    return {"received": True}
```

> **Important**: Always return HTTP 200. If we get a non-200 response, we will retry up to 3 times with exponential backoff.

---

## All callback events and their payloads

### `call.connected` — Bot successfully connected

```json
{
  "event": "call.connected",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "status": "connected",
  "timestamp": "2026-06-10T12:00:00.000Z",
  "livekit_room": "room_xyz"
}
```

### `call.bot_failed` — Bot failed to join the room

```json
{
  "event": "call.bot_failed",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "status": "failed",
  "error": "Agent failed to dispatch within timeout",
  "timestamp": "2026-06-10T12:00:05.000Z"
}
```

### `call.disconnected` — User or bot disconnected

```json
{
  "event": "call.disconnected",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "status": "disconnected",
  "reason": "user_hangup",
  "duration_ms": 145000,
  "timestamp": "2026-06-10T12:02:25.000Z"
}
```

`reason` values: `user_hangup` | `bot_disconnected` | `timeout` | `error` | `interrupted`

### `call.ended` — Session fully closed (normal)

```json
{
  "event": "call.ended",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "status": "ended",
  "duration_ms": 145000,
  "created_at": "2026-06-10T12:00:00.000Z",
  "ended_at": "2026-06-10T12:02:25.000Z",
  "turn_count": 12
}
```

### `call.ended_abnormally` — Session closed due to error

```json
{
  "event": "call.ended_abnormally",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "status": "error",
  "error": "Network timeout",
  "duration_ms": 30000,
  "ended_at": "2026-06-10T12:00:30.000Z"
}
```

### `call.transcript` — Conversation messages after call ends

```json
{
  "event": "call.transcript",
  "session_id": "sess_abc123",
  "user_id": "user_123",
  "character_id": "vlog_star",
  "messages": [
    { "speaker": "user",  "text": "Hello, how are you?",  "timestamp": "12:00:05" },
    { "speaker": "agent", "text": "I'm doing great! How can I help?", "timestamp": "12:00:08" }
  ],
  "created_at": "2026-06-10T12:00:00.000Z",
  "ended_at": "2026-06-10T12:02:25.000Z"
}
```

> 📸 **Screenshot to add**: Server logs showing incoming POST requests for each event type with the JSON payload pretty-printed.

---

## Testing your webhook locally

Use [ngrok](https://ngrok.com) to expose your local server for testing:

```bash
# Terminal 1 — run your local server
node server.js   # running on port 3000

# Terminal 2 — expose it publicly
ngrok http 3000
# → gives you: https://abc123.ngrok.io

# Now use as webhook URL:
# webhook_url: "https://abc123.ngrok.io/hooks/voice-events"
```

> 📸 **Screenshot to add**: ngrok terminal showing the public URL. Arrow pointing to the URL to use as webhook_url.

---

## Verify webhook authenticity (security)

We sign every webhook request with a `X-Webhook-Signature` header. Verify it to ensure the request is from us:

```js
const crypto = require('crypto')

function verifySignature(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex')
  return `sha256=${expected}` === signature
}

app.post('/hooks/voice-events', (req, res) => {
  const sig = req.headers['x-webhook-signature']
  if (!verifySignature(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  // process event...
})
```
