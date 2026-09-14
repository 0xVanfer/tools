/**
 * Address Collector Module
 * 
 * Collects and tracks unique addresses found during payload decoding.
 * Used for post-processing (fetching contract info, symbols, names).
 */

import { isValidAddress, isZeroAddress, normalizeAddress } from './core/address.js'

/**
 * Internal storage: Map<address, Set<elementId>>
 * Tracks which DOM elements contain each address
 */
let addressMap = new Map()

/**
 * Add an address to the collection
 * @param {string} address - The address (will be normalized to lowercase)
 * @param {string} elementId - Optional DOM element ID that contains this address
 */
export function collectAddress(address, elementId = null) {
  if (!address || typeof address !== 'string') return
  
  // Validate address format
  if (!isValidAddress(address)) return
  
  // Skip zero address
  if (isZeroAddress(address)) return
  
  const normalized = normalizeAddress(address)
  
  if (!addressMap.has(normalized)) {
    addressMap.set(normalized, new Set())
  }
  
  if (elementId) {
    addressMap.get(normalized).add(elementId)
  }
}

/**
 * Get all collected unique addresses
 * @returns {string[]} Array of lowercase addresses
 */
function getAllAddresses() {
  return Array.from(addressMap.keys())
}

/**
 * Clear all collected addresses
 */
export function clearAddresses() {
  addressMap.clear()
}

/**
 * Collect addresses from decoded call result
 * Recursively extracts addresses from params
 * @param {object} decoded - Decoded call result
 */
export function collectFromDecoded(decoded) {
  if (!decoded) return
  
  // Collect main addresses
  if (decoded.calledAddress) {
    collectAddress(decoded.calledAddress)
  }
  
  if (decoded.to) {
    collectAddress(decoded.to)
  }
  
  if (decoded.from) {
    collectAddress(decoded.from)
  }
  
  // Collect from params
  if (decoded.params) {
    collectFromParams(decoded.params)
  }
  
  // Collect from nested calls (Safe/Multicall)
  if (decoded.transactions) {
    for (const tx of decoded.transactions) {
      collectFromDecoded(tx)
    }
  }

  if (decoded.calls) {
    for (const call of decoded.calls) {
      collectFromDecoded(call)
    }
  }

  // Collect from decoded bytes
  if (decoded.decoded) {
    collectFromDecoded(decoded.decoded)
  }

  if (decoded.decodedArray) {
    for (const d of decoded.decodedArray) {
      if (d) collectFromDecoded(d)
    }
  }
}

/**
 * Extract addresses from params array
 * @param {Array} params 
 */
function collectFromParams(params) {
  if (!Array.isArray(params)) return
  
  for (const param of params) {
    if (!param) continue
    
    const type = param.type || param.AbiType || ''
    const value = param.value || param.Value
    
    // Direct address type
    if (type === 'address' && value) {
      collectAddress(value)
    }
    // Address array
    else if (type === 'address[]' && Array.isArray(value)) {
      for (const addr of value) {
        collectAddress(addr)
      }
    }
    
    // Tuple components (single tuple). NOTE: these checks are independent of the
    // type branches above — a tuple array reports `type` as `tuple(...)[]` and
    // stores its per-item components in `itemComponents`, which the previous
    // `else if` chain never reached.
    if (Array.isArray(param.components)) {
      collectFromParams(param.components)
    }
    
    if (Array.isArray(param.itemComponents)) {
      for (const item of param.itemComponents) {
        if (item) collectFromParams(item)
      }
    }
    
    // Nested decoded bytes
    if (param.decoded) {
      collectFromDecoded(param.decoded)
    }
    if (param.decodedArray) {
      for (const d of param.decodedArray) {
        if (d) collectFromDecoded(d)
      }
    }
    if (Array.isArray(param.decodedTuples)) {
      for (const tuple of param.decodedTuples) {
        if (Array.isArray(tuple)) collectFromParams(tuple)
      }
    }
  }
}
