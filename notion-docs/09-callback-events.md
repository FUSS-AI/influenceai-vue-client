# Callback Events — Complete Reference

This page lists every event we send to your webhook URL, with the exact JSON payload for each.

---

## Event delivery

- Events are delivered via HTTP POST to your `webhook_url`
- Content-Type is always `application/json`
- We expect a `200 OK` response within 5 seconds
- Failed deliveries are retried 3 times with 5s, 15s, 30s delays
- Each request includes `X-Webhook-Signature` for verification (see [Server Callbacks](./06-server-callbacks.md))

---

## Event index

| Event | When it fires |
|---|---|
| `call.connected` | Bot successfully joined the room |
| `call.bot_failed` | Bot failed to start or join |
| `call.disconnected` | User or bot disconnected |
| `call.ended` | Session closed normally |
| `call.ended_abnormally` | Session closed due to error/timeout |
| `call.transcript` | Full conversation sent after call ends |

---

## `call.connected`

Fired when the AI bot has successfully joined the LiveKit room and is ready to talk.

```json
{
  "event":        "call.connected",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "status":       "connected",
  "room_name":    "room_usr123_1749650000",
  "timestamp":    "2026-06-10T12:00:05.123Z",
  "created_at":   "2026-06-10T12:00:00.000Z"
}
```

**Use this to**: Start your call duration tracking, log that a session is active.

---

## `call.bot_failed`

Fired when the bot could not start or failed to join the room within the timeout window.

```json
{
  "event":        "call.bot_failed",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "status":       "failed",
  "error":        "Agent failed to dispatch within 30s timeout",
  "error_code":   "BOT_STARTUP_TIMEOUT",
  "timestamp":    "2026-06-10T12:00:30.000Z"
}
```

`error_code` values:

| Code | Meaning |
|---|---|
| `BOT_STARTUP_TIMEOUT` | Agent didn't join within 30 seconds |
| `BOT_CRASH` | Agent process exited unexpectedly |
| `NO_AGENT_AVAILABLE` | All agent workers are busy |

**Use this to**: Show the user an error, let them retry.

---

## `call.disconnected`

Fired when the user or bot disconnects from the room.

```json
{
  "event":        "call.disconnected",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "status":       "disconnected",
  "disconnected_by": "user",
  "reason":       "user_hangup",
  "duration_ms":  145000,
  "timestamp":    "2026-06-10T12:02:25.000Z"
}
```

`reason` values:

| Reason | Meaning |
|---|---|
| `user_hangup` | User called disconnect intentionally |
| `bot_disconnected` | Bot left the room (bot crash, restart) |
| `timeout` | Heartbeat / inactivity timeout |
| `interrupted` | Session was interrupted via the interrupt API |
| `network_error` | Connection lost and reconnect failed |

---

## `call.ended`

Fired when the session is fully cleaned up after a **normal** call end.

```json
{
  "event":        "call.ended",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "status":       "ended",
  "duration_ms":  145000,
  "turn_count":   12,
  "created_at":   "2026-06-10T12:00:00.000Z",
  "ended_at":     "2026-06-10T12:02:25.000Z"
}
```

**Use this to**: Update your database, charge the user for call time, trigger any post-call workflows.

---

## `call.ended_abnormally`

Fired when the session ends due to an error rather than a normal user hangup.

```json
{
  "event":        "call.ended_abnormally",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "status":       "error",
  "error":        "LiveKit room closed unexpectedly",
  "error_code":   "ROOM_CLOSED_UNEXPECTEDLY",
  "duration_ms":  30000,
  "created_at":   "2026-06-10T12:00:00.000Z",
  "ended_at":     "2026-06-10T12:00:30.000Z"
}
```

---

## `call.transcript`

Fired after `call.ended` or `call.ended_abnormally` — contains the full conversation for memory retrieval.

```json
{
  "event":        "call.transcript",
  "session_id":   "sess_abc123",
  "user_id":      "user_123",
  "character_id": "vlog_star",
  "created_at":   "2026-06-10T12:00:00.000Z",
  "ended_at":     "2026-06-10T12:02:25.000Z",
  "messages": [
    {
      "speaker":   "user",
      "text":      "Hello, how are you?",
      "timestamp": "2026-06-10T12:00:05.000Z"
    },
    {
      "speaker":   "agent",
      "text":      "I'm doing amazing! Ready to chat?",
      "timestamp": "2026-06-10T12:00:08.000Z"
    },
    {
      "speaker":   "user",
      "text":      "Tell me about your latest vlog",
      "timestamp": "2026-06-10T12:00:15.000Z"
    }
  ]
}
```

**Use this to**: Store the conversation in your database for short-term memory, feed into follow-up recommendations, display a call summary to the user.

---

## Event ordering

```
Session created (your POST /v1/sessions)
    │
    │  [bot joining — 3-30 seconds]
    │
    ├─► call.connected       (bot ready)
    │       OR
    ├─► call.bot_failed      (bot failed to start)
    │
    │  [conversation in progress]
    │
    ├─► call.disconnected    (connection dropped)
    │
    │  [cleanup — 1-2 seconds]
    │
    ├─► call.ended           (normal)
    │       OR
    ├─► call.ended_abnormally (error)
    │
    └─► call.transcript      (always last)
```

---

## Quick test with curl

```bash
# Start a session and watch your webhook receive events
curl -X POST http://your-server:8004/client/v1/influencer/session \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_dev_testkey" \
  -H "X-External-User-ID: test_user" \
  -d '{
    "agent_config": { "influencer_id": "vlog_star" },
    "webhook_url": "https://your-backend.com/hooks/voice-events"
  }'
```

> 📸 **Screenshot to add**: Request bin (requestbin.com or webhook.site) showing incoming call.connected event with the full JSON payload highlighted.
