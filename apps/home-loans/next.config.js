const path = require('node:path');

module.exports = {
  transpilePackages: ['@nbfc/loan-calculator'],
  webpack(config) {
    config.resolve.alias['@nbfc/loan-calculator$'] = path.resolve(__dirname, '../../dist/libs/loan-calculator/src/index.ts');
    return config;
  },
};
