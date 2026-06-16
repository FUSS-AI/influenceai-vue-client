<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  ArrowLeft,
  MessageSquare,
  Mic, MicOff,
  Download,
  CircleDot, Square,
  X,
  Loader2,
  AlertTriangle,
  PhoneOff,
} from 'lucide-vue-next'

import { useVoiceSession, useRecording, api } from '@fuss-ai/voice-sdk'
import { config }          from '../config.js'

// ── Props / emits ──────────────────────────────────────────────────────────────

const props = defineProps({
  /** { session_id, livekit_url, token } */
  connectionDetails: { type: Object, required: true },
  /** { name, avatar_url, influencer_id } */
  persona:           { type: Object, required: true },
})
const emit = defineEmits(['leave'])

// ── Composables ────────────────────────────────────────────────────────────────

const {
  room,
  connectionState,
  agentState,
  isMuted,
  error: connectionError,
  duration,
  transcript,
  clearTranscript,
  finalMessages,
  connect,
  disconnect,
  mute,
  unmute,
  interrupt
} = useVoiceSession()

const scrollRef = ref(null)

import { watch, nextTick } from 'vue'
watch(transcript, async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}, { deep: true })

const sessionId = computed(() => props.connectionDetails.session_id)
const {
  isRecording,
  recordingUrls,
  recordingError,
  isBusy: recordBusy,
  toggleRecording,
} = useRecording(sessionId)

// ── Local state ────────────────────────────────────────────────────────────────

const isSaving  = ref(false)
const saveError = ref(null)
const isLeaving = ref(false)

// ── Connect on mount ───────────────────────────────────────────────────────────

onMounted(() => {
  connect(
    props.connectionDetails.livekit_url,
    props.connectionDetails.token,
  ).catch(() => { /* error surfaced via connectionError ref */ })
})

// ── State display helpers ──────────────────────────────────────────────────────

const STATE_LABELS = {
  connecting:   { text: 'Connecting…',   color: 'text-yellow-400', dot: 'bg-yellow-400' },
  reconnecting: { text: 'Reconnecting…', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  failed:       { text: 'Failed',        color: 'text-red-400',    dot: 'bg-red-400'    },
  listening:    { text: 'Listening',     color: 'text-green-400',  dot: 'bg-green-400'  },
  speaking:     { text: 'Speaking',      color: 'text-violet-400', dot: 'bg-violet-400' },
  thinking:     { text: 'Thinking…',     color: 'text-blue-400',   dot: 'bg-blue-400'   },
  blocked:      { text: 'Blocked',       color: 'text-red-500',    dot: 'bg-red-500'    },
  connected:    { text: 'Connected',     color: 'text-white/50',   dot: 'bg-white/30'   },
  idle:         { text: 'Connected',     color: 'text-white/50',   dot: 'bg-white/30'   },
}

const displayState = computed(() => {
  if (['connecting', 'reconnecting', 'failed'].includes(connectionState.value)) {
    return connectionState.value
  }
  return agentState.value || 'connected'
})

const stateInfo   = computed(() => STATE_LABELS[displayState.value] ?? STATE_LABELS.connected)
const isSpeaking  = computed(() => agentState.value === 'speaking')
const isListening = computed(() => agentState.value === 'listening')
const isThinking  = computed(() => agentState.value === 'thinking')

// ── Avatar URL ─────────────────────────────────────────────────────────────────

const avatarSrc = computed(() => {
  const url = props.persona.avatar_url
  if (!url) return null
  if (/^(https?:|blob:|data:)/.test(url)) return url
  // Relative path — resolve against soulchat-ai origin (strip everything after port)
  try { return `${new URL(config.apiBaseUrl).origin}${url}` } catch { return url }
})

// ── Transcript bubble helpers ──────────────────────────────────────────────────

function bubbleClasses(msg) {
  const base = 'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed'
  const opacity = msg.final ? 'opacity-100' : 'opacity-60'
  if (msg.speaker === 'user') {
    return `${base} ${opacity} rounded-br-sm bg-secondary/10 border border-secondary/20 text-secondary/90`
  }
  if (msg.isBackchannel) {
    return `${base} ${opacity} rounded-bl-sm bg-primary/5 border border-primary/10 text-white/50 italic animate-pop-in`
  }
  return `${base} ${opacity} rounded-bl-sm bg-primary/10 border border-primary/20 text-white/90`
}

// ── Actions ────────────────────────────────────────────────────────────────────

async function saveTranscript() {
  isSaving.value  = true
  saveError.value = null
  try {
    const messages = finalMessages()
    if (!messages.length) { saveError.value = 'No finalised messages to save yet.'; return }
    await api.saveTranscript(sessionId.value, messages)
  } catch (err) {
    saveError.value = err.message
  } finally {
    isSaving.value = false
  }
}

async function handleLeave() {
  if (isLeaving.value) return
  isLeaving.value = true
  try {
    await disconnect()
    await api.endSession(sessionId.value)
  } catch { /* best-effort */ } finally {
    isLeaving.value = false
    emit('leave')
  }
}
</script>

<template>
  <div class="h-screen bg-background text-white flex flex-col relative overflow-hidden">

    <!-- Ambient glows -->
    <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px]" />
      <div class="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px]" />
    </div>

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] backdrop-blur-sm flex-shrink-0">
      <button
        type="button"
        :disabled="isLeaving"
        class="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm disabled:opacity-40"
        @click="handleLeave"
      >
        <ArrowLeft :size="16" />
        End Session
      </button>

      <div class="flex flex-col items-center">
        <h2 class="text-base font-semibold">{{ persona.name }}</h2>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span class="text-xs text-white/40">{{ duration }}</span>
        </div>
      </div>

      <div class="w-24 flex justify-end">
        <Loader2 v-if="isLeaving" :size="16" class="animate-spin text-white/30" />
      </div>
    </header>

    <!-- Connection error banner -->
    <div
      v-if="connectionError"
      class="relative z-10 flex items-center gap-2 px-6 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-300 text-sm flex-shrink-0"
    >
      <AlertTriangle :size="14" class="flex-shrink-0" />
      {{ connectionError }}
    </div>

    <!-- ── Body split ─────────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">

      <!-- ── LEFT: Avatar + Controls ────────────────────────────────────── -->
      <div class="flex flex-col items-center justify-center gap-6 p-8 md:w-[400px] flex-shrink-0 border-r border-white/5">

        <!-- Avatar with animated rings -->
        <div class="relative">

          <div
            :class="[
              'absolute inset-0 rounded-full transition-all duration-700',
              isSpeaking ? 'shadow-[0_0_60px_20px_rgba(139,92,246,0.4)] scale-110' : 'shadow-none scale-100',
            ]"
          />

          <template v-if="isSpeaking">
            <div class="absolute -inset-4 rounded-full border border-primary/20 animate-ping" style="animation-duration:1.5s" />
            <div class="absolute -inset-8 rounded-full border border-primary/10 animate-ping" style="animation-duration:2s" />
          </template>
          <template v-if="isListening">
            <div class="absolute -inset-3 rounded-full border border-secondary/30 animate-ping" style="animation-duration:1.8s" />
          </template>

          <div class="relative w-48 h-48 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl bg-white/5 flex items-center justify-center">
            <img v-if="avatarSrc" :src="avatarSrc" :alt="persona.name" class="w-full h-full object-cover" />
            <span v-else class="text-6xl select-none">🤖</span>
            <div v-if="isSpeaking" class="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent animate-pulse" />
          </div>

          <!-- State badge -->
          <div :class="['absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-xs font-medium whitespace-nowrap', stateInfo.color]">
            <span :class="['w-1.5 h-1.5 rounded-full animate-pulse', stateInfo.dot]" />
            {{ stateInfo.text }}
          </div>
        </div>

        <!-- Name -->
        <div class="text-center mt-2">
          <h3 class="text-xl font-bold">{{ persona.name }}</h3>
          <p class="text-white/40 text-sm mt-1">AI Voice Agent</p>
        </div>

        <!-- Controls: mic + end call + interrupt -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            :title="isMuted ? 'Unmute' : 'Mute'"
            :class="[
              'w-12 h-12 rounded-full flex items-center justify-center border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              !isMuted
                ? 'bg-primary/20 border-primary/40 hover:bg-primary/30 text-primary'
                : 'bg-white/5 border-white/15 hover:bg-white/10 text-white/50',
            ]"
            @click="isMuted ? unmute() : mute()"
          >
            <Mic v-if="!isMuted" :size="18" />
            <MicOff v-else :size="18" />
          </button>

          <button
            v-if="isSpeaking || isThinking"
            type="button"
            title="Interrupt AI"
            class="w-12 h-12 rounded-full flex items-center justify-center border bg-orange-500/15 border-orange-500/30 hover:bg-orange-500/25 text-orange-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 animate-fade-in"
            @click="interrupt"
          >
            <Square :size="16" class="fill-current" />
          </button>

          <button
            type="button"
            title="End session"
            :disabled="isLeaving"
            class="w-12 h-12 rounded-full flex items-center justify-center border bg-red-500/15 border-red-500/30 hover:bg-red-500/25 text-red-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
            @click="handleLeave"
          >
            <PhoneOff :size="18" />
          </button>
        </div>

        <!-- Recording error / download links -->
        <p v-if="recordingError" class="text-red-300 text-xs text-center max-w-[240px]">{{ recordingError }}</p>

        <div v-if="recordingUrls.length" class="flex flex-col gap-1.5 w-full max-w-[240px]">
          <a
            v-for="url in recordingUrls"
            :key="url"
            :href="url"
            download
            class="flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary underline-offset-2 hover:underline"
          >
            <Download :size="12" />
            {{ url.split('/').pop() || 'Download recording' }}
          </a>
        </div>

      </div>

      <!-- ── RIGHT: Transcript ───────────────────────────────────────────── -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">

        <!-- Transcript toolbar -->
        <div class="flex items-center gap-2 px-6 py-4 border-b border-white/5 flex-shrink-0">
          <MessageSquare :size="15" class="text-primary/70 flex-shrink-0" />
          <h3 class="text-sm font-semibold text-white/70">Live Transcript</h3>

          <div class="ml-auto flex items-center gap-2 flex-wrap justify-end">

            <button
              v-if="transcript.length > 0"
              type="button"
              :disabled="isSaving"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors focus:outline-none',
                isSaving
                  ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white',
              ]"
              @click="saveTranscript"
            >
              <Loader2 v-if="isSaving" :size="12" class="animate-spin" />
              <Download v-else :size="12" />
              {{ isSaving ? 'Saving…' : 'Save' }}
            </button>

            <button
              type="button"
              :disabled="recordBusy"
              :class="[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors focus:outline-none',
                isRecording
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white',
                recordBusy ? 'opacity-50 cursor-not-allowed' : '',
              ]"
              @click="toggleRecording"
            >
              <Square    v-if="isRecording" :size="12" class="fill-current" />
              <CircleDot v-else             :size="12" class="text-red-400" />
              {{ isRecording ? 'Stop Rec' : 'Record' }}
            </button>

            <button
              v-if="transcript.length > 0"
              type="button"
              class="flex items-center gap-1 text-white/25 hover:text-white/60 text-xs transition-colors"
              @click="clearTranscript"
            >
              <X :size="11" /> Clear
            </button>

          </div>
        </div>

        <!-- Save error -->
        <div
          v-if="saveError"
          class="flex items-center gap-2 px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-300 text-xs flex-shrink-0"
        >
          <AlertTriangle :size="12" />{{ saveError }}
        </div>

        <!-- Message list -->
        <div ref="scrollRef" class="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">

          <!-- Empty state -->
          <div v-if="transcript.length === 0" class="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
            <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <Mic :size="24" class="text-white/20" />
            </div>
            <div>
              <p class="text-white/30 text-sm font-medium">Conversation will appear here</p>
              <p class="text-white/20 text-xs mt-1">Start speaking to see live transcripts</p>
            </div>
          </div>

          <!-- ── Transcript message (inlined to avoid sub-component registration) ── -->
          <div
            v-for="msg in transcript"
            :key="msg.id"
            :class="['flex items-end gap-3', msg.speaker === 'user' ? 'flex-row-reverse' : 'flex-row']"
          >
            <!-- Speaker icon -->
            <div :class="[
              'w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center',
              msg.speaker === 'user'
                ? 'border-secondary/30 bg-secondary/10'
                : 'border-primary/30 bg-primary/10',
            ]">
              <template v-if="msg.speaker === 'user'">
                <Mic :size="13" class="text-secondary/70" />
              </template>
              <template v-else>
                <img v-if="avatarSrc" :src="avatarSrc" :alt="persona.name" class="w-full h-full object-cover" />
                <span v-else class="text-xs">🤖</span>
              </template>
            </div>

            <!-- Bubble -->
            <div :class="bubbleClasses(msg)">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="text-[10px] uppercase tracking-wider font-semibold opacity-50">
                  {{ msg.speaker === 'user' ? 'You' : persona.name }}
                </span>
                <span v-if="msg.timestamp" class="text-[10px] opacity-40">{{ msg.timestamp }}</span>
              </div>
              <div>
                {{ msg.text }}
                <span v-if="!msg.final" class="animate-pulse ml-0.5">▌</span>
              </div>
            </div>
          </div>

          <!-- Typing indicator when thinking / speaking -->
          <div v-if="isThinking || isSpeaking" class="flex items-end gap-3">
            <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
              <img v-if="avatarSrc" :src="avatarSrc" :alt="persona.name" class="w-full h-full object-cover" />
              <span v-else class="text-base">🤖</span>
            </div>
            <div class="px-4 py-3 rounded-2xl rounded-bl-sm bg-primary/10 border border-primary/20 max-w-xs">
              <div class="flex gap-1 items-center h-4">
                <span class="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style="animation-delay:0ms" />
                <span class="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style="animation-delay:150ms" />
                <span class="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style="animation-delay:300ms" />
              </div>
            </div>
          </div>

        </div>

        <!-- Footer status bar -->
        <div class="px-6 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between flex-shrink-0">
          <span class="text-xs text-white/30">
            {{ transcript.length }} message{{ transcript.length !== 1 ? 's' : '' }}
          </span>
          <span :class="['text-xs font-medium flex items-center gap-1.5', stateInfo.color]">
            <span :class="['w-1.5 h-1.5 rounded-full animate-pulse', stateInfo.dot]" />
            {{ stateInfo.text }}
          </span>
        </div>

      </div>
    </div>
  </div>
</template>
