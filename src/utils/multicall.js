/**
 * Generic Multicall3 Utility Module
 * 
 * Provides a generic interface for batching multiple contract calls
 * into a single RPC request using Multicall3.
 * 
 * Features:
 * - Support for arbitrary contract calls with any ABI
 * - Built-in allowFailure support (partial failures don't revert batch)
 * - Automatic encoding/decoding of call data
 * - Works with any EVM chain that has Multicall3 deployed
 * 
 * Multicall3 is deployed at the same address on most EVM chains:
 * 0xcA11bde05977b3631167028862bE2a173976CA11
 */

import { getEthers } from './ethereum.js'

/**
 * Multicall3 contract address (same on most EVM chains).
 */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

/**
 * Multicall3 ABI for aggregate3 function.
 * aggregate3 allows per-call allowFailure setting.
 */
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[])'
]

/**
 * Build a single call object for multicall.
 * 
 * @param {string} target - Contract address to call
 * @param {string} signature - Function signature (e.g., "balanceOf(address)")
 * @param {any[]} args - Function arguments
 * @param {boolean} allowFailure - Whether this call can fail without reverting batch
 * @returns {{target: string, allowFailure: boolean, callData: string, signature: string, args: any[]}}
 */
export function buildCall(target, signature, args = [], allowFailure = true) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers not loaded')
  
  // Create interface for encoding
  const iface = new ethers.utils.Interface([`function ${signature}`])
  const functionName = signature.split('(')[0]
  
  // Encode function call
  const callData = iface.encodeFunctionData(functionName, args)
  
  return {
    target,
    allowFailure,
    callData,
    // Store original info for decoding
    signature,
    args,
    functionName
  }
}

/**
 * Build a call object from raw calldata.
 * 
 * @param {string} target - Contract address
 * @param {string} callData - Encoded calldata
 * @param {boolean} allowFailure - Whether this call can fail
 * @returns {{target: string, allowFailure: boolean, callData: string}}
 */
export function buildRawCall(target, callData, allowFailure = true) {
  return {
    target,
    allowFailure,
    callData
  }
}

/**
 * Execute multicall via JSON-RPC.
 * 
 * @param {string} rpcUrl - The RPC endpoint URL
 * @param {Array<{target: string, allowFailure: boolean, callData: string}>} calls - Array of call objects
 * @returns {Promise<Array<{success: boolean, returnData: string}>>} Call results
 */
export async function executeMulticall(rpcUrl, calls) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers not loaded')
  
  if (!calls || calls.length === 0) {
    return []
  }
  
  const iface = new ethers.utils.Interface(MULTICALL3_ABI)
  
  // Format calls for aggregate3
  const formattedCalls = calls.map(call => ({
    target: call.target,
    allowFailure: call.allowFailure ?? true,
    callData: call.callData
  }))
  
  // Encode the aggregate3 call
  const calldata = iface.encodeFunctionData('aggregate3', [formattedCalls])
  
  // Build JSON-RPC request
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [
      {
        to: MULTICALL3_ADDRESS,
        data: calldata
      },
      'latest'
    ]
  }

  console.log('[multicall] Executing aggregate3', { 
    callCount: calls.length,
    rpcUrl
  })

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`)
  }

  // Decode the aggregate3 response
  const decoded = iface.decodeFunctionResult('aggregate3', json.result)
  return decoded[0] // Returns array of (success, returnData) tuples
}

/**
 * Decode a single result based on output signature using Interface.decodeFunctionResult.
 * 
 * @param {string} returnData - The raw return data
 * @param {string} signature - Function signature (e.g., "balanceOf(address)")
 * @param {string} outputTypes - Output types (e.g., "uint256" or "uint256,uint256,uint256")
 * @returns {any} Decoded value(s)
 */
export function decodeResult(returnData, signature, outputTypes) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers not loaded')
  
  if (!returnData || returnData === '0x') {
    return null
  }
  
  // Parse output types
  const types = outputTypes.split(',').map(t => t.trim()).filter(Boolean)
  if (types.length === 0) {
    return null
  }
  
  try {
    // Build full function signature with returns
    const funcName = signature.split('(')[0]
    const fullSig = `function ${signature} returns (${outputTypes})`
    const iface = new ethers.utils.Interface([fullSig])
    
    // Use decodeFunctionResult which handles the full function ABI properly
    const decoded = iface.decodeFunctionResult(funcName, returnData)
    
    console.log('[multicall] Decoded result:', { 
      signature, 
      outputTypes, 
      typesCount: types.length,
      decoded,
      decodedLength: decoded.length,
      decodedType: typeof decoded,
      isArray: Array.isArray(decoded)
    })
    
    // decodeFunctionResult returns a Result object (array-like)
    // For multiple return values, decoded.length should match types.length
    // But sometimes ethers wraps it differently, so we need to handle that
    
    let result = []
    
    // Check if decoded has the expected length
    if (decoded.length === types.length) {
      // Normal case: each index corresponds to a return value
      for (let i = 0; i < types.length; i++) {
        result.push(decoded[i])
      }
    } else if (decoded.length === 1 && types.length > 1) {
      // Edge case: ethers wrapped all values in decoded[0]
      // This can happen with some tuple interpretations
      const inner = decoded[0]
      if (inner && typeof inner === 'object' && (Array.isArray(inner) || inner.length !== undefined)) {
        const innerLength = Array.isArray(inner) ? inner.length : inner.length
        if (innerLength === types.length) {
          for (let i = 0; i < types.length; i++) {
            result.push(inner[i])
          }
        } else {
          // Just use the single value
          result.push(inner)
        }
      } else {
        result.push(decoded[0])
      }
    } else {
      // Unknown structure, just return as-is
      for (let i = 0; i < decoded.length; i++) {
        result.push(decoded[i])
      }
    }
    
    console.log('[multicall] Final result:', result, 'length:', result.length)
    
    // If single return value, unwrap
    return types.length === 1 ? result[0] : result
  } catch (e) {
    console.warn('[multicall] Failed to decode with decodeFunctionResult, trying defaultAbiCoder', { 
      signature, outputTypes, error: e.message 
    })
    
    // Fallback to defaultAbiCoder for simpler cases
    try {
      const decoded = ethers.utils.defaultAbiCoder.decode(types, returnData)
      const result = []
      for (let i = 0; i < decoded.length; i++) {
        result.push(decoded[i])
      }
      return types.length === 1 ? result[0] : result
    } catch (e2) {
      console.warn('[multicall] Failed to decode result', { outputTypes, error: e2.message })
      return null
    }
  }
}

/**
 * High-level function to execute multiple contract reads.
 * 
 * @param {string} rpcUrl - RPC endpoint URL
 * @param {Array<{
 *   target: string,
 *   signature: string,
 *   args?: any[],
 *   outputs?: string,
 *   allowFailure?: boolean
 * }>} calls - Array of call definitions
 * @returns {Promise<Array<{success: boolean, value: any, error?: string}>>} Results
 * 
 * @example
 * const results = await batchCall(rpcUrl, [
 *   { target: tokenAddr, signature: 'symbol()', outputs: 'string' },
 *   { target: tokenAddr, signature: 'balanceOf(address)', args: [userAddr], outputs: 'uint256' }
 * ])
 */
export async function batchCall(rpcUrl, calls) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers not loaded')
  
  // Build call objects
  const builtCalls = calls.map(call => 
    buildCall(
      call.target, 
      call.signature, 
      call.args || [], 
      call.allowFailure ?? true
    )
  )
  
  // Execute multicall
  const results = await executeMulticall(rpcUrl, builtCalls)
  
  // Decode results
  return results.map((result, index) => {
    const call = calls[index]
    
    if (!result.success) {
      // Try to decode error message
      let error = 'Call failed'
      if (result.returnData && result.returnData !== '0x') {
        try {
          // Try to decode as Error(string)
          const errorData = result.returnData
          if (errorData.startsWith('0x08c379a0')) {
            const decoded = ethers.utils.defaultAbiCoder.decode(
              ['string'], 
              '0x' + errorData.slice(10)
            )
            error = decoded[0]
          }
        } catch {}
      }
      return { success: false, value: null, error }
    }
    
    // Decode successful result
    const outputs = call.outputs || ''
    const signature = call.signature || ''
    const value = outputs ? decodeResult(result.returnData, signature, outputs) : result.returnData
    
    return { success: true, value, error: null }
  })
}

/**
 * Execute batch calls on both custom and production RPC,
 * and compare results.
 * 
 * @param {string} customRpcUrl - Custom/forked RPC URL
 * @param {string} productionRpcUrl - Production RPC URL
 * @param {Array<{target: string, signature: string, args?: any[], outputs?: string}>} calls
 * @returns {Promise<Array<{
 *   success: boolean,
 *   customValue: any,
 *   productionValue: any,
 *   customError?: string,
 *   productionError?: string,
 *   valuesMatch: boolean
 * }>>}
 */
export async function batchCallWithComparison(customRpcUrl, productionRpcUrl, calls) {
  const ethers = getEthers()
  if (!ethers) throw new Error('ethers not loaded')
  
  // Execute on both RPCs in parallel
  const [customResults, productionResults] = await Promise.all([
    batchCall(customRpcUrl, calls),
    productionRpcUrl ? batchCall(productionRpcUrl, calls) : Promise.resolve(calls.map(() => null))
  ])
  
  // Compare results
  return customResults.map((customResult, index) => {
    const productionResult = productionResults[index]
    const call = calls[index]
    
    // Determine if values match
    let valuesMatch = false
    if (customResult.success && productionResult?.success) {
      // Compare stringified values for complex types
      const customStr = formatValue(customResult.value)
      const productionStr = formatValue(productionResult.value)
      valuesMatch = customStr === productionStr
    } else if (!customResult.success && !productionResult?.success) {
      // Both failed - consider as "match" 
      valuesMatch = true
    }
    
    return {
      success: customResult.success,
      customValue: customResult.value,
      productionValue: productionResult?.value ?? null,
      customError: customResult.error,
      productionError: productionResult?.error,
      valuesMatch,
      call // Include original call info
    }
  })
}

/**
 * Format a value for display and comparison.
 * Handles BigNumber, arrays, etc.
 * 
 * @param {any} value - The value to format
 * @returns {string} Formatted string
 */
export function formatValue(value) {
  const ethers = getEthers()
  
  if (value === null || value === undefined) {
    return 'null'
  }
  
  // Handle BigNumber
  if (ethers?.BigNumber?.isBigNumber(value)) {
    return value.toString()
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`
  }
  
  // Handle objects (tuples)
  if (typeof value === 'object') {
    // Check if it's an ethers Result (has numeric indices)
    const keys = Object.keys(value)
    const numericKeys = keys.filter(k => !isNaN(Number(k)))
    if (numericKeys.length === keys.length / 2) {
      // It's a tuple, use numeric indices only
      const values = numericKeys.map(k => formatValue(value[k]))
      return `(${values.join(', ')})`
    }
    return JSON.stringify(value)
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  
  return String(value)
}

/**
 * Apply decimals formatting to a BigNumber value.
 * 
 * @param {any} value - BigNumber or string value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted value with decimals
 */
export function formatWithDecimals(value, decimals = 18) {
  const ethers = getEthers()
  if (!ethers) return String(value)
  
  try {
    const bn = ethers.BigNumber.from(value)
    return ethers.utils.formatUnits(bn, decimals)
  } catch {
    return String(value)
  }
}

/**
 * Parse a value with decimals back to BigNumber string.
 * 
 * @param {string} value - Human readable value
 * @param {number} decimals - Number of decimal places
 * @returns {string} BigNumber string representation
 */
export function parseWithDecimals(value, decimals = 18) {
  const ethers = getEthers()
  if (!ethers) return value
  
  try {
    return ethers.utils.parseUnits(value, decimals).toString()
  } catch {
    return value
  }
}
