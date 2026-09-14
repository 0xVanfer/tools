/**
 * Storage composable - reactive localStorage
 *
 * Refs are shared per storage key so that every component using the same key
 * observes the same value (previously each call created an isolated ref that was
 * only hydrated once, so writers and readers could silently diverge).
 */
import { ref, watch } from 'vue'
import { getItem, setItem, removeItem } from '@/utils/storage.js'

const storageRefs = new Map()

function getEntry(key, defaultValue) {
  let entry = storageRefs.get(key)
  if (entry) return entry

  const data = ref(getItem(key, defaultValue))

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

  entry = { data }
  storageRefs.set(key, entry)
  return entry
}

export function useStorage(key, defaultValue = null) {
  const entry = getEntry(key, defaultValue)
  const { data } = entry

  function reset() {
    // Persist deterministically instead of relying on watcher ordering, which
    // used to re-write the default right after `removeItem`.
    data.value = defaultValue
    if (defaultValue === null || defaultValue === undefined) {
      removeItem(key)
    } else {
      setItem(key, defaultValue)
    }
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
