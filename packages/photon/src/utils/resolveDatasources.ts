import { DataSource } from '@prisma/generator-helper'
import { uriToCredentials } from '@prisma/sdk/src/convertCredentials'
import path from 'path'
import { credentialsToUri } from '@prisma/sdk'

export function resolveDatasources(datasources: DataSource[], cwd: string, outputDir: string): DataSource[] {
  return datasources.map(datasource => {
    if (datasource.connectorType === 'sqlite') {
      if (datasource.url.fromEnvVar === null) {
        return {
          ...datasource,
          url: {
            fromEnvVar: null,
            value: absolutizeSqliteRelativePath(datasource.url.value, cwd, outputDir),
          },
        }
      } else {
        return datasource
      }
    } else if (datasource.connectorType === 'postgresql') {
      return {
        ...datasource,
        url: {
          value: absolutizePostgreSQLRelativePath(datasource.url.value, cwd, outputDir),
        },
      }
    }
    return datasource
  })
}

export function absolutizeSqliteRelativePath(url: string, cwd: string, outputDir: string): string {
  let filePath = url

  if (filePath.startsWith('file:')) {
    filePath = filePath.slice(5)
  }

  const absoluteTarget = path.resolve(cwd, filePath)

  return `'file:' + path.resolve(__dirname, '${path.relative(outputDir, absoluteTarget)}')`
}

export function absolutizePostgreSQLRelativePath(url: string, cwd: string, outputDir: string): string {
  const credentials = uriToCredentials(url)
  
  if (credentials.extraFields?.sslcert) {
    const absoluteTarget = path.resolve(cwd, credentials.extraFields.sslcert)
    credentials.extraFields.sslcert = path.relative(outputDir, absoluteTarget)
  }

  if (credentials.extraFields?.sslidentity) {
    const absoluteTarget = path.resolve(cwd, credentials.extraFields.sslidentity)
    credentials.extraFields.sslidentity = path.relative(outputDir, absoluteTarget)
  }

  return credentialsToUri(credentials)
}