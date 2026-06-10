# Interrupt API — Stop the Bot Mid-Conversation

Sometimes you need to stop the bot from continuing to speak — for example, when a moderator intervenes, or when your app detects the conversation should pause.

---

## How it works

```
Your Server                 Our Server                  AI Bot
    │                           │                          │
    │  POST /client/v1/influencer  │                        │
    │  /interrupt/:session_id      │                        │
    │ ─────────────────────────►│                          │
    │                           │  sends stop signal       │
    │                           │─────────────────────────►│
    │                           │                          │
    │  { "interrupted": true }  │                 Bot stops mid-sentence
    │◄──────────────────────────│                 and waits for user
    │                           │
```

---

## API call

```bash
# Stop the bot for a specific session
curl -X POST http://your-server:8004/client/v1/influencer/interrupt/sess_abc123 \
  -H "X-API-Key: sk_dev_testkey"
```

```js
// JavaScript
await fetch(`http://your-server:8004/client/v1/influencer/interrupt/${sessionId}`, {
  method: 'POST',
  headers: { 'X-API-Key': 'sk_dev_testkey' },
})
```

```python
# Python
import httpx
httpx.post(
    f"http://your-server:8004/client/v1/influencer/interrupt/{session_id}",
    headers={"X-API-Key": "sk_dev_testkey"}
)
```

### Response

```json
// Success
{ "interrupted": true, "session_id": "sess_abc123" }

// Session not found
{ "detail": "Session not found", "status": 404 }

// Session already ended
{ "detail": "Session is not active", "status": 400 }
```

---

## What happens after an interrupt?

After the bot is interrupted:

1. **Bot immediately stops** its current reply mid-sentence
2. **Bot enters listening state** — the user can speak again
3. **Call continues** — this is NOT a disconnect. The conversation resumes normally
4. **User hears silence** — the bot simply stops and waits

To resume normal conversation: the user just speaks. The bot picks up as usual.

To fully end the call after an interrupt:
```js
await fetch(`/v1/sessions/${sessionId}/interrupt`, ...)
// then if you also want to end the call:
await room.disconnect()
await fetch(`/v1/sessions/${sessionId}`, { method: 'DELETE', ... })
```

---

## When to use this

| Use case | Why |
|---|---|
| Moderator button | Admin stops bot if conversation goes off-track |
| Push-to-talk mode | User must hold a button to let bot speak |
| Timed responses | Force bot to stop after N seconds |
| Sensitive content detected | Your system flags content, you stop the bot |

---

## UI example — moderator panel

```html
<button id="interrupt-btn" onclick="interruptBot()">
  ⏹ Stop Bot
</button>
```

```js
async function interruptBot() {
  const btn = document.getElementById('interrupt-btn')
  btn.disabled = true
  btn.textContent = 'Stopping...'

  try {
    await fetch(`/v1/sessions/${sessionId}/interrupt`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
    })
    btn.textContent = '✅ Bot stopped'
  } catch (err) {
    btn.textContent = '❌ Failed'
    console.error(err)
  } finally {
    setTimeout(() => {
      btn.textContent = '⏹ Stop Bot'
      btn.disabled = false
    }, 2000)
  }
}
```

> 📸 **Screenshot to add**: UI panel with a red "Stop Bot" button. Arrow indicating this is a server-side call, not a client disconnect.
