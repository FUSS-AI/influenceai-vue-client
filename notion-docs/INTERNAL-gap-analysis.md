# Gap Analysis — China Team Requirements vs Current Implementation

> **Internal document** — do not share with external teams.
> Based on audit of `soulchat-ai` and `InfluenceAI` codebases, June 2026.
>
> **Policy**: All fixes go in **soulchat-ai backend** (or InfluenceAI backend).
> Do NOT modify any frontend (InfluencerSessionRoom.jsx or soulchat-ai React frontend).
> The Vue reference client (`influenceai-vue-client`) already implements all client-side requirements.

---

## Summary scorecard

| Category | Done | Partial | Missing |
|---|---|---|---|
| Client side (5 items) | 2 | 1 | 2 |
| Server side (3 items) | 0 | 0 | 3 |
| Status codes (6 items) | 1 | 3 | 2 |
| Callback events (6 items) | 1 | 2 | 3 |
| **Total (20 items)** | **4** | **6** | **10** |

---

## Detailed findings

### CLIENT SIDE

> All client-side requirements are satisfied by the **Vue reference client** (`influenceai-vue-client`). External teams implement these in their own frontends using our Vue SDK guide. We do not change the existing soulchat-ai React frontend.

| # | Requirement | Status | How satisfied |
|---|---|---|---|
| 1 | Display states (Connecting, Connected, Thinking, Speaking, Listening) | DONE in Vue client | `useVoiceSession.js` maps `ConnectionState` + `lk.agent.state` to all 5 states. External teams copy `SessionRoom.vue` pattern. |
| 2 | Bot not responding after sensitive words | DONE | Intent classifier blocks `child_abuse` intent (`ws.py:329-339`). Bot returns canned response and returns to listening. Note: `sexual`/`flirty` intents commented out in `classifier.py:44-53` — enable if needed. |
| 3 | Display and record call duration | SERVER-SIDE | Client shows live timer. **Authoritative duration comes from server**: `call.ended` webhook payload includes `duration_ms`, `created_at`, `ended_at`. Backend tracks this automatically — no frontend change needed. |
| 4 | Client heartbeat / auto-reconnect | DONE in Vue client | `useHeartbeat.js` composable: 30s inactivity timeout + reconnect banner. LiveKit SDK handles reconnect natively. External teams copy the composable pattern. |
| 5 | Vue SDK support | DONE | `influenceai-vue-client` repo is the Vue SDK — publicly available on GitHub. |

---

### SERVER SIDE (soulchat-ai backend changes)

| # | Requirement | Status | File to change | Implementation |
|---|---|---|---|---|
| 6 | Callback: client connected to bot | MISSING | `routes/influencer.py` | On agent `ParticipantConnected` LiveKit event: call `services/webhook.py` dispatcher with `call.connected` payload |
| 7 | Callback: client disconnected from bot | MISSING | `routes/influencer.py` | On room `Disconnected` event: dispatch `call.disconnected` with disconnect reason + `duration_ms` |
| 8 | Server-side interrupt API | MISSING | `routes/influencer.py` (new route) + `services/interrupt.py` | `POST /client/v1/influencer/interrupt/{session_id}` → set Redis key `interrupt:{session_id}` → InfluenceAI agent polling loop checks flag and stops streaming |

---

### RESPONSE STATUS CODES (soulchat-ai `main.py` + `routes/`)

| # | Requirement | Status | File to change | Implementation |
|---|---|---|---|---|
| 9 | Invalid request parameters (422) | PARTIAL | `main.py` | Add `@app.exception_handler(RequestValidationError)` with structured `{detail, code: "VALIDATION_ERROR", fields}` response |
| 10 | Token expired / invalid (401) | DONE | `auth/authhelper.py:78-93` | Already raises 401 for expired tokens |
| 11 | Rate limit exceeded (429) | MISSING | `main.py` | Add `slowapi` middleware; decorate session creation + call endpoints |
| 12 | Gateway errors (502/503) | PARTIAL | `routes/influencer.py` | 502 exists; add 503 when InfluenceAI is unreachable |
| 13 | Bot startup errors | PARTIAL | `main.py` | Add `GET /health` endpoint reporting readiness state |
| 14 | Request timeout (408/504) | PARTIAL | `routes/influencer.py` | Wrap `asyncio.TimeoutError` → 504; `httpx.TimeoutException` → 504 |

---

### CALLBACK EVENTS (new `services/webhook.py` in soulchat-ai)

| # | Requirement | Status | Implementation |
|---|---|---|---|
| 15 | Bot connected successfully | MISSING | Dispatch `call.connected` from LiveKit agent join event |
| 16 | Bot connection failed | MISSING | Dispatch `call.bot_failed` from agent dispatch timeout |
| 17 | Call ended normally | PARTIAL | Dispatch `call.ended` with `duration_ms` + timestamps when room closes cleanly |
| 18 | Call ended abnormally | MISSING | Track disconnect reason; dispatch `call.ended_abnormally` on error |
| 19 | Conversation messages after call | DONE | Retrievable via `GET /client/v1/influencer/memory/:persona_id` |
| 20 | Call creation + termination timestamps | PARTIAL | Add `created_at` / `ended_at` to `call.ended` webhook payload (DB already has `created_at`) |

---

## Implementation priorities (recommended order)

### Sprint 1 — Server foundation (2-3 days)
1. Create `services/webhook.py` — reusable async POST dispatcher with retry (3 attempts, exponential backoff)
2. Create `models/events.py` — Pydantic models for all 6 event payloads
3. Wire `call.connected` + `call.bot_failed` from agent join event in `routes/influencer.py`
4. Wire `call.disconnected` + `call.ended` + `call.transcript` on room close

### Sprint 2 — Interrupt API (1 day)
5. Add `POST /client/v1/influencer/interrupt/{session_id}` to `routes/influencer.py`
6. In InfluenceAI agent: poll Redis for `interrupt:{session_id}` key during LLM streaming and abort

### Sprint 3 — Status codes + robustness (1-2 days)
7. Add `RequestValidationError` handler in `main.py` (422)
8. Add `slowapi` rate limiting (429)
9. Map timeout exceptions → 504 in influencer routes
10. Add `GET /health` readiness endpoint

### Sprint 4 — Done (1 day)
11. Screenshots for Notion docs
12. Test all webhook events with webhook.site

---

## Architecture principle

```
External Team  ──►  soulchat-ai (port 8004)  ──►  InfluenceAI (internal)
                    Adds: interrupt API             Existing: sessions,
                          webhook dispatcher        agent dispatch,
                          rate limiting             transcripts
                          structured error codes
```

- External teams have ONE endpoint (soulchat-ai)
- InfluenceAI microservice stays internal — never directly accessible
- Auth, rate limiting, and callbacks all live in soulchat-ai
