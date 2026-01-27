/**
 * Clipboard composable
 */
import { ref } from 'vue'
import { copyToClipboard } from '@/utils/clipboard.js'

export function useClipboard() {
  const copied = ref(false)
  const copiedText = ref('')
  
  async function copy(text, duration = 2000) {
    const success = await copyToClipboard(text)
    if (success) {
      copied.value = true
      copiedText.value = text
      
      setTimeout(() => {
        copied.value = false
        copiedText.value = ''
      }, duration)
    }
    return success
  }
  
  return {
    copied,
    copiedText,
    copy,
  }
}

/**
 * Copy button state management for lists
 */
export function useCopyStates() {
  const states = ref({})
  
  async function copyItem(key, text, duration = 2000) {
    const success = await copyToClipboard(text)
    if (success) {
      states.value[key] = true
      setTimeout(() => {
        states.value[key] = false
      }, duration)
    }
    return success
  }
  
  function isCopied(key) {
    return states.value[key] || false
  }
  
  return {
    states,
    copyItem,
    isCopied,
  }
}
