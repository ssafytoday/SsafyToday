const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

// TypeScript 빌드 설정
module.exports = {
  mode: 'production',
  // Set devtool to false for production to avoid eval() usage
  devtool: false,
  entry: {
    background: './src/scripts/commons/background.ts',
    authorize: './src/scripts/commons/authorize.ts',
    baekjoon: './src/scripts/baekjoon/baekjoon.ts',
    programmers: './src/scripts/programmers/programmers.ts',
    swexpertacademy: './src/scripts/swexpertacademy/swexpertacademy.ts',
    goormlevel: './src/scripts/goormlevel/goormlevel.ts',
    oauth2: './src/scripts/commons/oauth2.ts',
    popup: './src/popup.ts',
    settings: './src/settings.ts',
    ssafytoday: './src/scripts/ssafytoday/ssafytoday.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/manifest.json', to: './' },
        { from: './src/rules.json', to: './' },
        { from: './src/assets', to: './assets' },
        { from: './src/css', to: './css' },
        { from: './src/popup.html', to: './' },
        { from: './src/settings.html', to: './' },
      ],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      sha1: 'js-sha1',
      '@': path.resolve(__dirname, 'src/scripts'),
      '@types': path.resolve(__dirname, 'src/types/index'),
    },
  },
};
