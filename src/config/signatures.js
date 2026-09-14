/**
 * Common Signatures Configuration
 * 
 * Pre-defined common function signatures for O(1) lookup.
 * These bypass API queries for frequently used functions.
 */

/**
 * Common ERC20/ERC721/DeFi function signatures
 */
export const COMMON_SIGNATURES = {
  // ERC20
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x095ea7b3': 'approve(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x70a08231': 'balanceOf(address)',
  '0xdd62ed3e': 'allowance(address,address)',
  '0x18160ddd': 'totalSupply()',
  '0x313ce567': 'decimals()',
  '0x95d89b41': 'symbol()',
  '0x06fdde03': 'name()',
  
  // ERC721
  '0x6352211e': 'ownerOf(uint256)',
  '0x42842e0e': 'safeTransferFrom(address,address,uint256)',
  '0xb88d4fde': 'safeTransferFrom(address,address,uint256,bytes)',
  '0xa22cb465': 'setApprovalForAll(address,bool)',
  '0xe985e9c5': 'isApprovedForAll(address,address)',
  '0x081812fc': 'getApproved(uint256)',
  
  // ERC1155
  '0xf242432a': 'safeTransferFrom(address,address,uint256,uint256,bytes)',
  '0x2eb2c2d6': 'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
  '0x00fdd58e': 'balanceOf(address,uint256)',
  '0x4e1273f4': 'balanceOfBatch(address[],uint256[])',
  
  // Ownable
  '0x8da5cb5b': 'owner()',
  '0xf2fde38b': 'transferOwnership(address)',
  '0x715018a6': 'renounceOwnership()',
  
  // Access Control
  '0x2f2ff15d': 'grantRole(bytes32,address)',
  '0xd547741f': 'revokeRole(bytes32,address)',
  '0x91d14854': 'hasRole(bytes32,address)',
  '0x248a9ca3': 'getRoleAdmin(bytes32)',
  '0x36568abe': 'renounceRole(bytes32,address)',
  
  // Pausable
  '0x5c975abb': 'paused()',
  '0x8456cb59': 'pause()',
  '0x3f4ba83a': 'unpause()',
  
  // Upgradeable
  '0x4f1ef286': 'upgradeToAndCall(address,bytes)',
  '0x3659cfe6': 'upgradeTo(address)',
  '0x52d1902d': 'proxiableUUID()',
  
  // Safe MultiSend
  '0x8d80ff0a': 'multiSend(bytes)',
  '0x6a761202': 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
  
  // Multicall (Uniswap style)
  '0xac9650d8': 'multicall(bytes[])',
  '0x5ae401dc': 'multicall(uint256,bytes[])',
  '0x1f0464d1': 'multicall(bytes32,bytes[])',
  
  // Multicall3 / Aggregate
  '0x252dba42': 'aggregate((address,bytes)[])',
  '0xbce38bd7': 'tryAggregate(bool,(address,bytes)[])',
  '0x82ad56cb': 'aggregate3((address,bool,bytes)[])',
  '0x174dea71': 'aggregate3Value((address,bool,uint256,bytes)[])',
  
  // Uniswap V2 Router
  '0x7ff36ab5': 'swapExactETHForTokens(uint256,address[],address,uint256)',
  '0x18cbafe5': 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)',
  '0x38ed1739': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
  '0xe8e33700': 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
  '0xf305d719': 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)',
  '0xbaa2abde': 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
  
  // Uniswap V3 SwapRouter (V1: deadline is part of the struct)
  '0x04e45aaf': 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))',
  '0xc04b8d59': 'exactInput((bytes,address,uint256,uint256,uint256))',
  '0x5023b4df': 'exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))',
  '0xf28c0498': 'exactOutput((bytes,address,uint256,uint256,uint256))',
  // Uniswap V3 SwapRouter02 (no deadline in the struct)
  '0xb858183f': 'exactInput((bytes,address,uint256,uint256))',
  '0x09b81346': 'exactOutput((bytes,address,uint256,uint256))',
  
  // Common DeFi
  '0xb6b55f25': 'deposit(uint256)',
  '0x2e1a7d4d': 'withdraw(uint256)',
  '0xa0712d68': 'mint(uint256)',
  '0x40c10f19': 'mint(address,uint256)',
  '0x42966c68': 'burn(uint256)',
  '0x9dc29fac': 'burn(address,uint256)',
  '0xd0e30db0': 'deposit()',
  '0x3ccfd60b': 'withdraw()',
  '0x47e7ef24': 'deposit(address,uint256)',
  
  // Staking
  '0xa694fc3a': 'stake(uint256)',
  '0x2e17de78': 'unstake(uint256)',
  '0x4e71d92d': 'claim()',
  '0xe9fad8ee': 'exit()',
  '0x3d18b912': 'getReward()',
  
  // WETH
  '0x2e1a7d4d': 'withdraw(uint256)',
  '0xd0e30db0': 'deposit()',
  
  // Permit
  '0xd505accf': 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
  '0x8fcbaf0c': 'permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)',
  
  // Governor
  '0x7d5e81e2': 'propose(address[],uint256[],bytes[],string)',
  '0x56781388': 'castVote(uint256,uint8)',
  '0x2656227d': 'execute(address[],uint256[],bytes[],bytes32)',
  '0x160cbed7': 'queue(address[],uint256[],bytes[],bytes32)',
  
  // EIP-712
  '0x3644e515': 'DOMAIN_SEPARATOR()',
  '0x7ecebe00': 'nonces(address)',
}

/**
 * Lookup a common signature by selector
 * 
 * @param {string} sighash - 4-byte selector (with 0x prefix)
 * @returns {string|null} - Function signature or null if not found
 */
export function lookupCommonSignature(sighash) {
  if (!sighash) return null
  return COMMON_SIGNATURES[sighash.toLowerCase()] || null
}

export default {
  COMMON_SIGNATURES,
  lookupCommonSignature
}
