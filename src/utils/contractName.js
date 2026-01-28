/**
 * Contract Name Service Module
 * 
 * Fetches contract names from Etherscan/block explorers.
 * Uses Etherscan V2 API with API key rotation.
 * Supports Routescan for specific chains.
 * Handles proxy contracts by fetching implementation names.
 */

import { setName, getCachedName } from './cacheManager.js'
import { chains } from './chains.js'
import {
  getNextApiKey,
  isRoutescanChain,
  getEtherscanApiUrl,
  buildApiUrl,
} from './core/etherscan.js'
import { normalizeAddress } from './core/address.js'

/**
 * In-memory cache for "not found" entries to avoid repeated API calls.
 */
const notFoundCache = new Map()
const NOT_FOUND_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

/**
 * Proxy contract names that should trigger implementation lookup.
 */
const PROXY_CONTRACT_NAMES = [
  'Proxy',
  'TransparentUpgradeableProxy',
  'ERC1967Proxy',
  'BeaconProxy',
  'AdminUpgradeabilityProxy',
  'OwnedUpgradeabilityProxy',
  'InitializableAdminUpgradeabilityProxy'
]

/**
 * Check if a contract name indicates a proxy contract.
 */
function isProxyContractName(name) {
  if (!name) return false
  return PROXY_CONTRACT_NAMES.some(proxyName => 
    name === proxyName || name.endsWith(proxyName)
  )
}

/**
 * Get contract name from cache.
 */
function getFromCache(chainId, address) {
  const normalizedAddr = normalizeAddress(address)
  const notFoundKey = `${chainId}:${normalizedAddr}`
  
  // Check in-memory "not found" cache
  const notFoundExpiry = notFoundCache.get(notFoundKey)
  if (notFoundExpiry && Date.now() < notFoundExpiry) {
    return { name: null, source: 'not-found-cache' }
  }
  
  // Check persistent cache
  const cached = getCachedName(chainId, normalizedAddr)
  if (cached) {
    return { name: cached, source: 'cache' }
  }
  
  return null
}

/**
 * Save contract name to cache.
 */
function saveToCache(chainId, address, name) {
  if (name) {
    setName(address, name, chainId)
  } else {
    // Mark as not found in memory cache
    const notFoundKey = `${chainId}:${normalizeAddress(address)}`
    notFoundCache.set(notFoundKey, Date.now() + NOT_FOUND_EXPIRY_MS)
  }
}

/**
 * Fetch contract name for a single address from Etherscan.
 * If the contract is a proxy, also fetches the implementation contract name.
 */
async function fetchSingleContractName(address, chainId) {
  const normalizedChainId = String(chainId)
  const fetchUrl = buildApiUrl(normalizedChainId, {
    module: 'contract',
    action: 'getsourcecode',
    address
  })
  
  try {
    const response = await fetch(fetchUrl)
    
    if (!response.ok) {
      console.debug('[contract-name] API request failed', { address, status: response.status })
      return { address, name: null }
    }
    
    const data = await response.json()
    
    if (data.status === '1' && data.result && data.result[0]) {
      const contractInfo = data.result[0]
      const contractName = contractInfo.ContractName
      
      // Check if contract is verified and has a name
      if (contractName && contractName !== '' && contractName !== 'Contract source code not verified') {
        
        // Check if it's a proxy contract and has implementation address
        const implAddress = contractInfo.Implementation
        if (isProxyContractName(contractName) && implAddress && implAddress !== '') {
          console.debug('[contract-name] Proxy detected, fetching implementation name', { 
            address, 
            proxyName: contractName,
            implementation: implAddress 
          })
          
          // Add delay before fetching implementation to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Fetch implementation contract name
          const implName = await fetchImplementationName(implAddress, normalizedChainId)
          
          if (implName) {
            const combinedName = `${implName}(Proxy)`
            console.debug('[contract-name] Combined proxy name', { address, name: combinedName })
            return { address, name: combinedName }
          }
        }
        
        console.debug('[contract-name] Found contract name', { address, name: contractName })
        return { address, name: contractName }
      }
    }
    
    console.debug('[contract-name] Contract not verified', { address })
    return { address, name: null }
    
  } catch (e) {
    console.debug('[contract-name] Failed to fetch contract name', { address, error: e.message })
    return { address, name: null }
  }
}

/**
 * Fetch contract name for an implementation address with retry logic.
 */
async function fetchImplementationName(address, chainId, retryCount = 0) {
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 500
  
  const fetchUrl = buildApiUrl(chainId, {
    module: 'contract',
    action: 'getsourcecode',
    address
  })
  
  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    // Check for rate limit
    if (data.status === '0' && data.message === 'NOTOK' && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)))
      return fetchImplementationName(address, chainId, retryCount + 1)
    }
    
    if (data.status === '1' && data.result && data.result[0]) {
      const contractInfo = data.result[0]
      const contractName = contractInfo.ContractName
      
      if (contractName && contractName !== '' && contractName !== 'Contract source code not verified') {
        return contractName
      }
    }
    
    return null
  } catch (e) {
    return null
  }
}

/**
 * Fetch contract names for multiple addresses.
 * Uses cache first, then fetches from Etherscan API for uncached addresses.
 * 
 * @param {string[]} addresses - Addresses to fetch names for
 * @param {string|number} chainId - The chain ID
 * @returns {Promise<Map<string, string>>} Map of address -> contract name
 */
export async function fetchContractNames(addresses, chainId = '1') {
  if (!addresses || addresses.length === 0) {
    return new Map()
  }
  
  const normalizedChainId = String(chainId)
  const nameMap = new Map()
  const uncachedAddresses = []
  
  // Check cache first
  for (const address of addresses) {
    const cached = getFromCache(normalizedChainId, address)
    
    if (cached !== null) {
      if (cached.name) {
        nameMap.set(address.toLowerCase(), cached.name)
      }
    } else {
      uncachedAddresses.push(address)
    }
  }
  
  // If all addresses were cached, return early
  if (uncachedAddresses.length === 0) {
    console.debug('[contract-name] All names from cache', { count: nameMap.size })
    return nameMap
  }
  
  console.debug('[contract-name] Fetching uncached names from Etherscan', { count: uncachedAddresses.length })
  
  // Process in batches to avoid rate limiting
  const BATCH_SIZE = 5
  const DELAY_MS = 200
  
  for (let i = 0; i < uncachedAddresses.length; i += BATCH_SIZE) {
    const batch = uncachedAddresses.slice(i, i + BATCH_SIZE)
    
    // Fetch batch in parallel
    const batchPromises = batch.map(address => 
      fetchSingleContractName(address, normalizedChainId)
    )
    
    const batchResults = await Promise.all(batchPromises)
    
    // Process results and update cache
    for (const { address, name } of batchResults) {
      if (name) {
        nameMap.set(address.toLowerCase(), name)
      }
      // Save to cache (both found and not-found)
      saveToCache(normalizedChainId, address, name)
    }
    
    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < uncachedAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  console.debug('[contract-name] Contract name fetch complete', {
    fetched: uncachedAddresses.length,
    found: nameMap.size
  })
  
  return nameMap
}

/**
 * Fetch a single contract name.
 * @param {string} address 
 * @param {string|number} chainId 
 * @returns {Promise<string|null>}
 */
export async function fetchContractName(address, chainId = '1') {
  const result = await fetchSingleContractName(address, String(chainId))
  if (result.name) {
    saveToCache(String(chainId), address, result.name)
  }
  return result.name
}

/**
 * Get explorer URL for an address using chains config.
 * @param {string} address 
 * @param {string|number} chainId 
 * @returns {string}
 */
export function getExplorerAddressUrl(address, chainId = '1') {
  const numericId = Number(chainId)
  const chain = chains[numericId]
  if (chain?.explorer) {
    return `${chain.explorer}/address/${address}`
  }
  return `https://etherscan.io/address/${address}`
}

/**
 * Get explorer URL for a transaction using chains config.
 * @param {string} txHash 
 * @param {string|number} chainId 
 * @returns {string}
 */
export function getExplorerTxUrl(txHash, chainId = '1') {
  const numericId = Number(chainId)
  const chain = chains[numericId]
  if (chain?.explorer) {
    return `${chain.explorer}/tx/${txHash}`
  }
  return `https://etherscan.io/tx/${txHash}`
}

/**
 * Get chain name from chains config.
 * @param {string|number} chainId 
 * @returns {string}
 */
export function getChainName(chainId) {
  const numericId = Number(chainId)
  const chain = chains[numericId]
  return chain?.name || `Chain ${chainId}`
}

// Re-export core etherscan utilities for backwards compatibility
export { getNextApiKey, isRoutescanChain, getEtherscanApiUrl as getApiUrl }
