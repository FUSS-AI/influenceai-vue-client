# InfluenceAI Voice Platform — Integration Guide

> This guide walks you through everything you need to add real-time AI voice calls to your web application.
> No prior WebRTC experience needed. Follow the steps in order.

---

## What does this platform do?

Think of it like a **phone call with an AI character**.

```
Your App  ──────────►  soulchat-ai API  ──────────►  AI Bot
         creates session               spins up bot

Your App  ◄──────────  LiveKit Room
         voice conversation starts
```

1. Your app calls the **soulchat-ai API** to create a session
2. soulchat-ai internally starts the AI bot and gives you a **LiveKit room token**
3. Your app uses that token to **join the voice room directly via WebRTC**
4. The AI bot and your user talk in **real time**
5. When done, your app disconnects from the room — session cleanup is automatic

> **Important**: You communicate with **soulchat-ai**, not InfluenceAI directly.
> InfluenceAI is the internal AI engine. It is not accessible from outside.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        YOUR APP                             │
│                                                             │
│   Vue / React / Plain JS   +   livekit-client npm package   │
└────────────────────────┬────────────────────────────────────┘
                         │  REST API calls
                         │  Headers: X-API-Key  +  X-External-User-ID
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              SOULCHAT-AI  (your contact point)              │
│              Base URL: http://your-server:8004              │
│                                                             │
│  POST /client/v1/influencer/session     ← start a call      │
│  GET  /client/v1/influencer/list        ← list characters   │
│  GET  /client/v1/influencer/memory/:id  ← past conversations│
│  POST /client/v1/influencer/interrupt/:id ← stop bot        │
│  Webhook callbacks → your server        ← call events       │
└────────────────────────┬────────────────────────────────────┘
                         │  internal — not accessible externally
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            INFLUENCEAI MICROSERVICE  (internal)             │
│                                                             │
│   Session management · Agent dispatch · Transcription       │
└────────────────────────┬────────────────────────────────────┘
                         │  WebRTC media
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               LIVEKIT MEDIA SERVER                          │
│                                                             │
│   Real-time audio routing + transcription + agent voice     │
└─────────────────────────────────────────────────────────────┘
```

---

## What's in this guide

| # | Page | What you'll learn |
|---|---|---|
| 1 | [Quick Start](./01-quickstart.md) | Working voice call in 15 minutes |
| 2 | [Display States](./02-display-states.md) | Show Connecting / Thinking / Speaking / Listening |
| 3 | [Call Duration & Timer](./03-call-duration.md) | Display call length returned from server |
| 4 | [Heartbeat & Reconnect](./04-heartbeat-reconnect.md) | Auto-reconnect on network drop |
| 5 | [Vue SDK Integration](./05-vue-sdk.md) | Full Vue 3 composables ready to copy |
| 6 | [Server Callbacks](./06-server-callbacks.md) | Get notified when bot connects/disconnects |
| 7 | [Interrupt API](./07-interrupt-api.md) | Stop the bot mid-sentence from your server |
| 8 | [Status Codes](./08-status-codes.md) | Every error code and what it means |
| 9 | [Callback Events](./09-callback-events.md) | Full list of webhook event payloads |
| 10 | [Go-Live Checklist](./10-go-live-checklist.md) | Production readiness checklist |

---

## Before you start

You need:

- [ ] An **API key** — ask your integration contact (`sk_dev_testkey` works for local testing)
- [ ] Node.js 18+ installed
- [ ] soulchat-ai server running at `http://your-server:8004` (URL provided by us)

Install the only npm package you need:

```bash
npm install livekit-client
```

> **Note**: Do NOT install `@livekit/components-react`. That is a React adapter and is not needed.
