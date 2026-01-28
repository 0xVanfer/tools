/**
 * Cryptographic utilities - Keccak256 and signature computation
 */

import { keccak256 as ethersKeccak256 } from './core/ethers.js'

// Re-export keccak256 from core/ethers.js
export const keccak256 = ethersKeccak256

/**
 * Compute 4-byte function selector from signature
 * e.g., "transfer(address,uint256)" -> "0xa9059cbb"
 */
export function computeFunctionSelector(signature) {
  const hash = keccak256(signature)
  return hash.slice(0, 10)
}
