/**
 * Clipboard utilities
 */

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      // execCommand reports success via its boolean return value; ignoring it
      // made a failed copy look successful to every caller.
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (!ok) console.error('Failed to copy:', err)
      return ok
    } catch {
      console.error('Failed to copy:', err)
      return false
    }
  }
}

/**
 * Read text from clipboard
 */
export async function readFromClipboard() {
  try {
    return await navigator.clipboard.readText()
  } catch (err) {
    console.error('Failed to read clipboard:', err)
    return null
  }
}
