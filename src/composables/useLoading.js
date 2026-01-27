/**
 * Loading state composable
 */
import { ref, computed } from 'vue'

export function useLoading(initialState = false) {
  const loading = ref(initialState)
  const error = ref(null)
  
  function start() {
    loading.value = true
    error.value = null
  }
  
  function stop() {
    loading.value = false
  }
  
  function setError(err) {
    loading.value = false
    error.value = typeof err === 'string' ? err : err?.message || 'An error occurred'
  }
  
  function reset() {
    loading.value = false
    error.value = null
  }
  
  async function wrap(fn) {
    start()
    try {
      const result = await fn()
      stop()
      return result
    } catch (err) {
      setError(err)
      throw err
    }
  }
  
  // Alias wrap as withLoading for compatibility
  const withLoading = wrap
  
  return {
    loading,
    error,
    start,
    stop,
    setError,
    reset,
    wrap,
    withLoading,
  }
}

/**
 * Multiple loading states management
 */
export function useLoadingStates() {
  const states = ref({})
  
  function isLoading(key) {
    return states.value[key] || false
  }
  
  function start(key) {
    states.value[key] = true
  }
  
  function stop(key) {
    states.value[key] = false
  }
  
  const anyLoading = computed(() => Object.values(states.value).some(Boolean))
  
  return {
    states,
    isLoading,
    start,
    stop,
    anyLoading,
  }
}
