/**
 * Core Etherscan API Configuration Module
 * 
 * Single source of truth for all Etherscan API-related configuration:
 * - API keys and rotation
 * - Per-chain API base URL resolution
 * - API URL generation
 * 
 * This module is used by:
 * - api.js
 * - abiFetcher.js
 * - contractName.js
 * - linkParsers.js
 */

import { getChain } from '../chains.js'

/**
 * Etherscan V2 unified API endpoint.
 * Serves a fixed chain list: https://api.etherscan.io/v2/chainlist
 */
const ETHERSCAN_V2_API = 'https://api.etherscan.io/v2/api'

/**
 * Etherscan V2 API keys.
 *
 * Override at build time with `VITE_ETHERSCAN_API_KEYS` (comma separated) so
 * deployments do not have to ship the maintainer's keys. The defaults below are
 * the historically committed keys; they are public and rate limited, so treat
 * them as a fallback only and rotate them if they are abused.
 */
function readApiKeys() {
  try {
    const fromEnv = import.meta?.env?.VITE_ETHERSCAN_API_KEYS
    if (typeof fromEnv === 'string' && fromEnv.trim()) {
      const keys = fromEnv.split(',').map(k => k.trim()).filter(Boolean)
      if (keys.length > 0) return keys
    }
  } catch {
    // `import.meta.env` is unavailable outside Vite (e.g. plain node scripts).
  }
  return [
    'B74HQUR15VESEHDE1HWQSFF6HGDDJ8C9RH',
    '69TECUX4UTVCG19HPW6SRTUW5YHT1J8JZX',
    '6JEUZGXV6NCGQEMKSWEGI46MJRK1QDWJ8C'
  ]
}

const ETHERSCAN_API_KEYS = readApiKeys()

let apiKeyIndex = 0

/**
 * Get the next API key in rotation
 * @returns {string} API key
 */
export function getNextApiKey() {
  const key = ETHERSCAN_API_KEYS[apiKeyIndex]
  apiKeyIndex = (apiKeyIndex + 1) % ETHERSCAN_API_KEYS.length
  return key
}

/**
 * Chains that use a non-Etherscan explorer API (Blockscout / Routescan / native).
 * Detected from the per-chain `apiUrl` in chains.js.
 * @param {string|number} chainId - Chain ID to check
 * @returns {boolean}
 */
export function isRoutescanChain(chainId) {
  const apiUrl = getChain(chainId)?.apiUrl || ''
  return apiUrl.includes('routescan.io')
}

/**
 * Get the block-explorer API base URL for a chain.
 *
 * Chains with their own Etherscan-compatible API (Blockscout, Routescan, native)
 * declare `apiUrl`; everything else falls back to the unified Etherscan V2 API.
 *
 * @param {string|number} chainId - Chain ID
 * @returns {string} API base URL
 */
export function getEtherscanApiUrl(chainId) {
  return getChain(chainId)?.apiUrl || ETHERSCAN_V2_API
}

/**
 * Build a complete API request URL with parameters
 * @param {string|number} chainId - Chain ID
 * @param {Object} params - URL parameters
 * @returns {string} Complete URL
 */
export function buildApiUrl(chainId, params) {
  const apiUrl = getEtherscanApiUrl(chainId)
  const apiKey = getNextApiKey()
  
  const urlParams = new URLSearchParams({
    ...params,
    apikey: apiKey
  })
  
  // Etherscan V2 requires chainid; dedicated explorer APIs identify the chain
  // through their host/path instead.
  if (apiUrl === ETHERSCAN_V2_API) {
    urlParams.set('chainid', String(chainId))
  }
  
  return `${apiUrl}?${urlParams}`
}

/**
 * Fetch from Etherscan API with proper configuration
 * @param {string|number} chainId - Chain ID
 * @param {Object} params - API parameters (module, action, etc.)
 * @param {{tolerateError?: boolean}} [options] - tolerateError returns status-0 payloads
 * @returns {Promise<Object>} API response JSON
 */
export async function fetchFromEtherscan(chainId, params, options = {}) {
  const url = buildApiUrl(chainId, params)
  
  console.debug('[etherscan] Fetching:', url)
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.status === '0' && data.message !== 'No transactions found' && !options.tolerateError) {
    throw new Error(data.result || data.message || 'API error')
  }
  
  return data
}

/**
 * Fetch contract ABI from Etherscan
 * @param {string|number} chainId - Chain ID
 * @param {string} address - Contract address
 * @returns {Promise<Object[]>} Parsed ABI array
 */
export async function fetchContractABI(chainId, address) {
  const data = await fetchFromEtherscan(chainId, {
    module: 'contract',
    action: 'getabi',
    address
  })
  
  if (!data.result) {
    throw new Error('ABI not found')
  }
  
  return JSON.parse(data.result)
}
