/**
 * Chain configuration - centralized chain data for all tools
 *
 * Every explorer URL, RPC endpoint and ABI API in this file was verified against
 * the live network (explorer HTTP status + `eth_chainId` on each RPC).
 *
 * Per chain:
 * - name / shortName / internalName: display identifiers
 * - explorer: block explorer base URL used for address/tx/block links
 * - apiUrl: optional Etherscan-compatible API base for explorers that are NOT
 *   served by the unified Etherscan V2 API (Blockscout / Routescan / native).
 *   When omitted, `https://api.etherscan.io/v2/api?chainid=...` is used.
 * - rpcs: public RPC endpoints, ordered by preference
 * - isTestnet: marks test networks
 *
 * Notes:
 * - ankr and drpc endpoints are excluded by project policy.
 * - Etherscan V2 serves a fixed chain list (https://api.etherscan.io/v2/chainlist);
 *   chains outside it need their own `apiUrl` or ABI lookups will fail.
 */

// Track failed RPCs with timestamp (for temporary backoff)
const failedRpcs = new Map() // rpc -> timestamp
const RPC_BACKOFF_MS = 60000 // 1 minute backoff for failed RPCs

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
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
      'https://rpc.mevblocker.io',
      'https://rpc.flashbots.net',
      'https://cloudflare-eth.com',
      'https://eth-mainnet.public.blastapi.io',
      'https://eth.merkle.io',
      'https://0xrpc.io/eth',
      'https://eth.meowrpc.com',
      'https://ethereum.public.blockpi.network/v1/rpc/public',
    ],
  },
  10: {
    name: 'Optimism',
    shortName: 'OP',
    internalName: 'optimism',
    explorer: 'https://optimistic.etherscan.io',
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism-rpc.publicnode.com',
      'https://1rpc.io/op',
      'https://optimism.gateway.tenderly.co',
    ],
  },
  14: {
    name: 'Flare',
    shortName: 'FLR',
    internalName: 'flare',
    explorer: 'https://flare-explorer.flare.network',
    apiUrl: 'https://flare-explorer.flare.network/api',
    rpcs: [
      'https://flare-api.flare.network/ext/C/rpc',
    ],
  },
  30: {
    name: 'Rootstock',
    shortName: 'RBTC',
    internalName: 'rootstock',
    explorer: 'https://rootstock.blockscout.com',
    apiUrl: 'https://rootstock.blockscout.com/api',
    rpcs: [
      'https://public-node.rsk.co',
      'https://mycrypto.rsk.co',
    ],
  },
  56: {
    name: 'BNB Chain',
    shortName: 'BSC',
    internalName: 'bsc',
    explorer: 'https://bscscan.com',
    rpcs: [
      'https://bsc-dataseed.bnbchain.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
      'https://bsc-dataseed2.bnbchain.org',
      'https://bsc-rpc.publicnode.com',
      'https://1rpc.io/bnb',
      'https://bsc-mainnet.public.blastapi.io',
      'https://bsc.meowrpc.com',
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
    ],
  },
  130: {
    name: 'Unichain',
    shortName: 'UNI',
    internalName: 'unichain',
    explorer: 'https://uniscan.xyz',
    rpcs: [
      'https://mainnet.unichain.org',
      'https://unichain-rpc.publicnode.com',
    ],
  },
  137: {
    name: 'Polygon',
    shortName: 'POL',
    internalName: 'polygon',
    explorer: 'https://polygonscan.com',
    rpcs: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://1rpc.io/matic',
    ],
  },
  143: {
    name: 'Monad',
    shortName: 'MON',
    internalName: 'monad',
    explorer: 'https://monadvision.com',
    rpcs: [
      'https://rpc.monad.xyz',
      'https://rpc1.monad.xyz',
    ],
  },
  146: {
    name: 'Sonic',
    shortName: 'S',
    internalName: 'sonic',
    explorer: 'https://sonicscan.org',
    rpcs: [
      'https://rpc.soniclabs.com',
      'https://sonic-rpc.publicnode.com',
    ],
  },
  169: {
    name: 'Manta Pacific',
    shortName: 'MANTA',
    internalName: 'manta',
    explorer: 'https://pacific-explorer.manta.network',
    apiUrl: 'https://pacific-explorer.manta.network/api',
    rpcs: [
      'https://pacific-rpc.manta.network/http',
    ],
  },
  204: {
    name: 'opBNB',
    shortName: 'opBNB',
    internalName: 'opbnb',
    explorer: 'https://opbnbscan.com',
    rpcs: [
      'https://opbnb-mainnet-rpc.bnbchain.org',
    ],
  },
  232: {
    name: 'Lens',
    shortName: 'LENS',
    internalName: 'lens',
    explorer: 'https://explorer.lens.xyz',
    apiUrl: 'https://explorer.lens.xyz/api',
    rpcs: [
      'https://rpc.lens.xyz',
    ],
  },
  239: {
    name: 'Tac',
    shortName: 'TAC',
    internalName: 'tac',
    explorer: 'https://explorer.tac.build',
    rpcs: [
      'https://rpc.tac.build',
      'https://tac.rpc.thirdweb.com',
    ],
  },
  250: {
    name: 'Fantom',
    shortName: 'FTM',
    internalName: 'fantom',
    explorer: 'https://explorer.fantom.network',
    rpcs: [
      'https://rpcapi.fantom.network',
      'https://rpc.fantom.network',
    ],
  },
  252: {
    name: 'Fraxtal',
    shortName: 'FRAX',
    internalName: 'fraxtal',
    explorer: 'https://fraxscan.com',
    rpcs: [
      'https://rpc.frax.com',
      'https://fraxtal-rpc.publicnode.com',
    ],
  },
  291: {
    name: 'Orderly',
    shortName: 'ORDER',
    internalName: 'orderly',
    explorer: 'https://explorer.orderly.network',
    rpcs: [
      'https://rpc.orderly.network',
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
    shortName: 'ZK',
    internalName: 'zksync',
    explorer: 'https://explorer.zksync.io',
    apiUrl: 'https://block-explorer-api.mainnet.zksync.io/api',
    rpcs: [
      'https://mainnet.era.zksync.io',
      'https://1rpc.io/zksync2-era',
    ],
  },
  360: {
    name: 'Shape',
    shortName: 'SHAPE',
    internalName: 'shape',
    explorer: 'https://shapescan.xyz',
    rpcs: [
      'https://mainnet.shape.network',
      'https://shape-mainnet.g.alchemy.com/public',
    ],
  },
  480: {
    name: 'World Chain',
    shortName: 'WORLD',
    internalName: 'worldchain',
    explorer: 'https://worldscan.org',
    rpcs: [
      'https://worldchain-mainnet.g.alchemy.com/public',
      'https://worldchain-mainnet.gateway.tenderly.co',
    ],
  },
  988: {
    name: 'Stable',
    shortName: 'STABLE',
    internalName: 'stable',
    explorer: 'https://stablescan.xyz',
    rpcs: [
      'https://rpc.stable.xyz',
    ],
  },
  999: {
    name: 'HyperEVM',
    shortName: 'HYPE',
    internalName: 'hyperevm',
    explorer: 'https://hyperevmscan.io',
    rpcs: [
      'https://rpc.hyperliquid.xyz/evm',
    ],
  },
  1101: {
    name: 'Polygon zkEVM',
    shortName: 'ZKEVM',
    internalName: 'polygonzk',
    explorer: 'https://polygon-zkevm.routescan.io',
    rpcs: [
      'https://zkevm-rpc.com',
    ],
  },
  1135: {
    name: 'Lisk',
    shortName: 'LSK',
    internalName: 'lisk',
    explorer: 'https://blockscout.lisk.com',
    apiUrl: 'https://blockscout.lisk.com/api',
    rpcs: [
      'https://rpc.api.lisk.com',
    ],
  },
  1284: {
    name: 'Moonbeam',
    shortName: 'GLMR',
    internalName: 'moonbeam',
    explorer: 'https://moonscan.io',
    rpcs: [
      'https://1rpc.io/glmr',
    ],
  },
  1329: {
    name: 'Sei',
    shortName: 'SEI',
    internalName: 'sei',
    explorer: 'https://seiscan.io',
    rpcs: [
      'https://evm-rpc.sei-apis.com',
      'https://sei-evm-rpc.publicnode.com',
    ],
  },
  1750: {
    name: 'Metal L2',
    shortName: 'METAL',
    internalName: 'metal',
    explorer: 'https://explorer.metall2.com',
    apiUrl: 'https://explorer.metall2.com/api',
    rpcs: [
      'https://rpc.metall2.com',
    ],
  },
  1776: {
    name: 'Injective',
    shortName: 'INJ',
    internalName: 'injective',
    explorer: 'https://blockscout.injective.network',
    rpcs: [
      'https://sentry.evm-rpc.injective.network',
    ],
  },
  1868: {
    name: 'Soneium',
    shortName: 'SONY',
    internalName: 'soneium',
    explorer: 'https://soneium.blockscout.com',
    apiUrl: 'https://soneium.blockscout.com/api',
    rpcs: [
      'https://rpc.soneium.org',
      'https://soneium-rpc.publicnode.com',
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
  2741: {
    name: 'Abstract',
    shortName: 'ABS',
    internalName: 'abstract',
    explorer: 'https://abscan.org',
    rpcs: [
      'https://api.mainnet.abs.xyz',
    ],
  },
  4200: {
    name: 'Merlin',
    shortName: 'MERL',
    internalName: 'merlin',
    explorer: 'https://scan.merlinchain.io',
    apiUrl: 'https://scan.merlinchain.io/api',
    rpcs: [
      'https://rpc.merlinchain.io',
    ],
  },
  4326: {
    name: 'MegaETH',
    shortName: 'MEGA',
    internalName: 'megaeth',
    explorer: 'https://megaexplorer.xyz',
    rpcs: [
      'https://mainnet.megaeth.com/rpc',
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
      'https://1rpc.io/mantle',
    ],
  },
  5330: {
    name: 'Superseed',
    shortName: 'SUPR',
    internalName: 'superseed',
    explorer: 'https://explorer.superseed.xyz',
    rpcs: [
      'https://mainnet.superseed.xyz',
    ],
  },
  7560: {
    name: 'Cyber',
    shortName: 'CYBER',
    internalName: 'cyber',
    explorer: 'https://cyberscan.co',
    apiUrl: 'https://cyberscan.co/api',
    rpcs: [
      'https://cyber.alt.technology',
      'https://rpc.cyber.co',
    ],
  },
  8453: {
    name: 'Base',
    shortName: 'BASE',
    internalName: 'base',
    explorer: 'https://basescan.org',
    rpcs: [
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
      'https://1rpc.io/base',
      'https://base-mainnet.public.blastapi.io',
    ],
  },
  9745: {
    name: 'Plasma',
    shortName: 'XPL',
    internalName: 'plasma',
    explorer: 'https://plasmascan.to',
    rpcs: [
      'https://rpc.plasma.to',
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
    apiUrl: 'https://explorer.mode.network/api',
    rpcs: [
      'https://mainnet.mode.network',
      'https://1rpc.io/mode',
    ],
  },
  33139: {
    name: 'ApeChain',
    shortName: 'APE',
    internalName: 'apechain',
    explorer: 'https://apescan.io',
    rpcs: [
      'https://rpc.apechain.com',
      'https://apechain.calderachain.xyz/http',
    ],
  },
  42161: {
    name: 'Arbitrum One',
    shortName: 'ARB',
    internalName: 'arbitrum',
    explorer: 'https://arbiscan.io',
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://1rpc.io/arb',
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
    ],
  },
  43111: {
    name: 'Hemi',
    shortName: 'HEMI',
    internalName: 'hemi',
    explorer: 'https://explorer.hemi.xyz',
    apiUrl: 'https://explorer.hemi.xyz/api',
    rpcs: [
      'https://rpc.hemi.network/rpc',
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
    ],
  },
  48900: {
    name: 'Zircuit',
    shortName: 'ZRC',
    internalName: 'zircuit',
    explorer: 'https://explorer.zircuit.com',
    rpcs: [
      'https://mainnet.zircuit.com',
    ],
  },
  57073: {
    name: 'Ink',
    shortName: 'INK',
    internalName: 'ink',
    explorer: 'https://explorer.inkonchain.com',
    apiUrl: 'https://explorer.inkonchain.com/api',
    rpcs: [
      'https://rpc-gel.inkonchain.com',
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
    ],
  },
  60808: {
    name: 'BOB',
    shortName: 'BOB',
    internalName: 'bob',
    explorer: 'https://explorer.gobob.xyz',
    rpcs: [
      'https://rpc.gobob.xyz',
    ],
  },
  747474: {
    name: 'Katana',
    shortName: 'KAT',
    internalName: 'katana',
    explorer: 'https://katanascan.com',
    rpcs: [
      'https://rpc.katana.network',
    ],
  },
  7777777: {
    name: 'Zora',
    shortName: 'ZORA',
    internalName: 'zora',
    explorer: 'https://explorer.zora.energy',
    rpcs: [
      'https://rpc.zora.energy',
    ],
  },
  80094: {
    name: 'Berachain',
    shortName: 'BERA',
    internalName: 'bera',
    explorer: 'https://berascan.com',
    rpcs: [
      'https://rpc.berachain.com',
      'https://berachain-rpc.publicnode.com',
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
  81457: {
    name: 'Blast',
    shortName: 'BLAST',
    internalName: 'blast',
    explorer: 'https://blastscan.io',
    rpcs: [
      'https://rpc.blast.io',
      'https://blast-rpc.publicnode.com',
    ],
  },
  167000: {
    name: 'Taiko',
    shortName: 'TAIKO',
    internalName: 'taiko',
    explorer: 'https://taikoscan.io',
    rpcs: [
      'https://rpc.mainnet.taiko.xyz',
      'https://taiko-rpc.publicnode.com',
    ],
  },
  534352: {
    name: 'Scroll',
    shortName: 'SCR',
    internalName: 'scroll',
    explorer: 'https://scrollscan.com',
    apiUrl: 'https://api.scrollscan.com/api',
    rpcs: [
      'https://rpc.scroll.io',
      'https://scroll-rpc.publicnode.com',
      'https://1rpc.io/scroll',
    ],
  },

  // ============================================================================
  // Testnets
  // ============================================================================
  10143: {
    name: 'Monad Testnet',
    shortName: 'MONAD-TEST',
    internalName: 'monadtestnet',
    explorer: 'https://testnet.monadvision.com',
    isTestnet: true,
    rpcs: [
      'https://testnet-rpc.monad.xyz',
    ],
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
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://1rpc.io/sepolia',
      'https://sepolia.gateway.tenderly.co',
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
 * Check if chain has an explorer API for ABI/source lookups.
 * @param {string|number} chainId 
 * @returns {boolean}
 */
export function hasEtherscanApi(chainId) {
  return getChain(chainId) !== undefined
}

/**
 * Get the block-explorer API base URL for a chain.
 *
 * Prefers the chain's explicit `apiUrl` (Blockscout / native Etherscan-compatible
 * APIs), otherwise the unified Etherscan V2 API.
 *
 * @param {string|number} chainId - Chain ID
 * @returns {string|null} API URL or null if chain not found
 */
export function getExplorerApiUrl(chainId) {
  const chain = getChain(chainId)
  if (!chain) return null
  return chain.apiUrl || 'https://api.etherscan.io/v2/api'
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
