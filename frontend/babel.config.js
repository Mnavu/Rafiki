module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [

    
      [
        'module-resolver',
        {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          root: ['./src'],
          alias: {
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@theme': './src/theme',
            '@hooks': './src/hooks',
            '@services': './src/services',
            '@data': './src/data',
            '@app-types': 
            './src/types',
            '@context': './src/context',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
    ignore: ['node_modules'],
  };
};
