/**
 * Storage utilities - localStorage wrapper with namespacing
 */

const STORAGE_PREFIX = 'eth-dev-tools:'

/**
 * Get item from storage
 */
export function getItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + key)
    if (value === null) return defaultValue
    return JSON.parse(value)
  } catch {
    return defaultValue
  }
}

/**
 * Set item in storage
 */
export function setItem(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Remove item from storage
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key)
    return true
  } catch {
    return false
  }
}

/**
 * Clear all items with prefix
 */
export function clearAll() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
    keys.forEach(k => localStorage.removeItem(k))
    return true
  } catch {
    return false
  }
}

/**
 * Get all keys with prefix
 */
export function getAllKeys() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(STORAGE_PREFIX))
    .map(k => k.slice(STORAGE_PREFIX.length))
}

/**
 * Storage with expiration
 */
export function setItemWithExpiry(key, value, ttlMs) {
  const item = {
    value,
    expiry: Date.now() + ttlMs,
  }
  return setItem(key, item)
}

export function getItemWithExpiry(key) {
  const item = getItem(key)
  if (!item) return null
  
  if (Date.now() > item.expiry) {
    removeItem(key)
    return null
  }
  
  return item.value
}
