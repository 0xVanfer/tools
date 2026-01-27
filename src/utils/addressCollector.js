/**
 * Address Collector Module
 * 
 * Collects and tracks unique addresses found during payload decoding.
 * Used for post-processing (fetching contract info, symbols, names).
 */

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
  
  const normalized = address.toLowerCase()
  
  // Skip zero address and invalid addresses
  if (normalized === '0x0000000000000000000000000000000000000000') return
  if (!/^0x[a-f0-9]{40}$/i.test(normalized)) return
  
  if (!addressMap.has(normalized)) {
    addressMap.set(normalized, new Set())
  }
  
  if (elementId) {
    addressMap.get(normalized).add(elementId)
  }
}

/**
 * Collect multiple addresses at once
 * @param {string[]} addresses 
 */
export function collectAddresses(addresses) {
  if (!Array.isArray(addresses)) return
  for (const addr of addresses) {
    collectAddress(addr)
  }
}

/**
 * Get all collected unique addresses
 * @returns {string[]} Array of lowercase addresses
 */
export function getAllAddresses() {
  return Array.from(addressMap.keys())
}

/**
 * Get element IDs associated with an address
 * @param {string} address 
 * @returns {Set<string>}
 */
export function getElementIdsForAddress(address) {
  const normalized = address?.toLowerCase()
  return addressMap.get(normalized) || new Set()
}

/**
 * Check if an address has been collected
 * @param {string} address 
 * @returns {boolean}
 */
export function hasAddress(address) {
  return addressMap.has(address?.toLowerCase())
}

/**
 * Get statistics about collected addresses
 */
export function getAddressStats() {
  return {
    count: addressMap.size,
    addresses: getAllAddresses(),
    elementsCount: Array.from(addressMap.values()).reduce((sum, set) => sum + set.size, 0),
  }
}

/**
 * Clear all collected addresses
 */
export function clearAddresses() {
  addressMap.clear()
}

/**
 * Reset and return the current collection
 * Useful for getting addresses before clearing
 * @returns {string[]}
 */
export function flushAddresses() {
  const addresses = getAllAddresses()
  clearAddresses()
  return addresses
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
    // Tuple containing addresses
    else if (type.startsWith('tuple') && param.components) {
      collectFromParams(param.components)
    }
    // Nested decoded bytes
    else if (param.decoded) {
      collectFromDecoded(param.decoded)
    }
    else if (param.decodedArray) {
      for (const d of param.decodedArray) {
        if (d) collectFromDecoded(d)
      }
    }
  }
}

/**
 * Collect addresses from Safe transaction structure
 */
export function collectFromSafeTransaction(tx) {
  if (tx.to) collectAddress(tx.to)
  if (tx.address) collectAddress(tx.address)
  if (tx.gasToken) collectAddress(tx.gasToken)
  if (tx.refundReceiver) collectAddress(tx.refundReceiver)
}

/**
 * Generate a unique element ID for address tracking
 * @returns {string}
 */
let elementIdCounter = 0
export function generateAddressElementId() {
  return `addr-${++elementIdCounter}`
}

/**
 * Reset element ID counter (for new decode session)
 */
export function resetElementIdCounter() {
  elementIdCounter = 0
}
