const { GraphQLServer } = require('graphql-yoga')

const Photon = require('@generated/photon')
const { resolvers } = require('./resolvers')
const { permissions } = require('./permissions')

const photon = new Photon.default()

const server = new GraphQLServer({
  typeDefs: 'src/schema.graphql',
  resolvers,
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
