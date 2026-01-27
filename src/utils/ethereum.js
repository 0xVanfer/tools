/**
 * Ethereum utilities - address handling, ethers.js wrapper
 */

/**
 * Get ethers instance from global
 */
export function getEthers() {
  return window.ethers
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false
  return /^0x[a-fA-F0-9]{40}$/i.test(address)
}

/**
 * Convert address to checksum format (EIP-55)
 */
export function toChecksumAddress(address) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers.js not loaded')
  return ethers.utils.getAddress(address)
}

/**
 * Normalize address to lowercase
 */
export function toLowerAddress(address) {
  return address?.toLowerCase() || ''
}

/**
 * Extract all addresses from text
 */
export function extractAddresses(text) {
  if (!text) return []
  const regex = /0x[a-fA-F0-9]{40}/gi
  const matches = text.match(regex) || []
  
  // Deduplicate
  const seen = new Set()
  return matches.filter(addr => {
    const lower = addr.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

/**
 * Format address for display (truncated)
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
  if (!address) return ''
  if (address.length <= startChars + endChars + 2) return address
  return `${address.slice(0, startChars + 2)}...${address.slice(-endChars)}`
}

/**
 * Generate random wallet
 */
export function generateRandomWallet() {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers.js not loaded')
  
  const privateKey = ethers.utils.hexlify(ethers.utils.randomBytes(32))
  const wallet = new ethers.Wallet(privateKey)
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  }
}

/**
 * Check if address has valid checksum
 */
export function isChecksumValid(address) {
  const ethers = getEthers()
  if (!ethers) return false
  
  try {
    const checksummed = ethers.utils.getAddress(address)
    return checksummed === address
  } catch {
    return false
  }
}

/**
 * Check if address matches prefix/suffix
 */
export function matchesVanity(address, prefix, suffix) {
  const addrNoPrefix = address.substring(2).toLowerCase()
  const prefixLower = prefix?.toLowerCase() || ''
  const suffixLower = suffix?.toLowerCase() || ''
  
  if (prefixLower && !addrNoPrefix.startsWith(prefixLower)) return false
  if (suffixLower && !addrNoPrefix.endsWith(suffixLower)) return false
  return true
}

/**
 * Decode calldata using ABI or signature
 */
export function decodeCalldata(data, abi = null, signature = null) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers.js not loaded')
  
  const selector = data.slice(0, 10)
  
  // If we have an ABI, try to decode with it
  if (abi) {
    try {
      const iface = new ethers.utils.Interface(abi)
      const parsed = iface.parseTransaction({ data })
      return {
        selector,
        signature: parsed.signature,
        name: parsed.name,
        params: parsed.args.map((arg, i) => ({
          type: parsed.functionFragment.inputs[i]?.type || 'unknown',
          name: parsed.functionFragment.inputs[i]?.name || `arg${i}`,
          value: arg
        })),
        nestedCalls: []
      }
    } catch (e) {
      console.warn('Failed to decode with ABI:', e)
    }
  }
  
  // If we have a signature string, try to decode with it
  if (signature) {
    try {
      const iface = new ethers.utils.Interface([`function ${signature}`])
      const parsed = iface.parseTransaction({ data })
      return {
        selector,
        signature: parsed.signature,
        name: parsed.name,
        params: parsed.args.map((arg, i) => ({
          type: parsed.functionFragment.inputs[i]?.type || 'unknown',
          name: parsed.functionFragment.inputs[i]?.name || `arg${i}`,
          value: arg
        })),
        nestedCalls: []
      }
    } catch (e) {
      console.warn('Failed to decode with signature:', e)
    }
  }
  
  // Return minimal info if we can't decode
  return {
    selector,
    signature: null,
    name: null,
    params: [],
    rawData: data.slice(10),
    nestedCalls: []
  }
}

/**
 * Get function selector from calldata
 */
export function getSelector(data) {
  if (!data || data.length < 10) return null
  return data.slice(0, 10).toLowerCase()
}

/**
 * Compute function selector from signature
 */
export function computeSelector(signature) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers.js not loaded')
  
  const hash = ethers.utils.id(signature)
  return hash.slice(0, 10)
}
