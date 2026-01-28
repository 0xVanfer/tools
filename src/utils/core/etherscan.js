/**
 * Core Etherscan API Configuration Module
 * 
 * Single source of truth for all Etherscan API-related configuration:
 * - API keys and rotation
 * - Routescan chain detection
 * - API URL generation
 * 
 * This module is used by:
 * - api.js
 * - abiFetcher.js
 * - contractName.js
 * - linkParsers.js
 */

/**
 * Etherscan V2 API keys for rotation (to avoid rate limiting)
 */
const ETHERSCAN_API_KEYS = [
  'B74HQUR15VESEHDE1HWQSFF6HGDDJ8C9RH',
  '69TECUX4UTVCG19HPW6SRTUW5YHT1J8JZX',
  '6JEUZGXV6NCGQEMKSWEGI46MJRK1QDWJ8C'
]

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
 * Chains that use Routescan API instead of Etherscan V2 API
 * These chains don't support the unified Etherscan V2 endpoint
 */
const ROUTESCAN_CHAINS = new Set(['9745'])

/**
 * Check if a chain uses Routescan API
 * @param {string|number} chainId - Chain ID to check
 * @returns {boolean}
 */
export function isRoutescanChain(chainId) {
  return ROUTESCAN_CHAINS.has(String(chainId))
}

/**
 * Get the Etherscan API base URL for a chain
 * @param {string|number} chainId - Chain ID
 * @returns {string} API base URL
 */
export function getEtherscanApiUrl(chainId) {
  const normalizedChainId = String(chainId)
  if (isRoutescanChain(normalizedChainId)) {
    return `https://api.routescan.io/v2/network/mainnet/evm/${normalizedChainId}/etherscan/api`
  }
  return 'https://api.etherscan.io/v2/api'
}

/**
 * Build a complete API request URL with parameters
 * @param {string|number} chainId - Chain ID
 * @param {Object} params - URL parameters
 * @returns {string} Complete URL
 */
export function buildApiUrl(chainId, params) {
  const apiUrl = getEtherscanApiUrl(chainId)
  const isRoutescan = isRoutescanChain(chainId)
  const apiKey = getNextApiKey()
  
  const urlParams = new URLSearchParams({
    ...params,
    apikey: apiKey
  })
  
  // Etherscan V2 requires chainid parameter, Routescan doesn't (it's in the URL)
  if (!isRoutescan) {
    urlParams.set('chainid', String(chainId))
  }
  
  return `${apiUrl}?${urlParams}`
}

/**
 * Fetch from Etherscan API with proper configuration
 * @param {string|number} chainId - Chain ID
 * @param {Object} params - API parameters (module, action, etc.)
 * @returns {Promise<Object>} API response JSON
 */
export async function fetchFromEtherscan(chainId, params) {
  const url = buildApiUrl(chainId, params)
  
  console.debug('[etherscan] Fetching:', url)
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.status === '0' && data.message !== 'No transactions found') {
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
