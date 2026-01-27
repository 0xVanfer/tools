/**
 * Generic Storage Manager Module
 * 
 * A extensible storage system that supports multiple cache types.
 * Each cache type has its own prefix and can have custom behavior.
 * 
 * Usage:
 *   const contractStore = createStore('contract', { chainId: '1' })
 *   contractStore.set(address, { name: 'USDC', symbol: 'USDC' })
 *   contractStore.get(address)
 * 
 * Cache Types:
 *   - contract: Contract address info (name, symbol, ABI, etc.)
 *   - signature: Function/event signatures
 *   - settings: App settings and preferences
 *   - history: Input/search history
 * 
 * Key format follows reference implementation:
 *   - Contract: payload-parser-contract:{chainId}:{address}
 *   - Signature: eth-tools:signature:{selector}
 *   - Other: eth-tools:{type}:{key}
 */

// Contract cache uses payload-parser prefix for compatibility with reference
const CONTRACT_PREFIX = 'payload-parser-contract:'
const STORAGE_PREFIX = 'eth-tools:'

// Global chain ID - applies to all chains
export const GLOBAL_CHAIN_ID = '0'

/**
 * Registry of cache type configurations
 */
export const CacheTypes = {
  CONTRACT: 'contract',
  SIGNATURE: 'signature',
  SETTINGS: 'settings',
  HISTORY: 'history',
  VNET: 'vnet',
}

/**
 * Cache type metadata for UI and management
 */
export const CacheTypeMeta = {
  [CacheTypes.CONTRACT]: {
    label: 'Contracts',
    description: 'Contract addresses, names, symbols and ABIs',
    icon: '📄',
    prefix: CONTRACT_PREFIX,
    keyPattern: (key) => {
      // Pattern: {chainId}:{address}
      const colonIndex = key.indexOf(':')
      if (colonIndex === -1) return null
      return { chainId: key.slice(0, colonIndex), address: key.slice(colonIndex + 1) }
    },
    formatKey: (params) => `${params.chainId}:${params.address?.toLowerCase() || ''}`,
  },
  [CacheTypes.SIGNATURE]: {
    label: 'Signatures',
    description: 'Function and event signatures',
    icon: '✍️',
    prefix: STORAGE_PREFIX,
    keyPattern: (key) => {
      // Pattern: signature:{selector}
      const parts = key.split(':')
      return parts.length === 2 ? { selector: parts[1] } : null
    },
    formatKey: (params) => params.selector,
  },
  [CacheTypes.SETTINGS]: {
    label: 'Settings',
    description: 'Application settings and preferences',
    icon: '⚙️',
    prefix: STORAGE_PREFIX,
    keyPattern: (key) => ({ setting: key.split(':')[1] }),
    formatKey: (params) => params.setting,
  },
  [CacheTypes.HISTORY]: {
    label: 'History',
    description: 'Search and input history',
    icon: '📜',
    prefix: STORAGE_PREFIX,
    keyPattern: (key) => ({ type: key.split(':')[1] }),
    formatKey: (params) => params.type,
  },
  [CacheTypes.VNET]: {
    label: 'VNet',
    description: 'Virtual network reader cache',
    icon: '🌐',
    prefix: STORAGE_PREFIX,
    keyPattern: (key) => {
      const parts = key.split(':')
      return parts.length >= 2 ? { id: parts.slice(1).join(':') } : null
    },
    formatKey: (params) => params.id,
  },
}

/**
 * Build full storage key
 * Contract type uses payload-parser-contract: prefix for reference compatibility
 * Other types use eth-tools: prefix
 */
function buildKey(type, keyParams) {
  const meta = CacheTypeMeta[type]
  if (!meta) {
    throw new Error(`Unknown cache type: ${type}`)
  }
  const suffix = typeof keyParams === 'string' ? keyParams : meta.formatKey(keyParams)
  
  // Contract type uses special prefix
  if (type === CacheTypes.CONTRACT) {
    return `${CONTRACT_PREFIX}${suffix}`
  }
  return `${STORAGE_PREFIX}${type}:${suffix}`
}

/**
 * Parse storage key into components
 */
function parseKey(fullKey) {
  // Check for contract cache (payload-parser-contract:)
  if (fullKey.startsWith(CONTRACT_PREFIX)) {
    const rest = fullKey.slice(CONTRACT_PREFIX.length)
    const colonIndex = rest.indexOf(':')
    if (colonIndex === -1) return null
    
    return {
      type: CacheTypes.CONTRACT,
      fullKey,
      chainId: rest.slice(0, colonIndex),
      address: rest.slice(colonIndex + 1),
    }
  }
  
  // Check for eth-tools: prefix
  if (!fullKey.startsWith(STORAGE_PREFIX)) return null
  
  const rest = fullKey.slice(STORAGE_PREFIX.length)
  const colonIndex = rest.indexOf(':')
  if (colonIndex === -1) return null
  
  const type = rest.slice(0, colonIndex)
  const keyPart = rest.slice(colonIndex + 1)
  const meta = CacheTypeMeta[type]
  
  if (!meta) return null
  
  const parsed = meta.keyPattern(keyPart)
  return {
    type,
    fullKey,
    ...parsed,
  }
}

/**
 * Create a typed store for a specific cache type
 */
export function createStore(type, defaultParams = {}) {
  const meta = CacheTypeMeta[type]
  if (!meta) {
    throw new Error(`Unknown cache type: ${type}`)
  }

  return {
    /**
     * Get item from storage
     */
    get(keyParams) {
      const params = typeof keyParams === 'string' 
        ? { ...defaultParams, [Object.keys(meta.keyPattern(''))[0]]: keyParams }
        : { ...defaultParams, ...keyParams }
      const key = buildKey(type, params)
      try {
        const data = localStorage.getItem(key)
        return data ? JSON.parse(data) : null
      } catch {
        return null
      }
    },

    /**
     * Set item in storage (merges with existing)
     */
    set(keyParams, data, options = { merge: true }) {
      const params = typeof keyParams === 'string' 
        ? { ...defaultParams, [Object.keys(meta.keyPattern(''))[0]]: keyParams }
        : { ...defaultParams, ...keyParams }
      const key = buildKey(type, params)
      try {
        let finalData = data
        if (options.merge) {
          const existing = this.get(keyParams) || {}
          finalData = { ...existing, ...data, updatedAt: Date.now() }
        } else {
          finalData = { ...data, updatedAt: Date.now() }
        }
        localStorage.setItem(key, JSON.stringify(finalData))
        return true
      } catch (e) {
        console.warn(`Failed to save ${type} cache:`, e)
        return false
      }
    },

    /**
     * Remove item from storage
     */
    remove(keyParams) {
      const params = typeof keyParams === 'string' 
        ? { ...defaultParams, [Object.keys(meta.keyPattern(''))[0]]: keyParams }
        : { ...defaultParams, ...keyParams }
      const key = buildKey(type, params)
      try {
        localStorage.removeItem(key)
        return true
      } catch {
        return false
      }
    },

    /**
     * Get all items of this type
     */
    getAll() {
      const results = []
      // Contract type uses special prefix
      const prefix = type === CacheTypes.CONTRACT ? CONTRACT_PREFIX : `${STORAGE_PREFIX}${type}:`
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(prefix)) {
            try {
              const data = JSON.parse(localStorage.getItem(key))
              const parsed = parseKey(key)
              if (parsed) {
                results.push({ ...parsed, data })
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn(`Failed to get all ${type} cache:`, e)
      }
      return results
    },

    /**
     * Clear all items of this type
     */
    clear() {
      // Contract type uses special prefix
      const prefix = type === CacheTypes.CONTRACT ? CONTRACT_PREFIX : `${STORAGE_PREFIX}${type}:`
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(prefix)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        return true
      } catch {
        return false
      }
    },

    /**
     * Get statistics for this cache type
     */
    getStats() {
      const items = this.getAll()
      return {
        count: items.length,
        oldestUpdatedAt: items.reduce((min, item) => 
          Math.min(min, item.data?.updatedAt || Infinity), Infinity),
        newestUpdatedAt: items.reduce((max, item) => 
          Math.max(max, item.data?.updatedAt || 0), 0),
      }
    },
  }
}

/**
 * Get all cache entries across all types
 */
export function getAllCacheEntries() {
  const results = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      // Check both prefixes
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(CONTRACT_PREFIX)) {
        const parsed = parseKey(key)
        if (parsed) {
          try {
            const data = JSON.parse(localStorage.getItem(key))
            results.push({ ...parsed, data })
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('Failed to get all cache entries:', e)
  }
  return results
}

/**
 * Get cache statistics by type
 */
export function getCacheStatsByType() {
  const entries = getAllCacheEntries()
  const stats = {}
  
  for (const type of Object.values(CacheTypes)) {
    const typeEntries = entries.filter(e => e.type === type)
    stats[type] = {
      count: typeEntries.length,
      meta: CacheTypeMeta[type],
    }
  }
  
  return stats
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      // Clear both prefixes
      if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(CONTRACT_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    return true
  } catch {
    return false
  }
}

/**
 * Export all cache as JSON
 * Uses reference-compatible format for contracts
 */
export function exportAllCache() {
  const entries = getAllCacheEntries()
  
  // Separate contracts from other data
  const contracts = {}
  const otherData = {}
  
  for (const entry of entries) {
    if (entry.type === CacheTypes.CONTRACT) {
      // Contracts use reference format: { chainId: { address: data } }
      const chainId = entry.chainId
      if (!contracts[chainId]) {
        contracts[chainId] = {}
      }
      contracts[chainId][entry.address] = entry.data
    } else {
      // Other types
      if (!otherData[entry.type]) {
        otherData[entry.type] = {}
      }
      const keyParts = entry.fullKey.split(':').slice(2)
      const keyStr = keyParts.join(':')
      otherData[entry.type][keyStr] = entry.data
    }
  }
  
  return JSON.stringify({
    version: 2,
    exportedAt: Date.now(),
    contracts,
    data: otherData,
  }, null, 2)
}

/**
 * Import cache from JSON
 * Supports reference format and legacy formats
 */
export function importAllCache(jsonStr) {
  try {
    const imported = JSON.parse(jsonStr)
    let importedCount = 0
    
    // Version 2 format with contracts and data
    if (imported.version === 2) {
      // Import contracts
      if (imported.contracts) {
        for (const [chainId, addresses] of Object.entries(imported.contracts)) {
          for (const [address, data] of Object.entries(addresses)) {
            const key = `${CONTRACT_PREFIX}${chainId}:${address.toLowerCase()}`
            localStorage.setItem(key, JSON.stringify(data))
            importedCount++
          }
        }
      }
      
      // Import other data
      if (imported.data) {
        for (const [type, entries] of Object.entries(imported.data)) {
          for (const [keyStr, data] of Object.entries(entries)) {
            const fullKey = `${STORAGE_PREFIX}${type}:${keyStr}`
            localStorage.setItem(fullKey, JSON.stringify(data))
            importedCount++
          }
        }
      }
      
      return { success: true, version: 2, imported: importedCount }
    }
    
    // Version 1 format (contracts only - reference format)
    if (imported.version === 1 && imported.contracts) {
      for (const [chainId, addresses] of Object.entries(imported.contracts)) {
        for (const [address, data] of Object.entries(addresses)) {
          const key = `${CONTRACT_PREFIX}${chainId}:${address.toLowerCase()}`
          localStorage.setItem(key, JSON.stringify(data))
          importedCount++
        }
      }
      return { success: true, version: 1, imported: importedCount }
    }
    
    return { success: false, error: 'Unknown format' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// Pre-created stores for common types
export const contractStore = createStore(CacheTypes.CONTRACT)
export const signatureStore = createStore(CacheTypes.SIGNATURE)
export const settingsStore = createStore(CacheTypes.SETTINGS)
export const historyStore = createStore(CacheTypes.HISTORY)
export const vnetStore = createStore(CacheTypes.VNET)
