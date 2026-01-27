/**
 * ABI Fetcher Module
 * 
 * Fetches contract ABI from Etherscan API with proxy detection.
 * Automatically fetches implementation ABI for proxy contracts.
 * Uses unified cache manager for persistence.
 */

import { getContractCache, setContractCache } from './cacheManager.js'

// Etherscan V2 API keys for rotation
const ETHERSCAN_API_KEYS = [
  'B74HQUR15VESEHDE1HWQSFF6HGDDJ8C9RH',
  '69TECUX4UTVCG19HPW6SRTUW5YHT1J8JZX',
  '6JEUZGXV6NCGQEMKSWEGI46MJRK1QDWJ8C'
]
let apiKeyIndex = 0

function getNextApiKey() {
  const key = ETHERSCAN_API_KEYS[apiKeyIndex]
  apiKeyIndex = (apiKeyIndex + 1) % ETHERSCAN_API_KEYS.length
  return key
}

// Chains that use Routescan API
const ROUTESCAN_CHAINS = new Set(['43114', '1111', '9745'])

function isRoutescanChain(chainId) {
  return ROUTESCAN_CHAINS.has(String(chainId))
}

function getApiUrl(chainId) {
  const normalizedChainId = String(chainId)
  if (isRoutescanChain(normalizedChainId)) {
    return `https://api.routescan.io/v2/network/mainnet/evm/${normalizedChainId}/etherscan/api`
  }
  return 'https://api.etherscan.io/v2/api'
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
 * Save ABI to cache.
 * 
 * @param {string} chainId - Chain ID
 * @param {string} address - Contract address
 * @param {Object[]} abi - Contract ABI
 * @param {boolean} isProxy - Whether contract is a proxy
 * @param {string|null} implementation - Implementation address if proxy
 */
function saveAbiToCache(chainId, address, abi, isProxy, implementation) {
  if (!abi) return
  
  setContractCache(address, {
    abi,
    isProxy,
    implementation
  }, chainId)
  
  console.log('[abiFetcher] Saved ABI to cache', { 
    chainId, 
    address, 
    methodCount: abi.filter(i => i.type === 'function').length 
  })
}

/**
 * Fetch implementation ABI for a proxy.
 * 
 * @param {string} address - Implementation address
 * @param {string} chainId - Chain ID
 * @returns {Promise<Object[]|null>}
 */
async function fetchImplementationABI(address, chainId) {
  const apiUrl = getApiUrl(chainId)
  const isRoutescan = isRoutescanChain(chainId)
  const apiKey = getNextApiKey()
  
  const params = new URLSearchParams({
    module: 'contract',
    action: 'getabi',
    address,
    apikey: apiKey
  })
  
  if (!isRoutescan) {
    params.set('chainid', chainId)
  }
  
  try {
    const response = await fetch(`${apiUrl}?${params}`)
    if (!response.ok) return null
    
    const data = await response.json()
    
    if (data.status !== '1' || !data.result) {
      console.log('[abiFetcher] Implementation ABI not available', { address })
      return null
    }
    
    const rawAbi = typeof data.result === 'string' ? JSON.parse(data.result) : data.result
    const abi = filterAbi(rawAbi)
    
    if (!abi) {
      console.log('[abiFetcher] Implementation ABI empty after filtering', { address })
      return null
    }
    
    console.log('[abiFetcher] Fetched implementation ABI', { 
      address, 
      methodCount: abi.filter(i => i.type === 'function').length 
    })
    
    return abi
  } catch (e) {
    console.error('[abiFetcher] Failed to fetch implementation ABI', { address, error: e.message })
    return null
  }
}

/**
 * Fetch contract ABI from Etherscan.
 * Automatically detects and handles proxy contracts.
 * 
 * @param {string} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {Promise<{abi: Object[]|null, isProxy: boolean, implementation: string|null}>}
 */
export async function fetchContractABI(chainId, address) {
  const normalizedChainId = String(chainId)
  
  // Check cache first
  const cached = getAbiFromCache(normalizedChainId, address)
  if (cached) {
    return cached
  }
  
  const apiUrl = getApiUrl(normalizedChainId)
  const isRoutescan = isRoutescanChain(normalizedChainId)
  const apiKey = getNextApiKey()
  
  console.log('[abiFetcher] Fetching ABI', { address, chainId: normalizedChainId })
  
  try {
    // Use getsourcecode to get ABI and detect proxy
    const params = new URLSearchParams({
      module: 'contract',
      action: 'getsourcecode',
      address,
      apikey: apiKey
    })
    
    if (!isRoutescan) {
      params.set('chainid', normalizedChainId)
    }
    
    const response = await fetch(`${apiUrl}?${params}`)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.status === '1' && data.result && data.result[0]) {
      const contractInfo = data.result[0]
      
      // Check if it's a proxy contract
      if (contractInfo.Implementation && contractInfo.Implementation !== '') {
        const implAddress = contractInfo.Implementation
        console.log('[abiFetcher] Detected proxy contract', { 
          proxy: address, 
          implementation: implAddress 
        })
        
        // Fetch implementation ABI
        const implAbi = await fetchImplementationABI(implAddress, normalizedChainId)
        if (implAbi) {
          saveAbiToCache(normalizedChainId, address, implAbi, true, implAddress)
          return { abi: implAbi, isProxy: true, implementation: implAddress }
        }
      }
      
      // Not a proxy, or implementation ABI not found - use own ABI
      if (contractInfo.ABI && contractInfo.ABI !== 'Contract source code not verified') {
        try {
          const rawAbi = JSON.parse(contractInfo.ABI)
          const abi = filterAbi(rawAbi)
          if (abi) {
            console.log('[abiFetcher] Successfully fetched ABI', { 
              address, 
              methodCount: abi.filter(i => i.type === 'function').length 
            })
            saveAbiToCache(normalizedChainId, address, abi, false, null)
            return { abi, isProxy: false, implementation: null }
          }
        } catch (e) {
          console.error('[abiFetcher] Failed to parse ABI', { error: e.message })
        }
      }
    }
    
    console.log('[abiFetcher] Contract not verified or ABI not available', { address })
    return { abi: null, isProxy: false, implementation: null }
    
  } catch (e) {
    console.error('[abiFetcher] Failed to fetch ABI', { address, error: e.message })
    return { abi: null, isProxy: false, implementation: null }
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
