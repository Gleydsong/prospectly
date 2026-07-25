const { createTransformer } = require('ts-jest');

module.exports = createTransformer({
  tsconfig: require('path').join(__dirname, 'tsconfig.json'),
});
