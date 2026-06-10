<script setup>
import { ref } from 'vue'
import SetupView  from './components/SetupView.vue'
import SessionRoom from './components/SessionRoom.vue'

// Two top-level views: 'setup' → persona selection / session config
//                      'session' → live voice room
const view            = ref('setup')
const connectionDetails = ref(null)   // { session_id, livekit_url, token }
const selectedPersona   = ref(null)   // { name, avatar_url, influencer_id }

function onSessionStart({ session, persona }) {
  connectionDetails.value = session
  selectedPersona.value   = persona
  view.value              = 'session'
}

function onLeave() {
  view.value            = 'setup'
  connectionDetails.value = null
  selectedPersona.value   = null
}
</script>

<template>
  <div class="min-h-screen bg-background text-white">
    <SetupView
      v-if="view === 'setup'"
      @session-start="onSessionStart"
    />
    <SessionRoom
      v-else-if="view === 'session'"
      :connection-details="connectionDetails"
      :persona="selectedPersona"
      @leave="onLeave"
    />
  </div>
</template>
