import fs from 'fs'
import path from 'path'
import { download, getBinaryName, checkVersionCommand, getVersion, getChecksum } from '../download'
// import { downloadZip } from '../downloadZip'
import { getDownloadUrl } from '../util'
import { getPlatform } from '@prisma/get-platform'
import { cleanupCache } from '../cleanupCache'
import del from 'del'

import zlib from 'zlib'
import retry from 'p-retry'
import fetch from 'node-fetch'
import { getProxyAgent } from '../getProxyAgent'

const { pipeline } = require('stream')
const { promisify } = require('util')
const pipe = promisify(pipeline)

jest.setTimeout(20000)

describe('download', () => {
  beforeEach(async () => {
    // completely clean up the cache and keep nothing
    await cleanupCache(0)
    await del(__dirname + '/prisma')
    await del(__dirname + '/**/*engine*')
    await del(__dirname + '/**/*engine*.gz')
  })

  // afterAll(async () => {
  //   await del(__dirname + '/**/*engine*')
  //   await del(__dirname + '/**/*engine*.gz')
  // })

  test('basic download', async () => {
    const platform = await getPlatform()
    const queryEnginePath = path.join(__dirname, getBinaryName('query-engine', platform))
    const introspectionEnginePath = path.join(__dirname, getBinaryName('introspection-engine', platform))
    const migrationEnginePath = path.join(__dirname, getBinaryName('migration-engine', platform))

    await download({
      binaries: {
        'query-engine': __dirname,
        'introspection-engine': __dirname,
        'migration-engine': __dirname,
      },
      version: 'd3b0ceed5d87544b9d2decb70e08664f9047bb73',
    })

    expect(await getVersion(queryEnginePath)).toMatchInlineSnapshot(`"prisma d3b0ceed5d87544b9d2decb70e08664f9047bb73"`)
    expect(await getVersion(introspectionEnginePath)).toMatchInlineSnapshot(
      `"d3b0ceed5d87544b9d2decb70e08664f9047bb73"`,
    )
    expect(await getVersion(migrationEnginePath)).toMatchInlineSnapshot(`"d3b0ceed5d87544b9d2decb70e08664f9047bb73"`)

    //
    // Checksum check
    //
    expect(await getChecksum(queryEnginePath)).toMatchInlineSnapshot(
      `"83322c943206f30778a5ae694c5fea6f9c994404c93676a27ad93ef6dff19ca1"`,
    )
    expect(await getChecksum(introspectionEnginePath)).toMatchInlineSnapshot(
      `"c1a713ac6ceccf6b1c3d910d583a79519fb21a22d0e77957fcb8bcf737a125eb"`,
    )
    expect(await getChecksum(migrationEnginePath)).toMatchInlineSnapshot(
      `"52b71bdd4ebb8d37ea79ae79efefafda8e38d19e9802c3afc087b8caf99d68db"`,
    )
  })

  test('download and unzip gz', async () => {
    const platform = await getPlatform()
    // const binaries = ['prisma', ]
    const downloadUrl = getDownloadUrl('master', 'd3b0ceed5d87544b9d2decb70e08664f9047bb73', platform, 'prisma')
    console.log(downloadUrl)
    const queryEnginePath = path.join(__dirname, getBinaryName('query-engine', platform))
    const queryEnginePathGz = queryEnginePath + '.gz'

    // Download
    const lastModified = await downloadZip(downloadUrl, queryEnginePathGz)

    // Checksum check .gz
    expect(await getChecksum(queryEnginePathGz)).toMatchInlineSnapshot(
      `"2c8ba435f079bf9f4d508836a09f787a34228517dfa3e0dcded604a62c4f2630"`,
    )

    // Unzip
    const queryEngineGz = fs.createReadStream(queryEnginePathGz)
    const queryEngineDestination = fs.createWriteStream(queryEnginePath)
    const gunzip = zlib.createGunzip()
    gunzip.on('error', console.error)

    await pipe(queryEngineGz, gunzip, queryEngineDestination)

    // Checksum check binary
    expect(await getChecksum(queryEnginePath)).toMatchInlineSnapshot(
      `"83322c943206f30778a5ae694c5fea6f9c994404c93676a27ad93ef6dff19ca1"`,
    )

    async function downloadZip(url: string, target: string, progressCb?: (progress: number) => any): Promise<string> {
      const partial = target + '.partial'
      const result = await retry(
        async () => {
          try {
            const resp = await fetch(url, { compress: false, agent: getProxyAgent(url) })

            if (resp.status !== 200) {
              throw new Error(resp.statusText + ' ' + url)
            }

            const lastModified = resp.headers.get('last-modified')!
            const size = parseFloat(resp.headers.get('content-length'))
            const ws = fs.createWriteStream(partial)

            return await new Promise((resolve, reject) => {
              let bytesRead = 0

              resp.body.on('error', reject).on('data', chunk => {
                bytesRead += chunk.length

                if (size && progressCb) {
                  progressCb(bytesRead / size)
                }
              })

              // const gunzip = zlib.createGunzip()
              // gunzip.on('error', reject)
              // resp.body.pipe(gunzip).pipe(ws)

              // without unzip
              resp.body.pipe(ws)

              ws.on('error', reject).on('close', () => {
                resolve(lastModified)
              })
            })
          } finally {
            //
          }
        },
        {
          retries: 0, // changed from 1 to 0
          onFailedAttempt: err => console.error(err),
        } as any,
      )
      fs.renameSync(partial, target)
      return result as string
    }
  })

  test('only unzip local gz', async () => {
    const queryEnginePath = path.join(__dirname, 'prisma')
    const queryEnginePathGz = queryEnginePath + '.gz'

    // Checksum check .gz
    expect(await getChecksum(queryEnginePathGz)).toMatchInlineSnapshot(
      `"2c8ba435f079bf9f4d508836a09f787a34228517dfa3e0dcded604a62c4f2630"`,
    )

    // Unzip
    const queryEngineGz = fs.createReadStream(queryEnginePathGz)
    const queryEngineDestination = fs.createWriteStream(queryEnginePath)
    const gunzip = zlib.createGunzip()
    gunzip.on('error', console.error)

    await pipe(queryEngineGz, gunzip, queryEngineDestination)

    // Checksum check binary
    expect(await getChecksum(queryEnginePath)).toMatchInlineSnapshot(
      `"83322c943206f30778a5ae694c5fea6f9c994404c93676a27ad93ef6dff19ca1"`,
    )
  })
})
