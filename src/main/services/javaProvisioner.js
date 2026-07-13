import { app } from 'electron'
import fs from 'fs'
import { readdir, rm, mkdir, unlink, chmod } from 'fs/promises'
import path from 'path'
import extractZip from 'extract-zip'
import { detectJava, validateJavaPath } from '../utils/javaDetector.js'
import { downloadFile } from '../utils/download.js'

/**
 * Maps a Minecraft version string to the required Java major version.
 * - Java 21: Minecraft 1.20.5+ (including 1.21, etc.)
 * - Java 17: Minecraft 1.17 - 1.20.4
 * - Java 8: Minecraft 1.16 and below (standard fallback)
 * 
 * @param {string} mcVersion - Minecraft version (e.g. "1.20.5", "1.16.5")
 * @returns {number} Required Java major version (8, 17, or 21)
 */
export function getRequiredJavaVersion(mcVersion) {
  if (!mcVersion || typeof mcVersion !== 'string') {
    return 8; // standard fallback
  }

  // Clean version string (e.g., remove trailing Fabric/Forge indicators or snapshots)
  const cleanVersion = mcVersion.trim().split('-')[0].split('+')[0];
  const parts = cleanVersion.split('.').map(p => parseInt(p, 10));

  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return 8; // fallback
  }

  // If first number is greater than 1 (e.g. future major version)
  if (parts[0] > 1) {
    return 21;
  }

  const minor = parts[1];
  const patch = parts[2] || 0;

  // Java 21: >= 1.20.5
  if (minor > 20 || (minor === 20 && patch >= 5)) {
    return 21;
  }

  // Java 17: >= 1.17 and <= 1.20.4
  if (minor >= 17) {
    return 17;
  }

  // Java 8: < 1.17
  return 8;
}

/**
 * Helper to parse the Java major version from a version string.
 * Supports format like "1.8.0_391" (returns 8) and "17.0.2" (returns 17)
 */
function getMajorVersion(versionString) {
  const parts = versionString.split(/[._-]/);
  const first = parseInt(parts[0], 10) || 0;
  if (first === 1 && parts.length > 1) {
    return parseInt(parts[1], 10) || 8;
  }
  return first;
}

/**
 * Recursively scans a directory for the bin/java.exe or bin/java executable.
 * 
 * @param {string} dir - Directory to search
 * @returns {Promise<string|null>} Resolved path to java executable or null
 */
async function findJavaExecutable(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'bin') {
          const binEntries = await readdir(fullPath);
          const exeName = process.platform === 'win32' ? 'java.exe' : 'java';
          if (binEntries.includes(exeName)) {
            return path.join(fullPath, exeName);
          }
        }
        const found = await findJavaExecutable(fullPath);
        if (found) {
          return found;
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${dir}:`, err);
  }
  return null;
}

/**
 * Provisions a Java Runtime Environment of the required major version.
 * First checks local installations, then checks cache, and finally downloads from Adoptium if necessary.
 * 
 * @param {number} majorVersion - Required Java major version (8, 17, 21)
 * @param {function} [onProgress] - Callback for download progress
 * @returns {Promise<string>} Path to the valid java executable
 */
export async function provisionJava(majorVersion, onProgress = null) {
  // 1. Check for compatible local Java runtimes using detectJava() and validateJavaPath().
  // Check that major version matches AND it is 64-bit architecture (since 32-bit has RAM limits).
  console.log(`Checking for local Java installations satisfying Java ${majorVersion} (64-bit)...`);
  const localJavas = await detectJava();
  const compatibleLocal = localJavas.find(j => {
    const major = getMajorVersion(j.version);
    return major === majorVersion && j.arch === '64-bit';
  });

  if (compatibleLocal) {
    const isValid = await validateJavaPath(compatibleLocal.path);
    if (isValid) {
      console.log(`Found compatible local Java at ${compatibleLocal.path}`);
      return compatibleLocal.path;
    }
  }

  // 2. Check cache
  const javaDir = path.join(app.getPath('userData'), 'java', String(majorVersion));
  console.log(`Checking JRE cache in: ${javaDir}`);
  if (fs.existsSync(javaDir)) {
    const cachedPath = await findJavaExecutable(javaDir);
    if (cachedPath) {
      const isValid = await validateJavaPath(cachedPath);
      if (isValid) {
        console.log(`Reusing cached JRE at ${cachedPath}`);
        return cachedPath;
      }
    }
  }

  // 3. Query api.adoptium.net and download JRE
  console.log(`No compatible local Java or cache found. Querying Adoptium API...`);
  const osMap = {
    win32: 'windows',
    darwin: 'mac',
    linux: 'linux'
  };
  const archMap = {
    x64: 'x64',
    ia32: 'x86',
    arm64: 'aarch64'
  };

  const os = osMap[process.platform] || process.platform;
  const arch = archMap[process.arch] || process.arch;

  const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${majorVersion}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;
  const tempZip = path.join(app.getPath('userData'), `temp_jre_${majorVersion}.zip`);

  try {
    await mkdir(javaDir, { recursive: true });
    console.log(`Downloading JRE from ${downloadUrl} to ${tempZip}...`);
    await downloadFile(downloadUrl, tempZip, onProgress);

    console.log(`Extracting JRE to ${javaDir}...`);
    await extractZip(tempZip, { dir: javaDir });
    console.log(`Extraction complete.`);
  } catch (err) {
    console.error(`Failed to download or extract Java ${majorVersion}:`, err);
    throw err;
  } finally {
    // Clean up temp zip
    if (fs.existsSync(tempZip)) {
      try {
        await unlink(tempZip);
      } catch (err) {
        console.warn(`Failed to clean up temporary archive ${tempZip}:`, err.message);
      }
    }
  }

  // Locate the nested java executable (recursively scanning targetDir for bin/java or bin/java.exe)
  const resolvedPath = await findJavaExecutable(javaDir);
  if (!resolvedPath) {
    throw new Error(`Failed to locate Java executable in extracted files under ${javaDir}`);
  }

  // Chmod resolved path if not windows, just in case
  if (process.platform !== 'win32') {
    try {
      await chmod(resolvedPath, 0o755);
    } catch (err) {
      console.warn(`Failed to set executable permissions on ${resolvedPath}:`, err.message);
    }
  }

  // Validate the final executable path
  const isValid = await validateJavaPath(resolvedPath);
  if (!isValid) {
    throw new Error(`The provisioned Java executable at ${resolvedPath} is not valid`);
  }

  console.log(`Successfully provisioned Java ${majorVersion} at ${resolvedPath}`);
  return resolvedPath;
}

/**
 * Lists all provisioned JRE versions.
 * 
 * @returns {Promise<Array<{majorVersion: number, path: string}>>} List of provisioned Java runtimes
 */
export async function listProvisionedJava() {
  const javaBaseDir = path.join(app.getPath('userData'), 'java');
  const list = [];
  try {
    if (!fs.existsSync(javaBaseDir)) {
      return list;
    }
    const entries = await readdir(javaBaseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const majorVersion = parseInt(entry.name, 10);
        if (!isNaN(majorVersion)) {
          const javaDir = path.join(javaBaseDir, entry.name);
          const exePath = await findJavaExecutable(javaDir);
          if (exePath) {
            const isValid = await validateJavaPath(exePath);
            if (isValid) {
              list.push({
                majorVersion,
                path: exePath
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to list provisioned Java runtimes:', err);
  }
  return list;
}

/**
 * Deletes a provisioned JRE directory.
 * 
 * @param {number} majorVersion - Major version of Java to delete (8, 17, 21)
 * @returns {Promise<boolean>} True if deleted successfully, false if didn't exist
 */
export async function deleteProvisionedJava(majorVersion) {
  const javaDir = path.join(app.getPath('userData'), 'java', String(majorVersion));
  try {
    if (fs.existsSync(javaDir)) {
      await rm(javaDir, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to delete provisioned Java ${majorVersion}:`, err);
    throw err;
  }
}

export default {
  getRequiredJavaVersion,
  provisionJava,
  listProvisionedJava,
  deleteProvisionedJava
}
