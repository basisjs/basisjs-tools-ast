var parser = require('esprima');
var escodegen = require('escodegen');
var translate = escodegen.generate.bind(escodegen);
var walker = require('./walker').astWalker();
var scope = require('./scope');
var structure = require('./structure');
var utils = require('./utils');

function parse(code) {
    return parser.parse(code, {
        sourceType: 'module',
        range: true,
        loc: true
    });
}

function getAstTop(code) {
    var ast = parse(code);

    return utils.getFirstExpression(ast);
}

function normalize(code) {
    return translate(getAstTop(code));
}

function isAstEqualsCode(expr, code) {
    return translate(expr) == normalize(code);
}

module.exports = {
    Scope: scope.Scope,
    applyScope: scope.process,

    struct: structure.process,
    createRunner: function(fn) {
        var token = {
            type: 'FunctionExpression',
            id: null,
            params: [],
            body: {
                type: 'BlockStatement',
                body: []
            }
        };

        token.run = fn;

        return token;
    },

    // ////

    parse: function(code, top) {
        return top ? getAstTop(code) : parse(code);
    },
    parseExpression: function(code, top) {
        code = '(' + code + ')';

        return top ? getAstTop(code) : parse(code);
    },
    normalize: normalize,

    isAstEqualsCode: isAstEqualsCode,

    translate: translate,

    walk: function(ast, walkers, context) {
        return walker.walk(ast, walkers, context);
    }
};
