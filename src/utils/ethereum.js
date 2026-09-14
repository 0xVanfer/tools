/**
 * Ethereum Utilities Module
 * 
 * Re-exports core address and ethers utilities plus provides
 * additional Ethereum-specific helpers.
 * 
 * For basic address operations, consider importing directly from:
 *   import { isValidAddress, toChecksumAddress } from '@/utils/core'
 */

import {
  getEthers,
  getEthersSafe,
  createInterface,
  computeSelector as coreComputeSelector,
} from './core/ethers.js'

import {
  isValidAddress,
  toChecksumAddress,
  toChecksumAddressSafe,
  isChecksumValid,
  formatAddress,
  shortenAddress,
  extractAddresses,
  matchesVanity,
} from './core/address.js'

// Re-export all core utilities for backwards compatibility
export {
  getEthers,
  getEthersSafe,
  isValidAddress,
  toChecksumAddress,
  toChecksumAddressSafe,
  isChecksumValid,
  formatAddress,
  shortenAddress,
  extractAddresses,
  matchesVanity,
}

/**
 * Get function selector from calldata
 * @param {string} data - Calldata hex string
 * @returns {string|null} 4-byte selector or null
 */
export function getSelector(data) {
  if (typeof data !== 'string') return null
  // Must be 0x-prefixed hex with at least 4 bytes, otherwise slicing arbitrary
  // text (e.g. "hello world") would produce a bogus "selector".
  if (!/^0[xX][0-9a-fA-F]{8}/.test(data)) return null
  return data.slice(0, 10).toLowerCase()
}

/**
 * Compute function selector from signature
 * @param {string} signature - Function signature
 * @returns {string} 4-byte selector
 */
export function computeSelector(signature) {
  return coreComputeSelector(signature)
}
