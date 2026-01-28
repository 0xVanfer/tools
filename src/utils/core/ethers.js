/**
 * Core Ethers.js Access Module
 * 
 * Single source of truth for accessing the globally-loaded ethers.js library.
 * All modules should import getEthers from this file instead of accessing window.ethers directly.
 */

/**
 * Get ethers instance from global window
 * @throws {Error} If ethers.js is not loaded
 * @returns {Object} The ethers.js library instance
 */
export function getEthers() {
  if (typeof window !== 'undefined' && window.ethers) {
    return window.ethers
  }
  throw new Error('ethers.js not loaded')
}

/**
 * Get ethers instance without throwing (returns null if not loaded)
 * @returns {Object|null} The ethers.js library instance or null
 */
export function getEthersSafe() {
  if (typeof window !== 'undefined' && window.ethers) {
    return window.ethers
  }
  return null
}

/**
 * Create an ethers Interface for ABI encoding/decoding
 * @param {Array|string} abi - ABI definition
 * @returns {Object} ethers.utils.Interface instance
 */
export function createInterface(abi) {
  const ethers = getEthers()
  return new ethers.utils.Interface(abi)
}

/**
 * Compute keccak256 hash
 * @param {string} data - String or hex data to hash
 * @returns {string} keccak256 hash
 */
export function keccak256(data) {
  const ethers = getEthers()
  if (typeof data === 'string' && !data.startsWith('0x')) {
    // Treat as UTF-8 string - use id() for function signature hashing
    return ethers.utils.id(data)
  }
  return ethers.utils.keccak256(data)
}

/**
 * Compute function selector from signature
 * @param {string} signature - Function signature e.g., "transfer(address,uint256)"
 * @returns {string} 4-byte selector with 0x prefix
 */
export function computeSelector(signature) {
  const hash = keccak256(signature)
  return hash.slice(0, 10)
}

/**
 * Generate random bytes
 * @param {number} length - Number of bytes
 * @returns {Uint8Array} Random bytes
 */
export function randomBytes(length) {
  const ethers = getEthers()
  return ethers.utils.randomBytes(length)
}

/**
 * Convert bytes to hex string
 * @param {Uint8Array|ArrayLike} bytes - Bytes to convert
 * @returns {string} Hex string with 0x prefix
 */
export function hexlify(bytes) {
  const ethers = getEthers()
  return ethers.utils.hexlify(bytes)
}
