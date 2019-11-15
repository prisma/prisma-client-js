import { download } from '../src'
import { join } from 'path'

download({
  binaries: {
    'query-engine': join(__dirname, '../test'),
    'migration-engine': join(__dirname, '../test'),
  },
  binaryTargets: ['native', 'darwin', 'windows', 'debian-openssl-1.0.x', 'debian-openssl-1.1.x', 'rhel-openssl-1.0.x', 'rhel-openssl-1.1.x'],
  showProgress: true,
})
