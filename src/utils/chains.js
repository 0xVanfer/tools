/**
 * Chain configuration - centralized chain data for all tools
 * 
 * Chain data sourced from:
 * - Chain IDs and names from kit/ethaddr/chain.go
 * - Block explorers from kit/consts/blockscan.go
 * - RPCs from chainlist.org (excluding ankr, drpc)
 */

// Track failed RPCs with timestamp (for temporary backoff)
const failedRpcs = new Map() // rpc -> timestamp
const RPC_BACKOFF_MS = 60000 // 1 minute backoff for failed RPCs

/**
 * Main chain configuration object keyed by chain ID (number)
 * 
 * Each chain contains:
 * - name: Display name
 * - shortName: Short identifier (for CHAINS object keys)
 * - internalName: Internal name from Go (for compatibility)
 * - explorer: Block explorer base URL
 * - rpcs: Array of RPC URLs (excluding ankr, drpc)
 * 
 * Note: All chains use unified Etherscan V2 API (https://api.etherscan.io/v2/api)
 * Some chains use Routescan API instead (see ROUTESCAN_CHAINS in api.js)
 */
export const chains = {
  // ============================================================================
  // Ethereum & L2s
  // ============================================================================
  1: {
    name: 'Ethereum',
    shortName: 'ETH',
    internalName: 'ethereum',
    explorer: 'https://etherscan.io',
    rpcs: [
      'https://eth.llamarpc.com',
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
      'https://rpc.mevblocker.io',
      'https://rpc.flashbots.net',
      'https://cloudflare-eth.com',
      'https://eth-mainnet.public.blastapi.io',
      'https://ethereum.public.blockpi.network/v1/rpc/public',
      'https://rpc.payload.de',
      'https://eth.meowrpc.com',
      'https://eth.merkle.io',
      'https://0xrpc.io/eth',
      'https://endpoints.omniatech.io/v1/eth/mainnet/public',
    ],
  },
  10: {
    name: 'Optimism',
    shortName: 'OP',
    internalName: 'optimism',
    explorer: 'https://optimistic.etherscan.io',
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism.llamarpc.com',
      'https://optimism-rpc.publicnode.com',
      'https://1rpc.io/op',
      'https://optimism.public.blastapi.io',
      'https://optimism.blockpi.network/v1/rpc/public',
      'https://optimism.meowrpc.com',
      'https://0xrpc.io/op',
    ],
  },
  56: {
    name: 'BNB Chain',
    shortName: 'BSC',
    internalName: 'bsc',
    explorer: 'https://bscscan.com',
    rpcs: [
      'https://binance.llamarpc.com',
      'https://bsc-dataseed.bnbchain.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
      'https://bsc-rpc.publicnode.com',
      'https://1rpc.io/bnb',
      'https://bsc-mainnet.public.blastapi.io',
      'https://bsc.meowrpc.com',
      'https://bsc.blockpi.network/v1/rpc/public',
    ],
  },
  66: {
    name: 'OKXChain',
    shortName: 'OKX',
    internalName: 'okex',
    explorer: 'https://www.oklink.com',
    rpcs: [
      'https://exchainrpc.okex.org',
      'https://okc-mainnet.gateway.pokt.network/v1/lb/6275309bea1b320039c893ff',
    ],
  },
  100: {
    name: 'Gnosis',
    shortName: 'GNO',
    internalName: 'gnosis',
    explorer: 'https://gnosisscan.io',
    rpcs: [
      'https://rpc.gnosischain.com',
      'https://gnosis-rpc.publicnode.com',
      'https://1rpc.io/gnosis',
      'https://gnosis-mainnet.public.blastapi.io',
      'https://gnosis.blockpi.network/v1/rpc/public',
      'https://gnosis.meowrpc.com',
      'https://0xrpc.io/gnosis',
    ],
  },
  128: {
    name: 'Heco',
    shortName: 'HECO',
    internalName: 'heco',
    explorer: 'https://hecoinfo.com',
    rpcs: [
      'https://http-mainnet.hecochain.com',
      'https://http-mainnet-node.huobichain.com',
    ],
  },
  137: {
    name: 'Polygon',
    shortName: 'MATIC',
    internalName: 'polygon',
    explorer: 'https://polygonscan.com',
    rpcs: [
      'https://polygon-rpc.com',
      'https://polygon.llamarpc.com',
      'https://polygon-bor-rpc.publicnode.com',
      'https://1rpc.io/matic',
      'https://polygon-mainnet.public.blastapi.io',
      'https://polygon.blockpi.network/v1/rpc/public',
      'https://polygon.meowrpc.com',
      'https://0xrpc.io/matic',
    ],
  },
  143: {
    name: 'Monad',
    shortName: 'MONAD',
    internalName: 'monad',
    explorer: 'https://monadexplorer.com',
    rpcs: [],
  },
  146: {
    name: 'Sonic',
    shortName: 'SONIC',
    internalName: 'sonic',
    explorer: 'https://sonicscan.org',
    rpcs: [
      'https://rpc.soniclabs.com',
      'https://sonic.public-rpc.com',
    ],
  },
  239: {
    name: 'Tac',
    shortName: 'TAC',
    internalName: 'tac',
    explorer: 'https://explorer.tac.build',
    rpcs: [],
  },
  250: {
    name: 'Fantom',
    shortName: 'FTM',
    internalName: 'fantom',
    explorer: 'https://ftmscan.com',
    rpcs: [
      'https://rpc.ftm.tools',
      'https://fantom-rpc.publicnode.com',
      'https://1rpc.io/ftm',
      'https://fantom-mainnet.public.blastapi.io',
      'https://fantom.blockpi.network/v1/rpc/public',
      'https://0xrpc.io/ftm',
    ],
  },
  252: {
    name: 'Fraxtal',
    shortName: 'FRAX',
    internalName: 'fraxtal',
    explorer: 'https://fraxscan.com',
    rpcs: [
      'https://rpc.frax.com',
      'https://fraxtal.public-rpc.com',
    ],
  },
  314: {
    name: 'Filecoin',
    shortName: 'FIL',
    internalName: 'filecoin',
    explorer: 'https://filscan.io',
    rpcs: [
      'https://api.node.glif.io',
      'https://filecoin.public-rpc.com',
    ],
  },
  324: {
    name: 'zkSync Era',
    shortName: 'ZKSYNC',
    internalName: 'zksync',
    explorer: 'https://explorer.zksync.io',
    rpcs: [
      'https://mainnet.era.zksync.io',
      'https://zksync-era.public-rpc.com',
      'https://1rpc.io/zksync2-era',
      'https://zksync.meowrpc.com',
    ],
  },
  480: {
    name: 'World Chain',
    shortName: 'WORLD',
    internalName: 'worldchain',
    explorer: 'https://worldscan.org',
    rpcs: [
      'https://worldchain-mainnet.g.alchemy.com/public',
      'https://worldchain.public-rpc.com',
    ],
  },
  999: {
    name: 'HyperEVM',
    shortName: 'HYPER',
    internalName: 'hyperevm',
    explorer: 'https://hyperevmscan.io',
    rpcs: [],
  },
  1101: {
    name: 'Polygon zkEVM',
    shortName: 'ZKEVM',
    internalName: 'polygonzk',
    explorer: 'https://zkevm.polygonscan.com',
    rpcs: [
      'https://zkevm-rpc.com',
      'https://polygon-zkevm.public-rpc.com',
      'https://1rpc.io/polygon/zkevm',
      'https://polygon-zkevm-mainnet.public.blastapi.io',
      'https://polygon-zkevm.blockpi.network/v1/rpc/public',
    ],
  },
  1284: {
    name: 'Moonbeam',
    shortName: 'GLMR',
    internalName: 'moonbeam',
    explorer: 'https://moonscan.io',
    rpcs: [
      'https://rpc.api.moonbeam.network',
      'https://moonbeam-rpc.publicnode.com',
      'https://1rpc.io/glmr',
      'https://moonbeam.public.blastapi.io',
    ],
  },
  1329: {
    name: 'Sei',
    shortName: 'SEI',
    internalName: 'sei',
    explorer: 'https://seitrace.com',
    rpcs: [
      'https://evm-rpc.sei-apis.com',
      'https://sei-rpc.publicnode.com',
    ],
  },
  2031: {
    name: 'Centrifuge',
    shortName: 'CFG',
    internalName: 'centrifuge',
    explorer: 'https://centrifuge.subscan.io',
    rpcs: [
      'https://fullnode.centrifuge.io',
    ],
  },
  2222: {
    name: 'Kava',
    shortName: 'KAVA',
    internalName: 'kava',
    explorer: 'https://kavascan.com',
    rpcs: [
      'https://evm.kava.io',
      'https://kava-evm-rpc.publicnode.com',
    ],
  },
  4200: {
    name: 'Merlin',
    shortName: 'MERL',
    internalName: 'merlin',
    explorer: 'https://scan.merlinchain.io',
    rpcs: [
      'https://rpc.merlinchain.io',
    ],
  },
  5000: {
    name: 'Mantle',
    shortName: 'MNT',
    internalName: 'mantle',
    explorer: 'https://mantlescan.xyz',
    rpcs: [
      'https://rpc.mantle.xyz',
      'https://mantle-rpc.publicnode.com',
      'https://mantle-mainnet.public.blastapi.io',
      'https://mantle.public-rpc.com',
    ],
  },
  8453: {
    name: 'Base',
    shortName: 'BASE',
    internalName: 'base',
    explorer: 'https://basescan.org',
    rpcs: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base-rpc.publicnode.com',
      'https://1rpc.io/base',
      'https://base-mainnet.public.blastapi.io',
      'https://base.blockpi.network/v1/rpc/public',
      'https://base.meowrpc.com',
      'https://0xrpc.io/base',
    ],
  },
  9745: {
    name: 'Plasma',
    shortName: 'PLASMA',
    internalName: 'plasma',
    explorer: 'https://plasmascan.to',
    rpcs: [
      'https://rpc.plasma.nexus',
    ],
  },
  13371: {
    name: 'Immutable',
    shortName: 'IMX',
    internalName: 'immutable',
    explorer: 'https://immutascan.io',
    rpcs: [
      'https://rpc.immutable.com',
    ],
  },
  34443: {
    name: 'Mode',
    shortName: 'MODE',
    internalName: 'mode',
    explorer: 'https://explorer.mode.network',
    rpcs: [
      'https://mainnet.mode.network',
      'https://1rpc.io/mode',
      'https://mode.public-rpc.com',
    ],
  },
  42161: {
    name: 'Arbitrum One',
    shortName: 'ARB',
    internalName: 'arbitrum',
    explorer: 'https://arbiscan.io',
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://1rpc.io/arb',
      'https://arbitrum-mainnet.public.blastapi.io',
      'https://arbitrum.blockpi.network/v1/rpc/public',
      'https://arbitrum.meowrpc.com',
      'https://0xrpc.io/arb',
    ],
  },
  42220: {
    name: 'Celo',
    shortName: 'CELO',
    internalName: 'celo',
    explorer: 'https://celoscan.io',
    rpcs: [
      'https://forno.celo.org',
      'https://celo-rpc.publicnode.com',
      'https://1rpc.io/celo',
      'https://celo.public-rpc.com',
    ],
  },
  43114: {
    name: 'Avalanche',
    shortName: 'AVAX',
    internalName: 'avalanche',
    explorer: 'https://snowscan.xyz',
    rpcs: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://1rpc.io/avax/c',
      'https://avalanche-mainnet.public.blastapi.io/ext/bc/C/rpc',
      'https://avax.meowrpc.com',
      'https://0xrpc.io/avax',
    ],
  },
  48900: {
    name: 'Zircuit',
    shortName: 'ZRC',
    internalName: 'zircuit',
    explorer: 'https://explorer.zircuit.com',
    rpcs: [
      'https://zircuit1-mainnet.p2pify.com',
      'https://zircuit-mainnet.public-rpc.com',
    ],
  },
  59144: {
    name: 'Linea',
    shortName: 'LINEA',
    internalName: 'linea',
    explorer: 'https://lineascan.build',
    rpcs: [
      'https://rpc.linea.build',
      'https://linea-rpc.publicnode.com',
      'https://1rpc.io/linea',
      'https://linea.blockpi.network/v1/rpc/public',
    ],
  },
  80094: {
    name: 'Berachain',
    shortName: 'BERA',
    internalName: 'bera',
    explorer: 'https://berascan.com',
    rpcs: [
      'https://rpc.berachain.com',
      'https://berachain-mainnet.rpc.porters.xyz',
      'https://bera.public-rpc.com',
    ],
  },
  81457: {
    name: 'Blast',
    shortName: 'BLAST',
    internalName: 'blast',
    explorer: 'https://blastscan.io',
    rpcs: [
      'https://rpc.blast.io',
      'https://blast.public-rpc.com',
      'https://blast.blockpi.network/v1/rpc/public',
    ],
  },
  167000: {
    name: 'Taiko',
    shortName: 'TAIKO',
    internalName: 'taiko',
    explorer: 'https://taikoscan.io',
    rpcs: [
      'https://rpc.taiko.xyz',
      'https://rpc.mainnet.taiko.xyz',
      'https://taiko-rpc.publicnode.com',
    ],
  },
  534352: {
    name: 'Scroll',
    shortName: 'SCROLL',
    internalName: 'scroll',
    explorer: 'https://scrollscan.com',
    rpcs: [
      'https://rpc.scroll.io',
      'https://scroll-rpc.publicnode.com',
      'https://1rpc.io/scroll',
      'https://scroll-mainnet.public.blastapi.io',
    ],
  },
  810180: {
    name: 'zkLink Nova',
    shortName: 'ZKLINK',
    internalName: 'zklinknova',
    explorer: 'https://explorer.zklink.io',
    rpcs: [
      'https://rpc.zklink.io',
    ],
  },

  // ============================================================================
  // Testnets (kept for reference but marked as testnet)
  // ============================================================================
  5: {
    name: 'Goerli',
    shortName: 'GOERLI',
    internalName: 'goerli',
    explorer: 'https://goerli.etherscan.io',
    isTestnet: true,
    rpcs: [
      'https://rpc.goerli.mudit.blog',
      'https://goerli.gateway.tenderly.co',
    ],
  },
  10143: {
    name: 'Monad Testnet',
    shortName: 'MONAD-TEST',
    internalName: 'monadtestnet',
    explorer: 'https://testnet.monadexplorer.com',
    isTestnet: true,
    rpcs: [],
  },
  421614: {
    name: 'Arbitrum Sepolia',
    shortName: 'ARB-SEP',
    internalName: 'arbitrum-sepolia',
    explorer: 'https://sepolia.arbiscan.io',
    isTestnet: true,
    rpcs: [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia-rpc.publicnode.com',
    ],
  },
  11155111: {
    name: 'Sepolia',
    shortName: 'SEP',
    internalName: 'sepolia',
    explorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    rpcs: [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://1rpc.io/sepolia',
      'https://sepolia.public-rpc.com',
    ],
  },
}

/**
 * Build explorer domain to chain ID mapping
 * Returns string chain IDs for compatibility with reference implementation
 */
export const EXPLORER_CHAIN_MAP = Object.entries(chains).reduce((acc, [chainId, config]) => {
  if (config.explorer) {
    try {
      const url = new URL(config.explorer)
      acc[url.hostname] = String(chainId)
    } catch (e) {
      // Invalid URL, skip
    }
  }
  return acc
}, {})

/**
 * CHAINS object for dropdown compatibility
 * Provides id and name for each chain
 */
export const CHAINS = Object.entries(chains).reduce((acc, [chainId, config]) => {
  acc[chainId] = {
    id: chainId,
    name: config.name,
    ...config
  }
  return acc
}, {})

/**
 * Get chain config by ID
 * @param {string|number} chainId 
 * @returns {Object|undefined} Chain configuration
 */
export function getChain(chainId) {
  return chains[Number(chainId)]
}

/**
 * Get all available chain IDs
 * @returns {number[]} Array of chain IDs
 */
export function getChainIds() {
  return Object.keys(chains).map(Number)
}

/**
 * Get chain name by ID
 * @param {string|number} chainId 
 * @returns {string}
 */
export function getChainName(chainId) {
  const chain = getChain(chainId)
  return chain?.name || `Chain ${chainId}`
}

/**
 * Check if chain has Etherscan API support
 * All chains now use Etherscan V2 API, so this returns true for all valid chains
 * @param {string|number} chainId 
 * @returns {boolean}
 */
export function hasEtherscanApi(chainId) {
  return getChain(chainId) !== undefined
}

/**
 * Get explorer URL (unified Etherscan V2 API)
 * @param {string|number} chainId - Chain ID
 * @returns {string|null} API URL or null if chain not found
 */
export function getExplorerApiUrl(chainId) {
  if (!getChain(chainId)) return null
  
  const normalizedChainId = String(chainId)
  // Known Routescan chains: 9745
  const routescanChains = new Set(['9745'])
  if (routescanChains.has(normalizedChainId)) {
    return `https://api.routescan.io/v2/network/mainnet/evm/${normalizedChainId}/etherscan/api`
  }
  return 'https://api.etherscan.io/v2/api'
}

/**
 * Get explorer URL for address, tx, token, or block
 * @param {string|number} chainId - Chain ID
 * @param {string} value - Address, tx hash, or block number
 * @param {string} type - 'address', 'tx', 'token', 'block', or 'home'
 * @returns {string|null}
 */
export function getExplorerUrl(chainId, value, type = 'address') {
  const chain = getChain(chainId)
  if (!chain?.explorer) return null
  
  const base = chain.explorer.replace(/\/$/, '')
  
  switch (type) {
    case 'address':
      return `${base}/address/${value}`
    case 'tx':
      return `${base}/tx/${value}`
    case 'token':
      return `${base}/token/${value}`
    case 'block':
      return `${base}/block/${value}`
    case 'home':
      return base
    default:
      return `${base}/${type}/${value}`
  }
}

/**
 * Get RPC URL (first available)
 */
export function getRpcUrl(chainId) {
  const numericId = Number(chainId)
  const chain = chains[numericId]
  if (!chain?.rpcs?.length) return null
  return getAvailableRpc(numericId)
}

/**
 * Get an available RPC (skipping recently failed ones)
 */
export function getAvailableRpc(chainId) {
  const numericId = Number(chainId)
  const rpcs = chains[numericId]?.rpcs || []
  const now = Date.now()
  
  // Find first RPC that hasn't failed recently
  for (const rpc of rpcs) {
    const failedAt = failedRpcs.get(rpc)
    if (!failedAt || now - failedAt > RPC_BACKOFF_MS) {
      return rpc
    }
  }
  
  // All RPCs failed recently, return the first one anyway
  return rpcs[0] || null
}

/**
 * Mark an RPC as failed (for rotation)
 */
export function markRpcFailed(rpcUrl) {
  failedRpcs.set(rpcUrl, Date.now())
  console.warn(`[chains] RPC marked as failed: ${rpcUrl}`)
}

/**
 * Clear failed RPC status
 */
export function clearRpcFailure(rpcUrl) {
  failedRpcs.delete(rpcUrl)
}

/**
 * Get next available RPC after current one fails
 */
export function getNextRpc(chainId, currentRpc) {
  const numericId = Number(chainId)
  const rpcs = chains[numericId]?.rpcs || []
  const currentIndex = rpcs.indexOf(currentRpc)
  const now = Date.now()
  
  // Try RPCs after current one
  for (let i = 1; i < rpcs.length; i++) {
    const nextIndex = (currentIndex + i) % rpcs.length
    const rpc = rpcs[nextIndex]
    const failedAt = failedRpcs.get(rpc)
    if (!failedAt || now - failedAt > RPC_BACKOFF_MS) {
      return rpc
    }
  }
  
  // All failed, return any different RPC
  const nextIndex = (currentIndex + 1) % rpcs.length
  return rpcs[nextIndex] || null
}

/**
 * Execute an RPC call with automatic fallback
 */
export async function executeWithFallback(chainId, callFn, options = {}) {
  const { maxRetries = 3, timeout = 10000 } = options
  const rpcs = chains[chainId]?.rpcs || []
  
  if (rpcs.length === 0) {
    throw new Error(`No RPCs configured for chain ${chainId}`)
  }
  
  let lastError = null
  let attempts = 0
  let currentRpc = getAvailableRpc(chainId)
  
  while (attempts < maxRetries && currentRpc) {
    attempts++
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), timeout)
      )
      
      const result = await Promise.race([
        callFn(currentRpc),
        timeoutPromise
      ])
      
      clearRpcFailure(currentRpc)
      return result
      
    } catch (e) {
      lastError = e
      console.warn(`[chains] RPC call failed (attempt ${attempts}/${maxRetries}):`, currentRpc, e.message)
      
      markRpcFailed(currentRpc)
      currentRpc = getNextRpc(chainId, currentRpc)
    }
  }
  
  throw lastError || new Error(`All RPCs failed for chain ${chainId}`)
}

/**
 * Detect chain ID from explorer URL
 */
export function detectChainFromUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.host.toLowerCase()
    
    for (const [domain, chainId] of Object.entries(EXPLORER_CHAIN_MAP)) {
      if (host === domain || host.endsWith('.' + domain)) {
        return Number(chainId)
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

/**
 * Shorten address for display (0x1234...5678)
 */
export function shortenAddress(address, startChars = 6, endChars = 4) {
  if (!address) return ''
  if (address.length <= startChars + endChars + 2) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
