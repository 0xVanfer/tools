/**
 * Address Display Composable
 * 
 * THE SINGLE SOURCE OF TRUTH for address display logic.
 * All components must use this composable for:
 * - Getting address display names (symbols, contract names, custom names)
 * - Generating explorer URLs
 * - Checksumming addresses
 * 
 * This ensures consistent rendering across all views:
 * - PayloadParser.vue
 * - ParameterList.vue
 * - SafeTransactionCard.vue
 * - MulticallCard.vue
 */

import { getAddressDisplayName } from '@/utils/cacheManager'
import { getExplorerUrl } from '@/utils/chains'
import { toChecksumAddress, isValidAddress } from '@/utils/ethereum'

/**
 * Get display name for an address
 * Priority: customName(global) > customName(chain) > symbol > name(global) > name(chain)
 * 
 * @param {string} address - The address to look up
 * @param {string} chainId - Chain ID for chain-specific lookups
 * @returns {string} Display name or empty string
 */
export function getAddressName(address, chainId = '1') {
  if (!address) return ''
  return getAddressDisplayName(address, chainId) || ''
}

/**
 * Get explorer URL for an address
 * Falls back to Etherscan mainnet if chain not supported
 * 
 * @param {string} address - The address
 * @param {string} chainId - Chain ID
 * @returns {string} Explorer URL
 */
export function getAddressExplorerUrl(address, chainId = '1') {
  if (!address) return ''
  const url = getExplorerUrl(chainId, address, 'address')
  return url || `https://etherscan.io/address/${address}`
}

/**
 * Get checksummed address
 * 
 * @param {string} address - The address to checksum
 * @returns {string} Checksummed address or original if invalid
 */
export function checksumAddress(address) {
  if (!address) return ''
  try {
    return toChecksumAddress(address)
  } catch {
    return address
  }
}

/**
 * Check if a value is a valid Ethereum address
 * 
 * @param {string} value - Value to check
 * @returns {boolean}
 */
export function isAddress(value) {
  return isValidAddress(value)
}

/**
 * Composable for address display utilities
 * Use this in Vue components that need address rendering
 * 
 * @param {import('vue').Ref<string>|string|Function} chainIdRef - Reactive chain ID, static string, or getter function
 * @returns {Object} Address display utilities bound to the chain
 */
export function useAddressDisplay(chainIdRef) {
  // Support reactive refs, static values, and getter functions
  const getChainId = () => {
    if (typeof chainIdRef === 'function') return String(chainIdRef())
    if (typeof chainIdRef === 'string') return chainIdRef
    if (chainIdRef?.value !== undefined) return String(chainIdRef.value)
    return '1'
  }

  return {
    /**
     * Get display name for address using component's chainId
     */
    getName: (address) => getAddressName(address, getChainId()),
    
    /**
     * Get explorer URL using component's chainId
     */
    getExplorerUrl: (address) => getAddressExplorerUrl(address, getChainId()),
    
    /**
     * Checksum an address
     */
    checksum: checksumAddress,
    
    /**
     * Check if value is valid address
     */
    isValid: isAddress,
  }
}

// Default export for convenience
export default useAddressDisplay
