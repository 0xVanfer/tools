/**
 * Preset Methods Configuration
 * 
 * Pre-defined methods for VNet Reader, organized by category.
 */

export const PRESET_METHODS = {
  ERC20: [
    {
      name: 'balanceOf',
      signature: 'balanceOf(address)',
      outputs: '(uint256)',
      description: 'Get token balance of address'
    },
    {
      name: 'totalSupply',
      signature: 'totalSupply()',
      outputs: '(uint256)',
      description: 'Get total token supply'
    },
    {
      name: 'allowance',
      signature: 'allowance(address,address)',
      outputs: '(uint256)',
      description: 'Get approved allowance'
    },
    {
      name: 'decimals',
      signature: 'decimals()',
      outputs: '(uint8)',
      description: 'Get token decimals'
    },
    {
      name: 'symbol',
      signature: 'symbol()',
      outputs: '(string)',
      description: 'Get token symbol'
    },
    {
      name: 'name',
      signature: 'name()',
      outputs: '(string)',
      description: 'Get token name'
    }
  ],
  
  ERC721: [
    {
      name: 'ownerOf',
      signature: 'ownerOf(uint256)',
      outputs: '(address)',
      description: 'Get owner of token ID'
    },
    {
      name: 'balanceOf',
      signature: 'balanceOf(address)',
      outputs: '(uint256)',
      description: 'Get NFT count for address'
    },
    {
      name: 'getApproved',
      signature: 'getApproved(uint256)',
      outputs: '(address)',
      description: 'Get approved address for token'
    },
    {
      name: 'isApprovedForAll',
      signature: 'isApprovedForAll(address,address)',
      outputs: '(bool)',
      description: 'Check operator approval'
    },
    {
      name: 'tokenURI',
      signature: 'tokenURI(uint256)',
      outputs: '(string)',
      description: 'Get token metadata URI'
    }
  ],
  
  ERC1155: [
    {
      name: 'balanceOf',
      signature: 'balanceOf(address,uint256)',
      outputs: '(uint256)',
      description: 'Get balance for token ID'
    },
    {
      name: 'balanceOfBatch',
      signature: 'balanceOfBatch(address[],uint256[])',
      outputs: '(uint256[])',
      description: 'Get balances for multiple tokens'
    },
    {
      name: 'isApprovedForAll',
      signature: 'isApprovedForAll(address,address)',
      outputs: '(bool)',
      description: 'Check operator approval'
    },
    {
      name: 'uri',
      signature: 'uri(uint256)',
      outputs: '(string)',
      description: 'Get token metadata URI'
    }
  ],
  
  Ownable: [
    {
      name: 'owner',
      signature: 'owner()',
      outputs: '(address)',
      description: 'Get contract owner'
    },
    {
      name: 'pendingOwner',
      signature: 'pendingOwner()',
      outputs: '(address)',
      description: 'Get pending owner (two-step)'
    }
  ],
  
  AccessControl: [
    {
      name: 'hasRole',
      signature: 'hasRole(bytes32,address)',
      outputs: '(bool)',
      description: 'Check if address has role'
    },
    {
      name: 'getRoleAdmin',
      signature: 'getRoleAdmin(bytes32)',
      outputs: '(bytes32)',
      description: 'Get admin role for role'
    },
    {
      name: 'DEFAULT_ADMIN_ROLE',
      signature: 'DEFAULT_ADMIN_ROLE()',
      outputs: '(bytes32)',
      description: 'Get default admin role'
    }
  ],
  
  Pausable: [
    {
      name: 'paused',
      signature: 'paused()',
      outputs: '(bool)',
      description: 'Check if contract is paused'
    }
  ],
  
  Proxy: [
    {
      name: 'implementation',
      signature: 'implementation()',
      outputs: '(address)',
      description: 'Get implementation address'
    },
    {
      name: 'admin',
      signature: 'admin()',
      outputs: '(address)',
      description: 'Get proxy admin'
    },
    {
      name: 'proxiableUUID',
      signature: 'proxiableUUID()',
      outputs: '(bytes32)',
      description: 'Get UUPS storage slot'
    }
  ],
  
  Safe: [
    {
      name: 'getOwners',
      signature: 'getOwners()',
      outputs: '(address[])',
      description: 'Get Safe owners'
    },
    {
      name: 'getThreshold',
      signature: 'getThreshold()',
      outputs: '(uint256)',
      description: 'Get required signatures'
    },
    {
      name: 'nonce',
      signature: 'nonce()',
      outputs: '(uint256)',
      description: 'Get current nonce'
    },
    {
      name: 'isOwner',
      signature: 'isOwner(address)',
      outputs: '(bool)',
      description: 'Check if address is owner'
    },
    {
      name: 'getModules',
      signature: 'getModules()',
      outputs: '(address[])',
      description: 'Get enabled modules'
    }
  ],
  
  Staking: [
    {
      name: 'balanceOf',
      signature: 'balanceOf(address)',
      outputs: '(uint256)',
      description: 'Get staked balance'
    },
    {
      name: 'earned',
      signature: 'earned(address)',
      outputs: '(uint256)',
      description: 'Get earned rewards'
    },
    {
      name: 'rewardPerToken',
      signature: 'rewardPerToken()',
      outputs: '(uint256)',
      description: 'Get reward per token'
    },
    {
      name: 'totalSupply',
      signature: 'totalSupply()',
      outputs: '(uint256)',
      description: 'Get total staked'
    },
    {
      name: 'rewardRate',
      signature: 'rewardRate()',
      outputs: '(uint256)',
      description: 'Get reward rate'
    }
  ],
  
  UniswapV2: [
    {
      name: 'getReserves',
      signature: 'getReserves()',
      outputs: '(uint112,uint112,uint32)',
      description: 'Get pair reserves'
    },
    {
      name: 'token0',
      signature: 'token0()',
      outputs: '(address)',
      description: 'Get first token'
    },
    {
      name: 'token1',
      signature: 'token1()',
      outputs: '(address)',
      description: 'Get second token'
    },
    {
      name: 'price0CumulativeLast',
      signature: 'price0CumulativeLast()',
      outputs: '(uint256)',
      description: 'Get cumulative price'
    }
  ],
  
  UniswapV3: [
    {
      name: 'slot0',
      signature: 'slot0()',
      outputs: '(uint160,int24,uint16,uint16,uint16,uint8,bool)',
      description: 'Get pool state'
    },
    {
      name: 'liquidity',
      signature: 'liquidity()',
      outputs: '(uint128)',
      description: 'Get active liquidity'
    },
    {
      name: 'fee',
      signature: 'fee()',
      outputs: '(uint24)',
      description: 'Get pool fee'
    },
    {
      name: 'tickSpacing',
      signature: 'tickSpacing()',
      outputs: '(int24)',
      description: 'Get tick spacing'
    },
    {
      name: 'positions',
      signature: 'positions(bytes32)',
      outputs: '(uint128,uint256,uint256,uint128,uint128)',
      description: 'Get position info'
    }
  ],
  
  Aave: [
    {
      name: 'getUserAccountData',
      signature: 'getUserAccountData(address)',
      outputs: '(uint256,uint256,uint256,uint256,uint256,uint256)',
      description: 'Get user account data'
    },
    {
      name: 'getReserveData',
      signature: 'getReserveData(address)',
      outputs: '(tuple)',
      description: 'Get reserve data'
    }
  ],
  
  Custom: []
}

/**
 * Get all preset categories
 */
export function getPresetCategories() {
  return Object.keys(PRESET_METHODS)
}

/**
 * Get methods for a category
 */
export function getPresetMethods(category) {
  return PRESET_METHODS[category] || []
}

/**
 * Parse a method signature string
 * Input: "balanceOf(address)(uint256)" or "balanceOf(address)"
 * Output: { name, inputs, outputs }
 */
export function parseMethodSignature(signature) {
  // Match: name(inputs)(outputs) or name(inputs)
  const match = signature.match(/^(\w+)\((.*?)\)(?:\((.*?)\))?$/)
  
  if (!match) {
    return null
  }
  
  const name = match[1]
  const inputsStr = match[2]
  const outputsStr = match[3] || ''
  
  // Parse inputs
  const inputs = inputsStr ? parseTypeList(inputsStr) : []
  
  // Parse outputs
  const outputs = outputsStr ? parseTypeList(outputsStr) : []
  
  return { name, inputs, outputs }
}

/**
 * Parse comma-separated type list
 */
function parseTypeList(str) {
  if (!str.trim()) return []
  
  const types = []
  let depth = 0
  let current = ''
  
  for (const char of str) {
    if (char === '(' || char === '[') {
      depth++
      current += char
    } else if (char === ')' || char === ']') {
      depth--
      current += char
    } else if (char === ',' && depth === 0) {
      if (current.trim()) types.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  if (current.trim()) types.push(current.trim())
  
  return types
}

/**
 * Add a custom method to session
 */
export function addCustomMethod(method) {
  if (!PRESET_METHODS.Custom.find(m => m.signature === method.signature)) {
    PRESET_METHODS.Custom.push(method)
  }
}

export default {
  PRESET_METHODS,
  getPresetCategories,
  getPresetMethods,
  parseMethodSignature,
  addCustomMethod
}
