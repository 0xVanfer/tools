/**
 * Solidity Parser
 * 
 * Parses Solidity source files to extract:
 * - Struct definitions
 * - Enum definitions  
 * - Function signatures (public/external only)
 * - Error definitions
 * 
 * Ported from extract_sig/solidity-parser.js
 */

import { keccak256 } from './crypto.js'

// Solidity primitive types
const PRIMITIVE_TYPES = new Set([
  'address', 'bool', 'string', 'bytes',
  'uint', 'uint8', 'uint16', 'uint24', 'uint32', 'uint64', 'uint80', 'uint128', 'uint256',
  'int', 'int8', 'int16', 'int24', 'int32', 'int64', 'int80', 'int128', 'int256',
  'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8',
  'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16',
  'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22', 'bytes23', 'bytes24',
  'bytes25', 'bytes26', 'bytes27', 'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32',
])

// Type aliases for canonical form
const TYPE_ALIASES = {
  'uint': 'uint256',
  'int': 'int256',
  'byte': 'bytes1',
}

// Common interface patterns that should be treated as address
const INTERFACE_PATTERNS = [
  /^I?ERC\d+$/i,
  /^I[A-Z][a-zA-Z0-9]*$/,
  'IERC20', 'IERC721', 'IERC1155', 'IERC4626', 'IERC20Permit',
  'ISwapRouter', 'IUniswapV2Router', 'IUniswapV3Pool', 'IUniswapV2Pair',
  'IAToken', 'IPool', 'ILendingPool', 'IPriceOracle',
  'IWETH', 'IWETH9', 'WETH', 'WETH9',
]

/**
 * Check if a type name is a known interface/contract type
 */
function isInterfaceType(typeName) {
  const baseType = typeName.replace(/\[\]$/, '').split('.').pop()
  
  if (INTERFACE_PATTERNS.includes(baseType)) {
    return true
  }
  
  for (const pattern of INTERFACE_PATTERNS) {
    if (pattern instanceof RegExp && pattern.test(baseType)) {
      return true
    }
  }
  
  return false
}

/**
 * Compute 4-byte function selector
 */
function computeSelector(signature) {
  const hash = keccak256(signature)
  return hash.slice(0, 10)
}

/**
 * Parser class - extracts structs, enums, functions, errors
 */
class Parser {
  constructor() {
    this.structs = new Map()
    this.qualifiedStructs = new Map()
    this.enums = new Set()
    this.functions = []
    this.errors = []
    this.debugLog = []
  }

  log(msg) {
    this.debugLog.push(msg)
  }

  removeComments(content) {
    content = content.replace(/\/\*[\s\S]*?\*\//g, '')
    content = content.replace(/\/\/.*$/gm, '')
    return content
  }

  extractContainerName(content) {
    const match = content.match(/\b(library|contract|interface)\s+(\w+)/)
    return match ? match[2] : null
  }

  /**
   * Find the innermost contract/library/interface enclosing a source offset.
   *
   * Previously a single file-wide container name was applied to every struct and
   * enum, so in a file with several contracts all of them were attributed to the
   * first one (and qualified lookups silently resolved to the wrong struct).
   */
  containerAt(content, position) {
    const pattern = /\b(library|contract|interface)\s+(\w+)\s*\{/g
    const spans = []
    let match

    while ((match = pattern.exec(content)) !== null) {
      if (match.index > position) break

      const openBrace = match.index + match[0].length - 1
      let depth = 0
      let end = openBrace
      for (; end < content.length; end++) {
        if (content[end] === '{') depth++
        else if (content[end] === '}') {
          depth--
          if (depth === 0) break
        }
      }

      if (end >= position) {
        spans.push({ name: match[2], start: match.index, end })
      }
    }

    if (spans.length === 0) return null
    // Innermost = smallest enclosing span.
    spans.sort((a, b) => (a.end - a.start) - (b.end - b.start))
    return spans[0].name
  }

  parseStructBody(body) {
    const fields = []
    const lines = body.split(';')

    for (let line of lines) {
      line = line.trim()
      if (!line) continue
      if (line.startsWith('mapping')) continue

      const match = line.match(/^\s*([\w.\[\]]+)\s+(\w+)\s*$/)
      if (match) {
        fields.push({ name: match[2], typeName: match[1] })
      }
    }

    return fields
  }

  extractEnums(content, filePath) {
    const enumNames = []
    const pattern = /\benum\s+(\w+)\s*\{/g

    let match
    while ((match = pattern.exec(content)) !== null) {
      const enumName = match[1]
      const containerName = this.containerAt(content, match.index)
      const qualifiedName = containerName ? `${containerName}.${enumName}` : enumName
      enumNames.push(enumName)
      enumNames.push(qualifiedName)
    }

    return enumNames
  }

  extractStructs(content, filePath) {
    const structs = []
    const pattern = /\bstruct\s+(\w+)\s*\{/g

    let match
    while ((match = pattern.exec(content)) !== null) {
      const structName = match[1]
      const containerName = this.containerAt(content, match.index)
      const startPos = match.index + match[0].length

      let braceCount = 1
      let endPos = startPos

      while (endPos < content.length && braceCount > 0) {
        if (content[endPos] === '{') braceCount++
        else if (content[endPos] === '}') braceCount--
        endPos++
      }

      const structBody = content.substring(startPos, endPos - 1)
      const fields = this.parseStructBody(structBody)
      const qualifiedName = containerName ? `${containerName}.${structName}` : structName

      structs.push({
        name: structName,
        qualifiedName,
        fields,
        sourceFile: filePath
      })
    }

    return structs
  }

  extractFunctionParams(paramsStr) {
    const params = []
    if (!paramsStr.trim()) return params

    let depth = 0
    let currentParam = ''

    for (const char of paramsStr) {
      if (char === '(' || char === '[') {
        depth++
        currentParam += char
      } else if (char === ')' || char === ']') {
        depth--
        currentParam += char
      } else if (char === ',' && depth === 0) {
        if (currentParam.trim()) params.push(currentParam.trim())
        currentParam = ''
      } else {
        currentParam += char
      }
    }
    if (currentParam.trim()) params.push(currentParam.trim())

    const result = []
    for (let param of params) {
      param = param.replace(/\baddress\s+payable\b/g, 'address').trim()
      param = param.replace(/\s+(memory|storage|calldata)\s+/g, ' ')
      param = param.replace(/\s+(memory|storage|calldata)$/g, '')
      
      const parts = param.split(/\s+/)
      if (parts.length === 0) continue
      
      if (parts.length === 1) {
        result.push([parts[0], ''])
      } else {
        const lastPart = parts[parts.length - 1]
        if (/^\w+$/.test(lastPart) && !['memory', 'storage', 'calldata'].includes(lastPart)) {
          const typeParts = parts.slice(0, -1)
          result.push([typeParts.join(' '), lastPart])
        } else {
          result.push([param, ''])
        }
      }
    }

    return result
  }

  extractFunctions(content, filePath) {
    const functions = []
    const contentNormalized = content.replace(/\s+/g, ' ')
    const pattern = /\bfunction\s+(\w+)\s*\(/g

    let match
    while ((match = pattern.exec(contentNormalized)) !== null) {
      const funcName = match[1]
      if (['constructor', 'receive', 'fallback'].includes(funcName)) continue

      let startPos = match.index + match[0].length
      let parenDepth = 1
      let pos = startPos

      while (pos < contentNormalized.length && parenDepth > 0) {
        if (contentNormalized[pos] === '(') parenDepth++
        else if (contentNormalized[pos] === ')') parenDepth--
        pos++
      }

      const paramsStr = parenDepth === 0 ? contentNormalized.substring(startPos, pos - 1) : ''

      let restEnd = pos
      while (restEnd < contentNormalized.length && !'{;'.includes(contentNormalized[restEnd])) {
        restEnd++
      }
      const modifiers = contentNormalized.substring(pos, restEnd).toLowerCase()

      // Pre-0.5 Solidity defaults to `public` when no visibility keyword is given;
      // defaulting to `internal` silently dropped legacy functions.
      let visibility = 'public'
      if (modifiers.includes('external')) visibility = 'external'
      else if (modifiers.includes('private')) visibility = 'private'
      else if (modifiers.includes('internal')) visibility = 'internal'

      if (['internal', 'private'].includes(visibility)) continue

      if (paramsStr.includes('mapping(') && paramsStr.includes('storage')) continue

      const params = this.extractFunctionParams(paramsStr)
      let skip = false
      for (const [paramType] of params) {
        if (paramType.toLowerCase().includes('mapping')) {
          skip = true
          break
        }
      }
      if (skip) continue

      functions.push({
        name: funcName,
        parameters: params,
        sourceFile: filePath,
        originalLine: `function ${funcName}(${paramsStr})`,
        visibility,
        container: this.containerAt(contentNormalized, match.index)
      })
    }

    return functions
  }

  extractErrors(content, filePath) {
    const errors = []
    const contentNormalized = content.replace(/\s+/g, ' ')
    const pattern = /\berror\s+(\w+)\s*\(/g

    let match
    while ((match = pattern.exec(contentNormalized)) !== null) {
      const errorName = match[1]

      let startPos = match.index + match[0].length
      let parenDepth = 1
      let pos = startPos

      while (pos < contentNormalized.length && parenDepth > 0) {
        if (contentNormalized[pos] === '(') parenDepth++
        else if (contentNormalized[pos] === ')') parenDepth--
        pos++
      }

      const paramsStr = parenDepth === 0 ? contentNormalized.substring(startPos, pos - 1) : ''
      const params = this.extractFunctionParams(paramsStr)

      errors.push({
        name: errorName,
        parameters: params,
        sourceFile: filePath,
        originalLine: `error ${errorName}(${paramsStr})`
      })
    }

    return errors
  }

  parseFile(content, filePath) {
    content = this.removeComments(content)

    const enumNames = this.extractEnums(content, filePath)
    enumNames.forEach(e => this.enums.add(e))

    const structs = this.extractStructs(content, filePath)
    for (const struct of structs) {
      // Qualify first so a duplicate short name in another contract cannot
      // silently overwrite the definition used for type flattening.
      this.qualifiedStructs.set(struct.qualifiedName, struct)
      if (!this.structs.has(struct.name)) {
        this.structs.set(struct.name, struct)
      }
    }

    const functions = this.extractFunctions(content, filePath)
    this.functions.push(...functions)

    const errors = this.extractErrors(content, filePath)
    this.errors.push(...errors)
  }

  getStats() {
    return {
      structs: this.structs.size,
      enums: this.enums.size,
      functions: this.functions.length,
      errors: this.errors.length
    }
  }
}

/**
 * TypeFlattener - Flattens struct types to primitive tuples
 */
class TypeFlattener {
  constructor(structs, qualifiedStructs, enums) {
    this.structs = structs
    this.qualifiedStructs = qualifiedStructs
    this.enums = enums
    this._recursionGuard = new Set()
  }

  isEnum(typeName) {
    const baseType = typeName.replace(/\[\]$/, '')
    return this.enums.has(baseType) || this.enums.has(baseType.split('.').pop())
  }

  isPrimitive(typeName) {
    const baseType = typeName.replace(/\[\]$/, '')
    return PRIMITIVE_TYPES.has(baseType)
  }

  normalizeType(typeName) {
    let arraySuffix = ''
    if (typeName.endsWith('[]')) {
      arraySuffix = '[]'
      typeName = typeName.slice(0, -2)
    }

    if (TYPE_ALIASES[typeName]) {
      typeName = TYPE_ALIASES[typeName]
    }

    return typeName + arraySuffix
  }

  findStruct(typeName, container = null) {
    if (this.qualifiedStructs.has(typeName)) {
      return this.qualifiedStructs.get(typeName)
    }
    // Resolve an unqualified struct name against the enclosing contract first.
    if (container) {
      const scoped = this.qualifiedStructs.get(`${container}.${typeName}`)
      if (scoped) return scoped
    }
    if (this.structs.has(typeName)) {
      return this.structs.get(typeName)
    }
    const shortName = typeName.split('.').pop()
    if (this.structs.has(shortName)) {
      return this.structs.get(shortName)
    }
    return null
  }

  flattenType(typeName, depth = 0, container = null) {
    if (depth > 20) return typeName

    typeName = typeName.trim().replace(/\s+/g, '')

    let arraySuffix = ''
    let baseType = typeName
    if (typeName.endsWith('[]')) {
      arraySuffix = '[]'
      baseType = typeName.slice(0, -2)
    }

    if (this._recursionGuard.has(baseType)) {
      return `(${baseType})${arraySuffix}`
    }

    if (this.isPrimitive(baseType)) {
      return this.normalizeType(typeName)
    }

    if (this.isEnum(baseType)) {
      return `uint8${arraySuffix}`
    }

    if (isInterfaceType(baseType)) {
      return `address${arraySuffix}`
    }

    const struct = this.findStruct(baseType, container)
    if (struct) {
      this._recursionGuard.add(baseType)

      const flattenedFields = []
      for (const field of struct.fields) {
        const flatType = this.flattenType(field.typeName, depth + 1, container)
        flattenedFields.push(flatType)
      }

      this._recursionGuard.delete(baseType)

      return flattenedFields.length > 0 
        ? `(${flattenedFields.join(',')})${arraySuffix}`
        : `()${arraySuffix}`
    }

    const firstName = baseType.split('.').pop()
    if (firstName && /^[A-Z]/.test(firstName) && !this.isPrimitive(baseType)) {
      return `address${arraySuffix}`
    }
    
    return this.normalizeType(typeName)
  }

  flattenFunctionSignature(func) {
    this._recursionGuard.clear()
    const flatParams = func.parameters.map(([typeName]) => {
      const cleanType = typeName.trim().replace(/\s+/g, ' ')
      return this.flattenType(cleanType, 0, func.container)
    })
    return `${func.name}(${flatParams.join(',')})`
  }

  flattenErrorSignature(error) {
    this._recursionGuard.clear()
    const flatParams = error.parameters.map(([typeName]) => {
      const cleanType = typeName.trim().replace(/\s+/g, ' ')
      return this.flattenType(cleanType)
    })
    return `${error.name}(${flatParams.join(',')})`
  }
}

/**
 * Process multiple Solidity files and extract signatures
 */
export function processFiles(files) {
  const parser = new Parser()

  for (const file of files) {
    parser.parseFile(file.content, file.path)
  }

  const flattener = new TypeFlattener(parser.structs, parser.qualifiedStructs, parser.enums)

  const functionSignatures = new Map()
  const errorSignatures = new Map()

  for (const func of parser.functions) {
    try {
      const sig = flattener.flattenFunctionSignature(func)
      const selector = computeSelector(sig)
      
      if (!functionSignatures.has(sig)) {
        functionSignatures.set(sig, {
          name: func.name,
          signature: sig,
          selector: selector,
          source: func.sourceFile,
          original: func.originalLine,
          visibility: func.visibility,
          type: 'function'
        })
      }
    } catch (e) {
      parser.log(`[ERROR] Failed to flatten function ${func.name}: ${e.message}`)
    }
  }

  for (const error of parser.errors) {
    try {
      const sig = flattener.flattenErrorSignature(error)
      const selector = computeSelector(sig)
      
      if (!errorSignatures.has(sig)) {
        errorSignatures.set(sig, {
          name: error.name,
          signature: sig,
          selector: selector,
          source: error.sourceFile,
          original: error.originalLine,
          type: 'error'
        })
      }
    } catch (e) {
      parser.log(`[ERROR] Failed to flatten error ${error.name}: ${e.message}`)
    }
  }

  return {
    functions: Array.from(functionSignatures.values()),
    errors: Array.from(errorSignatures.values()),
    stats: {
      ...parser.getStats(),
      uniqueFunctions: functionSignatures.size,
      uniqueErrors: errorSignatures.size
    },
    debugLog: parser.debugLog
  }
}

/**
 * Process a single source code string
 */
export function processSingleSource(code, filename = 'source.sol') {
  return processFiles([{ path: filename, content: code }])
}

export { PRIMITIVE_TYPES, TYPE_ALIASES, Parser, TypeFlattener }
