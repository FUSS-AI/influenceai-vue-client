import { ref, computed } from 'vue'
import { api } from '../services/api.js'

/**
 * Session recording composable.
 *
 * Wraps start / stop recording API calls and exposes reactive state.
 * Recording happens server-side (the Python agent captures raw PCM);
 * on stop, the server returns download URLs for user and agent audio.
 *
 * Usage:
 *   const { isRecording, recordingUrls, recordingError, toggleRecording } = useRecording(sessionId)
 *
 * @param {import('vue').Ref<string>} sessionId  - Reactive ref to the current session_id.
 */
export function useRecording(sessionId) {
  const isRecording    = ref(false)
  const recordingUrls  = ref([])      // string[] — populated after stop
  const recordingError = ref(null)    // string | null
  const isBusy         = ref(false)   // prevents double-click races

  const canToggle = computed(() => !!sessionId.value && !isBusy.value)

  async function startRecording() {
    if (!canToggle.value) return
    isBusy.value        = true
    recordingError.value = null
    try {
      await api.startRecording(sessionId.value)
      isRecording.value   = true
      recordingUrls.value = []
    } catch (err) {
      recordingError.value = err.message
    } finally {
      isBusy.value = false
    }
  }

  async function stopRecording() {
    if (!canToggle.value) return
    isBusy.value        = true
    recordingError.value = null
    try {
      const data = await api.stopRecording(sessionId.value)
      isRecording.value   = false
      recordingUrls.value = data?.urls ?? []
    } catch (err) {
      recordingError.value = err.message
      // Assume stopped even on network error so the UI doesn't get stuck
      isRecording.value = false
    } finally {
      isBusy.value = false
    }
  }

  async function toggleRecording() {
    if (isRecording.value) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }

  return {
    isRecording,
    recordingUrls,
    recordingError,
    isBusy,
    toggleRecording,
  }
}
