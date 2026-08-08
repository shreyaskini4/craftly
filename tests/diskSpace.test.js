import { describe, it, expect } from 'vitest'
import { formatBytes, checkFreeSpace } from '../src/main/utils/diskSpace.js'

describe('Disk Space Utility', () => {
  it('formatBytes converts numbers to readable units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024 * 500)).toBe('500 MB')
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
  })

  it('checkFreeSpace returns disk space stats for existing paths', async () => {
    const space = await checkFreeSpace(process.cwd())
    expect(space).toHaveProperty('availableBytes')
    expect(typeof space.availableBytes).toBe('number')
    expect(space.availableBytes).toBeGreaterThan(0)
  })

  it('checkFreeSpace passes when available space is sufficient', async () => {
    const result = await checkFreeSpace(process.cwd(), 100)
    expect(result).toHaveProperty('availableBytes')
  })

  it('checkFreeSpace throws a descriptive Error when space is insufficient', async () => {
    const hugeBytes = 100 * 1024 * 1024 * 1024 * 1024 * 1024 // 100 PB
    await expect(checkFreeSpace(process.cwd(), hugeBytes)).rejects.toThrow(
      /Insufficient disk space/
    )
  })
})
