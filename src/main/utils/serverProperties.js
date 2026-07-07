import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const PROPERTIES_FILE = 'server.properties'

/**
 * Parses a server.properties file into a key-value object.
 * Comments (lines starting with #) are ignored in the return value
 * but preserved internally for write operations.
 *
 * @param {string} serverDir - Path to the server directory
 * @returns {Promise<object>} Parsed key-value properties
 */
export async function readProperties(serverDir) {
  const filePath = join(serverDir, PROPERTIES_FILE)
  try {
    const content = await readFile(filePath, 'utf8')
    const properties = {}

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex !== -1) {
        const key = trimmed.substring(0, eqIndex).trim()
        const value = trimmed.substring(eqIndex + 1).trim()
        properties[key] = value
      }
    }

    return properties
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {} // File doesn't exist yet
    }
    throw new Error(`Failed to read server.properties: ${err.message}`)
  }
}

/**
 * Writes a key-value object back to server.properties.
 * Preserves comments from the original file. Existing keys are updated,
 * new keys are appended at the end.
 *
 * @param {string} serverDir - Path to the server directory
 * @param {object} properties - Key-value properties to write
 */
export async function writeProperties(serverDir, properties) {
  const filePath = join(serverDir, PROPERTIES_FILE)
  let originalLines = []

  // Try to read the existing file to preserve comments and ordering
  try {
    const content = await readFile(filePath, 'utf8')
    originalLines = content.split(/\r?\n/)
  } catch {
    // File doesn't exist, we'll create a fresh one
  }

  const writtenKeys = new Set()
  const outputLines = []

  // Update existing lines, preserving comments and order
  for (const line of originalLines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      // Preserve comments and empty lines as-is
      outputLines.push(line)
      continue
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex !== -1) {
      const key = trimmed.substring(0, eqIndex).trim()
      if (key in properties) {
        outputLines.push(`${key}=${properties[key]}`)
        writtenKeys.add(key)
      } else {
        // Key not in new properties — still keep it
        outputLines.push(line)
        writtenKeys.add(key)
      }
    } else {
      outputLines.push(line)
    }
  }

  // Append any new keys that weren't in the original file
  for (const [key, value] of Object.entries(properties)) {
    if (!writtenKeys.has(key)) {
      outputLines.push(`${key}=${value}`)
    }
  }

  // Ensure the file ends with a newline
  const output = outputLines.join('\n')
  await writeFile(filePath, output.endsWith('\n') ? output : output + '\n', 'utf8')
}

/**
 * Gets a single property value from server.properties.
 *
 * @param {string} serverDir - Path to the server directory
 * @param {string} key - The property key to read
 * @returns {Promise<string|undefined>} The property value, or undefined if not found
 */
export async function getProperty(serverDir, key) {
  const properties = await readProperties(serverDir)
  return properties[key]
}

/**
 * Sets a single property in server.properties.
 * Creates the file if it doesn't exist.
 *
 * @param {string} serverDir - Path to the server directory
 * @param {string} key - The property key to set
 * @param {string} value - The property value to set
 */
export async function setProperty(serverDir, key, value) {
  const properties = await readProperties(serverDir)
  properties[key] = String(value)
  await writeProperties(serverDir, properties)
}

/**
 * Ensures RCON is properly configured in server.properties.
 * Sets enable-rcon=true and configures the port and password.
 *
 * @param {string} serverDir - Path to the server directory
 * @param {number} port - RCON port number
 * @param {string} password - RCON password
 */
export async function ensureRcon(serverDir, port, password) {
  const properties = await readProperties(serverDir)

  properties['enable-rcon'] = 'true'
  properties['rcon.port'] = String(port)
  properties['rcon.password'] = password

  await writeProperties(serverDir, properties)
}
