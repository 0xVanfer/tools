/**
 * Cryptographic utilities - Keccak256 and signature computation
 */

// Import from ethers or use standalone implementation
export function keccak256(data) {
  const ethers = window.ethers
  if (ethers) {
    if (typeof data === 'string') {
      return ethers.utils.id(data)
    }
    return ethers.utils.keccak256(data)
  }
  throw new Error('ethers.js not loaded')
}

/**
 * Compute 4-byte function selector from signature
 * e.g., "transfer(address,uint256)" -> "0xa9059cbb"
 */
export function computeFunctionSelector(signature) {
  const hash = keccak256(signature)
  return hash.slice(0, 10)
}

/**
 * Compute event topic from signature
 */
export function computeEventTopic(signature) {
  return keccak256(signature)
}

/**
 * Normalize Solidity type for canonical signature
 */
export function normalizeType(type) {
  // Common type aliases
  const aliases = {
    'uint': 'uint256',
    'int': 'int256',
    'byte': 'bytes1',
    'address payable': 'address',
  }
  
  let normalized = type.trim()
  
  // Handle arrays
  const arrayMatch = normalized.match(/^(.+?)(\[.*\])$/)
  if (arrayMatch) {
    return normalizeType(arrayMatch[1]) + arrayMatch[2]
  }
  
  return aliases[normalized] || normalized
}

/**
 * Parse function signature into components
 */
export function parseSignature(signature) {
  const match = signature.match(/^(\w+)\((.*)\)$/)
  if (!match) return null
  
  const name = match[1]
  const params = match[2] ? match[2].split(',').map(p => p.trim()) : []
  
  return { name, params }
}

/**
 * Build canonical signature from name and types
 */
export function buildSignature(name, types) {
  const normalizedTypes = types.map(normalizeType)
  return `${name}(${normalizedTypes.join(',')})`
}

/**
 * Validate hex string
 */
export function isValidHex(str) {
  return /^[0-9a-fA-F]*$/.test(str)
}

/**
 * Normalize hex string (add 0x prefix if missing)
 */
export function normalizeHex(str) {
  if (!str) return ''
  const cleaned = str.trim()
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    return cleaned.toLowerCase()
  }
  if (isValidHex(cleaned)) {
    return '0x' + cleaned.toLowerCase()
  }
  return cleaned
}

/**
 * Compute 4-byte selector from signature (alias)
 */
export function computeSelector(signature) {
  return computeFunctionSelector(signature)
}

/**
 * Extract function/event/error signatures from Solidity source code
 */
export function extractSignatures(sourceCode) {
  const signatures = []
  
  // Match function definitions
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)/g
  let match
  while ((match = functionRegex.exec(sourceCode)) !== null) {
    const name = match[1]
    const params = parseParams(match[2])
    const signature = `${name}(${params.map(p => p.type).join(',')})`
    signatures.push({
      name,
      signature,
      type: 'function',
      params
    })
  }
  
  // Match event definitions
  const eventRegex = /event\s+(\w+)\s*\(([^)]*)\)/g
  while ((match = eventRegex.exec(sourceCode)) !== null) {
    const name = match[1]
    const params = parseParams(match[2])
    const signature = `${name}(${params.map(p => p.type).join(',')})`
    signatures.push({
      name,
      signature,
      type: 'event',
      params
    })
  }
  
  // Match error definitions
  const errorRegex = /error\s+(\w+)\s*\(([^)]*)\)/g
  while ((match = errorRegex.exec(sourceCode)) !== null) {
    const name = match[1]
    const params = parseParams(match[2])
    const signature = `${name}(${params.map(p => p.type).join(',')})`
    signatures.push({
      name,
      signature,
      type: 'error',
      params
    })
  }
  
  return signatures
}

/**
 * Parse parameter list from Solidity source
 */
function parseParams(paramsStr) {
  if (!paramsStr.trim()) return []
  
  const params = []
  const parts = paramsStr.split(',')
  
  for (const part of parts) {
    const tokens = part.trim().split(/\s+/)
    if (tokens.length === 0) continue
    
    // Type is the first token (or first two for 'mapping' etc)
    let type = tokens[0]
    let name = ''
    
    // Handle memory/storage/calldata modifiers
    const modifiers = ['memory', 'storage', 'calldata', 'indexed']
    let i = 1
    while (i < tokens.length && modifiers.includes(tokens[i])) {
      i++
    }
    
    // Last token after modifiers is the name
    if (i < tokens.length) {
      name = tokens[tokens.length - 1]
      if (modifiers.includes(name)) {
        name = ''
      }
    }
    
    // Normalize the type
    type = normalizeType(type)
    
    params.push({ type, name })
  }
  
  return params
}
