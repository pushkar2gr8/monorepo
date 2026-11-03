const { NextFederationPlugin } = require('@module-federation/nextjs-mf');
const { dependencies } = require('./package.json');
const path = require('node:path');
const loanPageArtifact = path.resolve(__dirname, '../../dist/libs/loan-page-v2/personal-loans-v2.tsx');

module.exports = {
  transpilePackages: ['@nbfc/loan-calculator'],
  webpack(config, options) {
    config.resolve.alias['@nbfc/loan-calculator$'] = path.resolve(__dirname, '../../dist/libs/loan-calculator-v2/src/index.ts');
    config.resolve.alias['@nbfc/loan-page$'] = loanPageArtifact;
    config.resolve.alias['@nbfc/form-workflow$'] = path.resolve(__dirname, '../../libs/form-workflow/src/index.ts');
    if (process.env.ENABLE_MODULE_FEDERATION === 'true' && !options.isServer) {
      config.plugins.push(
        new NextFederationPlugin({
          name: 'personal_loans',
          filename: 'static/chunks/remoteEntry.js',
          exposes: {
            './LoanCalculator': '@nbfc/loan-calculator',
            './ApplyPage': './pages/index.tsx',
          },
          shared: {
            react: { singleton: true, requiredVersion: dependencies.react },
            'react-dom': { singleton: true, requiredVersion: dependencies['react-dom'] },
          },
        })
      );
    }
    return config;
  },
};
