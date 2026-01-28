/**
 * Decoder Module
 * 
 * Provides comprehensive calldata decoding with:
 * - Multicall detection and parsing (Uniswap V3, generic, aggregate)
 * - Safe transaction parsing (execTransaction, multiSend)
 * - Nested bytes recursive decoding
 * - Signature lookup integration
 */

import { getEthers, createInterface } from './core/ethers.js'
import { toChecksumAddressSafe } from './core/address.js'
import { lookupSignature } from './signature.js'
import { getSelector } from './ethereum.js'

// Re-export toChecksumAddress for backwards compatibility in decoder
const toChecksumAddress = toChecksumAddressSafe

// ============================================================================
// MULTICALL PATTERNS
// ============================================================================

/**
 * Known multicall function selectors and their formats.
 */
export const MULTICALL_SELECTORS = {
  // Uniswap V3 Router: multicall(uint256 deadline, bytes[] data)
  '0x5ae401dc': {
    name: 'multicall',
    signature: 'multicall(uint256,bytes[])',
    type: 'uniswap-v3'
  },
  // Generic multicall: multicall(bytes[] data)  
  '0xac9650d8': {
    name: 'multicall',
    signature: 'multicall(bytes[])',
    type: 'generic'
  },
  // Multicall2 aggregate: aggregate((address,bytes)[])
  '0x252dba42': {
    name: 'aggregate',
    signature: 'aggregate((address,bytes)[])',
    type: 'aggregate'
  },
  // Multicall with previous blockhash: multicall(bytes32,bytes[])
  '0x1c0464c1': {
    name: 'multicall',
    signature: 'multicall(bytes32,bytes[])',
    type: 'with-hash'
  },
  // Aggregate with strict mode
  '0x8a6a1e85': {
    name: 'aggregate',
    signature: 'aggregate((address,bytes)[],bool)',
    type: 'aggregate-strict'
  }
}

/**
 * Check if payload is a multicall
 */
export function isMulticall(payload) {
  const selector = getSelector(payload)
  return !!MULTICALL_SELECTORS[selector]
}

/**
 * Get multicall info for a selector
 */
export function getMulticallInfo(selector) {
  return MULTICALL_SELECTORS[selector.toLowerCase()] || null
}

/**
 * Parse a multicall payload into individual calls
 */
export function parseMulticall(payload) {
  const ethers = getEthers()
  const selector = getSelector(payload)
  const info = MULTICALL_SELECTORS[selector]
  
  if (!info) {
    throw new Error('Not a recognized multicall pattern')
  }
  
  const data = normalizePayload(payload)
  
  try {
    const iface = createInterface([`function ${info.signature}`])
    const decoded = iface.decodeFunctionData(info.name, data)
    
    switch (info.type) {
      case 'uniswap-v3': {
        // multicall(uint256 deadline, bytes[] data)
        const deadline = decoded[0].toString()
        const calls = decoded[1].map(calldata => ({
          data: calldata,
          target: null // Same contract
        }))
        return { type: info.type, deadline, calls }
      }
      
      case 'generic':
      case 'with-hash': {
        // multicall(bytes[]) or multicall(bytes32, bytes[])
        const callsArray = info.type === 'with-hash' ? decoded[1] : decoded[0]
        const calls = callsArray.map(calldata => ({
          data: calldata,
          target: null
        }))
        return { type: info.type, calls }
      }
      
      case 'aggregate':
      case 'aggregate-strict': {
        // aggregate((address,bytes)[])
        const tuples = decoded[0]
        const calls = tuples.map(tuple => ({
          target: toChecksumAddress(tuple[0]),
          data: tuple[1]
        }))
        return { type: info.type, calls }
      }
      
      default:
        throw new Error(`Unknown multicall type: ${info.type}`)
    }
  } catch (e) {
    throw new Error(`Failed to parse multicall: ${e.message}`)
  }
}

// ============================================================================
// SAFE TRANSACTION PATTERNS
// ============================================================================

/**
 * Known Safe MultiSend contract addresses
 */
export const SAFE_MULTISEND_ADDRESSES = [
  '0x9641d764fc13c8b624c04430c7356c1c7c8102e2', // MultiSend 1.3.0
  '0x40a2accbd92bca938b02010e17a5b8929b49130d', // MultiSend Call Only 1.3.0
  '0xa238cbeb142c10ef7ad8442c6d1f9e89e07e7761', // MultiSend 1.4.1
  '0x38869bf66a61cf6bdb996a6ae40d5853fd43b526', // MultiSend Call Only 1.4.1
]

/**
 * Safe function selectors
 */
export const SAFE_SELECTORS = {
  execTransaction: '0x6a761202',
  multiSend: '0x8d80ff0a'
}

/**
 * Check if address is a known Safe MultiSend contract
 */
export function isSafeMultisendAddress(address) {
  if (!address) return false
  return SAFE_MULTISEND_ADDRESSES.includes(address.toLowerCase())
}

/**
 * Check if payload is a Safe execTransaction
 */
export function isExecTransaction(payload) {
  return getSelector(payload) === SAFE_SELECTORS.execTransaction
}

/**
 * Check if payload is a Safe multiSend
 */
export function isMultiSend(payload) {
  return getSelector(payload) === SAFE_SELECTORS.multiSend
}

/**
 * Decode a Safe execTransaction payload
 */
export function decodeExecTransaction(payload) {
  const abi = [
    'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)'
  ]
  
  const iface = createInterface(abi)
  const data = normalizePayload(payload)
  const decoded = iface.decodeFunctionData('execTransaction', data)
  
  return {
    to: toChecksumAddress(decoded.to),
    value: decoded.value.toString(),
    data: decoded.data,
    operation: decoded.operation,
    safeTxGas: decoded.safeTxGas.toString(),
    baseGas: decoded.baseGas.toString(),
    gasPrice: decoded.gasPrice.toString(),
    gasToken: toChecksumAddress(decoded.gasToken),
    refundReceiver: toChecksumAddress(decoded.refundReceiver),
    signatures: decoded.signatures
  }
}

/**
 * Parse Safe multiSend packed bytes into individual transactions
 * 
 * Format for each transaction:
 * - 1 byte: operation (0 = call, 1 = delegatecall)
 * - 20 bytes: to address
 * - 32 bytes: value
 * - 32 bytes: data length
 * - N bytes: data
 */
export function parseMultiSendPackedBytes(packedBytes) {
  let hexStr = (packedBytes || '').replace(/^0x/i, '')
  
  const transactions = []
  
  while (hexStr.length > 0) {
    // Minimum: operation(2) + to(40) + value(64) + dataLength(64) = 170 hex chars
    if (hexStr.length < 170) break
    
    // 1. Operation (1 byte = 2 hex chars)
    const operation = parseInt(hexStr.slice(0, 2), 16)
    hexStr = hexStr.slice(2)
    
    // 2. To address (20 bytes = 40 hex chars)
    const toAddress = '0x' + hexStr.slice(0, 40)
    hexStr = hexStr.slice(40)
    
    // 3. Value (32 bytes = 64 hex chars)
    const value = BigInt('0x' + hexStr.slice(0, 64)).toString()
    hexStr = hexStr.slice(64)
    
    // 4. Data length (32 bytes = 64 hex chars)
    const dataLength = parseInt(hexStr.slice(0, 64), 16)
    hexStr = hexStr.slice(64)
    
    if (isNaN(dataLength) || dataLength < 0 || hexStr.length < dataLength * 2) {
      break
    }
    
    // 5. Data
    const data = dataLength > 0 ? '0x' + hexStr.slice(0, dataLength * 2) : '0x'
    hexStr = hexStr.slice(dataLength * 2)
    
    transactions.push({
      operation,
      operationName: operation === 0 ? 'call' : operation === 1 ? 'delegatecall' : `unknown(${operation})`,
      address: toChecksumAddress(toAddress),
      value,
      data
    })
  }
  
  return transactions
}

/**
 * Parse a Safe multiSend payload (full payload including selector)
 */
export function parseMultiSend(payload) {
  // Decode the multiSend(bytes) call first
  const abi = ['function multiSend(bytes transactions)']
  const iface = createInterface(abi)
  const data = normalizePayload(payload)
  const decoded = iface.decodeFunctionData('multiSend', data)
  
  // Parse the packed bytes
  return parseMultiSendPackedBytes(decoded[0])
}

/**
 * Process a Safe transaction payload
 * Handles both execTransaction and direct multiSend
 */
export function processSafePayload(payload) {
  if (isExecTransaction(payload)) {
    const decoded = decodeExecTransaction(payload)
    
    // If target is a known multiSend address, parse the inner data
    if (isSafeMultisendAddress(decoded.to)) {
      return {
        type: 'execTransaction-multiSend',
        execTransaction: decoded,
        transactions: parseMultiSend(decoded.data)
      }
    }
    
    // Single transaction
    return {
      type: 'execTransaction',
      execTransaction: decoded,
      transactions: [{
        address: decoded.to,
        value: decoded.value,
        data: decoded.data,
        operation: decoded.operation
      }]
    }
  }
  
  if (isMultiSend(payload)) {
    return {
      type: 'multiSend',
      transactions: parseMultiSend(payload)
    }
  }
  
  return null
}

// ============================================================================
// NESTED BYTES DECODING
// ============================================================================

/**
 * Check if a bytes value is likely decodable (has a valid function selector)
 * Must be a hex string starting with 0x, at least 4 bytes, and not starting with 0x00000000
 */
export function isDecodableBytes(value) {
  if (!value || typeof value !== 'string') return false
  const hex = value.replace(/^0x/i, '')
  // At least 4 bytes (8 hex chars) and valid hex
  if (hex.length < 8 || !/^[0-9a-fA-F]+$/.test(hex)) return false
  // Skip if starts with zeros (likely just data, not a function call)
  if (hex.startsWith('00000000')) return false
  return true
}

/**
 * Parse tuple value into components for further processing
 */
function parseTupleValue(value, typeStr) {
  // typeStr is like "tuple(address,uint256,bytes)" or "tuple(address,uint256,bytes)[]"
  const isArray = typeStr.endsWith('[]')
  const baseType = isArray ? typeStr.slice(0, -2) : typeStr
  
  // Extract inner types
  const match = baseType.match(/^tuple\((.+)\)$/)
  if (!match) return null
  
  const innerTypes = splitTupleTypes(match[1])
  
  if (isArray && Array.isArray(value)) {
    return value.map(item => parseSingleTuple(item, innerTypes))
  }
  
  return parseSingleTuple(value, innerTypes)
}

/**
 * Split tuple type string handling nested tuples
 */
function splitTupleTypes(typeStr) {
  const types = []
  let current = ''
  let depth = 0
  
  for (let i = 0; i < typeStr.length; i++) {
    const char = typeStr[i]
    if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      types.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  
  if (current.trim()) {
    types.push(current.trim())
  }
  
  return types
}

/**
 * Parse single tuple value
 */
function parseSingleTuple(value, types) {
  if (!value || !Array.isArray(types)) return null
  
  const components = []
  for (let i = 0; i < types.length; i++) {
    components.push({
      type: types[i],
      value: Array.isArray(value) ? value[i] : value[types[i]],
      name: `field${i}`
    })
  }
  return components
}

/**
 * Find and decode nested bytes parameters recursively
 * 
 * Handles:
 * - bytes: Standard bytes with function call
 * - bytes[]: Array of bytes, each potentially containing function calls
 * - tuple: Tuple containing bytes or other tuples
 * - tuple[]: Array of tuples
 * - multiSend(bytes): Special packed format for Safe multiSend
 * 
 * @param {Array} params - Decoded parameters array
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth (default 3)
 * @param {string} parentFunctionName - Parent function name for special handling
 * @returns {Promise<Array>} Parameters with decoded nested bytes
 */
export async function findAndDecodeNestedBytes(params, depth = 0, maxDepth = 3, parentFunctionName = '') {
  if (depth >= maxDepth || !Array.isArray(params)) return params
  
  const results = []
  
  for (const param of params) {
    const result = { ...param }
    const paramType = param.type || param.AbiType || ''
    const paramValue = param.value || param.Value
    
    // Special case: multiSend(bytes) - packed bytes format
    if (parentFunctionName === 'multiSend' && paramType === 'bytes' && paramValue) {
      try {
        const transactions = parseMultiSendPackedBytes(paramValue)
        if (transactions.length > 0) {
          result.isMultiSendPacked = true
          result.packedTransactions = []
          
          for (const tx of transactions) {
            if (tx.data && tx.data !== '0x' && isDecodableBytes(tx.data)) {
              const decoded = await decodePayload(tx.data, { recursive: true, depth: depth + 1, maxDepth })
              // IMPORTANT: Also recurse into decoded.params for more nested bytes
              if (decoded && decoded.params && decoded.params.length > 0) {
                decoded.params = await findAndDecodeNestedBytes(
                  decoded.params,
                  depth + 1,
                  maxDepth,
                  decoded.name || decoded.signature?.split('(')[0] || ''
                )
              }
              result.packedTransactions.push({ ...tx, decoded })
            } else {
              result.packedTransactions.push(tx)
            }
          }
          results.push(result)
          continue
        }
      } catch (e) {
        // Not a valid multiSend packed bytes, continue with normal processing
      }
    }
    
    // Case 1: bytes type
    if (paramType === 'bytes' && isDecodableBytes(paramValue)) {
      try {
        const decoded = await decodePayload(paramValue, { recursive: true, depth: depth + 1, maxDepth })
        if (decoded && (decoded.signature || decoded.selector)) {
          result.decoded = decoded
          // IMPORTANT: Also recurse into the decoded params to find more nested bytes
          if (decoded.params && decoded.params.length > 0) {
            result.decoded.params = await findAndDecodeNestedBytes(
              decoded.params, 
              depth + 1, 
              maxDepth, 
              decoded.name || decoded.signature?.split('(')[0] || ''
            )
          }
        }
      } catch (e) {
        // Silently fail - not all bytes are function calls
      }
    }
    // Case 2: bytes[] type
    else if (paramType === 'bytes[]') {
      const values = Array.isArray(paramValue) ? paramValue : tryParseJSON(paramValue)
      if (Array.isArray(values)) {
        const decodedArray = []
        for (const bytesVal of values) {
          if (isDecodableBytes(bytesVal)) {
            try {
              const decoded = await decodePayload(bytesVal, { recursive: true, depth: depth + 1, maxDepth })
              // Also recurse into decoded params
              if (decoded && decoded.params && decoded.params.length > 0) {
                decoded.params = await findAndDecodeNestedBytes(
                  decoded.params,
                  depth + 1,
                  maxDepth,
                  decoded.name || decoded.signature?.split('(')[0] || ''
                )
              }
              decodedArray.push(decoded)
            } catch (e) {
              decodedArray.push(null)
            }
          } else {
            decodedArray.push(null)
          }
        }
        if (decodedArray.some(d => d !== null)) {
          result.decodedArray = decodedArray
        }
      }
    }
    // Case 3: tuple type containing bytes
    else if (paramType.startsWith('tuple')) {
      const tupleComponents = param.components || parseTupleValue(paramValue, paramType)
      if (Array.isArray(tupleComponents)) {
        const decodedComponents = await findAndDecodeNestedBytes(tupleComponents, depth, maxDepth, parentFunctionName)
        if (decodedComponents !== tupleComponents) {
          result.components = decodedComponents
        }
      }
    }
    // Case 4: tuple[] type
    else if (paramType.includes('tuple') && paramType.endsWith('[]')) {
      const values = Array.isArray(paramValue) ? paramValue : tryParseJSON(paramValue)
      if (Array.isArray(values)) {
        const decodedTuples = []
        for (const tupleVal of values) {
          const components = parseSingleTuple(tupleVal, splitTupleTypes(paramType.match(/tuple\((.+)\)/)?.[1] || ''))
          if (components) {
            const decoded = await findAndDecodeNestedBytes(components, depth, maxDepth, parentFunctionName)
            decodedTuples.push(decoded)
          } else {
            decodedTuples.push(null)
          }
        }
        if (decodedTuples.some(d => d !== null)) {
          result.decodedTuples = decodedTuples
        }
      }
    }
    
    results.push(result)
  }
  
  return results
}

/**
 * Try to parse JSON string, return original if fails
 */
function tryParseJSON(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// ============================================================================
// MAIN DECODER
// ============================================================================

/**
 * Normalize payload to have 0x prefix
 */
function normalizePayload(payload) {
  return payload.startsWith('0x') ? payload : '0x' + payload
}

/**
 * Get full ABI type string including tuple components
 */
function getFullAbiType(input) {
  if (!input) return ''
  
  if (input.baseType === 'array' || (input.baseType && input.baseType.endsWith('[]'))) {
    if (input.arrayChildren) {
      return getFullAbiType(input.arrayChildren) + '[]'
    }
    return input.type
  }
  
  if (input.baseType === 'tuple') {
    const inner = input.components.map(getFullAbiType).join(',')
    return `tuple(${inner})`
  }
  
  return input.type
}

/**
 * Format decoded value for display
 */
function formatValue(value, input) {
  try {
    if (!input) return String(value)
    
    if (input.baseType === 'bytes') {
      const ethers = getEthers()
      return ethers.utils.hexlify(value)
    }
    
    if (input.baseType === 'address') {
      return toChecksumAddress(value)
    }
    
    if (input.baseType === 'array' || (input.baseType && input.baseType.endsWith('[]'))) {
      return Array.from(value).map(v => formatValue(v, input.arrayChildren))
    }
    
    if (input.baseType === 'tuple') {
      // Return array of values for tuples - components will be set separately
      const parts = []
      for (let i = 0; i < input.components.length; i++) {
        parts.push(formatValue(value[i], input.components[i]))
      }
      return parts
    }
    
    if (input.baseType && (input.baseType.startsWith('uint') || input.baseType.startsWith('int'))) {
      return value.toString()
    }
    
    return String(value)
  } catch (e) {
    return String(value)
  }
}

/**
 * Build components array for tuple parameters
 */
function buildTupleComponents(value, input) {
  if (!input || input.baseType !== 'tuple' || !input.components) return null
  
  const components = []
  for (let i = 0; i < input.components.length; i++) {
    const comp = input.components[i]
    const compValue = formatValue(value[i], comp)
    const compType = getFullAbiType(comp)
    
    const compObj = {
      value: compValue,
      type: compType,
      name: comp.name || `field${i}`
    }
    
    // Recursively build components for nested tuples
    if (comp.baseType === 'tuple') {
      compObj.components = buildTupleComponents(value[i], comp)
    }
    // Handle arrays of tuples nested inside this tuple
    else if (comp.baseType === 'array' && comp.arrayChildren?.baseType === 'tuple') {
      compObj.itemComponents = Array.from(value[i]).map(item => 
        buildTupleComponents(item, comp.arrayChildren)
      )
    }
    
    components.push(compObj)
  }
  return components
}

/**
 * Decode a payload with a given signature
 */
export function decodeWithSignature(signature, payload) {
  if (!signature) {
    return { params: [], error: 'No signature provided' }
  }
  
  try {
    const abi = [`function ${signature}`]
    const iface = createInterface(abi)
    const data = normalizePayload(payload)
    
    // Verify sighash matches
    const payloadSighash = data.slice(0, 10).toLowerCase()
    const funcName = signature.split('(')[0]
    const abiSighash = iface.getSighash(funcName).toLowerCase()
    
    if (payloadSighash !== abiSighash) {
      return {
        params: [],
        error: `Sighash mismatch: payload=${payloadSighash}, expected=${abiSighash}`
      }
    }
    
    const args = iface.decodeFunctionData(signature, data)
    const method = iface.getFunction(signature)
    const params = []
    
    for (let i = 0; i < method.inputs.length; i++) {
      const input = method.inputs[i]
      const abiType = getFullAbiType(input)
      const value = formatValue(args[i], input)
      
      const paramObj = {
        value,
        type: abiType,
        name: input.name || `param${i}`
      }
      
      // Add components for tuple types
      if (input.baseType === 'tuple') {
        paramObj.components = buildTupleComponents(args[i], input)
      }
      // Handle arrays of tuples - build components for each item
      else if (input.baseType === 'array' && input.arrayChildren?.baseType === 'tuple') {
        paramObj.itemComponents = Array.from(args[i]).map(item => 
          buildTupleComponents(item, input.arrayChildren)
        )
      }
      
      params.push(paramObj)
    }
    
    return { params, error: null }
  } catch (e) {
    return { params: [], error: `Decode failed: ${e.message}` }
  }
}

/**
 * Decode a payload using ABI
 */
export function decodeWithABI(abi, payload) {
  try {
    const iface = createInterface(abi)
    const data = normalizePayload(payload)
    const parsed = iface.parseTransaction({ data })
    
    const params = parsed.args.map((arg, i) => {
      const input = parsed.functionFragment.inputs[i]
      const abiType = getFullAbiType(input)
      const value = formatValue(arg, input)
      
      const paramObj = {
        value,
        type: abiType,
        name: input?.name || `param${i}`
      }
      
      // Add components for tuple types
      if (input?.baseType === 'tuple') {
        paramObj.components = buildTupleComponents(arg, input)
      }
      // Handle arrays of tuples - build components for each item
      else if (input?.baseType === 'array' && input?.arrayChildren?.baseType === 'tuple') {
        paramObj.itemComponents = Array.from(arg).map(item => 
          buildTupleComponents(item, input.arrayChildren)
        )
      }
      
      return paramObj
    })
    
    return {
      selector: parsed.sighash,
      signature: parsed.signature,
      name: parsed.name,
      params,
      error: null
    }
  } catch (e) {
    return { error: `Failed to decode with ABI: ${e.message}` }
  }
}

/**
 * Main decode function
 * 
 * Decodes a payload with automatic detection of:
 * - Multicall patterns
 * - Safe transactions
 * - Nested bytes parameters
 * 
 * @param {string} payload - The hex-encoded payload
 * @param {Object} options - Decode options
 * @param {string} options.abi - Contract ABI for decoding
 * @param {string} options.signature - Function signature override
 * @param {boolean} options.recursive - Enable nested bytes decoding
 * @param {number} options.depth - Current recursion depth
 * @param {number} options.maxDepth - Maximum recursion depth
 */
export async function decodePayload(payload, options = {}) {
  const { abi, signature: overrideSignature, recursive = true, depth = 0, maxDepth = 3 } = options
  
  if (!payload || payload.length < 10) {
    return { error: 'Invalid payload: too short' }
  }
  
  const selector = getSelector(payload)
  
  // 1. Check for Safe transactions
  const safeResult = processSafePayload(payload)
  if (safeResult) {
    // Decode each inner transaction
    const decodedTransactions = []
    for (const tx of safeResult.transactions) {
      if (tx.data && tx.data !== '0x') {
        const decoded = await decodePayload(tx.data, { recursive, depth: depth + 1, maxDepth })
        // Also recurse into decoded.params
        if (recursive && decoded && decoded.params && decoded.params.length > 0 && depth < maxDepth) {
          decoded.params = await findAndDecodeNestedBytes(
            decoded.params, 
            depth + 1, 
            maxDepth, 
            decoded.name || decoded.signature?.split('(')[0] || ''
          )
        }
        decodedTransactions.push({
          ...tx,
          decoded
        })
      } else {
        decodedTransactions.push(tx)
      }
    }
    
    return {
      selector,
      type: 'safe',
      safeType: safeResult.type,
      execTransaction: safeResult.execTransaction,
      transactions: decodedTransactions
    }
  }
  
  // 2. Check for multicall
  if (isMulticall(payload)) {
    const multicallResult = parseMulticall(payload)
    const multicallInfo = getMulticallInfo(selector)
    
    // Decode each inner call
    const decodedCalls = []
    for (const call of multicallResult.calls) {
      const decoded = await decodePayload(call.data, { recursive, depth: depth + 1, maxDepth })
      // Also recurse into decoded.params
      if (recursive && decoded && decoded.params && decoded.params.length > 0 && depth < maxDepth) {
        decoded.params = await findAndDecodeNestedBytes(
          decoded.params,
          depth + 1,
          maxDepth,
          decoded.name || decoded.signature?.split('(')[0] || ''
        )
      }
      decodedCalls.push({
        ...call,
        decoded
      })
    }
    
    return {
      selector,
      type: 'multicall',
      multicallType: multicallResult.type,
      signature: multicallInfo.signature,
      name: multicallInfo.name,
      deadline: multicallResult.deadline,
      calls: decodedCalls
    }
  }
  
  // 3. Standard decode with ABI or signature lookup
  let result = null
  
  // Try ABI first
  if (abi) {
    result = decodeWithABI(abi, payload)
    if (!result.error) {
      // Try nested bytes decoding
      if (recursive && depth < maxDepth) {
        result.params = await findAndDecodeNestedBytes(result.params, depth, maxDepth)
      }
      return result
    }
  }
  
  // Use override signature if provided
  if (overrideSignature) {
    const decoded = decodeWithSignature(overrideSignature, payload)
    if (!decoded.error) {
      result = {
        selector,
        signature: overrideSignature,
        name: overrideSignature.split('(')[0],
        params: decoded.params
      }
      
      if (recursive && depth < maxDepth) {
        result.params = await findAndDecodeNestedBytes(result.params, depth, maxDepth)
      }
      return result
    }
  }
  
  // Lookup signature from 4byte
  try {
    const signatures = await lookupSignature(selector)
    if (signatures && signatures.length > 0) {
      // Try each signature until one works
      for (const sig of signatures) {
        const decoded = decodeWithSignature(sig, payload)
        if (!decoded.error && decoded.params.length > 0) {
          result = {
            selector,
            signature: sig,
            name: sig.split('(')[0],
            params: decoded.params,
            alternativeSignatures: signatures.filter(s => s !== sig)
          }
          
          if (recursive && depth < maxDepth) {
            result.params = await findAndDecodeNestedBytes(result.params, depth, maxDepth)
          }
          return result
        }
      }
      
      // Return first signature even if decode failed (for display)
      return {
        selector,
        signature: signatures[0],
        name: signatures[0].split('(')[0],
        params: [],
        alternativeSignatures: signatures.slice(1),
        rawData: payload.slice(10),
        error: 'Could not decode parameters'
      }
    }
  } catch (e) {
    console.warn('Signature lookup failed:', e)
  }
  
  // Return unknown function
  return {
    selector,
    signature: null,
    name: null,
    params: [],
    rawData: payload.slice(10),
    error: 'Unknown function selector'
  }
}

/**
 * Collect all addresses from a decoded result
 */
export function collectAddresses(decoded, addresses = new Set()) {
  if (!decoded) return addresses
  
  // Check Safe transactions
  if (decoded.transactions) {
    for (const tx of decoded.transactions) {
      if (tx.address) addresses.add(tx.address.toLowerCase())
      if (tx.decoded) collectAddresses(tx.decoded, addresses)
    }
  }
  
  // Check multicall
  if (decoded.calls) {
    for (const call of decoded.calls) {
      if (call.target) addresses.add(call.target.toLowerCase())
      if (call.decoded) collectAddresses(call.decoded, addresses)
    }
  }
  
  // Check execTransaction (Safe)
  if (decoded.execTransaction?.to) {
    addresses.add(decoded.execTransaction.to.toLowerCase())
  }
  
  // Check parameters recursively
  if (decoded.params) {
    collectAddressesFromParams(decoded.params, addresses)
  }
  
  return addresses
}

/**
 * Recursively collect addresses from parameters array
 */
function collectAddressesFromParams(params, addresses) {
  if (!params || !Array.isArray(params)) return
  
  for (const param of params) {
    // Single address
    if (param.type === 'address' && param.value) {
      addresses.add(param.value.toLowerCase())
    }
    
    // Address array
    if (param.type === 'address[]' && Array.isArray(param.value)) {
      for (const addr of param.value) {
        if (addr) addresses.add(addr.toLowerCase())
      }
    }
    
    // Decoded bytes content
    if (param.decoded) {
      collectAddresses(param.decoded, addresses)
    }
    
    // Decoded bytes array
    if (param.decodedArray && Array.isArray(param.decodedArray)) {
      for (const decoded of param.decodedArray) {
        if (decoded) collectAddresses(decoded, addresses)
      }
    }
    
    // Tuple components
    if (param.components && Array.isArray(param.components)) {
      collectAddressesFromParams(param.components, addresses)
    }
    
    // Tuple array with itemComponents
    if (param.itemComponents && Array.isArray(param.itemComponents)) {
      for (const itemComp of param.itemComponents) {
        if (itemComp) collectAddressesFromParams(itemComp, addresses)
      }
    }
    
    // MultiSend packed transactions
    if (param.isMultiSendPacked && param.packedTransactions) {
      for (const tx of param.packedTransactions) {
        if (tx.address) addresses.add(tx.address.toLowerCase())
        if (tx.decoded) collectAddresses(tx.decoded, addresses)
      }
    }
  }
}
