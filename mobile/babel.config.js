module.exports = function (api) {
  api.cache(true)
  return {
    // babel-preset-expo (SDK 54) incluye automáticamente el plugin de
    // Reanimated/Worklets cuando react-native-reanimated está instalado.
    presets: ['babel-preset-expo'],
  }
}
