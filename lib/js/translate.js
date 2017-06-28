var escodegen = require('escodegen');
var utils = require('./utils');

var DEFAULTS = {
  format: {
    quotes: 'double',
    indent: {
      style: '  '
    }
  }
};

exports.setDefaults = function(options){
  utils.deepExtend(DEFAULTS, options);
};

exports.translate = function(ast, options){
  return escodegen.generate(ast, utils.deepExtend({}, DEFAULTS, options || {}));
};
