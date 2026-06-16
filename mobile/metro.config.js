// Metro config que permite a la app móvil importar el paquete compartido
// (../shared) como código fuente TS, sin publicarlo en npm. El alias apunta a
// shared/src y se añade el repo raíz a watchFolders para que Metro lo transpile.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.extraNodeModules = {
  '@retobox/shared': path.resolve(workspaceRoot, 'shared/src'),
}

module.exports = config
