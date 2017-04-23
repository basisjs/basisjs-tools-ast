var parser = require('./parser');
var translate = require('./translator').gen_code;
var walker = require('./walker').astWalker();
var scope = require('./scope');
var structure = require('./structure');

function parse(code) {
    return parser.parse(code);
}

function getAstTop(code) {
    // return top level statement's ast
    return parser.parse(code)[1][0][1];
}

function normalize(code) {
    return translate(getAstTop(code));
}

function splitLines(code, maxLineLength) {
    var splits = [0];

    parser.parse(function() {
        var nextToken = parser.tokenizer(code);
        var lastSplit = 0;
        var prevToken;

        function custom() {
            var token = nextToken.apply(this, arguments);

            if (!prevToken || prevToken.type != 'keyword') {
                if (token.pos - lastSplit > maxLineLength) {
                    if (token.type == 'keyword' ||
                        token.type == 'atom' ||
                        token.type == 'name' ||
                        token.type == 'punc') {
                        lastSplit = token.pos;
                        splits.push(lastSplit);
                    }
                }
            }

            prevToken = token;

            return token;
        }

        custom.context = function() {
            return nextToken.context.apply(this, arguments);
        };

        return custom;
    }());

    return splits.map(function(pos, i) {
        return code.substring(pos, splits[i + 1] || code.length);
    }).join('\n');
}

// @fixme: works only for "call"
function isAstEqualsCode(expr, code) {
    return translate(expr) == normalize(code);
}

function translateCallExpr(expr, args) {
    return translate(expr) + '(' + args.map(translate).join(', ') + ')';
}

module.exports = {
    Scope: scope.Scope,
    applyScope: scope.process,

    struct: structure.process,
    createRunner: function(fn) {
        var token = ['function', null, []];

        token.run = fn;

        return token;
    },

    // ////

    parse: function(text, top) {
        var ast = parse(text);

        return top ? ast[1][0][1] : ast;
    },
    normalize: normalize,

    isAstEqualsCode: isAstEqualsCode,

    translate: translate,
    translateCallExpr: translateCallExpr,
    translateDefaults: require('./translator').setDefaults,
    splitLines: splitLines,

    prepend: function(ast, prependAst) {
        var stat = ast[1][0];

        if (stat && stat[0] == 'function' && !stat[1]) {
            Array.prototype.unshift.apply(stat[3], prependAst[1]);
        } else {
            Array.prototype.unshift.apply(ast[1], prependAst[1]);
        }
    },
    append: function(ast, appendAst) {
        var stat = ast[1][0];

        if (stat && stat[0] == 'function' && !stat[1]) {
            Array.prototype.push.apply(stat[3], appendAst[1]);
        } else {
            Array.prototype.push.apply(ast[1], appendAst[1]);
        }
    },

    walk: function(ast, walkers, context) {
        return walker.walk(ast, walkers, context);
    }
};
