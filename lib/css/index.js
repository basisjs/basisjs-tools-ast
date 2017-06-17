var csso = require('csso');
var parse = csso.syntax.parse;
var walk = csso.syntax.walk;
var clone = csso.syntax.clone;
var translate = csso.syntax.translate;

function unpackString(val) {
    return val.substr(1, val.length - 2);
}

function unpackUri(node) {
    switch (node.type) {
        case 'String':
            return unpackString(node.value);
        case 'Url':
            return node.value.type === 'String'
                ? unpackString(node.value.value)
                : node.value.value;
    }
}

function packWhiteSpace(value) {
    return {
        type: 'WhiteSpace',
        loc: null,
        value: value
    };
}

function packString(string) {
    return {
        type: 'String',
        loc: null,
        value: '"' + String(string).replace(/\"/, '\\"') + '"'
    };
}

function packComment(comment) {
    return {
        type: 'Comment',
        loc: null,
        value: String(comment).replace(/\*\//g, '* /')
    };
}

function packUri(uri, node) {
    if (!node) {
        node = {
            type: 'Url',
            loc: null,
            value: packString(uri)
        };
    } else {
        node.value = packString(uri);
    }

    return node;
}

module.exports = {
    List: csso.syntax.List,
    compress: csso.compress,
    copy: clone,
    translate: translate,
    walk: function(ast, handlers) {
        if (typeof handlers === 'function') {
            walk(ast, handlers);
        } else {
            walk(ast, function(node, item, list) {
                if (handlers.hasOwnProperty(node.type)) {
                    handlers[node.type].call(this, node, item, list);
                }
            });
        }
    },
    parse: function(content, filename, isRule) {
        return parse(content, {
            filename: filename,
            context: isRule ? 'declarationList' : 'stylesheet',
            positions: true
        });
    },

    unpackUri: unpackUri,

    WhiteSpace: packWhiteSpace,
    Comment: packComment,
    Url: packUri
};
