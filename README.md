# InfluenceAI Vue Client

This repository serves as a **reference implementation** demonstrating how to build a stunning, real-time Voice AI frontend using the official `@fuss-ai/voice-sdk`. 

The goal of this repository is to show how easily external teams can drop the SDK into their own projects and build custom UIs on top of it.

---

## 🚀 Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/FUSS-AI/influenceai-vue-client.git
   cd influenceai-vue-client
   ```

2. **Configure your environment:**
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` and insert your `VITE_API_BASE_URL` and `VITE_API_KEY`.*

3. **Install and Run:**
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

## 🛠 How it uses the SDK

Unlike older versions of this client that handled complex WebRTC logic manually, this application delegates all heavy lifting to the `@fuss-ai/voice-sdk`.

Here is a breakdown of how the SDK powers the components in this repository:

### 1. Initialization (`src/main.js`)
The SDK is initialized globally using the `VoiceSDKPlugin`. This automatically configures the REST API helpers with your credentials:
```javascript
import { VoiceSDKPlugin } from '@fuss-ai/voice-sdk'
import { config } from './config.js'

app.use(VoiceSDKPlugin, { 
  apiBaseUrl: config.apiBaseUrl, 
  apiKey: config.apiKey 
})
```

### 2. Creating a Session (`src/components/SetupView.vue`)
To create a voice session, the client imports the `api` object directly from the SDK. It passes the `influencer_id` and an optional `instructionsOverride`. 
```javascript
import { api } from '@fuss-ai/voice-sdk'

// The SDK handles the REST call and returns the LiveKit connection details
const session = await api.createSession('vlog_star', 'user_123');
```
*Note: You can also pass `initial_audio_text` in the metadata here if you want the agent to auto-play a specific greeting!*

### 3. Managing the Call (`src/components/SessionRoom.vue`)
The actual voice room UI is entirely powered by the `useVoiceSession` composable. It effortlessly extracts reactive states and control functions:
```javascript
import { useVoiceSession } from '@fuss-ai/voice-sdk'

const {
  connectionState, // 'connecting', 'connected', 'failed'
  agentState,      // 'listening', 'thinking', 'speaking', 'blocked'
  transcript,      // Real-time chat bubbles
  mute, unmute,    // Microphone controls
  interrupt,       // Instantly halt the AI's current generation
  connect,         
  disconnect
} = useVoiceSession()
```

### 4. Call Recording (`src/components/SessionRoom.vue`)
Recording is decoupled into its own composable, `useRecording`. The client calls `toggleRecording()` to start/stop, and the SDK automatically polls the backend until the MP4 download links (`recordingUrls`) are ready:
```javascript
import { useRecording } from '@fuss-ai/voice-sdk'

const { isRecording, recordingUrls, toggleRecording } = useRecording(sessionId)
```

### 5. Saving Transcripts
When the call ends, the client extracts the finalized conversation log (ignoring partial, real-time chunks) and saves it via the SDK's API:
```javascript
import { useVoiceSession, api } from '@fuss-ai/voice-sdk'

const { finalMessages } = useVoiceSession()

// Save to backend
await api.saveTranscript(sessionId.value, finalMessages())
```

---

## 🎨 UI & UX Features Demonstrated

- **Dynamic Agent States**: The UI reacts instantly to `agentState`, showing smooth animations for "Thinking" and glowing rings when "Speaking".
- **Sensitive Word Blocking**: If the AI hits a sensitive topic, `agentState` becomes `blocked`, and the UI instantly turns red to warn the user.
- **Manual Interruptions**: Includes a Stop/Square button bound to the SDK's `interrupt()` method to manually halt the AI.
- **Auto-Scrolling Chat**: Uses the SDK's `transcript` array to build real-time, animated chat bubbles exactly like a standard messaging app.

## License
MIT
