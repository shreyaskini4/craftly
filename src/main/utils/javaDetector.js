import { execFile } from 'child_process'
import { access, readdir } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Common Windows directories where Java may be installed.
 */
const JAVA_SEARCH_PATHS = [
  'C:\\Program Files\\Java',
  'C:\\Program Files (x86)\\Java',
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Eclipse Foundation',
  'C:\\Program Files\\AdoptOpenJDK',
  'C:\\Program Files\\Zulu',
  'C:\\Program Files\\Microsoft\\jdk-*',
  'C:\\Program Files\\BellSoft\\LibericaJDK-*',
  'C:\\Program Files\\Amazon Corretto',
  'C:\\Program Files\\OpenJDK',
  join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
  join(process.env.USERPROFILE || '', '.jdks')
]

/**
 * Checks if a path exists and is accessible.
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Runs `java -version` at the given java executable path and extracts the version string.
 * @param {string} javaPath - Path to the java executable
 * @returns {Promise<string|null>} The version string or null if invalid
 */
async function getJavaVersion(javaPath) {
  try {
    // java -version outputs to stderr
    const { stderr } = await execFileAsync(javaPath, ['-version'], {
      timeout: 10000,
      windowsHide: true
    })
    const output = stderr || ''
    // Match patterns like: openjdk version "21.0.1" or java version "1.8.0_391"
    const match = output.match(/(?:java|openjdk)\s+version\s+"([^"]+)"/i)
    if (match) {
      return match[1]
    }
    // Fallback: try to match any version number pattern
    const fallback = output.match(/(\d+[\d._-]+\d+)/)
    return fallback ? fallback[1] : 'unknown'
  } catch {
    return null
  }
}

/**
 * Searches a parent directory for Java installations.
 * Looks for bin/java.exe inside each subdirectory.
 *
 * @param {string} parentDir - Parent directory to scan
 * @returns {Promise<string[]>} Array of java.exe paths found
 */
async function searchDirectory(parentDir) {
  const javaPaths = []
  try {
    if (!(await pathExists(parentDir))) return javaPaths

    const entries = await readdir(parentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const javaExe = join(parentDir, entry.name, 'bin', 'java.exe')
        if (await pathExists(javaExe)) {
          javaPaths.push(javaExe)
        }
      }
    }
  } catch {
    // Directory not accessible, skip
  }
  return javaPaths
}

/**
 * Detects installed Java installations on the system.
 * Checks JAVA_HOME, PATH, and common installation directories.
 *
 * @returns {Promise<Array<{path: string, version: string}>>} Array of detected Java installations
 */
export async function detectJava() {
  const candidates = new Set()
  const results = []

  // 1. Check JAVA_HOME environment variable
  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const javaExe = join(javaHome, 'bin', 'java.exe')
    if (await pathExists(javaExe)) {
      candidates.add(javaExe)
    }
  }

  // 2. Check if 'java' is on PATH (system default)
  try {
    const { stderr } = await execFileAsync('java', ['-version'], {
      timeout: 10000,
      windowsHide: true
    })
    // Resolve the actual path using 'where java'
    try {
      const { stdout } = await execFileAsync('where', ['java'], {
        timeout: 5000,
        windowsHide: true
      })
      const paths = stdout.trim().split(/\r?\n/)
      for (const p of paths) {
        if (p.trim()) candidates.add(p.trim())
      }
    } catch {
      candidates.add('java') // Fallback to just 'java' on PATH
    }
  } catch {
    // java not on PATH
  }

  // 3. Search common installation directories
  for (const searchPath of JAVA_SEARCH_PATHS) {
    // Handle glob-like patterns (e.g., "jdk-*")
    if (searchPath.includes('*')) {
      const parentDir = searchPath.substring(0, searchPath.lastIndexOf('\\'))
      const pattern = searchPath.substring(searchPath.lastIndexOf('\\') + 1).replace('*', '')
      try {
        if (await pathExists(parentDir)) {
          const entries = await readdir(parentDir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith(pattern)) {
              const javaExe = join(parentDir, entry.name, 'bin', 'java.exe')
              if (await pathExists(javaExe)) {
                candidates.add(javaExe)
              }
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    } else {
      const found = await searchDirectory(searchPath)
      for (const p of found) {
        candidates.add(p)
      }
    }
  }

  // 4. Validate each candidate and get version
  for (const candidatePath of candidates) {
    const version = await getJavaVersion(candidatePath)
    if (version) {
      results.push({ path: candidatePath, version })
    }
  }

  // Sort by version descending (prefer newer Java)
  results.sort((a, b) => {
    const aMajor = parseInt(a.version.split(/[._-]/)[0], 10) || 0
    const bMajor = parseInt(b.version.split(/[._-]/)[0], 10) || 0
    return bMajor - aMajor
  })

  return results
}

/**
 * Validates that a given path points to a working Java installation.
 *
 * @param {string} javaPath - Path to the java executable
 * @returns {Promise<boolean>} true if the path is a valid Java executable
 */
export async function validateJavaPath(javaPath) {
  const version = await getJavaVersion(javaPath)
  return version !== null
}
