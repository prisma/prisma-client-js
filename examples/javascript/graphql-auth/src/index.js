const { nexusPrismaPlugin } = require('@generated/nexus-prisma')
const Photon = require('@generated/photon')
const { makeSchema } = require('@prisma/nexus')
const { GraphQLServer } = require('graphql-yoga')
const { join } = require('path')
const { permissions } = require('./permissions')
const allTypes = require('./resolvers')

const photon = new Photon({
  debug: true,
})

const nexusPrisma = nexusPrismaPlugin({
  photon: ctx => ctx.photon,
})

const schema = makeSchema({
  types: [allTypes, nexusPrisma],
  outputs: {
    schema: join(__dirname, '/schema.graphql'),
  },
})

const server = new GraphQLServer({
  schema,
  // middlewares: [permissions], // TODO: Fix after https://github.com/maticzav/graphql-shield/issues/361
  context: request => {
    return {
      ...request,
      photon,
    }
  },
})

server.start(() => console.log(`🚀 Server ready at http://localhost:4000`))
