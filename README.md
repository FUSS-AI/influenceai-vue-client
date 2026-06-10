# InfluenceAI Vue Client

A complete Vue 3 reference client for the InfluenceAI real-time voice platform.

**No React. No adapters.** Uses [`livekit-client`](https://github.com/livekit/client-sdk-js) directly.

---

## Features

- Real-time voice calls with AI characters
- Live transcript (user + agent speech)
- Agent state display (Listening / Thinking / Speaking)
- Echo suppression (prevents STT from transcribing the bot's own voice)
- Backchannel interjections ("hmm", "right") with audio playback
- Recording start/stop
- Session transcript save
- Heartbeat / auto-reconnect on network drop
- Call duration timer

---

## Quick start

```bash
git clone https://github.com/FUSS-AI/influenceai-vue-client.git
cd influenceai-vue-client
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL and VITE_API_KEY
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Configuration

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | InfluenceAI API base URL | `http://localhost:8000/v1` |
| `VITE_API_KEY` | Your platform API key | *(required)* |

---

## Project structure

```
src/
  config.js                  ← environment config
  services/api.js            ← REST client (session CRUD, recording, transcript)
  composables/
    useVoiceSession.js       ← LiveKit room, bot state, audio rendering
    useTranscript.js         ← STT, echo detection, backchannel
    useRecording.js          ← recording start/stop with race guard
  components/
    SetupView.vue            ← persona picker + session creation
    SessionRoom.vue          ← active call UI
  styles/main.css
  main.js
  App.vue
```

---

## Integration docs

Full integration guide for your team: [docs.influenceai.dev](https://docs.influenceai.dev) *(link your Notion page here)*

---

## Requirements

- Node.js 18+
- A running InfluenceAI server (see the server repo for Docker setup)

---

## License

MIT
