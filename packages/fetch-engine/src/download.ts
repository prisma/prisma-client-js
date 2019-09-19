// Inspired by https://github.com/zeit/now-cli/blob/canary/download/src/index.js
import fs from 'fs'
import { promisify } from 'util'
import chalk from 'chalk'

// Packages
import onDeath from 'death'
import path from 'path'
import Debug from 'debug'
import makeDir from 'make-dir'

// Utils
import { getBar, info, warn } from './log'
import plusxSync from './chmod'
import { copy } from './copy'
import { getPlatform, Platform } from '@prisma/get-platform'
import { downloadZip } from './downloadZip'
import { getCacheDir, getLocalLastModified, getRemoteLastModified, getDownloadUrl, BinaryKind } from './util'

const debug = Debug('download')
const writeFile = promisify(fs.writeFile)
const exists = promisify(fs.exists)

const channel = 'master'
export interface BinaryDownloadConfiguration {
  'query-engine'?: string
  'migration-engine'?: string
}

export interface DownloadOptions {
  binaries: BinaryDownloadConfiguration
  platforms?: Platform[]
  showProgress?: boolean
  progressCb?: (progress: number) => any
  version?: string
}

export interface BinaryMergedOptions {
  binaryName: BinaryKind
  targetDir: string
  platforms?: Platform[]
  version?: string
}

interface DownloadBinaryOptions {
  sourcePath: string
  targetPath: string
  version: string
  platform: string
  binaryName: BinaryKind
  progressCb?: (progress: number) => any
}

export async function download(options: DownloadOptions) {
  const detectedPlatform = await getPlatform();
  const mergedOptions = Object.keys(options.binaries).reduce((opts, binaryName) => {
    const envName = `PRISMA_${binaryName.replace(/\-/g, '_').toUpperCase()}_BINARY`;
    return Object.assign(opts, {
      [binaryName]: {
        binaryName,
        targetDir: options.binaries[binaryName],
        platforms: [process.env[envName] ? process.env[envName] : detectedPlatform],
        version: 'latest',
        ...options,
      }
    });
  }, {});

  const platforms = Object.keys(mergedOptions).reduce((platforms, name) => {
    return platforms.concat(mergedOptions[name].platforms);
  }, []).filter((platform, index, self) => {
    return self.indexOf(platform) === index;
  });
  
  const plural = platforms.length > 1 ? 'ies' : 'y'
  const bar = options.showProgress
    ? getBar(`Downloading ${platforms.map(p => chalk.bold(p)).join(' and ')} binar${plural}`)
    : undefined
  const progressMap: { [key: string]: number } = {}
  // Object.values is faster than Object.keys
  const numDownloads = Number(Object.values(mergedOptions)
    .reduce((count: number = 0, { platforms = [] }) => count + platforms.length, 0));
  const collectiveCallback =
    options.progressCb || options.showProgress
      ? (sourcePath: string) => progress => {
          progressMap[sourcePath] = progress
          const progressValues = Object.values(progressMap)
          const totalProgress =
            progressValues.reduce((acc, curr) => {
              return acc + curr
            }, 0) / numDownloads
          if (options.progressCb) {
            options.progressCb(totalProgress)
          }
          if (bar) {
            bar.update(totalProgress)
          }
        }
      : undefined

  await Promise.all(Object.values(mergedOptions).map((mergedOptions: BinaryMergedOptions) => {
    const { binaryName, targetDir, platforms = [], version } = mergedOptions;
    return Promise.all(platforms.map(async platform => {
      const sourcePath = getDownloadUrl(channel, version, platform, binaryName as BinaryKind)
      const targetPath = path.resolve(targetDir, getBinaryName(binaryName, platform))
      await downloadBinary({
        sourcePath,
        binaryName: binaryName as BinaryKind,
        platform,
        version,
        targetPath,
        progressCb: collectiveCallback ? collectiveCallback(sourcePath) : undefined,
      })
    }));
  }));

  if (bar) {
    bar.update(1)
    bar.terminate()
  }
}

function getBinaryName(binaryName, platform) {
  const extension = platform === 'windows' ? '.exe' : ''
  if (binaryName === 'migration-engine') {
    return 'migration-engine' + extension
  }
  return `${binaryName}-${platform}${extension}`
}

async function downloadBinary({
  sourcePath,
  targetPath,
  version,
  platform,
  progressCb,
  binaryName,
}: DownloadBinaryOptions) {
  await makeDir(path.dirname(targetPath))
  debug(`Downloading ${sourcePath} to ${targetPath}`)
  try {
    fs.writeFileSync(
      targetPath,
      '#!/usr/bin/env node\n' + `console.log("Please wait until the \'prisma ${binaryName}\' download completes!")\n`,
    )
  } catch (err) {
    if (err.code === 'EACCES') {
      warn('Please try installing Prisma 2 CLI again with the `--unsafe-perm` option.')
      info('Example: `npm i -g --unsafe-perm prisma2`')

      process.exit()
    }

    throw err
  }

  onDeath(() => {
    fs.writeFileSync(
      targetPath,
      '#!/usr/bin/env node\n' +
        `console.log("The \'prisma ${binaryName}\' download did not complete successfully.")\n` +
        'console.log("Please run \'npm i -g prisma2\' to reinstall!")\n',
    )
    process.exit()
  })

  // Print an empty line
  const cacheDir = await getCacheDir(channel, version, platform)
  const cachedTargetPath = path.join(cacheDir, binaryName)
  const cachedLastModifiedPath = path.join(cacheDir, 'lastModified-' + binaryName)

  const [cachedPrismaExists, localLastModified] = await Promise.all([
    exists(cachedTargetPath),
    getLocalLastModified(cachedLastModifiedPath),
  ])

  if (cachedPrismaExists && localLastModified) {
    const remoteLastModified = await getRemoteLastModified(sourcePath)
    // If there is no new binary and we have it localy, copy it over
    if (localLastModified >= remoteLastModified) {
      await copy(cachedTargetPath, targetPath)
      return
    }
  }

  if (progressCb) {
    progressCb(0)
  }

  const lastModified = await downloadZip(sourcePath, targetPath, progressCb)
  if (progressCb) {
    progressCb(1)
  }

  plusxSync(targetPath)

  try {
    await copy(targetPath, cachedTargetPath)
    await writeFile(cachedLastModifiedPath, lastModified)
  } catch (e) {
    debug({ sourcePath, targetPath }, e)
    // let this fail silently - the CI system may have reached the file size limit
  }
}
