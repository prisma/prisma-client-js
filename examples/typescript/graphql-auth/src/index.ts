import { nexusPrismaPlugin } from '@generated/nexus-prisma'
import Photon from '@generated/photon'
import { makeSchema } from '@prisma/nexus'
import { GraphQLServer } from 'graphql-yoga'
import { join } from 'path'
import { permissions } from './permissions'
import * as allTypes from './resolvers'
import { Context } from './types'

const photon = new Photon({
  debug: true,
})

const nexusPrisma = nexusPrismaPlugin({
  photon: (ctx: Context) => ctx.photon,
})

const schema = makeSchema({
  types: [allTypes, nexusPrisma],
  outputs: {
    typegen: join(__dirname, '../generated/nexus-typegen.ts'),
    schema: join(__dirname, '/schema.graphql'),
  },
  typegenAutoConfig: {
    sources: [
      {
        source: '@generated/photon',
        alias: 'photon',
      },
      {
        source: join(__dirname, 'types.ts'),
        alias: 'ctx',
      },
    ],
    contextType: 'ctx.Context',
  },
})

const server = new GraphQLServer({
  schema,
  // TODO: requires graphql-middleware 3.0.1
  // 3.0.2 throws TypeError: definitions.trim is not a function
  // see https://github.com/prisma/graphql-middleware/issues/198
  middlewares: [permissions],
  context: request => {
    return {
      ...request,
      photon,
    }
  },
})

server.start(() => console.log(`🚀 Server ready at http://localhost:4000`))
