/**
 * API utilities - GitHub, GitLab, Etherscan API helpers
 */

import { setItemWithExpiry, getItemWithExpiry } from './storage.js'

const CACHE_TTL = 1000 * 60 * 60 // 1 hour

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

// Explorer domain to chain ID mapping (matching reference)
const EXPLORER_CHAIN_MAP = {
  'etherscan.io': '1',
  'optimistic.etherscan.io': '10',
  'bscscan.com': '56',
  'gnosisscan.io': '100',
  'polygonscan.com': '137',
  'sonicscan.org': '146',
  'ftmscan.com': '250',
  'fraxscan.com': '252',
  'zkevm.polygonscan.com': '1101',
  'moonscan.io': '1284',
  'mantlescan.xyz': '5000',
  'basescan.org': '8453',
  'arbiscan.io': '42161',
  'celoscan.io': '42220',
  'snowtrace.io': '43114',
  'lineascan.build': '59144',
  'blastscan.io': '81457',
  'scrollscan.com': '534352',
}

// Chains that use Routescan API instead of Etherscan V2
const ROUTESCAN_CHAINS = new Set(['43114', '1111', '9745'])

function isRoutescanChain(chainId) {
  return ROUTESCAN_CHAINS.has(String(chainId))
}

function getEtherscanApiUrl(chainId) {
  const normalizedChainId = String(chainId)
  if (isRoutescanChain(normalizedChainId)) {
    return `https://api.routescan.io/v2/network/mainnet/evm/${normalizedChainId}/etherscan/api`
  }
  return 'https://api.etherscan.io/v2/api'
}

/**
 * Check if URL is an Etherscan-compatible explorer link
 */
export function isEtherscanLink(url) {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace('www.', '')
    return Object.keys(EXPLORER_CHAIN_MAP).some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

/**
 * Extract chain ID from Etherscan URL
 */
export function getChainIdFromExplorerUrl(url) {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace('www.', '')
    for (const [domain, chainId] of Object.entries(EXPLORER_CHAIN_MAP)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return chainId
      }
    }
  } catch {}
  return null
}

/**
 * Extract contract address from Etherscan URL
 */
export function extractContractAddress(url) {
  const match = url.match(/\/(address|token)\/(0x[a-fA-F0-9]{40})/i)
  return match ? match[2] : null
}

/**
 * Parse GitHub/GitLab/Etherscan URL
 */
export function parseRepoUrl(url) {
  // Check for Etherscan-compatible explorer URLs first
  if (isEtherscanLink(url)) {
    const chainId = getChainIdFromExplorerUrl(url)
    const address = extractContractAddress(url)
    if (chainId && address) {
      return {
        platform: 'etherscan',
        chainId,
        address,
      }
    }
  }
  
  // GitHub: https://github.com/owner/repo[/tree/branch/path]
  const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?/)
  if (githubMatch) {
    return {
      platform: 'github',
      owner: githubMatch[1],
      repo: githubMatch[2].replace(/\.git$/, ''),
      branch: githubMatch[3] || 'main',
      path: githubMatch[4] || '',
    }
  }
  
  // GitLab: https://gitlab.com/group/project[/-/tree/branch/path]
  const gitlabMatch = url.match(/gitlab\.com\/(.+?)(?:\/-\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/)
  if (gitlabMatch) {
    return {
      platform: 'gitlab',
      host: 'https://gitlab.com',
      projectPath: gitlabMatch[1].replace(/\.git$/, ''),
      branch: gitlabMatch[2] || 'main',
      path: gitlabMatch[3] || '',
    }
  }
  
  return null
}

/**
 * GitHub API - Fetch repository tree
 */
export async function fetchGitHubTree(owner, repo, branch = 'main', token = null) {
  const cacheKey = `github:tree:${owner}/${repo}/${branch}`
  const cached = getItemWithExpiry(cacheKey)
  if (cached) return cached
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) {
    headers['Authorization'] = `token ${token}`
  }
  
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  )
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }
  
  const data = await response.json()
  setItemWithExpiry(cacheKey, data, CACHE_TTL)
  return data
}

/**
 * GitHub API - Fetch file content by URL or path
 */
export async function fetchGitHubFile(urlOrPath, repo, path, branch = 'main', token = null) {
  let owner, repoName, filePath, branchName
  
  // If first arg is a full URL, parse it
  if (urlOrPath.startsWith('http')) {
    const parsed = parseRepoUrl(urlOrPath)
    if (!parsed || parsed.platform !== 'github') {
      throw new Error('Invalid GitHub URL')
    }
    owner = parsed.owner
    repoName = parsed.repo
    branchName = parsed.branch
    filePath = parsed.path
  } else {
    // Traditional arguments
    owner = urlOrPath
    repoName = repo
    filePath = path
    branchName = branch
  }
  
  const headers = {
    'Accept': 'application/vnd.github.v3.raw',
  }
  if (token) {
    headers['Authorization'] = `token ${token}`
  }
  
  const response = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repoName}/${branchName}/${filePath}`,
    { headers }
  )
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }
  
  return response.text()
}

/**
 * GitLab API - Fetch file content by URL
 */
export async function fetchGitLabFile(url, token = null) {
  const parsed = parseRepoUrl(url)
  if (!parsed || parsed.platform !== 'gitlab') {
    throw new Error('Invalid GitLab URL')
  }
  
  const headers = {}
  if (token) {
    headers['PRIVATE-TOKEN'] = token
  }
  
  // Use the raw file endpoint
  const projectId = encodeURIComponent(parsed.projectPath)
  const filePath = encodeURIComponent(parsed.path)
  const ref = parsed.branch
  
  const response = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/repository/files/${filePath}/raw?ref=${ref}`,
    { headers }
  )
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`)
  }
  
  return response.text()
}

/**
 * GitHub API - List branches
 */
export async function fetchGitHubBranches(owner, repo, token = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
  }
  if (token) {
    headers['Authorization'] = `token ${token}`
  }
  
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches`,
    { headers }
  )
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }
  
  return response.json()
}

/**
 * GitLab API - Fetch repository tree
 */
export async function fetchGitLabTree(host, projectPath, branch = 'main', token = null) {
  const projectId = encodeURIComponent(projectPath)
  const headers = {}
  if (token) {
    headers['PRIVATE-TOKEN'] = token
  }
  
  const response = await fetch(
    `${host}/api/v4/projects/${projectId}/repository/tree?ref=${branch}&recursive=true&per_page=100`,
    { headers }
  )
  
  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status}`)
  }
  
  return response.json()
}

/**
 * 4byte.directory - Lookup signature by selector
 */
export async function lookup4byte(selector) {
  const cacheKey = `4byte:${selector}`
  const cached = getItemWithExpiry(cacheKey)
  if (cached) return cached
  
  try {
    const response = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`
    )
    
    if (!response.ok) return []
    
    const data = await response.json()
    const signatures = data.results?.map(r => r.text_signature) || []
    
    if (signatures.length > 0) {
      setItemWithExpiry(cacheKey, signatures, CACHE_TTL)
    }
    
    return signatures
  } catch {
    return []
  }
}

/**
 * Alias for lookup4byte
 */
export const lookupSignature = lookup4byte

/**
 * 4byte.directory - Upload signatures
 */
export async function upload4byte(signatures) {
  const results = []
  
  for (const sig of signatures) {
    try {
      const response = await fetch(
        'https://www.4byte.directory/api/v1/signatures/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text_signature: sig }),
        }
      )
      results.push({ signature: sig, success: response.ok })
    } catch {
      results.push({ signature: sig, success: false })
    }
  }
  
  return results
}

/**
 * Etherscan - Fetch verified contract source using V2 API
 * @param {string} chainId - Chain ID (e.g., '1', '137')
 * @param {string} address - Contract address
 * @returns {Promise<Object>} Source code result object
 */
export async function fetchEtherscanSource(chainId, address) {
  const apiUrl = getEtherscanApiUrl(chainId)
  const isRoutescan = isRoutescanChain(chainId)
  const apiKey = getNextApiKey()
  
  const params = new URLSearchParams({
    module: 'contract',
    action: 'getsourcecode',
    address,
    apikey: apiKey
  })
  
  // Etherscan V2 requires chainid, Routescan doesn't
  if (!isRoutescan) {
    params.set('chainid', chainId)
  }
  
  const fetchUrl = `${apiUrl}?${params}`
  console.log('[Etherscan] Fetching source:', fetchUrl)
  
  const response = await fetch(fetchUrl)
  
  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.status === '0') {
    throw new Error(data.result || 'Contract source not found')
  }
  
  const result = data.result[0]
  
  if (!result.SourceCode && !result.ABI) {
    throw new Error('Contract is not verified on Etherscan')
  }
  
  return result
}

/**
 * Etherscan - Fetch contract ABI using V2 API
 */
export async function fetchContractABI(chainId, address) {
  const apiUrl = getEtherscanApiUrl(chainId)
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
  
  const response = await fetch(`${apiUrl}?${params}`)
  
  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.status === '0') {
    throw new Error(data.result || 'ABI not found')
  }
  
  return JSON.parse(data.result)
}

/**
 * Check if a contract is a proxy and get the implementation address
 */
export async function getProxyImplementation(chainId, address) {
  try {
    const sourceResult = await fetchEtherscanSource(chainId, address)
    
    // Check if Etherscan detected this as a proxy
    if (sourceResult.Implementation && sourceResult.Implementation !== '') {
      console.log(`[Etherscan] Detected proxy, implementation: ${sourceResult.Implementation}`)
      return sourceResult.Implementation
    }
    
    // Check Proxy field
    if (sourceResult.Proxy === '1' && sourceResult.Implementation) {
      return sourceResult.Implementation
    }
    
    return null
  } catch (e) {
    console.warn('Error checking proxy:', e)
    return null
  }
}

/**
 * Fetch contract info (symbol, name) via RPC multicall
 * @param {string[]} addresses - Contract addresses to fetch info for
 * @param {string} rpcUrl - RPC URL to use
 * @returns {Promise<Map<string, {symbol?: string, name?: string}>>}
 */
export async function fetchContractInfoBatch(addresses, rpcUrl) {
  if (!addresses?.length || !rpcUrl) {
    return new Map()
  }
  
  const ethers = window.ethers
  if (!ethers) {
    throw new Error('ethers not loaded')
  }
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const results = new Map()
  
  // ERC20/721 interface for symbol() and name()
  const erc20Interface = new ethers.utils.Interface([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
  ])
  
  const symbolData = erc20Interface.encodeFunctionData('symbol')
  const nameData = erc20Interface.encodeFunctionData('name')
  
  // Batch calls in parallel
  const batchPromises = addresses.map(async (address) => {
    try {
      const [symbolResult, nameResult] = await Promise.allSettled([
        provider.call({ to: address, data: symbolData }),
        provider.call({ to: address, data: nameData }),
      ])
      
      const info = {}
      
      if (symbolResult.status === 'fulfilled' && symbolResult.value !== '0x') {
        try {
          const decoded = erc20Interface.decodeFunctionResult('symbol', symbolResult.value)
          info.symbol = decoded[0]
        } catch (e) {
          // Try bytes32 decode (some tokens return bytes32)
          try {
            const decoded = ethers.utils.parseBytes32String(symbolResult.value)
            if (decoded) info.symbol = decoded.replace(/\0/g, '')
          } catch {}
        }
      }
      
      if (nameResult.status === 'fulfilled' && nameResult.value !== '0x') {
        try {
          const decoded = erc20Interface.decodeFunctionResult('name', nameResult.value)
          info.name = decoded[0]
        } catch (e) {
          // Try bytes32 decode
          try {
            const decoded = ethers.utils.parseBytes32String(nameResult.value)
            if (decoded) info.name = decoded.replace(/\0/g, '')
          } catch {}
        }
      }
      
      if (info.symbol || info.name) {
        results.set(address.toLowerCase(), info)
      }
    } catch (e) {
      // Silent fail for individual addresses
    }
  })
  
  await Promise.all(batchPromises)
  return results
}

/**
 * Storage key for contract info cache
 */
const CONTRACT_INFO_CACHE_KEY = 'contract_info_cache'

/**
 * Get cached contract info
 */
export function getCachedContractInfo(address, chainId = '1') {
  try {
    const cache = JSON.parse(localStorage.getItem(CONTRACT_INFO_CACHE_KEY) || '{}')
    const key = `${chainId}:${address.toLowerCase()}`
    return cache[key] || cache[`0:${address.toLowerCase()}`] // Also check global (chainId 0)
  } catch {
    return null
  }
}

/**
 * Set cached contract info
 */
export function setCachedContractInfo(address, info, chainId = '1') {
  try {
    const cache = JSON.parse(localStorage.getItem(CONTRACT_INFO_CACHE_KEY) || '{}')
    const key = `${chainId}:${address.toLowerCase()}`
    cache[key] = { ...info, cachedAt: Date.now() }
    localStorage.setItem(CONTRACT_INFO_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Silent fail
  }
}
