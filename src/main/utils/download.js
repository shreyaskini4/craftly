import https from 'https'
import http from 'http'
import { createWriteStream, existsSync, unlinkSync, renameSync } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'

/**
 * Downloads a file from a URL to a destination path with progress reporting.
 * Follows HTTP redirects up to a maximum depth.
 *
 * @param {string} url - The URL to download from
 * @param {string} destPath - The local file path to save to
 * @param {function} [onProgress] - Progress callback: ({ downloaded, total, percent })
 * @param {number} [maxRedirects=5] - Maximum number of redirects to follow
 * @returns {Promise<string>} Resolves with destPath when download is complete
 */
export function downloadFile(url, destPath, onProgress = null, maxRedirects = 5) {
  return new Promise(async (resolve, reject) => {
    try {
      // Ensure the destination directory exists
      await mkdir(dirname(destPath), { recursive: true })
    } catch (err) {
      return reject(new Error(`Failed to create directory for ${destPath}: ${err.message}`))
    }

    const attemptDownload = (currentUrl, redirectsLeft, retriesLeft = 3) => {
      const parsedUrl = new URL(currentUrl)
      const client = parsedUrl.protocol === 'https:' ? https : http

      const tempPath = destPath + '.downloading'
      
      const cleanupPartial = () => {
        try { if (existsSync(tempPath)) unlinkSync(tempPath) } catch { /* ignore */ }
      }

      const request = client.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
        }
      }, (response) => {
        const { statusCode, headers } = response

        // Handle redirects (301, 302, 303, 307, 308)
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume() 
          if (redirectsLeft <= 0) {
            return reject(new Error(`Too many redirects (max ${maxRedirects}) for ${url}`))
          }
          const redirectUrl = new URL(headers.location, currentUrl).toString()
          return attemptDownload(redirectUrl, redirectsLeft - 1, retriesLeft)
        }

        // Handle 5xx errors with retry and backoff
        if (statusCode >= 500 && statusCode < 600) {
          response.resume()
          if (retriesLeft > 0) {
            cleanupPartial()
            const delay = Math.pow(2, 3 - retriesLeft) * 1000
            setTimeout(() => attemptDownload(currentUrl, redirectsLeft, retriesLeft - 1), delay)
            return
          }
        }

        if (statusCode !== 200) {
          response.resume()
          return reject(new Error(`Download failed with status ${statusCode}: ${currentUrl}`))
        }

        const totalBytes = parseInt(headers['content-length'], 10) || 0
        let downloadedBytes = 0

        const fileStream = createWriteStream(tempPath)

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length
          if (onProgress) {
            // Mock progress if no content length
            const mockTotal = totalBytes > 0 ? totalBytes : (downloadedBytes + (1024 * 1024))
            onProgress({
              downloaded: downloadedBytes,
              total: mockTotal,
              percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
            })
          }
        })

        response.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close(() => {
            try {
              renameSync(tempPath, destPath)
              resolve(destPath)
            } catch (err) {
              cleanupPartial()
              reject(new Error(`Failed to rename downloaded file: ${err.message}`))
            }
          })
        })

        fileStream.on('error', (err) => {
          fileStream.close()
          cleanupPartial()
          reject(new Error(`File write error: ${err.message}`))
        })

        response.on('error', (err) => {
          fileStream.close()
          cleanupPartial()
          if (retriesLeft > 0) {
            const delay = Math.pow(2, 3 - retriesLeft) * 1000
            setTimeout(() => attemptDownload(currentUrl, redirectsLeft, retriesLeft - 1), delay)
          } else {
            reject(new Error(`Download stream error: ${err.message}`))
          }
        })
      })

      request.on('error', (err) => {
        cleanupPartial()
        if (retriesLeft > 0) {
          const delay = Math.pow(2, 3 - retriesLeft) * 1000
          setTimeout(() => attemptDownload(currentUrl, redirectsLeft, retriesLeft - 1), delay)
        } else {
          reject(new Error(`Network error downloading ${currentUrl}: ${err.message}`))
        }
      })

      request.setTimeout(30000, () => {
        request.destroy()
        cleanupPartial()
        if (retriesLeft > 0) {
          const delay = Math.pow(2, 3 - retriesLeft) * 1000
          setTimeout(() => attemptDownload(currentUrl, redirectsLeft, retriesLeft - 1), delay)
        } else {
          reject(new Error(`Download timed out: ${currentUrl}`))
        }
      })
    }

    attemptDownload(url, maxRedirects)
  })
}

/**
 * Makes an HTTPS GET request and returns the parsed JSON response.
 *
 * @param {string} url - The URL to request
 * @param {object} [headers] - Additional request headers
 * @returns {Promise<object>} Parsed JSON response
 */
export function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        ...headers
      }
    }

    const request = client.request(options, (response) => {
      const { statusCode, headers: respHeaders } = response

      // Follow redirects
      if (statusCode >= 300 && statusCode < 400 && respHeaders.location) {
        response.resume()
        const redirectUrl = new URL(respHeaders.location, url).toString()
        return fetchJson(redirectUrl, headers).then(resolve).catch(reject)
      }

      if (statusCode !== 200) {
        response.resume()
        return reject(new Error(`HTTP ${statusCode} from ${url}`))
      }

      let data = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (err) {
          reject(new Error(`Invalid JSON response from ${url}: ${err.message}`))
        }
      })
      response.on('error', (err) => {
        reject(new Error(`Response error from ${url}: ${err.message}`))
      })
    })

    request.on('error', (err) => {
      reject(new Error(`Network error requesting ${url}: ${err.message}`))
    })

    request.setTimeout(15000, () => {
      request.destroy()
      reject(new Error(`Request timed out: ${url}`))
    })

    request.end()
  })
}
