/**
 * Signature Module
 * 
 * Handles function signature lookup, registration, and submission.
 * Follows priority order: customSignatures → commonSignatures → signatureCache → 4byte API
 */

import { lookupCommonSignature } from '@/config/signatures.js'
import { getEthers, createInterface } from './core/ethers.js'

// ============================================================================
// STORAGE
// ============================================================================

/**
 * User-registered custom signatures (selector → signature)
 * Example: Map { '0xa9059cbb' => 'transfer(address,uint256)' }
 */
const customSignatures = new Map()

/**
 * API query result cache (selector → signatures array)
 */
const signatureCache = new Map()

// ============================================================================
// API ENDPOINTS
// ============================================================================

const SIGNATURE_API_URL = 'https://api.4byte.sourcify.dev/signature-database/v1/lookup'
const SIGNATURE_IMPORT_URL = 'https://api.4byte.sourcify.dev/signature-database/v1/import'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract 4-byte selector from payload
 */
function extractSelector(input) {
  if (!input) return ''
  
  const hex = input.replace(/^0x/i, '')
  
  // Already a 4-byte selector
  if (hex.length === 8 && /^[0-9a-fA-F]{8}$/.test(hex)) {
    return '0x' + hex.toLowerCase()
  }
  
  // Full payload - extract first 4 bytes
  if (hex.length >= 8 && /^[0-9a-fA-F]+$/.test(hex)) {
    return '0x' + hex.slice(0, 8).toLowerCase()
  }
  
  return ''
}

// ============================================================================
// MAIN METHODS
// ============================================================================

/**
 * Lookup function signature(s) for a selector
 * 
 * Priority order:
 * 1. customSignatures (user-registered)
 * 2. commonSignatures (preset common functions)
 * 3. signatureCache (API result cache)
 * 4. 4byte API query
 * 
 * @param {string} sighashOrPayload - 4-byte selector or full payload
 * @returns {Promise<string[]>} - Array of possible signatures, or empty array
 */
export async function lookupSignature(sighashOrPayload) {
  const sighash = extractSelector(sighashOrPayload)
  
  if (!sighash) {
    return []
  }
  
  // 1. Check customSignatures (user-registered)
  if (customSignatures.has(sighash)) {
    return [customSignatures.get(sighash)]
  }
  
  // 2. Check commonSignatures (preset)
  const common = lookupCommonSignature(sighash)
  if (common) {
    return [common]
  }
  
  // 3. Check signatureCache (API cache)
  if (signatureCache.has(sighash)) {
    return signatureCache.get(sighash)
  }
  
  // 4. Query 4byte API
  try {
    const url = `${SIGNATURE_API_URL}?function=${sighash}`
    const response = await fetch(url)
    
    if (!response.ok) {
      console.warn(`Signature API request failed: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    // API response format:
    // { "result": { "function": { "0xa9059cbb": [{ "name": "transfer(address,uint256)" }] } } }
    const results = data?.result?.function?.[sighash] || []
    const signatures = results.map(r => r.name).filter(Boolean)
    
    // Cache the result
    signatureCache.set(sighash, signatures)
    
    return signatures
  } catch (e) {
    console.warn('Signature lookup failed:', e)
    return []
  }
}

/**
 * Register a custom function signature
 * 
 * @param {string} signature - Function signature, e.g., 'transfer(address,uint256)'
 * @returns {string} - Computed 4-byte selector
 * @throws {Error} - If signature format is invalid
 */
export function registerCustomSignature(signature) {
  // Parse and validate signature using createInterface from core
  const iface = createInterface([`function ${signature}`])
  
  // Extract function name and compute selector
  const funcName = signature.split('(')[0]
  const sighash = iface.getSighash(funcName).toLowerCase()
  
  // Store in customSignatures
  customSignatures.set(sighash, signature)
  
  return sighash
}

/**
 * Parse function signatures from text (supports markdown tables and plain text)
 * 
 * @param {string} text - Text containing signatures
 * @returns {string[]} - Array of parsed signatures
 */
export function parseSignatureTable(text) {
  const signatures = []
  
  // Regex supporting nested parentheses
  const regex = /(\b\w+)\(((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*)\)/g
  
  for (const line of text.split('\n')) {
    let match
    while ((match = regex.exec(line)) !== null) {
      const sig = match[1] + '(' + match[2] + ')'
      
      // Skip common non-function matches
      if (!sig.startsWith('http') && !sig.startsWith('ftp')) {
        signatures.push(sig)
      }
    }
    // Reset regex state for next line
    regex.lastIndex = 0
  }
  
  // Deduplicate
  return [...new Set(signatures)]
}

/**
 * Submit signatures to 4byte database
 * 
 * @param {string[]} signatures - Array of function signatures
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitSignatures(signatures) {
  if (!signatures || signatures.length === 0) {
    return { success: false, error: 'No signatures to submit' }
  }
  
  try {
    const response = await fetch(SIGNATURE_IMPORT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: signatures,
        event: []
      })
    })
    
    if (response.ok) {
      return { success: true }
    }
    
    const errorText = await response.text()
    return { success: false, error: `API error: ${response.status} - ${errorText}` }
  } catch (e) {
    return { success: false, error: `Network error: ${e.message}` }
  }
}

/**
 * Clear signature cache
 */
export function clearCache() {
  signatureCache.clear()
}

/**
 * Get all custom registered signatures
 * 
 * @returns {Object} - sighash → signature mapping
 */
export function getCustomSignatures() {
  const result = {}
  for (const [sighash, sig] of customSignatures) {
    result[sighash] = sig
  }
  return result
}

/**
 * Register multiple signatures and submit to 4byte
 * 
 * @param {string} text - Text containing signatures
 * @returns {Promise<{registered: number, submitted: boolean, error?: string}>}
 */
export async function registerAndSubmitSignatures(text) {
  const signatures = parseSignatureTable(text)
  
  if (signatures.length === 0) {
    return { registered: 0, submitted: false, error: 'No valid signatures found' }
  }
  
  // Register locally
  let registeredCount = 0
  const validSignatures = []
  
  for (const sig of signatures) {
    try {
      registerCustomSignature(sig)
      registeredCount++
      validSignatures.push(sig)
    } catch (e) {
      console.warn(`Failed to register signature: ${sig}`, e)
    }
  }
  
  // Submit to 4byte
  const submitResult = await submitSignatures(validSignatures)
  
  return {
    registered: registeredCount,
    submitted: submitResult.success,
    error: submitResult.error
  }
}

export default {
  lookupSignature,
  registerCustomSignature,
  parseSignatureTable,
  submitSignatures,
  clearCache,
  getCustomSignatures,
  registerAndSubmitSignatures
}
