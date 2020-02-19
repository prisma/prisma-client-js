import { DataSource } from '@prisma/generator-helper'
import { datasourceToDatasourceOverwrite, serializeDatasources } from '../generation/serializeDatasources'
import { absolutizeSqliteRelativePath, resolveDatasources, absolutizePostgreSQLRelativePath } from '../utils/resolveDatasources'

const cwd = '/Users/tim/project/prisma'
const outputDir = '/Users/tim/project/node_modules/@prisma/client/runtime'

test('absolutizeSqliteRelativePath', () => {
  expect(absolutizeSqliteRelativePath('file:db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/db.db')"`,
  )
  expect(absolutizeSqliteRelativePath('file:/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../../../../db.db')"`,
  )
  expect(absolutizeSqliteRelativePath('file:../db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../db.db')"`,
  )
  expect(absolutizeSqliteRelativePath('file:./db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/db.db')"`,
  )

  expect(absolutizeSqliteRelativePath('file:asd/another/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/asd/another/dir/db.db')"`,
  )
  expect(absolutizeSqliteRelativePath('file:/some/random/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../../../../some/random/dir/db.db')"`,
  )
  expect(
    absolutizeSqliteRelativePath('file:/Users/tim/project/node_modules/@prisma/client/runtime', cwd, outputDir),
  ).toMatchInlineSnapshot(`"'file:' + path.resolve(__dirname, '')"`)
  expect(absolutizeSqliteRelativePath('file:../another-dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../another-dir/db.db')"`,
  )
  expect(absolutizeSqliteRelativePath('file:./some/dir/db.db', cwd, outputDir)).toMatchInlineSnapshot(
    `"'file:' + path.resolve(__dirname, '../../../../prisma/some/dir/db.db')"`,
  )
})

test('absolutizeSqliteRelativePath', () => {
  expect(absolutizePostgreSQLRelativePath('postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=client-identity.p12&sslpassword=mysslpassword&sslcert=server-ca.pem', cwd, outputDir)).toMatchInlineSnapshot(
    `"postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=../../../../prisma/client-identity.p12&sslpassword=mysslpassword&sslcert=../../../../prisma/server-ca.pem"`,
  )
  expect(absolutizePostgreSQLRelativePath('postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=./client-identity.p12&sslpassword=mysslpassword&sslcert=./server-ca.pem', cwd, outputDir)).toMatchInlineSnapshot(
    `"postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=../../../../prisma/client-identity.p12&sslpassword=mysslpassword&sslcert=../../../../prisma/server-ca.pem"`,
  )
  expect(absolutizePostgreSQLRelativePath('postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=../client-identity.p12&sslpassword=mysslpassword&sslcert=../server-ca.pem', cwd, outputDir)).toMatchInlineSnapshot(
    `"postgresql://postgres:password@localhost:5432/mydb?schema=public&sslmode=require&sslidentity=../../../../client-identity.p12&sslpassword=mysslpassword&sslcert=../../../../server-ca.pem"`,
  )
})

const datasources: DataSource[] = [
  {
    name: 'db',
    url: {
      value: 'file:db.db',
      fromEnvVar: null,
    },
    connectorType: 'sqlite',
    config: {},
  },
  {
    name: 'db2',
    url: {
      value: 'file:./some-dir/db.db',
      fromEnvVar: null,
    },
    connectorType: 'sqlite',
    config: {},
  },
  {
    name: 'db3',
    url: {
      value: 'mysql:localhost',
      fromEnvVar: null,
    },
    connectorType: 'mysql',
    config: {},
  },
]

test('resolveDatasources', () => {
  expect(resolveDatasources(datasources, cwd, outputDir)).toMatchInlineSnapshot(`
    Array [
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db",
        "url": Object {
          "fromEnvVar": null,
          "value": "'file:' + path.resolve(__dirname, '../../../../prisma/db.db')",
        },
      },
      Object {
        "config": Object {},
        "connectorType": "sqlite",
        "name": "db2",
        "url": Object {
          "fromEnvVar": null,
          "value": "'file:' + path.resolve(__dirname, '../../../../prisma/some-dir/db.db')",
        },
      },
      Object {
        "config": Object {},
        "connectorType": "mysql",
        "name": "db3",
        "url": Object {
          "fromEnvVar": null,
          "value": "mysql:localhost",
        },
      },
    ]
  `)
})

test('serializeDatasources', () => {
  expect(serializeDatasources(resolveDatasources(datasources, cwd, outputDir).map(datasourceToDatasourceOverwrite)))
    .toMatchInlineSnapshot(`
    "[
      {
        \\"name\\": \\"db\\",
        \\"url\\": 'file:' + path.resolve(__dirname, '../../../../prisma/db.db')
      },
      {
        \\"name\\": \\"db2\\",
        \\"url\\": 'file:' + path.resolve(__dirname, '../../../../prisma/some-dir/db.db')
      },
      {
        \\"name\\": \\"db3\\",
        \\"url\\": \\"mysql:localhost\\"
      }
    ]"
  `)
})
