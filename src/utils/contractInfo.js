/**
 * Contract Info Service Module
 * 
 * Provides contract metadata lookup functionality using Multicall3.
 * Batch queries multiple addresses for symbol information in a single RPC call.
 * 
 * Features:
 * - Multicall3 batch queries for efficiency
 * - Supports symbol() lookup
 * - Graceful error handling for non-contract addresses
 * - Uses unified cache manager for persistence
 * 
 * Note: Multicall3 is deployed at the same address on most EVM chains:
 * 0xcA11bde05977b3631167028862bE2a173976CA11
 */

import { getEthers, createInterface } from './core/ethers.js'
import { 
  getAddressDisplayName, 
  getContractCache,
  setSymbol
} from './cacheManager.js'
import { getRpcUrl } from './chains.js'

/**
 * Multicall3 contract address (same on most EVM chains).
 */
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

/**
 * ERC20 function signatures for contract calls.
 */
const ERC20_SIGNATURES = {
  symbol: '0x95d89b41'    // symbol()
}

/**
 * ABI for Multicall3 tryAggregate function.
 * tryAggregate allows calls to fail without reverting the entire batch.
 */
const MULTICALL3_ABI = [
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[])'
]

/**
 * ABI fragments for decoding ERC20 responses.
 */
const ERC20_ABI = [
  'function symbol() view returns (string)'
]

/**
 * Get contract info from cache.
 * @param {string|number} chainId - The chain ID
 * @param {string} address - The contract address
 * @returns {{symbol: string|null}|null}
 */
function getFromCache(chainId, address) {
  const cached = getContractCache(address, String(chainId))
  if (cached?.symbol) {
    console.log('[contractInfo] Found in cache', { chainId, address, symbol: cached.symbol })
    return { symbol: cached.symbol }
  }
  return null
}

/**
 * Save contract info to cache.
 * @param {string|number} chainId - The chain ID
 * @param {string} address - The contract address
 * @param {Object} info - The contract info
 */
function saveToCache(chainId, address, info) {
  if (info.symbol) {
    setSymbol(address, info.symbol, chainId)
    console.log('[contractInfo] Saved to cache', { chainId, address, symbol: info.symbol })
  }
}

/**
 * Build multicall batch for symbol queries.
 * Creates 1 call per address: symbol().
 * 
 * @param {string[]} addresses - Array of addresses
 * @returns {Array<{target: string, callData: string}>} Array of call objects
 */
function buildMulticallBatch(addresses) {
  const calls = []
  
  for (const address of addresses) {
    // Add symbol() call only
    calls.push({
      target: address,
      callData: ERC20_SIGNATURES.symbol
    })
  }
  
  return calls
}

/**
 * Execute multicall via JSON-RPC fetch.
 * Uses tryAggregate to allow individual calls to fail.
 * 
 * @param {string} rpcUrl - The RPC endpoint URL
 * @param {Array<{target: string, callData: string}>} calls - Array of call objects
 * @returns {Promise<Array<{success: boolean, returnData: string}>>} Call results
 */
async function executeMulticall(rpcUrl, calls) {
  const iface = createInterface(MULTICALL3_ABI)
  
  // Encode the tryAggregate call
  // requireSuccess = false allows individual calls to fail
  const calldata = iface.encodeFunctionData('tryAggregate', [false, calls])
  
  // Build JSON-RPC request
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [
      {
        to: MULTICALL3_ADDRESS,
        data: calldata
      },
      'latest'
    ]
  }

  console.log('[contractInfo] Executing multicall', { 
    callCount: calls.length,
    rpcUrl,
    multicallAddress: MULTICALL3_ADDRESS 
  })

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`)
  }

  // Decode the tryAggregate response
  const decoded = iface.decodeFunctionResult('tryAggregate', json.result)
  return decoded[0] // Returns array of (success, returnData) tuples
}

/**
 * Parse multicall results into ContractInfo objects.
 * 
 * @param {string[]} addresses - Original addresses array
 * @param {Array<{success: boolean, returnData: string}>} results - Multicall results
 * @returns {Map<string, {symbol: string|null}>} Map of address -> ContractInfo
 */
function parseMulticallResults(addresses, results) {
  const ethers = getEthers()
  if (!ethers) return new Map()
  
  const infoMap = new Map()
  const erc20Interface = createInterface(ERC20_ABI)
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]
    const symbolResult = results[i] // 1:1 mapping
    
    const info = {
      address,
      symbol: null
    }
    
    // Try to decode symbol
    if (symbolResult && symbolResult.success && symbolResult.returnData !== '0x') {
      try {
        const decoded = erc20Interface.decodeFunctionResult('symbol', symbolResult.returnData)
        info.symbol = decoded[0]
      } catch (e) {
        // Try bytes32 decode (some tokens like MKR return bytes32)
        try {
          const decoded = ethers.utils.parseBytes32String(symbolResult.returnData)
          if (decoded) {
            info.symbol = decoded.replace(/\0/g, '')
          }
        } catch {}
      }
    }
    
    infoMap.set(address, info)
  }
  
  console.log('[contractInfo] Parsed contract symbols', { 
    total: addresses.length,
    withSymbol: Array.from(infoMap.values()).filter(i => i.symbol).length
  })
  
  return infoMap
}

/**
 * Fetch contract symbols for multiple addresses.
 * Uses Multicall3 to batch all queries into a single RPC call.
 * First checks browser cache for each address, only queries uncached ones.
 * 
 * @param {string[]} addresses - Array of addresses to query
 * @param {string} rpcUrl - RPC URL (optional, will use chain default if not provided)
 * @param {string|number} chainId - The chain ID to query
 * @returns {Promise<Map<string, {symbol?: string}>>} Map of address -> ContractInfo
 */
export async function fetchContractInfoFromRpc(addresses, rpcUrl, chainId = '1') {
  if (!addresses || addresses.length === 0) {
    console.log('[contractInfo] No addresses to query')
    return new Map()
  }

  console.log('[contractInfo] fetchContractInfoFromRpc called', { 
    addressCount: addresses.length, 
    chainId 
  })

  const infoMap = new Map()
  const uncachedAddresses = []
  
  // Check cache first for each address
  for (const address of addresses) {
    const cached = getFromCache(chainId, address)
    if (cached) {
      infoMap.set(address, {
        address,
        symbol: cached.symbol
      })
    } else {
      uncachedAddresses.push(address)
    }
  }
  
  console.log('[contractInfo] Cache lookup complete', {
    total: addresses.length,
    cached: addresses.length - uncachedAddresses.length,
    uncached: uncachedAddresses.length,
    chainId
  })
  
  // If all addresses are cached, return early
  if (uncachedAddresses.length === 0) {
    return infoMap
  }

  // Get RPC URL if not provided
  const finalRpcUrl = rpcUrl || getRpcUrl(chainId)
  if (!finalRpcUrl) {
    console.warn('[contractInfo] No RPC URL available for chain', chainId)
    return infoMap
  }

  console.log('[contractInfo] Fetching contract symbols via Multicall3', { 
    addressCount: uncachedAddresses.length, 
    chainId,
    rpcUrl: finalRpcUrl
  })

  try {
    // Build multicall batch with symbol for each address
    const calls = buildMulticallBatch(uncachedAddresses)
    
    // Execute multicall
    const results = await executeMulticall(finalRpcUrl, calls)
    
    // Parse results and build ContractInfo map
    const fetchedInfoMap = parseMulticallResults(uncachedAddresses, results)
    
    // Merge fetched results and save to cache
    for (const [address, info] of fetchedInfoMap) {
      infoMap.set(address, info)
      // Save to cache if symbol was found
      saveToCache(chainId, address, info)
    }
    
    return infoMap
    
  } catch (e) {
    console.error('[contractInfo] Failed to fetch contract info', e.message)
    return infoMap
  }
}

/**
 * Fetch contract info for given addresses and update DOM elements
 * @param {string[]} addresses - Array of addresses to look up
 * @param {string} chainId - Chain ID
 * @param {string} rpcUrl - RPC URL (if not provided, will use default for chain)
 */
export async function fetchAndDisplayContractInfo(addresses, chainId = '1', rpcUrl = null) {
  if (!addresses?.length) return
  
  // Filter addresses that don't have cached info
  const addressesToFetch = []
  
  for (const addr of addresses) {
    const displayName = getAddressDisplayName(addr, chainId)
    if (!displayName) {
      addressesToFetch.push(addr)
    }
  }
  
  if (addressesToFetch.length === 0) {
    // All addresses have cached info, just update displays
    updateAddressDisplays(chainId)
    return
  }
  
  // Get RPC URL for chain if not provided
  const finalRpcUrl = rpcUrl || getRpcUrl(chainId)
  
  if (finalRpcUrl) {
    await fetchContractInfoFromRpc(addressesToFetch, finalRpcUrl, chainId)
  }
  
  // Update DOM
  updateAddressDisplays(chainId)
}

/**
 * Update all address display elements in the DOM with cached names
 * @param {string} chainId 
 */
export function updateAddressDisplays(chainId = '1') {
  // Find all address display elements
  const elements = document.querySelectorAll('[data-address]')
  
  for (const el of elements) {
    const address = el.dataset.address
    if (!address) continue
    
    const displayName = getAddressDisplayName(address, chainId)
    
    if (displayName) {
      // Update the label/name element
      const labelEl = el.querySelector('.address-label, .address-name')
      if (labelEl) {
        labelEl.textContent = displayName
        labelEl.title = displayName
      }
      
      // Or update data attribute for Vue components to react
      el.dataset.displayName = displayName
    }
  }
}

/**
 * Get display info for a single address
 * Checks cache first, optionally fetches if not found
 * @param {string} address 
 * @param {string} chainId 
 * @param {boolean} fetch - Whether to fetch from RPC if not cached
 * @param {string} rpcUrl - RPC URL to use for fetching
 * @returns {Promise<{displayName: string|null, symbol?: string, name?: string}>}
 */
export async function getContractInfo(address, chainId = '1', fetch = false, rpcUrl = null) {
  const displayName = getAddressDisplayName(address, chainId)
  const cached = getContractCache(address, String(chainId))
  
  if (displayName || !fetch) {
    return {
      displayName,
      symbol: cached?.symbol,
      name: cached?.name,
    }
  }
  
  // Fetch from RPC
  const finalRpcUrl = rpcUrl || getRpcUrl(chainId)
  if (finalRpcUrl) {
    const results = await fetchContractInfoFromRpc([address], finalRpcUrl, chainId)
    const info = results.get(address.toLowerCase()) || results.get(address)
    
    return {
      displayName: info?.symbol || null,
      symbol: info?.symbol,
    }
  }
  
  return { displayName: null }
}

/**
 * Batch get display names for multiple addresses
 * @param {string[]} addresses 
 * @param {string} chainId 
 * @returns {Map<string, string>}
 */
export function getDisplayNamesForAddresses(addresses, chainId = '1') {
  const result = new Map()
  
  for (const addr of addresses) {
    const displayName = getAddressDisplayName(addr, chainId)
    if (displayName) {
      result.set(addr.toLowerCase(), displayName)
    }
  }
  
  return result
}
