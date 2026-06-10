# Go-Live Checklist

Run through this before sending the integration to production.

---

## Client side

- [ ] **API key** — replace `sk_dev_testkey` with your production key. Never expose it in client-side code — proxy through your backend.
- [ ] **API base URL** — set `VITE_API_BASE_URL` to your production server URL (`https://` not `http://`)
- [ ] **HTTPS** — all API calls and the LiveKit WebSocket must use HTTPS / WSS in production
- [ ] **Display states** — test all 5 states (Connecting, Connected, Listening, Thinking, Speaking) are visually distinct
- [ ] **Call timer** — verify timer starts on connect and stops on disconnect
- [ ] **Heartbeat** — test by disabling wifi for 5 seconds — banner should appear and recover
- [ ] **Disconnect cleanup** — confirm audio elements are removed from DOM after call ends
- [ ] **beforeunload** — close the tab mid-call and check session ends cleanly on the server
- [ ] **Mic permission** — test the flow when user clicks "Block" on mic prompt (show a helpful message)
- [ ] **Safari** — test audio autoplay (Safari requires a user gesture before Audio.play() works)

---

## Server side

- [ ] **Webhook URL** — confirm your webhook endpoint is reachable from the internet (not localhost)
- [ ] **Webhook signature** — verify `X-Webhook-Signature` on every incoming webhook
- [ ] **Event handling** — test each event type (`call.connected`, `call.ended`, `call.transcript`) is received and processed
- [ ] **Idempotency** — handle duplicate webhook deliveries gracefully (we retry on failure)
- [ ] **Interrupt API** — test that POST /interrupt actually stops the bot mid-sentence
- [ ] **Error handling** — test your app's behaviour for 401, 429, 503 responses

---

## Infrastructure (if self-hosting)

- [ ] **livekit.yaml** — set `use_external_ip: true` on cloud servers; `node_ip` to your server's public IP
- [ ] **UDP ports open** — 50000-60000/UDP must be open in your firewall for WebRTC media
- [ ] **TCP 7881 open** — for clients behind VPNs/firewalls that block UDP
- [ ] **TURN server** — configure TURN/TLS (port 5349) for clients on strict corporate networks
- [ ] **SSL certificate** — LiveKit must be behind a domain with a valid SSL cert for WSS to work
- [ ] **Redis** — use Redis in production (not in-memory) for multi-agent dispatch
- [ ] **Port range** — expand `port_range_end` to 60000 for production concurrent users

---

## Testing checklist before handoff

| Test | Pass |
|---|---|
| Create session returns session_id, livekit_url, token | ☐ |
| Browser connects and bot joins within 10s | ☐ |
| Bot state changes show correctly in UI | ☐ |
| User speech appears in transcript | ☐ |
| Bot speech appears in transcript | ☐ |
| Call timer runs and shows correct format | ☐ |
| Mute button toggles mic | ☐ |
| Disconnect button ends call cleanly | ☐ |
| Webhook receives `call.connected` event | ☐ |
| Webhook receives `call.ended` + `call.transcript` | ☐ |
| Interrupt API stops bot mid-speech | ☐ |
| Tab close ends the session on the server | ☐ |
| Network drop → reconnect banner → recovery | ☐ |
| 401 error shows clear message to user | ☐ |

---

## Contacts

| Issue | Contact |
|---|---|
| API key / access | Your integration contact |
| Bug reports | GitHub Issues on the reference repo |
| Production support | Contact provided separately |
