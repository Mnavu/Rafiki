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
            '@context': './src/context',
            '@navigation': './src/navigation',
            '@screens': './src/screens',
            '@services': './src/services',
            '@theme': './src/theme',
            '@types': './src/types',
          },
        },
      ],
    ],
  };
};
