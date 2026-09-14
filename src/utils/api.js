/**
 * API utilities - GitHub, GitLab, Etherscan API helpers
 */

import { setItemWithExpiry, getItemWithExpiry } from './storage.js'
import { EXPLORER_CHAIN_MAP } from './chains.js'
import { fetchFromEtherscan } from './core/etherscan.js'

const CACHE_TTL = 1000 * 60 * 60 // 1 hour

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
 * Hosts that must never be interpreted as a self-hosted GitLab instance.
 * Mostly reserved/documentation domains that would otherwise be swallowed by the
 * permissive self-hosted fallback.
 */
const NON_GITLAB_HOSTS = new Set([
  'example.com', 'example.org', 'example.net', 'localhost', '127.0.0.1', '0.0.0.0',
])

/**
 * Parse GitHub/GitLab/Etherscan URL
 */
export function parseRepoUrl(url) {
  if (!url) return null
  const normalizedUrl = url.trim().replace(/#L\d+(-L\d+)?$/, '')
  // Check for Etherscan-compatible explorer URLs first
  if (isEtherscanLink(normalizedUrl)) {
    const chainId = getChainIdFromExplorerUrl(normalizedUrl)
    const address = extractContractAddress(normalizedUrl)
    if (chainId && address) {
      return {
        platform: 'etherscan',
        chainId,
        address,
      }
    }
  }
  
  // GitHub: https://github.com/owner/repo[/tree/branch/path]
  const githubMatch = normalizedUrl.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?/)
  if (githubMatch) {
    return {
      platform: 'github',
      owner: githubMatch[1],
      repo: githubMatch[2].replace(/\.git$/, ''),
      branch: githubMatch[3] || 'main',
      // Distinguishes an explicit /tree/<branch> URL from the default, so callers
      // can honour the URL's branch instead of always preferring their own state.
      branchSpecified: !!githubMatch[3],
      path: githubMatch[4] || '',
    }
  }
  
  // GitLab: https://gitlab.com/group/project[/-/tree/branch/path]
  const gitlabMatch = normalizedUrl.match(/gitlab\.com\/(.+?)(?:\/-\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/)
  if (gitlabMatch) {
    return {
      platform: 'gitlab',
      host: 'https://gitlab.com',
      projectPath: gitlabMatch[1].replace(/\.git$/, ''),
      fullPath: gitlabMatch[1].replace(/\.git$/, ''),
      branch: gitlabMatch[2] || 'main',
      branchSpecified: !!gitlabMatch[2],
      path: gitlabMatch[3] || '',
      isSelfHosted: false,
    }
  }

  // Self-hosted GitLab: http://host/group/project or http://host/group/project/-/tree/branch/path
  // This is the last resort, so it must not swallow unrelated URLs: previously it
  // matched ANY http(s) URL (e.g. an explorer link) and claimed it was GitLab.
  const selfHostedMatch = normalizedUrl.match(/^(https?:\/\/[^/]+)\/(.+?)(?:\/-\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/)
  if (selfHostedMatch) {
    const host = selfHostedMatch[1]
    const projectPath = selfHostedMatch[2].replace(/\.git$/, '')
    let hostname = ''
    try {
      hostname = new URL(host).hostname.replace(/^www\./, '')
    } catch {
      hostname = ''
    }
    const isKnownExplorer = Object.keys(EXPLORER_CHAIN_MAP).some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    )
    const looksLikeExplorerPath = /(^|\/)(tx|address|token|block|transactions)(\/|$)/.test(projectPath)
    const looksLikeGitLab = hostname.includes('gitlab')
    // Accept only GitLab-looking hosts, or custom hosts whose path is not an
    // explorer path and has at least a group/project pair.
    if (
      !isKnownExplorer &&
      !NON_GITLAB_HOSTS.has(hostname) &&
      !looksLikeExplorerPath &&
      (looksLikeGitLab || projectPath.split('/').length >= 2)
    ) {
      return {
        platform: 'gitlab',
        host,
        projectPath,
        fullPath: projectPath,
        branch: selfHostedMatch[3] || 'main',
        branchSpecified: !!selfHostedMatch[3],
        path: selfHostedMatch[4] || '',
        isSelfHosted: true,
      }
    }
  }
  
  return null
}

/**
 * GitHub API - Fetch repository tree
 */
export async function fetchGitHubTree(owner, repo, branch = 'main', token = null) {
  // Include a token discriminator: a tree fetched with a token must not be
  // served to later unauthenticated requests (and vice versa).
  const cacheKey = `github:tree:${owner}/${repo}/${branch}${token ? ':auth' : ''}`
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
  
  const headers = {}
  if (token) {
    headers['Authorization'] = `token ${token}`
  }

  // raw.githubusercontent.com cannot serve private repositories, so use the
  // authenticated contents API when a token is supplied.
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  const requestUrl = token
    ? `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}?ref=${encodeURIComponent(branchName)}`
    : `https://raw.githubusercontent.com/${owner}/${repoName}/${branchName}/${encodedPath}`

  if (token) headers['Accept'] = 'application/vnd.github.raw'

  const response = await fetch(requestUrl, { headers })
  
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

  // GitLab paginates at 100 entries per page; without following the pages a
  // large repository silently loses every file after the first 100.
  const allEntries = []
  let page = 1

  while (page > 0) {
    const response = await fetch(
      `${host}/api/v4/projects/${projectId}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`,
      { headers }
    )

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status}`)
    }

    const entries = await response.json()
    if (Array.isArray(entries)) allEntries.push(...entries)

    const nextPage = response.headers.get('X-Next-Page')
    page = nextPage ? Number(nextPage) : 0
    if (!Number.isFinite(page) || page <= 0) break
  }

  return allEntries
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
  // `tolerateError` lets the API's status-0 payload through so the caller can
  // report "not verified" instead of the raw API string.
  const data = await fetchFromEtherscan(chainId, {
    module: 'contract',
    action: 'getsourcecode',
    address
  }, { tolerateError: true })
  
  const result = data.result?.[0]
  
  if (!result?.SourceCode && !result?.ABI) {
    throw new Error(typeof data.result === 'string' && data.result
      ? data.result
      : 'Contract is not verified on Etherscan')
  }
  
  return result
}

/**
 * Etherscan - Fetch contract ABI using V2 API
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
 * Storage key for contract info cache
 */
const CONTRACT_INFO_CACHE_KEY = 'contract_info_cache'
const CONTRACT_INFO_TTL = 1000 * 60 * 60 // 1 hour

/**
 * Get cached contract info
 */
export function getCachedContractInfo(address, chainId = '1') {
  try {
    const cache = JSON.parse(localStorage.getItem(CONTRACT_INFO_CACHE_KEY) || '{}')
    const key = `${chainId}:${address.toLowerCase()}`
    const entry = cache[key]
    if (!entry) return null
    // Expire stale entries instead of returning them forever.
    if (entry.cachedAt && Date.now() - entry.cachedAt > CONTRACT_INFO_TTL) return null
    return entry
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
