<script setup>
import { ref, computed } from 'vue'
import { Mic, Loader2, AlertTriangle, ChevronRight } from 'lucide-vue-next'
import { api, ApiError } from '@fuss-ai/voice-sdk'
import { config } from '../config.js'

const emit = defineEmits(['session-start'])

// ── Preset personas ────────────────────────────────────────────────────────────
// influencer_id must match a persona defined on the server side.
const PRESETS = [
  { id: 'vlog_star',    name: 'Vlog Star',         tagline: 'Trendy lifestyle creator',   emoji: '⭐' },
  { id: 'fitness_guru', name: 'Fitness Guru',       tagline: 'Health & wellness coach',    emoji: '💪' },
  { id: 'tech_bro',     name: 'Tech Influencer',    tagline: 'Silicon Valley vibes',       emoji: '🚀' },
  { id: 'custom',       name: 'Custom',             tagline: 'Enter your own influencer ID', emoji: '🎛️' },
]

// ── Form state ─────────────────────────────────────────────────────────────────
const selected        = ref(PRESETS[0])
const customId        = ref('')
const userId          = ref('')     // optional — leave blank to auto-generate
const instructionsOverride = ref('')

const isLoading = ref(false)
const formError = ref(null)

const missingKey = computed(() => !config.apiKey)

const effectiveInfluencerId = computed(() =>
  selected.value.id === 'custom' ? customId.value.trim() : selected.value.id
)

const canStart = computed(() =>
  !isLoading.value &&
  !missingKey.value &&
  effectiveInfluencerId.value.length > 0
)

// ── Session creation ───────────────────────────────────────────────────────────

async function startSession() {
  if (!canStart.value) return
  formError.value = null
  isLoading.value = true

  try {
    const finalUserId = userId.value.trim() || `user_${Math.random().toString(36).slice(2, 8)}`
    
    const session = await api.createSession(
      effectiveInfluencerId.value,
      finalUserId,
      {
        instructionsOverride: instructionsOverride.value.trim() || undefined,
      },
    )

    emit('session-start', {
      session,
      persona: {
        name:          selected.value.id === 'custom' ? customId.value.trim() : selected.value.name,
        avatar_url:    null,
        influencer_id: effectiveInfluencerId.value,
      },
    })
  } catch (err) {
    formError.value = err instanceof ApiError
      ? `Server error (${err.status || 'network'}): ${err.message}`
      : err.message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">

    <!-- Background glows -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div class="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px]" />
      <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/8 rounded-full blur-[120px]" />
    </div>

    <div class="relative z-10 w-full max-w-2xl">

      <!-- Header -->
      <div class="mb-10 text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
          <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          InfluenceAI Voice Client
        </div>
        <h1 class="text-3xl font-bold tracking-tight">Choose a Persona</h1>
        <p class="text-white/40 text-sm mt-2">Select an AI influencer to start a live voice session</p>
      </div>

      <!-- Missing API key warning -->
      <div v-if="missingKey" class="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
        <AlertTriangle :size="16" class="flex-shrink-0 mt-0.5" />
        <div>
          <strong>VITE_API_KEY is not set.</strong>
          Copy <code class="bg-white/10 px-1 rounded">.env.example</code> to <code class="bg-white/10 px-1 rounded">.env</code> and fill in your key.
        </div>
      </div>

      <!-- Persona cards -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <button
          v-for="preset in PRESETS"
          :key="preset.id"
          type="button"
          :class="[
            'relative flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            selected.id === preset.id
              ? 'bg-primary/15 border-primary/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]'
              : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15',
          ]"
          @click="selected = preset"
        >
          <span class="text-2xl leading-none">{{ preset.emoji }}</span>
          <div>
            <p class="font-semibold text-sm">{{ preset.name }}</p>
            <p class="text-white/40 text-xs mt-0.5">{{ preset.tagline }}</p>
          </div>
          <!-- Selected indicator -->
          <div
            v-if="selected.id === preset.id"
            class="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary"
          />
        </button>
      </div>

      <!-- Custom influencer ID (shown when Custom is selected) -->
      <div v-if="selected.id === 'custom'" class="mb-4">
        <label class="block text-xs font-medium text-white/50 mb-1.5">Influencer ID</label>
        <input
          v-model="customId"
          type="text"
          placeholder="e.g. vlog_star"
          class="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
        />
      </div>

      <!-- Advanced options (collapsed by default) -->
      <details class="mb-6 group">
        <summary class="cursor-pointer text-xs text-white/30 hover:text-white/60 transition select-none list-none flex items-center gap-1">
          <ChevronRight :size="12" class="transition-transform group-open:rotate-90" />
          Advanced options
        </summary>

        <div class="mt-3 space-y-3">
          <div>
            <label class="block text-xs font-medium text-white/50 mb-1.5">User ID <span class="text-white/25">(optional — blank auto-generates)</span></label>
            <input
              v-model="userId"
              type="text"
              placeholder="user_abc123"
              class="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-white/50 mb-1.5">Instructions override <span class="text-white/25">(optional)</span></label>
            <textarea
              v-model="instructionsOverride"
              rows="3"
              placeholder="Override the persona's system prompt…"
              class="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition resize-none"
            />
          </div>
        </div>
      </details>

      <!-- Error message -->
      <div v-if="formError" class="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
        <AlertTriangle :size="14" class="flex-shrink-0 mt-0.5" />
        {{ formError }}
      </div>

      <!-- Start button -->
      <button
        type="button"
        :disabled="!canStart"
        :class="[
          'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200',
          canStart
            ? 'bg-primary hover:bg-primary/90 text-white shadow-[0_4px_24px_rgba(139,92,246,0.35)] hover:shadow-[0_4px_32px_rgba(139,92,246,0.5)]'
            : 'bg-white/5 text-white/25 cursor-not-allowed',
        ]"
        @click="startSession"
      >
        <Loader2 v-if="isLoading" :size="16" class="animate-spin" />
        <Mic v-else :size="16" />
        {{ isLoading ? 'Creating session…' : 'Start Voice Session' }}
      </button>

    </div>
  </div>
</template>
