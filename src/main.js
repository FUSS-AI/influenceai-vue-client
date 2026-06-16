import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { VoiceSDKPlugin } from '@fuss-ai/voice-sdk'
import { config } from './config.js'

createApp(App)
  .use(VoiceSDKPlugin, { apiBaseUrl: config.apiBaseUrl, apiKey: config.apiKey })
  .mount('#app')
