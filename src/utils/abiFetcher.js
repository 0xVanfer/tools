/**
 * ABI Fetcher Module
 * 
 * Fetches contract ABI from Etherscan API with proxy detection.
 * Automatically fetches implementation ABI for proxy contracts.
 * Uses unified cache manager for persistence.
 */

import { getContractCache, setContractCache } from './cacheManager.js'
import { fetchContractABI as fetchAbiFromEtherscan } from './core/etherscan.js'
import { getProxyImplementation } from './api.js'
import { isValidAddress } from './core/address.js'

/**
 * Fetch ABI for a contract, with proxy detection and caching.
 *
 * For proxy contracts the implementation ABI is fetched and merged with the
 * proxy's own ABI, so read calls exposed by the implementation show up.
 *
 * @param {string|number} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {Promise<{abi: Object[], isProxy: boolean, implementation: string|null}>}
 */
export async function fetchContractABI(chainId, address) {
  // Check cache first
  const cached = getAbiFromCache(chainId, address)
  if (cached) return cached

  // Fetch from Etherscan
  const abi = await fetchAbiFromEtherscan(chainId, address)
  const filtered = filterAbi(abi)

  if (!filtered) {
    throw new Error('No valid ABI entries found')
  }

  // Resolve the implementation for proxy contracts (best effort).
  let implementation = null
  try {
    implementation = await getProxyImplementation(chainId, address)
  } catch {
    implementation = null
  }

  if (
    implementation &&
    isValidAddress(implementation) &&
    implementation.toLowerCase() !== address.toLowerCase()
  ) {
    try {
      const implAbi = filterAbi(await fetchAbiFromEtherscan(chainId, implementation))
      if (implAbi) {
        const merged = mergeAbis(filtered, implAbi)
        setContractCache(address, { abi: merged, isProxy: true, implementation }, String(chainId))
        return { abi: merged, isProxy: true, implementation }
      }
    } catch {
      // Fall through and cache the proxy ABI on its own.
    }
  }

  setContractCache(address, { abi: filtered, isProxy: false, implementation: null }, String(chainId))

  return {
    abi: filtered,
    isProxy: false,
    implementation: null
  }
}

/**
 * Merge a proxy ABI with its implementation ABI, de-duplicating by fragment.
 */
function mergeAbis(primary, secondary) {
  const seen = new Set()
  const merged = []

  const keyOf = (item) => {
    const inputs = (item.inputs || []).map(i => i.type).join(',')
    return `${item.type}:${item.name || ''}(${inputs})`
  }

  for (const item of [...primary, ...secondary]) {
    const key = keyOf(item)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }

  return merged
}

/**
 * Filter ABI to keep only useful entries.
 * Removes error definitions, keeps functions, events, constructor, fallback, receive.
 * 
 * @param {Object[]} abi - Raw ABI array
 * @returns {Object[]|null} Filtered ABI or null if empty
 */
function filterAbi(abi) {
  if (!Array.isArray(abi)) return null
  
  const filtered = abi.filter(item => {
    const type = item.type
    return type === 'function' || type === 'event' || type === 'constructor' ||
           type === 'fallback' || type === 'receive'
  })
  
  return filtered.length > 0 ? filtered : null
}

/**
 * Get ABI from cache.
 * 
 * @param {string} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {{abi: Object[], isProxy: boolean, implementation: string|null}|null}
 */
export function getAbiFromCache(chainId, address) {
  const cached = getContractCache(address, String(chainId))
  if (!cached?.abi) return null
  
  // Parse ABI if stored as string
  let abi = cached.abi
  if (typeof abi === 'string') {
    try {
      abi = JSON.parse(abi)
    } catch {
      return null
    }
  }
  
  console.log('[abiFetcher] Found ABI in cache', { 
    chainId, 
    address, 
    methodCount: Array.isArray(abi) ? abi.filter(i => i.type === 'function').length : 0 
  })
  
  return {
    abi,
    isProxy: cached.isProxy || false,
    implementation: cached.implementation || null
  }
}

/**
 * Parse ABI into method definitions for UI display.
 * Only includes view/pure functions.
 * 
 * @param {Object[]} abi - Contract ABI
 * @returns {Array<{name: string, signature: string, inputs: string, outputs: string, inputTypes: string[], outputTypes: string[]}>}
 */
export function parseAbiToMethods(abi) {
  if (!Array.isArray(abi)) return []
  
  const methods = []
  
  for (const item of abi) {
    if (item.type !== 'function') continue
    
    // Only include view/pure functions
    if (item.stateMutability !== 'view' && item.stateMutability !== 'pure') continue
    
    // Build input types
    const inputTypes = (item.inputs || []).map(formatParamType)
    const inputs = inputTypes.join(',')
    
    // Build output types
    const outputTypes = (item.outputs || []).map(formatParamType)
    const outputs = outputTypes.join(',')
    
    // Build signature
    const signature = `${item.name}(${inputs})`
    
    methods.push({
      name: item.name,
      signature,
      inputs,
      outputs,
      inputTypes,
      outputTypes,
      inputNames: (item.inputs || []).map(i => i.name || ''),
      outputNames: (item.outputs || []).map(o => o.name || ''),
      stateMutability: item.stateMutability
    })
  }
  
  // Sort alphabetically
  methods.sort((a, b) => a.name.localeCompare(b.name))
  
  return methods
}

/**
 * Format a parameter type from ABI.
 * Handles tuple types and arrays.
 * 
 * @param {Object} param - Parameter object from ABI
 * @returns {string} Type string
 */
function formatParamType(param) {
  if (param.type === 'tuple' || param.type.startsWith('tuple[')) {
    const components = (param.components || []).map(formatParamType).join(',')
    const tupleType = `(${components})`
    
    if (param.type.startsWith('tuple[')) {
      const arrayPart = param.type.slice(5)
      return tupleType + arrayPart
    }
    return tupleType
  }
  return param.type
}

/**
 * Check if ABI is loaded for an address.
 * 
 * @param {string} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {boolean}
 */
export function hasAbi(chainId, address) {
  const cached = getAbiFromCache(chainId, address)
  return cached !== null && cached.abi !== null
}

/**
 * Get parsed methods for an address.
 * Returns empty array if ABI not loaded.
 * 
 * @param {string} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {Array<{name: string, signature: string, inputs: string, outputs: string}>}
 */
export function getContractMethods(chainId, address) {
  const cached = getAbiFromCache(chainId, address)
  if (!cached?.abi) return []
  return parseAbiToMethods(cached.abi)
}
