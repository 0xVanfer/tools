/**
 * Clipboard composable
 */
import { ref } from 'vue'
import { copyToClipboard } from '@/utils/clipboard.js'

export function useClipboard() {
  const copied = ref(false)
  const copiedText = ref('')
  let resetTimer = null

  async function copy(text, duration = 2000) {
    const success = await copyToClipboard(text)
    if (success) {
      copied.value = true
      copiedText.value = text

      // Clear any pending reset so a second copy gets the full duration instead
      // of being cut short by the previous timer.
      if (resetTimer) clearTimeout(resetTimer)
      resetTimer = setTimeout(() => {
        copied.value = false
        copiedText.value = ''
        resetTimer = null
      }, duration)
    }
    return success
  }

  function dispose() {
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
  }

  return {
    copied,
    copiedText,
    copy,
    dispose,
  }
}

/**
 * Copy button state management for lists
 */
export function useCopyStates() {
  const states = ref({})
  const timers = new Map()

  async function copyItem(key, text, duration = 2000) {
    const success = await copyToClipboard(text)
    if (success) {
      states.value[key] = true
      if (timers.has(key)) clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          states.value[key] = false
          timers.delete(key)
        }, duration),
      )
    }
    return success
  }

  function isCopied(key) {
    return states.value[key] || false
  }

  function dispose() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  }

  return {
    states,
    copyItem,
    isCopied,
    dispose,
  }
}
