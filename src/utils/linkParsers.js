/**
 * Link Parsers Module
 * 
 * Parses transaction URLs from various sources:
 * - Etherscan and compatible block explorers (BSCScan, Arbiscan, etc.)
 * - Tenderly Virtual Environments (formerly "Virtual TestNets"/VNet) and shared simulations
 * - Safe transaction service
 *
 * Tenderly migration note (2025/2026):
 * - "Tenderly TestNets" are now "Virtual Environments" (VNet is still the internal name).
 * - The legacy public endpoints (`/api/v1/testnets/public/...`) were removed and now 404.
 * - Virtual Environment data is fetched over the environment's public JSON-RPC endpoint
 *   (`eth_getTransactionByHash`), which is CORS-enabled and needs no API key.
 * - The account-scoped REST API (`/api/public/v1/...`) requires an `X-Access-Key` header,
 *   so links that only exist behind authentication return an actionable error.
 */

import { EXPLORER_CHAIN_MAP as chainsExplorerMap, executeWithFallback } from './chains.js'
import { buildApiUrl } from './core/etherscan.js'
import { getItemWithExpiry, setItemWithExpiry } from './storage.js'

// ============================================================================
// ETHERSCAN PARSER
// ============================================================================

/**
 * Re-export EXPLORER_CHAIN_MAP from chains.js for backwards compatibility
 * This is now generated dynamically from the chains config
 */
export const EXPLORER_CHAIN_MAP = chainsExplorerMap

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
    
    // Also match common explorer URL patterns (fallback) for explorers that are
    // not in the chains config, while never claiming another service's URLs.
    if (isTenderlyLink(url) || isSafeLink(url)) return false
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
  
  try {
    const fetchUrl = buildApiUrl(chainId, {
      module: 'proxy',
      action: 'eth_getTransactionByHash',
      txhash: txHash
    })
    
    console.debug('[etherscan] Fetching transaction', { chainId, txHash })
    
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
const TENDERLY_SUPPORTED_NETWORKS_URL = `${TENDERLY_API_BASE}/supported-networks`

/**
 * Static fallback map of chain ID -> Tenderly Virtual Environment RPC slug.
 *
 * Sourced from `GET https://api.tenderly.co/api/v1/supported-networks`
 * (`network_slugs.vnet_rpc_slug`, only networks with `virtual_testnet: true`).
 * The live list is preferred; this map only covers the case where that request
 * fails (offline / rate limited). Keep in sync when Tenderly adds networks.
 */
export const VNET_CHAIN_SLUGS = {
  1: 'mainnet',
  10: 'optimism',
  14: 'flare',
  30: 'rsk',
  31: 'rsk-testnet',
  56: 'binance',
  71: 'cfx-espace-testnet',
  97: 'binance-rialto',
  100: 'gnosis',
  130: 'unichain',
  137: 'polygon',
  143: 'monad',
  146: 'sonic',
  232: 'lens',
  252: 'fraxtal',
  288: 'boba-ethereum',
  300: 'zksync-sepolia',
  324: 'zksync',
  480: 'worldchain-mainnet',
  988: 'stable',
  1030: 'cfx-espace',
  1135: 'lisk',
  1301: 'astrochain-sepolia',
  1328: 'sei-atlantic-2',
  1329: 'sei-pacific-1',
  1439: 'injective-testnet',
  1776: 'injective',
  1868: 'soneium',
  1946: 'soneium-minato',
  2020: 'ronin',
  2201: 'stable-testnet',
  2523: 'fraxtal-hoodi',
  4202: 'lisk-sepolia',
  4326: 'megaeth',
  4663: 'robinhood-chain',
  4801: 'worldchain-sepolia',
  5000: 'mantle',
  5003: 'mantle-sepolia',
  7000: 'zetachain',
  7001: 'zetachain-testnet',
  8453: 'base',
  9069: 'af-nexus-mainnet',
  9070: 'af-nexus-testnet',
  9745: 'plasma',
  9746: 'plasma-testnet',
  10143: 'monad-testnet',
  10200: 'gnosis-chiado-testnet',
  13371: 'immutable',
  13473: 'immutable-testnet',
  14601: 'sonic-testnet',
  28882: 'boba-sepolia',
  33111: 'curtis',
  33139: 'apechain',
  37111: 'lens-sepolia',
  42161: 'arbitrum',
  42220: 'celo',
  43113: 'avalanche-testnet',
  43114: 'avalanche',
  46630: 'robinhood-chain-testnet',
  57073: 'ink',
  59141: 'linea-sepolia',
  59144: 'linea',
  60808: 'bob',
  80002: 'polygon-amoy',
  80069: 'bepolia',
  80094: 'berachain',
  81457: 'blast',
  84532: 'base-sepolia',
  167000: 'taiko-mainnet',
  167013: 'taiko-hoodi',
  421614: 'arbitrum-sepolia',
  534352: 'scroll-mainnet',
  560048: 'hoodi',
  737373: 'katana-bokuto',
  747474: 'katana',
  763373: 'ink-sepolia',
  808813: 'bob-testnet',
  5042002: 'arc-testnet',
  11142220: 'celo-sepolia',
  11155111: 'sepolia',
  11155420: 'optimism-sepolia',
  1230263917: 'interval',
}

// Cache keys / TTLs for the dynamic Tenderly data.
const NETWORKS_CACHE_KEY = 'tenderly:supported-networks'
const NETWORKS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
const VNET_DISCOVERY_CACHE_KEY = 'tenderly:vnet-network'
const VNET_DISCOVERY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7d

// In-memory caches (per page load).
let supportedNetworksPromise = null
const vnetNetworkCache = new Map() // vnetId -> { chainId, slug, identifier }

/**
 * Build the host for a Virtual Environment RPC endpoint.
 *
 * Current Tenderly URL layout (see docs: virtual-environments/named-rpc-urls):
 *   Public RPC: https://virtual.[NETWORK].[REGION].rpc.tenderly.co/[ACCOUNT]/[PROJECT]/[RPC_NAME]
 *   Admin RPC:  .../[RPC_NAME]-[SUFFIX]
 * The region segment (`eu` | `us-east`) is optional; the legacy region-less host is
 * still served and is what a bare environment identifier uses.
 *
 * @param {string} slug - Tenderly network slug (e.g. "mainnet")
 * @param {string} [region] - Optional region ("eu" or "us-east")
 * @returns {string} RPC host without trailing slash
 */
function vnetRpcHost(slug, region) {
  return region
    ? `https://virtual.${slug}.${region}.rpc.tenderly.co`
    : `https://virtual.${slug}.rpc.tenderly.co`
}

/**
 * Generate a Virtual Environment RPC URL from an environment identifier.
 *
 * @param {string} identifier - Environment id (UUID) or the `[ACCOUNT]/[PROJECT]/[RPC_NAME]` path
 * @param {string|number} [chainIdOrSlug] - Chain ID or Tenderly network slug
 * @param {{ region?: string, slug?: string }} [options] - Explicit slug / region
 * @returns {string} Public RPC URL
 */
export function generateVnetRpcUrl(identifier, chainIdOrSlug = null, options = {}) {
  const { region = '', slug } = options
  let network = slug || null

  if (!network && chainIdOrSlug !== null && chainIdOrSlug !== undefined && chainIdOrSlug !== '') {
    const key = String(chainIdOrSlug)
    if (VNET_CHAIN_SLUGS[key]) {
      network = VNET_CHAIN_SLUGS[key]
    } else if (!/^\d+$/.test(key) && /^[a-z0-9-]+$/i.test(key)) {
      // Treat a non-numeric value as an explicit network slug.
      network = key.toLowerCase()
    }
  }

  if (!network) network = 'mainnet'

  const path = String(identifier || '').replace(/^\/+|\/+$/g, '')
  return `${vnetRpcHost(network, region)}/${path}`
}

/**
 * Tenderly dashboard URL patterns.
 *
 * Confirmed against the current dashboard:
 * - VNet env:      /explorer/vnet/{vnetId}
 * - VNet env + tx: /explorer/vnet/{vnetId}/tx/{txHash}
 * - Shared sim:    https://www.tdly.co/shared/simulation/{simId}
 * - Own sim:       /{account}/{project}/simulator/{simId}
 * - Explorer tx:   /tx/{networkSlug}/{txHash}
 */
const TENDERLY_PATTERNS = {
  // VNet transaction: /explorer/vnet/{vnetId}/tx/{txHash}
  vnet: /\/explorer\/vnet\/(.+?)\/tx\/(0x[a-fA-F0-9]{64})/i,

  // VNet environment (optionally /transactions): /explorer/vnet/{vnetId}
  vnetList: /\/explorer\/vnet\/([^/?#]+(?:\/[^/?#]+)*?)(?:\/transactions)?\/?$/i,

  // Shared simulation: /shared/simulation/{simId}
  sharedSimulation: /\/shared\/simulation\/([a-fA-F0-9-]+)/i,

  // Public simulation (legacy, account-scoped): /public/{account}/{project}/simulator/{simId}
  publicSimulator: /\/public\/([^/]+)\/([^/]+)\/simulator\/([a-fA-F0-9-]+)/i,

  // Account simulation (current): /{account}/{project}/simulator/{simId}
  accountSimulator: /\/([^/]+)\/([^/]+)\/simulator\/([a-fA-F0-9-]+)/i,

  // Fork simulation: /{account}/{project}/fork/{forkId}/simulation/{simId}
  forkSimulation: /\/([^/]+)\/([^/]+)\/fork\/([a-fA-F0-9-]+)\/simulation\/([a-fA-F0-9-]+)/i,

  // Tenderly explorer transaction: /tx/{networkSlug}/{txHash}
  explorerTx: /\/tx\/([a-zA-Z0-9-]+)\/(0x[a-fA-F0-9]{64})/,
}

/**
 * Check if URL is from Tenderly.
 *
 * Matches both `*.tenderly.co` (dashboard/API) and the short share domain
 * `*.tdly.co`, which is what shared-simulation links use.
 */
export function isTenderlyLink(url) {
  if (!url) return false

  try {
    const host = new URL(url).host.toLowerCase()
    return (
      host === 'tenderly.co' || host.endsWith('.tenderly.co') ||
      host === 'tdly.co' || host.endsWith('.tdly.co')
    )
  } catch {
    return false
  }
}

/**
 * Fetch (and cache) Tenderly's supported-network list.
 *
 * Public endpoint, no API key required. Returns:
 *   [{ chainId, name, explorerSlug, vnetSlug, isTestnet }]
 */
export async function fetchTenderlyNetworks() {
  if (supportedNetworksPromise) return supportedNetworksPromise

  supportedNetworksPromise = (async () => {
    const cached = getItemWithExpiry(NETWORKS_CACHE_KEY)
    if (Array.isArray(cached) && cached.length > 0) return cached

    const response = await fetch(TENDERLY_SUPPORTED_NETWORKS_URL, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Tenderly supported-networks request failed: ${response.status}`)
    }

    const raw = await response.json()
    const list = (Array.isArray(raw) ? raw : raw?.networks || [])
      .map((n) => ({
        chainId: String(n.chain_id ?? n.chainId ?? ''),
        name: n.network_name || n.name || '',
        explorerSlug: n.network_slugs?.explorer_slug || '',
        vnetSlug: n.network_slugs?.vnet_rpc_slug || '',
        isTestnet: !!n.is_testnet,
        supportsVnet: !!n.supported_features?.virtual_testnet,
      }))
      .filter((n) => n.chainId)

    if (list.length > 0) setItemWithExpiry(NETWORKS_CACHE_KEY, list, NETWORKS_CACHE_TTL)
    return list
  })().catch((e) => {
    // Allow a later retry after a failure.
    supportedNetworksPromise = null
    throw e
  })

  return supportedNetworksPromise
}

/**
 * Fallback network list built from VNET_CHAIN_SLUGS (used when the live fetch fails).
 */
function fallbackNetworks() {
  return Object.entries(VNET_CHAIN_SLUGS).map(([chainId, slug]) => ({
    chainId,
    name: `Chain ${chainId}`,
    explorerSlug: slug,
    vnetSlug: slug,
    isTestnet: false,
    supportsVnet: true,
  }))
}

/**
 * Resolve the chain ID of a Tenderly explorer network slug (e.g. "optimistic" -> 10).
 */
async function chainIdFromExplorerSlug(slug) {
  const wanted = String(slug || '').toLowerCase()
  if (!wanted) return null
  // Some legacy links embed the numeric chain ID instead of a network slug.
  if (/^\d+$/.test(wanted)) return wanted

  let networks
  try {
    networks = await fetchTenderlyNetworks()
  } catch {
    networks = fallbackNetworks()
  }
  const hit = networks.find(
    (n) =>
      n.explorerSlug?.toLowerCase() === wanted ||
      n.vnetSlug?.toLowerCase() === wanted ||
      n.name?.toLowerCase().replace(/\s+/g, '-') === wanted,
  )
  return hit?.chainId || null
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
 * Minimal JSON-RPC helper with an abort-based timeout.
 */
async function rpcCall(rpcUrl, method, params, timeout = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`RPC request failed: ${response.status}`)
    const json = await response.json()
    if (json.error) throw new Error(json.error.message || 'RPC error')
    return json.result
  } finally {
    clearTimeout(timer)
  }
}

// Preferred probe order when discovering which network a Virtual Environment forked.
const NETWORK_PRIORITY = [
  'mainnet', 'base', 'arbitrum', 'optimism', 'unichain', 'binance', 'polygon',
  'sepolia', 'base-sepolia', 'arbitrum-sepolia', 'optimism-sepolia',
  'gnosis', 'avalanche', 'ink', 'soneium', 'monad', 'plasma', 'sonic',
  'berachain', 'mantle', 'linea', 'blast', 'celo', 'katana', 'lisk',
]

function networkPriority(network) {
  const i = NETWORK_PRIORITY.indexOf(network.vnetSlug)
  return (network.isTestnet ? 100 : 0) + (i < 0 ? 50 : i)
}

/**
 * Discover which parent network a Virtual Environment belongs to.
 *
 * A dashboard URL only carries the environment id, so we probe the public RPC
 * endpoint of each VNet-capable network until one answers. `eth_chainId` is not
 * used as the parent identifier itself, because environments may override the
 * chain ID — the network that answers is the parent.
 *
 * @param {string} vnetId
 * @returns {Promise<{chainId: string, slug: string, virtualChainId: string, identifier: string, rpcUrl: string}|null>}
 */
export async function discoverVnetNetwork(vnetId, { timeout = 10000 } = {}) {
  const cacheKey = String(vnetId).toLowerCase()
  if (vnetNetworkCache.has(cacheKey)) return vnetNetworkCache.get(cacheKey)

  const stored = getItemWithExpiry(`${VNET_DISCOVERY_CACHE_KEY}:${cacheKey}`)
  if (stored?.slug && stored?.rpcUrl) {
    vnetNetworkCache.set(cacheKey, stored)
    return stored
  }

  let networks
  try {
    networks = await fetchTenderlyNetworks()
  } catch {
    networks = fallbackNetworks()
  }

  const candidates = networks
    .filter((n) => n.vnetSlug && n.supportsVnet !== false)
    .sort((a, b) => networkPriority(a) - networkPriority(b))

  let index = 0
  let found = null

  async function worker() {
    while (!found && index < candidates.length) {
      const candidate = candidates[index++]
      if (!candidate) return
      const rpcUrl = `${vnetRpcHost(candidate.vnetSlug)}/${encodeURIComponent(vnetId)}`
      try {
        const chainIdHex = await rpcCall(rpcUrl, 'eth_chainId', [], timeout)
        if (typeof chainIdHex === 'string' && chainIdHex.startsWith('0x')) {
          found = {
            chainId: candidate.chainId,
            slug: candidate.vnetSlug,
            virtualChainId: String(parseInt(chainIdHex, 16)),
            identifier: String(vnetId),
            rpcUrl,
          }
        }
      } catch {
        // Wrong network (or transient failure) — try the next candidate.
      }
    }
  }

  const concurrency = Math.min(8, candidates.length)
  await Promise.all(Array.from({ length: concurrency }, worker))

  if (found) {
    vnetNetworkCache.set(cacheKey, found)
    setItemWithExpiry(`${VNET_DISCOVERY_CACHE_KEY}:${cacheKey}`, found, VNET_DISCOVERY_CACHE_TTL)
  }
  return found
}

/**
 * Fetch a transaction from a Virtual Environment over its public JSON-RPC.
 *
 * Replaces the removed `/api/v1/testnets/public/{vnetId}/tx/{hash}` endpoint.
 */
async function fetchVnetTransaction(vnetId, txHash) {
  const network = await discoverVnetNetwork(vnetId)
  if (!network) {
    throw new Error(
      'Could not reach this Virtual Environment. It may have been deleted, or its public RPC is disabled.',
    )
  }
  const tx = await rpcCall(network.rpcUrl, 'eth_getTransactionByHash', [txHash])
  if (!tx) throw new Error('Transaction not found on this Virtual Environment')
  return { tx, network }
}

/**
 * Fetch a shared simulation.
 *
 * `https://www.tdly.co/shared/simulation/{id}` is backed by the public
 * `GET /api/v1/simulations/{id}` endpoint (no API key required).
 */
async function fetchSharedSimulation(simId) {
  const url = `${TENDERLY_API_BASE}/simulations/${encodeURIComponent(simId)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Shared simulation not found (it may have been unshared or deleted)'
        : `API request failed: ${response.status}`,
    )
  }

  return response.json()
}

/**
 * Extract the transaction input/context from a simulation API response.
 */
function extractSimulationPayload(data) {
  const simulation = data?.simulation || data
  const transaction = simulation?.transaction || simulation?.transaction_info || {}
  const payload =
    simulation?.input ||
    transaction?.input ||
    simulation?.transaction_info?.input ||
    data?.input ||
    null
  const chainId = String(
    simulation?.network_id || transaction?.network_id || data?.network_id || '',
  )
  return {
    payload,
    chainId: chainId || null,
    to: simulation?.to || transaction?.to || data?.to || null,
    from: simulation?.from || transaction?.from || data?.from || null,
  }
}

/**
 * Fetch a transaction from a production/standard chain RPC using the RPC list
 * configured in chains.js.
 */
async function fetchTxViaChainRpc(chainId, txHash) {
  return executeWithFallback(chainId, async (rpc) => {
    const tx = await rpcCall(rpc, 'eth_getTransactionByHash', [txHash])
    if (!tx) throw new Error('Transaction not found')
    return tx
  })
}

/**
 * Parse a Tenderly link.
 *
 * Supported (public, no credentials):
 * - Virtual Environment transaction: https://dashboard.tenderly.co/explorer/vnet/{id}/tx/{hash}
 * - Shared simulation:               https://www.tdly.co/shared/simulation/{id}
 * - Tenderly explorer transaction:   https://dashboard.tenderly.co/tx/{network}/{hash}
 *
 * Recognised but not readable without a Tenderly API key (returns an actionable
 * error): account-scoped simulator URLs and bare Virtual Environment URLs.
 */
export async function parseTenderlyLink(url) {
  const detected = detectTenderlyUrlType(url)

  if (!detected) {
    return { success: false, error: 'Unrecognized Tenderly URL format' }
  }

  const { type, matches } = detected
  let vnetId = null
  let vnetRpcUrl = null
  let chainId = null

  if (type === 'vnet' || type === 'vnetList') vnetId = matches[1]

  try {
    switch (type) {
      case 'vnet': {
        const txHash = matches[2].toLowerCase()
        const { tx, network } = await fetchVnetTransaction(vnetId, txHash)
        chainId = network.chainId
        vnetRpcUrl = network.rpcUrl

        const payload = tx.input
        if (!payload || payload === '0x') {
          return {
            success: false, chainId, txHash, vnetId, vnetRpcUrl,
            error: 'This Virtual Environment transaction has no input data (simple transfer)',
          }
        }

        return {
          success: true,
          payload,
          txHash: (tx.hash || txHash).toLowerCase(),
          chainId,
          to: tx.to || null,
          from: tx.from || null,
          value: tx.value,
          source: 'tenderly-vnet',
          vnetId,
          vnetRpcUrl,
          virtualChainId: network.virtualChainId,
        }
      }

      case 'vnetList': {
        // The unauthenticated endpoint that used to list Virtual Environment
        // transactions was removed; the replacement needs an API key. Resolve the
        // network anyway so the caller can still offer "read contract state".
        const network = await discoverVnetNetwork(vnetId)
        if (network) {
          chainId = network.chainId
          vnetRpcUrl = network.rpcUrl
        }
        return {
          success: false,
          vnetId,
          vnetRpcUrl,
          chainId,
          error: network
            ? 'Open a specific transaction in this Virtual Environment and paste that link, or paste the calldata directly.'
            : 'Could not reach this Virtual Environment. It may have been deleted, or its public RPC is disabled.',
        }
      }

      case 'sharedSimulation': {
        const data = await fetchSharedSimulation(matches[1])
        const extracted = extractSimulationPayload(data)
        chainId = extracted.chainId

        if (!extracted.payload) {
          return { success: false, error: 'Could not find input data in shared simulation response' }
        }

        return {
          success: true,
          payload: extracted.payload,
          chainId,
          to: extracted.to,
          from: extracted.from,
          source: 'tenderly-shared-simulation',
        }
      }

      case 'explorerTx': {
        const networkSlug = matches[1]
        const txHash = matches[2].toLowerCase()
        chainId = await chainIdFromExplorerSlug(networkSlug)

        if (!chainId) {
          return {
            success: false,
            txHash,
            error: `Unknown Tenderly network "${networkSlug}" — cannot resolve its chain ID`,
          }
        }

        const tx = await fetchTxViaChainRpc(chainId, txHash)
        const payload = tx.input
        if (!payload || payload === '0x') {
          return {
            success: false, chainId, txHash,
            error: 'Transaction has no input data (simple ETH transfer)',
          }
        }

        return {
          success: true,
          payload,
          chainId,
          txHash: (tx.hash || txHash).toLowerCase(),
          to: tx.to,
          from: tx.from,
          value: tx.value,
          source: 'tenderly-explorer-tx',
        }
      }

      case 'publicSimulator':
      case 'accountSimulator':
      case 'forkSimulation':
        return {
          success: false,
          error:
            'This simulation is private to a Tenderly project. Enable public sharing ' +
            '(which produces a tdly.co/shared/simulation/... link), or paste the payload manually.',
        }

      default:
        return { success: false, error: `Unsupported Tenderly URL type: ${type}` }
    }
  } catch (e) {
    return {
      success: false,
      error: `Failed to fetch from Tenderly: ${e.message}`,
      ...(vnetId ? { vnetId } : {}),
      ...(vnetRpcUrl ? { vnetRpcUrl } : {}),
      ...(chainId ? { chainId } : {}),
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

