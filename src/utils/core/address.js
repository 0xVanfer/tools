/**
 * Core Address Utilities Module
 * 
 * Single source of truth for all address-related operations:
 * - Validation
 * - Normalization
 * - Checksum conversion
 * - Formatting for display
 */

import { getEthers, getEthersSafe } from './ethers.js'

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid 40-character hex address
 */
export function isValidAddress(address) {
  if (!address || typeof address !== 'string') return false
  return /^0x[a-fA-F0-9]{40}$/i.test(address)
}

/**
 * Normalize address to lowercase
 * @param {string} address - Address to normalize
 * @returns {string} Lowercase address or empty string
 */
export function normalizeAddress(address) {
  return address?.toLowerCase?.() || ''
}

/**
 * Convert address to EIP-55 checksum format
 * @param {string} address - Address to checksum
 * @returns {string} Checksummed address
 * @throws {Error} If address is invalid or ethers not loaded
 */
export function toChecksumAddress(address) {
  const ethers = getEthers()
  return ethers.utils.getAddress(address)
}

/**
 * Convert address to checksum format (safe version, returns original on error)
 * @param {string} address - Address to checksum
 * @returns {string} Checksummed address or original if failed
 */
export function toChecksumAddressSafe(address) {
  if (!address) return ''
  try {
    return toChecksumAddress(address)
  } catch {
    return address
  }
}

/**
 * Check if address has valid EIP-55 checksum
 * @param {string} address - Address to check
 * @returns {boolean} True if checksum is valid
 */
export function isChecksumValid(address) {
  const ethers = getEthersSafe()
  if (!ethers) return false
  
  try {
    const checksummed = ethers.utils.getAddress(address)
    return checksummed === address
  } catch {
    return false
  }
}

/**
 * Format address for display (truncated)
 * @param {string} address - Address to format
 * @param {number} startChars - Characters to show at start (default 6)
 * @param {number} endChars - Characters to show at end (default 4)
 * @returns {string} Formatted address e.g., "0x1234...5678"
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
  if (!address) return ''
  // Include 0x in startChars count
  const start = startChars + 2
  if (address.length <= start + endChars) return address
  return `${address.slice(0, start)}...${address.slice(-endChars)}`
}

/**
 * Alias for formatAddress
 */
export const shortenAddress = formatAddress

/**
 * Extract all addresses from text
 * @param {string} text - Text to search
 * @returns {string[]} Array of unique lowercase addresses
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
 * Check if address is the zero address
 * @param {string} address - Address to check
 * @returns {boolean}
 */
export function isZeroAddress(address) {
  if (!address) return false
  return normalizeAddress(address) === '0x0000000000000000000000000000000000000000'
}

/**
 * Check if address matches prefix/suffix pattern (for vanity addresses)
 * @param {string} address - Address to check
 * @param {string} prefix - Required prefix (after 0x)
 * @param {string} suffix - Required suffix
 * @returns {boolean}
 */
export function matchesVanity(address, prefix, suffix) {
  const addrNoPrefix = address.substring(2).toLowerCase()
  const prefixLower = prefix?.toLowerCase() || ''
  const suffixLower = suffix?.toLowerCase() || ''
  
  if (prefixLower && !addrNoPrefix.startsWith(prefixLower)) return false
  if (suffixLower && !addrNoPrefix.endsWith(suffixLower)) return false
  return true
}
