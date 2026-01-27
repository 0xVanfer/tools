/**
 * Storage composable - reactive localStorage
 */
import { ref, watch } from 'vue'
import { getItem, setItem, removeItem } from '@/utils/storage.js'

export function useStorage(key, defaultValue = null) {
  const data = ref(getItem(key, defaultValue))
  
  // Watch for changes and persist
  watch(
    data,
    (newValue) => {
      if (newValue === null || newValue === undefined) {
        removeItem(key)
      } else {
        setItem(key, newValue)
      }
    },
    { deep: true }
  )
  
  function reset() {
    data.value = defaultValue
    removeItem(key)
  }
  
  return {
    data,
    reset,
  }
}

/**
 * History management with storage
 */
export function useHistory(key, maxItems = 50) {
  const { data: history } = useStorage(key, [])
  
  function add(item) {
    // Remove duplicate if exists
    const index = history.value.findIndex(h => 
      JSON.stringify(h) === JSON.stringify(item)
    )
    if (index !== -1) {
      history.value.splice(index, 1)
    }
    
    // Add to front
    history.value.unshift(item)
    
    // Trim to max
    if (history.value.length > maxItems) {
      history.value = history.value.slice(0, maxItems)
    }
  }
  
  function remove(index) {
    history.value.splice(index, 1)
  }
  
  function clear() {
    history.value = []
  }
  
  return {
    history,
    add,
    remove,
    clear,
  }
}
