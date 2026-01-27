/**
 * Link Parsers Module
 * 
 * Parses transaction URLs from various sources:
 * - Etherscan and compatible block explorers (BSCScan, Arbiscan, etc.)
 * - Tenderly VNet simulations (testnet support removed)
 * - Safe transaction service
 * 
 * Based on reference/payload/js/parsers/etherscan.js
 */

import { EXPLORER_CHAIN_MAP as chainsExplorerMap, chains } from './chains.js'

// ============================================================================
// ETHERSCAN PARSER
// ============================================================================

/**
 * Re-export EXPLORER_CHAIN_MAP from chains.js for backwards compatibility
 * This is now generated dynamically from the chains config
 */
export const EXPLORER_CHAIN_MAP = chainsExplorerMap

/**
 * Etherscan API keys for rate limiting bypass.
 * Rotates through keys on each request.
 */
const ETHERSCAN_API_KEYS = [
  'B74HQUR15VESEHDE1HWQSFF6HGDDJ8C9RH',
  '69TECUX4UTVCG19HPW6SRTUW5YHT1J8JZX',
  '6JEUZGXV6NCGQEMKSWEGI46MJRK1QDWJ8C'
]

let currentApiKeyIndex = 0

function getNextApiKey() {
  const key = ETHERSCAN_API_KEYS[currentApiKeyIndex]
  currentApiKeyIndex = (currentApiKeyIndex + 1) % ETHERSCAN_API_KEYS.length
  return key
}

/**
 * Chain IDs that use Routescan API instead of Etherscan V2 API.
 */
const ROUTESCAN_CHAINS = ['9745']

/**
 * Check if a chain uses Routescan API.
 */
function isRoutescanChain(chainId) {
  return ROUTESCAN_CHAINS.includes(String(chainId))
}

/**
 * Get the API URL for a given chain.
 * Uses Etherscan V2 API for most chains, Routescan API for specific chains.
 */
function getApiUrl(chainId) {
  const normalizedChainId = String(chainId)
  if (isRoutescanChain(normalizedChainId)) {
    return `https://api.routescan.io/v2/network/mainnet/evm/${normalizedChainId}/etherscan/api`
  }
  return 'https://api.etherscan.io/v2/api'
}

/**
 * Check if URL is from a supported block explorer
 */
export function isEtherscanLink(url) {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    const host = parsed.host.toLowerCase()
    
    // Check against EXPLORER_CHAIN_MAP (from chains.js)
    for (const domain of Object.keys(EXPLORER_CHAIN_MAP)) {
      if (host === domain || host.endsWith('.' + domain)) {
        return true
      }
    }
    
    // Also match common explorer URL patterns (fallback)
    return parsed.pathname.includes('/tx/0x') || 
           parsed.pathname.includes('/address/0x')
  } catch {
    return false
  }
}

/**
 * Extract chain ID from explorer URL
 */
export function getChainIdFromUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.host.toLowerCase()
    
    for (const [domain, chainId] of Object.entries(EXPLORER_CHAIN_MAP)) {
      if (host === domain || host.endsWith('.' + domain)) {
        return String(chainId)
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Extract transaction hash from explorer URL
 */
export function extractTxHash(url) {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    
    const txMatch = path.match(/\/tx\/(0x[a-fA-F0-9]{64})/)
    if (txMatch) {
      return txMatch[1].toLowerCase()
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Parse an Etherscan-style transaction link
 */
export async function parseEtherscanLink(url) {
  const chainId = getChainIdFromUrl(url)
  const txHash = extractTxHash(url)
  
  if (!chainId) {
    return { success: false, error: 'Could not determine chain from URL' }
  }
  
  if (!txHash) {
    return { success: false, chainId, error: 'Could not extract transaction hash from URL' }
  }
  
  const apiUrl = getApiUrl(chainId)
  const isRoutescan = isRoutescanChain(chainId)
  
  try {
    const apiKey = getNextApiKey()
    // Routescan API doesn't need chainid parameter (it's in the URL path)
    const fetchUrl = isRoutescan
      ? `${apiUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`
      : `${apiUrl}?chainid=${chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`
    
    console.debug('[etherscan] Fetching transaction', { chainId, txHash, apiUrl })
    
    const response = await fetch(fetchUrl)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.error) {
      throw new Error(data.error.message || 'API returned error')
    }
    
    const result = data.result
    if (!result) {
      throw new Error('Transaction not found')
    }
    
    const payload = result.input
    if (!payload || payload === '0x') {
      return {
        success: true,
        chainId,
        txHash,
        payload: '0x',
        note: 'Transaction has no input data (simple ETH transfer)'
      }
    }
    
    return {
      success: true,
      chainId,
      txHash,
      payload,
      to: result.to,
      from: result.from,
      value: result.value
    }
  } catch (e) {
    return {
      success: false,
      chainId,
      txHash,
      error: `Failed to fetch transaction: ${e.message}`
    }
  }
}

// ============================================================================
// TENDERLY PARSER
// ============================================================================

const TENDERLY_API_BASE = 'https://api.tenderly.co/api/v1'

/**
 * Map of chain IDs to Tenderly RPC network names
 */
const CHAIN_TO_NETWORK = {
  '1': 'mainnet',
  '10': 'optimism',
  '56': 'bsc',
  '100': 'gnosis',
  '137': 'polygon',
  '250': 'fantom',
  '324': 'zksync',
  '5000': 'mantle',
  '8453': 'base',
  '34443': 'mode',
  '42161': 'arbitrum',
  '43114': 'avalanche',
  '59144': 'linea',
  '81457': 'blast',
  '534352': 'scroll',
  '7777777': 'zora',
  '11155111': 'sepolia',
  '11155420': 'optimism-sepolia',
  '84532': 'base-sepolia',
  '421614': 'arbitrum-sepolia'
}

/**
 * Generate VNet RPC URL
 */
export function generateVnetRpcUrl(vnetId, chainId = '1') {
  const network = CHAIN_TO_NETWORK[chainId] || 'mainnet'
  return `https://virtual.${network}.rpc.tenderly.co/${vnetId}`
}

/**
 * Tenderly URL patterns
 * Note: Testnet patterns removed - no longer supported
 */
const TENDERLY_PATTERNS = {
  // VNet transaction: /explorer/vnet/{vnetId}/tx/{txHash}
  vnet: /\/explorer\/vnet\/([a-f0-9-]+)\/tx\/(0x[a-f0-9]+)/i,
  
  // VNet transaction list: /explorer/vnet/{vnetId}/transactions or /explorer/vnet/{vnetId}
  vnetList: /\/explorer\/vnet\/([a-f0-9-]+)(?:\/transactions)?$/i,
  
  // Public simulation: /public/{account}/{project}/simulator/{simId}
  publicSimulator: /\/public\/([^\/]+)\/([^\/]+)\/simulator\/([a-f0-9-]+)/i,
  
  // Shared simulation: /shared/simulation/{simId}
  sharedSimulation: /\/shared\/simulation\/([a-f0-9-]+)/i,
  
  // Account simulation: /{account}/{project}/simulator/{simId}
  accountSimulator: /\/([^\/]+)\/([^\/]+)\/simulator\/([a-f0-9-]+)/i,
  
  // Fork simulation: /{account}/{project}/fork/{forkId}/simulation/{simId}
  forkSimulation: /\/([^\/]+)\/([^\/]+)\/fork\/([a-f0-9-]+)\/simulation\/([a-f0-9-]+)/i,
  
  // Standard transaction: /{account}/{project}/tx/{chainId}/{txHash}
  standardTx: /\/([^\/]+)\/([^\/]+)\/tx\/(\d+)\/(0x[a-f0-9]+)/i,
}

/**
 * Check if URL is from Tenderly
 */
export function isTenderlyLink(url) {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    return parsed.host.includes('tenderly.co')
  } catch {
    return false
  }
}

/**
 * Detect Tenderly URL type
 */
function detectTenderlyUrlType(url) {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    
    for (const [type, pattern] of Object.entries(TENDERLY_PATTERNS)) {
      const matches = path.match(pattern)
      if (matches) {
        return { type, matches }
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Fetch VNet transaction data
 */
async function fetchVnetTransaction(vnetId, txHash) {
  const url = `${TENDERLY_API_BASE}/testnets/public/${vnetId}/tx/${txHash}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  return response.json()
}

/**
 * Fetch VNet transaction list
 */
async function fetchVnetTransactionList(vnetId) {
  const url = `${TENDERLY_API_BASE}/testnets/public/${vnetId}/transactions?offset=0&limit=100`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://dashboard.tenderly.co',
      'Referer': 'https://dashboard.tenderly.co/'
    }
  })
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  
  const data = await response.json()
  return data.fork_transactions || data || []
}

/**
 * Fetch public simulation
 */
async function fetchPublicSimulation(account, project, simId) {
  const url = `${TENDERLY_API_BASE}/public/account/${account}/project/${project}/simulate/${simId}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
    },
    body: ''
  })
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Fetch shared simulation
 */
async function fetchSharedSimulation(simId) {
  const url = `${TENDERLY_API_BASE}/simulations/${simId}`
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
    }
  })
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Process VNet transaction list
 */
function processVnetTransactionList(transactions) {
  if (!Array.isArray(transactions)) return []
  
  const validTxs = transactions.filter(tx => {
    return !!tx.project_id && !!tx.hash && !!tx.input && tx.input !== '0x'
  })
  
  return [...validTxs].reverse()
}

/**
 * Parse a Tenderly link
 */
export async function parseTenderlyLink(url) {
  const detected = detectTenderlyUrlType(url)
  
  if (!detected) {
    return { success: false, error: 'Unrecognized Tenderly URL format' }
  }
  
  const { type, matches } = detected
  let vnetId = null
  let defaultChainId = '1'
  
  // Extract vnetId based on URL type
  if (type === 'vnetList' || type === 'vnet') {
    vnetId = matches[1]
  }
  
  try {
    switch (type) {
      case 'vnetList': {
        const data = await fetchVnetTransactionList(vnetId)
        const transactions = processVnetTransactionList(data)
        
        const listChainId = transactions.length > 0 ? (transactions[0].network_id || '1') : '1'
        defaultChainId = listChainId
        const vnetRpcUrl = generateVnetRpcUrl(vnetId, listChainId)
        
        if (transactions.length === 0) {
          return {
            success: false,
            error: 'No valid transactions found in VNet',
            vnetId,
            vnetRpcUrl,
            chainId: listChainId
          }
        }
        
        if (transactions.length === 1) {
          const tx = transactions[0]
          return {
            success: true,
            payload: tx.input,
            txHash: tx.hash,
            chainId: tx.network_id,
            to: tx.to,
            from: tx.from,
            source: 'tenderly-vnet',
            vnetId,
            vnetRpcUrl
          }
        }
        
        const payloads = transactions.map(tx => ({
          payload: tx.input,
          txHash: tx.hash,
          chainId: tx.network_id,
          to: tx.to,
          from: tx.from
        }))
        
        return {
          success: true,
          isMultiple: true,
          payloads,
          chainId: listChainId,
          source: 'tenderly-vnet-list',
          label: 'VNet Transactions',
          vnetId,
          vnetRpcUrl
        }
      }
      
      case 'vnet': {
        const txHash = matches[2]
        const data = await fetchVnetTransaction(vnetId, txHash)
        
        const tx = data?.fork_transaction || data?.transaction || data
        const payload = tx?.input || data?.input
        const chainId = tx?.network_id || data?.network_id || '1'
        defaultChainId = chainId
        const vnetRpcUrl = generateVnetRpcUrl(vnetId, chainId)
        
        if (!payload) {
          return {
            success: false,
            txHash,
            error: 'Could not find input data in API response',
            vnetId,
            vnetRpcUrl,
            chainId
          }
        }
        
        return {
          success: true,
          payload,
          txHash,
          chainId,
          to: tx?.to || data?.to,
          from: tx?.from || data?.from,
          source: 'tenderly-vnet',
          vnetId,
          vnetRpcUrl
        }
      }
      
      case 'publicSimulator': {
        const account = matches[1]
        const project = matches[2]
        const simId = matches[3]
        
        const data = await fetchPublicSimulation(account, project, simId)
        
        const simulation = data?.simulation || data
        const payload = simulation?.input || 
                       simulation?.transaction?.input ||
                       simulation?.transaction_info?.input
        
        if (!payload) {
          return { success: false, error: 'Could not find input data in simulation response' }
        }
        
        const simChainId = simulation?.network_id || simulation?.transaction?.network_id || '1'
        const forkId = simulation?.fork_id || data?.fork_id
        let simVnetRpcUrl = null
        if (forkId) {
          simVnetRpcUrl = generateVnetRpcUrl(forkId, simChainId)
        }
        
        return {
          success: true,
          payload,
          chainId: simChainId,
          to: simulation?.to || simulation?.transaction?.to,
          from: simulation?.from || simulation?.transaction?.from,
          source: 'tenderly-simulator',
          vnetId: forkId,
          vnetRpcUrl: simVnetRpcUrl
        }
      }
      
      case 'sharedSimulation': {
        const simId = matches[1]
        const data = await fetchSharedSimulation(simId)
        
        const simulation = data?.simulation || data
        const payload = simulation?.input || 
                       simulation?.transaction?.input ||
                       simulation?.transaction_info?.input
        
        if (!payload) {
          return { success: false, error: 'Could not find input data in shared simulation response' }
        }
        
        const sharedChainId = simulation?.network_id || simulation?.transaction?.network_id || '1'
        const sharedForkId = simulation?.fork_id || data?.fork_id
        let sharedVnetRpcUrl = null
        if (sharedForkId) {
          sharedVnetRpcUrl = generateVnetRpcUrl(sharedForkId, sharedChainId)
        }
        
        return {
          success: true,
          payload,
          chainId: sharedChainId,
          to: simulation?.to || simulation?.transaction?.to,
          from: simulation?.from || simulation?.transaction?.from,
          source: 'tenderly-shared-simulation',
          vnetId: sharedForkId,
          vnetRpcUrl: sharedVnetRpcUrl
        }
      }
      
      case 'accountSimulator': {
        const account = matches[1]
        const project = matches[2]
        const simId = matches[3]
        
        try {
          const data = await fetchPublicSimulation(account, project, simId)
          
          const simulation = data?.simulation || data
          const payload = simulation?.input || 
                         simulation?.transaction?.input ||
                         simulation?.transaction_info?.input
          
          if (payload) {
            const accChainId = simulation?.network_id || simulation?.transaction?.network_id || '1'
            const accForkId = simulation?.fork_id || data?.fork_id
            let accVnetRpcUrl = null
            if (accForkId) {
              accVnetRpcUrl = generateVnetRpcUrl(accForkId, accChainId)
            }
            
            return {
              success: true,
              payload,
              chainId: accChainId,
              to: simulation?.to || simulation?.transaction?.to,
              from: simulation?.from || simulation?.transaction?.from,
              source: 'tenderly-account-simulation',
              vnetId: accForkId,
              vnetRpcUrl: accVnetRpcUrl
            }
          }
        } catch (e) {
          // Fall through to error
        }
        
        return {
          success: false,
          error: 'This simulation may require authentication. Please enter payload manually.'
        }
      }
      
      case 'standardTx': {
        const chainId = matches[3]
        const txHash = matches[4]
        
        return {
          success: false,
          chainId,
          txHash,
          error: 'Standard Tenderly transactions require authentication. Please enter payload manually.'
        }
      }
      
      case 'forkSimulation': {
        return {
          success: false,
          error: 'Fork simulations require authentication. Please enter payload manually.'
        }
      }
      
      default:
        return {
          success: false,
          error: `Unsupported Tenderly URL type: ${type}`
        }
    }
  } catch (e) {
    if (vnetId) {
      const vnetRpcUrl = generateVnetRpcUrl(vnetId, defaultChainId)
      return {
        success: false,
        error: `Failed to fetch from Tenderly: ${e.message}`,
        vnetId,
        vnetRpcUrl,
        chainId: defaultChainId
      }
    }
    
    return {
      success: false,
      error: `Failed to fetch from Tenderly: ${e.message}`
    }
  }
}

// ============================================================================
// SAFE LINK PARSER
// ============================================================================

/**
 * Safe Transaction Service API endpoints
 */
const SAFE_TX_SERVICE_URLS = {
  '1': 'https://safe-transaction-mainnet.safe.global',
  '10': 'https://safe-transaction-optimism.safe.global',
  '56': 'https://safe-transaction-bsc.safe.global',
  '100': 'https://safe-transaction-gnosis-chain.safe.global',
  '137': 'https://safe-transaction-polygon.safe.global',
  '8453': 'https://safe-transaction-base.safe.global',
  '42161': 'https://safe-transaction-arbitrum.safe.global',
  '43114': 'https://safe-transaction-avalanche.safe.global',
  '11155111': 'https://safe-transaction-sepolia.safe.global',
}

/**
 * Safe URL patterns
 */
const SAFE_PATTERNS = {
  // Transaction: /transactions/tx?safe={safeAddress}&id=multisig_{safeAddress}_{safeTxHash}
  // Or: /transactions/{safeAddress}_{safeTxHash}
  newFormat: /\/transactions\/tx\?.*id=multisig_([^_&]+)_([^_&]+)/i,
  legacyFormat: /\/transactions\/([^_\/]+)_([^_\/\?]+)/i,
  // Queue format: /transactions/queue?safe={chainPrefix}:{safeAddress}
  queueFormat: /\/transactions\/queue\?safe=([^:]+):([^&]+)/i,
}

/**
 * Chain prefix to chain ID mapping for Safe
 */
const SAFE_CHAIN_PREFIXES = {
  'eth': '1',
  'oeth': '10',
  'bnb': '56',
  'gno': '100',
  'matic': '137',
  'arb1': '42161',
  'base': '8453',
  'avax': '43114',
  'sep': '11155111',
}

/**
 * Check if URL is a Safe transaction link
 */
export function isSafeLink(url) {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    return parsed.host.includes('safe.global') || parsed.host.includes('gnosis-safe.io')
  } catch {
    return false
  }
}

/**
 * Parse a Safe transaction link
 */
export async function parseSafeLink(url) {
  try {
    const parsed = new URL(url)
    const fullUrl = parsed.href
    
    // Try to match URL patterns
    let safeAddress = null
    let safeTxHash = null
    let chainId = '1'
    
    // Try new format first
    const newMatch = fullUrl.match(SAFE_PATTERNS.newFormat)
    if (newMatch) {
      safeAddress = newMatch[1]
      safeTxHash = newMatch[2]
    }
    
    // Try legacy format
    if (!safeAddress) {
      const legacyMatch = parsed.pathname.match(SAFE_PATTERNS.legacyFormat)
      if (legacyMatch) {
        safeAddress = legacyMatch[1]
        safeTxHash = legacyMatch[2]
      }
    }
    
    // Extract chain from URL params or path
    const safeParam = parsed.searchParams.get('safe')
    if (safeParam && safeParam.includes(':')) {
      const [prefix, addr] = safeParam.split(':')
      chainId = SAFE_CHAIN_PREFIXES[prefix] || '1'
      if (!safeAddress) {
        safeAddress = addr
      }
    }
    
    if (!safeAddress || !safeTxHash) {
      return {
        success: false,
        error: 'Could not extract Safe transaction details from URL'
      }
    }
    
    // Normalize safe address
    if (!safeAddress.startsWith('0x')) {
      safeAddress = '0x' + safeAddress
    }
    
    // Normalize safe tx hash
    if (!safeTxHash.startsWith('0x')) {
      safeTxHash = '0x' + safeTxHash
    }
    
    // Fetch from Safe Transaction Service
    const serviceUrl = SAFE_TX_SERVICE_URLS[chainId] || SAFE_TX_SERVICE_URLS['1']
    const apiUrl = `${serviceUrl}/api/v1/multisig-transactions/${safeTxHash}/`
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `Safe Transaction Service returned ${response.status}`,
        chainId,
        safeAddress
      }
    }
    
    const data = await response.json()
    
    // Extract payload
    const payload = data.data || '0x'
    
    return {
      success: true,
      payload,
      chainId,
      txHash: safeTxHash,
      to: data.to,
      from: safeAddress,
      value: data.value,
      source: 'safe',
      safeAddress,
      operation: data.operation,
      safeTxGas: data.safeTxGas,
      baseGas: data.baseGas,
      gasPrice: data.gasPrice,
      nonce: data.nonce
    }
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse Safe link: ${e.message}`
    }
  }
}

// ============================================================================
// UNIFIED LINK PARSER
// ============================================================================

/**
 * Detect the type of link
 */
export function detectLinkType(input) {
  if (!input) return null
  
  const trimmed = input.trim()
  
  // Raw payload (hex)
  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed)) {
    return 'raw'
  }
  
  // URL-based detection
  if (trimmed.startsWith('http')) {
    if (isTenderlyLink(trimmed)) {
      return 'tenderly'
    }
    if (isEtherscanLink(trimmed)) {
      return 'etherscan'
    }
    if (isSafeLink(trimmed)) {
      return 'safe'
    }
  }
  
  return null
}

/**
 * Check if URL is a parsable link
 */
export function isParsableLink(url) {
  return isTenderlyLink(url) || isEtherscanLink(url) || isSafeLink(url)
}

/**
 * Parse any supported link format
 */
export async function parseLink(url) {
  if (isTenderlyLink(url)) {
    return parseTenderlyLink(url)
  }
  if (isEtherscanLink(url)) {
    return parseEtherscanLink(url)
  }
  if (isSafeLink(url)) {
    return parseSafeLink(url)
  }
  return { success: false, error: 'Unsupported link format' }
}

/**
 * Parse any supported input format
 */
export async function parseInput(input) {
  if (!input) {
    return { success: false, error: 'No input provided' }
  }
  
  const trimmed = input.trim()
  const type = detectLinkType(trimmed)
  
  switch (type) {
    case 'raw': {
      const payload = trimmed.startsWith('0x') ? trimmed : '0x' + trimmed
      return {
        success: true,
        payload,
        source: 'raw'
      }
    }
    
    case 'tenderly':
      return parseTenderlyLink(trimmed)
    
    case 'etherscan':
      return parseEtherscanLink(trimmed)
    
    case 'safe':
      return parseSafeLink(trimmed)
    
    default:
      return {
        success: false,
        error: 'Unrecognized input format. Enter a hex payload or paste a supported URL.'
      }
  }
}

