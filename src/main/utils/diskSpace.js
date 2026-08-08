import fs from 'fs'
import path from 'path'

/**
 * Format bytes into a human-readable string (e.g., "500 MB", "1 GB", "100 MB").
 *
 * @param {number} bytes - The number of bytes to format
 * @returns {string} Formatted string with appropriate unit (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${formatted} ${sizes[i]}`
}

/**
 * Validates free disk space at the specified target path.
 * If the target path does not exist yet, falls back to checking its parent directory.
 *
 * @param {string} targetPath - Directory or file path to check space for
 * @param {number} [requiredBytes=0] - Minimum required free space in bytes
 * @returns {Promise<{ availableBytes: number, freeBytes: number, totalBytes: number }>}
 * @throws {Error} If available space is less than requiredBytes
 */
export async function checkFreeSpace(targetPath, requiredBytes = 0) {
  if (!targetPath) {
    throw new Error('Target path is required for disk space check')
  }

  let currentPath = path.resolve(targetPath)
  let stats = null

  // If the target path does not exist, traverse up to an existing ancestor directory
  while (currentPath) {
    try {
      if (fs.promises.statfs) {
        stats = await fs.promises.statfs(currentPath)
        break
      } else {
        break
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        const parent = path.dirname(currentPath)
        if (parent === currentPath) {
          // Reached root and still ENOENT
          break
        }
        currentPath = parent
      } else {
        throw err
      }
    }
  }

  if (!stats) {
    return {
      availableBytes: Number.POSITIVE_INFINITY,
      freeBytes: Number.POSITIVE_INFINITY,
      totalBytes: Number.POSITIVE_INFINITY
    }
  }

  const bsize = Number(stats.bsize) || 4096
  const bavail = stats.bavail !== undefined && stats.bavail !== null ? Number(stats.bavail) : Number(stats.bfree || 0)
  const bfree = Number(stats.bfree || 0)
  const blocks = Number(stats.blocks || 0)

  const availableBytes = bavail * bsize
  const freeBytes = bfree * bsize
  const totalBytes = blocks * bsize

  if (requiredBytes > 0 && availableBytes < requiredBytes) {
    const availableFormatted = formatBytes(availableBytes)
    const requiredFormatted = formatBytes(requiredBytes)
    throw new Error(
      `Insufficient disk space: Only ${availableFormatted} available, but ${requiredFormatted} is required.`
    )
  }

  return {
    availableBytes,
    freeBytes,
    totalBytes
  }
}

export default {
  checkFreeSpace,
  formatBytes
}
