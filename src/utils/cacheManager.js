/**
 * Cache Manager Module
 * 
 * Contract-specific cache utilities built on top of the generic storage manager.
 * Compatible with reference/payload/ cache format.
 * 
 * Key format: payload-parser-contract:{chainId}:{address}
 * 
 * Entry structure:
 * {
 *   symbol?: string,
 *   name?: string,
 *   customName?: string,
 *   abi?: string,
 *   isProxy?: boolean,
 *   implementation?: string,
 *   vnetDefault?: boolean,
 *   updatedAt?: number
 * }
 * 
 * Display name priority:
 * 1. customName (chainId 0) - Global custom name
 * 2. customName (chainId specific)
 * 3. symbol (chainId specific)
 * 4. name (chainId 0) - Global name
 * 5. name (chainId specific)
 */

import { 
  contractStore,
  CacheTypes,
  CacheTypeMeta,
  getAllCacheEntries,
  getCacheStatsByType,
  exportAllCache,
  importAllCache,
  createStore,
  GLOBAL_CHAIN_ID,
} from './storageManager.js'
import { normalizeAddress } from './core/address.js'

// Re-export storage manager utilities for extensibility
export { 
  CacheTypes, 
  CacheTypeMeta, 
  getAllCacheEntries, 
  getCacheStatsByType,
  createStore,
  exportAllCache,
  importAllCache,
  GLOBAL_CHAIN_ID,
}

/**
 * Get contract cache for a specific address
 * Uses the new storage manager internally
 */
export function getContractCache(address, chainId = '1') {
  if (!address) return null
  return contractStore.get({ chainId, address: normalizeAddress(address) })
}

/**
 * Set contract cache for a specific address
 * Uses the new storage manager internally
 */
export function setContractCache(address, data, chainId = '1') {
  if (!address) return
  contractStore.set({ chainId, address: normalizeAddress(address) }, data)
}

/**
 * Delete contract cache for a specific address
 */
export function deleteContractCache(address, chainId = '1') {
  if (!address) return
  contractStore.remove({ chainId, address: normalizeAddress(address) })
}

/**
 * Get address display name with priority:
 * 1. customName (chainId 0) - User-set global name
 * 2. customName (chainId specific)
 * 3. symbol (chainId specific)
 * 4. name (chainId 0) - Global name
 * 5. name (chainId specific)
 * 
 * @param {string} address - The address to look up
 * @param {string} chainId - Chain ID (default: "1")
 * @returns {string|null} Display name or null if not found
 */
export function getAddressDisplayName(address, chainId = '1') {
  if (!address) return null
  const addr = normalizeAddress(address)
  
  // Priority 1: Global custom name (chainId 0)
  const globalCache = getContractCache(addr, '0')
  if (globalCache?.customName) {
    return globalCache.customName
  }
  
  // Priority 2-3: Chain-specific custom name or symbol
  const chainCache = getContractCache(addr, chainId)
  if (chainCache?.customName) {
    return chainCache.customName
  }
  if (chainCache?.symbol) {
    return chainCache.symbol
  }
  
  // Priority 4: Global name
  if (globalCache?.name) {
    return globalCache.name
  }
  
  // Priority 5: Chain-specific name
  if (chainCache?.name) {
    return chainCache.name
  }
  
  return null
}

/**
 * Get full cached info for an address
 */
export function getCachedAddressInfo(address, chainId = '1') {
  return {
    chainData: getContractCache(address, chainId),
    globalData: getContractCache(address, '0'),
  }
}

/**
 * Set custom name for an address (user-defined)
 * @param {string} address 
 * @param {string} customName 
 * @param {string} chainId - Use "0" for global
 */
export function setCustomName(address, customName, chainId = '0') {
  setContractCache(address, { customName }, chainId)
}

/**
 * Set symbol for an address (from RPC query)
 */
export function setSymbol(address, symbol, chainId = '1') {
  setContractCache(address, { symbol }, chainId)
}

/**
 * Set name for an address (from Etherscan or other source)
 */
export function setName(address, name, chainId = '1') {
  setContractCache(address, { name }, chainId)
}

/**
 * Get cached name for an address with priority lookup.
 * Priority: customName > symbol > name
 * Within each type: global (chainId 0) -> specific chainId
 * @param {string} chainId - The chain ID
 * @param {string} address - The contract address
 * @returns {string|null} Cached name or null if not found
 */
export function getCachedName(chainId, address) {
  if (!address) return null
  const addr = normalizeAddress(address)
  
  const globalCache = getContractCache(addr, GLOBAL_CHAIN_ID)
  const chainCache = getContractCache(addr, chainId)
  
  // Priority 1: customName (global first, then chain-specific)
  if (globalCache?.customName) return globalCache.customName
  if (chainCache?.customName) return chainCache.customName
  
  // Priority 2: symbol (global first, then chain-specific)
  if (globalCache?.symbol) return globalCache.symbol
  if (chainCache?.symbol) return chainCache.symbol
  
  // Priority 3: name (global first, then chain-specific)
  if (globalCache?.name) return globalCache.name
  if (chainCache?.name) return chainCache.name
  
  return null
}

/**
 * Set multiple fields at once
 */
export function setCachedInfo(address, info, chainId = '1') {
  setContractCache(address, info, chainId)
}

/**
 * Remove an address from cache
 */
export function removeCachedAddress(address, chainId = '1') {
  deleteContractCache(address, chainId)
}

/**
 * Get all contract cache entries
 * @returns {Array<{address: string, chainId: string, info: object}>}
 */
export function getAllCachedAddresses() {
  const entries = contractStore.getAll()
  return entries.map(entry => ({
    address: entry.address,
    chainId: entry.chainId,
    info: entry.data,
  }))
}

/**
 * Get contracts grouped by chain (reference-compatible)
 * @returns {Object.<string, Array<{address: string, data: object}>>}
 */
export function getContractCacheByChain() {
  const entries = contractStore.getAll()
  const byChain = {}
  
  for (const entry of entries) {
    const chainId = entry.chainId
    if (!byChain[chainId]) {
      byChain[chainId] = []
    }
    byChain[chainId].push({
      address: entry.address,
      data: entry.data,
    })
  }
  
  // Sort each chain's contracts by update time (newest first)
  for (const chainId in byChain) {
    byChain[chainId].sort((a, b) => (b.data?.updatedAt || 0) - (a.data?.updatedAt || 0))
  }
  
  return byChain
}

/**
 * Clear all contract cache
 */
export function clearCache() {
  contractStore.clear()
}

/**
 * Export cache as JSON (contract-specific, legacy format)
 * Format: { version: 1, exportedAt: timestamp, contracts: { chainId: { address: data } } }
 */
export function exportCache() {
  const allEntries = getAllCachedAddresses()
  const contracts = {}
  
  for (const { address, chainId, info } of allEntries) {
    if (!contracts[chainId]) {
      contracts[chainId] = {}
    }
    contracts[chainId][address] = info
  }
  
  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    contracts
  }, null, 2)
}

/**
 * Import cache from JSON
 * Supports format: { version: 1, contracts: { chainId: { address: data } } }
 */
export function importCache(jsonStr) {
  try {
    const data = JSON.parse(jsonStr)
    
    // Check version format
    if (data.version === 1 && data.contracts) {
      // New format with version
      for (const [chainId, addresses] of Object.entries(data.contracts)) {
        for (const [address, info] of Object.entries(addresses)) {
          setContractCache(address, info, chainId)
        }
      }
      return true
    }
    
    // Legacy format: { "chainId:address": info }
    for (const [key, value] of Object.entries(data)) {
      const colonIndex = key.indexOf(':')
      if (colonIndex > 0) {
        const chainId = key.slice(0, colonIndex)
        const address = key.slice(colonIndex + 1)
        setContractCache(address, value, chainId)
      }
    }
    return true
  } catch (e) {
    console.warn('Cache import failed:', e)
    return false
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const allEntries = getAllCachedAddresses()
  
  const stats = {
    total: allEntries.length,
    withCustomName: 0,
    withSymbol: 0,
    withName: 0,
    withVnetDefault: 0,
    byChain: {},
  }
  
  for (const { chainId, info } of allEntries) {
    if (info.customName) stats.withCustomName++
    if (info.symbol) stats.withSymbol++
    if (info.name) stats.withName++
    if (info.vnetDefault) stats.withVnetDefault++
    stats.byChain[chainId] = (stats.byChain[chainId] || 0) + 1
  }
  
  return stats
}

/**
 * Get addresses marked as VNet default for a specific chain.
 * These addresses will be shown in VNet Reader dropdown by default.
 * @param {string|number} chainId - The chain ID
 * @returns {Array<{address: string, symbol: string|null, name: string|null, customName: string|null}>}
 */
export function getVnetDefaultAddresses(chainId) {
  const chainIdStr = String(chainId)
  const result = []
  
  const allEntries = getAllCachedAddresses()
  for (const entry of allEntries) {
    if (entry.chainId === chainIdStr && entry.info?.vnetDefault) {
      result.push({
        address: entry.address,
        symbol: entry.info.symbol || null,
        name: entry.info.name || null,
        customName: entry.info.customName || null,
      })
    }
  }
  
  // Sort by display name (customName > symbol > name > address)
  result.sort((a, b) => {
    const aLabel = a.customName || a.symbol || a.name || a.address
    const bLabel = b.customName || b.symbol || b.name || b.address
    return aLabel.localeCompare(bLabel)
  })
  
  return result
}

/**
 * Set VNet default flag for an address
 * @param {string} address 
 * @param {boolean} vnetDefault 
 * @param {string} chainId 
 */
export function setVnetDefault(address, vnetDefault, chainId = '1') {
  setContractCache(address, { vnetDefault }, chainId)
}
