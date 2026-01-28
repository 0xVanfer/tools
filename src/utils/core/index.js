/**
 * Core Utilities Barrel Export
 * 
 * Re-exports all core utility modules for convenient importing.
 * 
 * Usage:
 *   import { getEthers, normalizeAddress, getNextApiKey } from '@/utils/core'
 */

// Ethers.js access
export {
  getEthers,
  getEthersSafe,
  createInterface,
  keccak256,
  computeSelector,
  randomBytes,
  hexlify,
} from './ethers.js'

// Address utilities
export {
  isValidAddress,
  normalizeAddress,
  toChecksumAddress,
  toChecksumAddressSafe,
  isChecksumValid,
  formatAddress,
  shortenAddress,
  extractAddresses,
  isZeroAddress,
  matchesVanity,
} from './address.js'

// Etherscan API
export {
  getNextApiKey,
  isRoutescanChain,
  getEtherscanApiUrl,
  buildApiUrl,
  fetchFromEtherscan,
  fetchContractABI,
} from './etherscan.js'
