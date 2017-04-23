var htmlparser = require('htmlparser2');

var N = 10;  // \n
var F = 12;  // \f
var R = 13;  // \r

var parserConfig = {
    lowerCaseTags: true
};

function prettyOffset(children, begin) {
    var offset = '';

    if (begin) {
        var firstChild = children[1];

        if (firstChild) {
            if (firstChild.type == 'text' && firstChild.data.match(/(?:\r\n?|\n\r?)[ \t]*$/)) {
                offset = RegExp.lastMatch;
            }
        } else {
            offset = '\n  ';
        }

        if (offset) {
            children.unshift({ type: 'text', data: offset });
        }
    } else {
        var idx = children.length - 2;
        var cursor;

        do {
            cursor = children[idx--];
        }
        while (cursor && cursor.type != 'text');

        if (cursor) {
            if (cursor.data.match(/[ \t]*$/)) {
                offset = RegExp.lastMatch;
            }
        } else {
            offset = '\n  ';
        }

        if (offset) {
            var lastChildren = children[children.length - 1];

            if (lastChildren && lastChildren.type == 'text') {
                lastChildren.data = lastChildren.data.replace(/(\r\n?|\n\r?)?$/, '\n' + offset);
            } else {
                children.push({ type: 'text', data: '\n' + offset });
            }
        }
    }
}

function walk(ast, handlers, context) {
    function walkNode(nodes) {
        for (var i = 0, node; node = nodes[i]; i++) {
            var type = node.type;

            if (typeof handlers[type] == 'function') {
                handlers[type].call(context, node);
            }

            if (typeof handlers['*'] == 'function') {
                handlers['*'].call(context, node);
            }

            if (node.children) {
                walkNode(node.children);
            }
        }
    }

    if (typeof handlers == 'function') {
        handlers = {
            '*': handlers
        };
    }

    walkNode(ast);
}

function translate(ast) {
    walk(ast, function(node) {
        if (node.ast) {
            node.data = (node.prefix || '') + translate(node.ast) + (node.postfix || '');
        }
    });

    return htmlparser.DomUtils.getInnerHTML({
        children: Array.isArray(ast) ? ast : [ast]
    });
}

module.exports = {
    parse: function(html, options) {
        // prepare parser
        var handler = new htmlparser.DomHandler(false);
        var parser = new htmlparser.Parser(handler, parserConfig);
        var posMap = new Map([[0, { line: 1, column: 1 }]]);
        var attrInfo = {};
        var head = null;
        var body = null;

        var lastPos = 0;

        if (!options) {
            options = {
                location: true
            };
        }

        function posToLineColumn(str, pos) {
            var prevIndex;
            var i;

            if (pos > lastPos) {
                prevIndex = lastPos;
                lastPos = pos;
            } else {
                if (posMap.has(pos)) {
                    return posMap.get(pos);
                }

                for (i = pos; i >= 0; i--) {
                    if (posMap.has(i)) {
                        prevIndex = i;
                        break;
                    }
                }
            }

            var prevInfo = posMap.get(prevIndex);
            var line = prevInfo.line;
            var column = prevInfo.column;
            var prevCharCode = prevIndex ? str.charCodeAt(prevIndex - 1) : 0;

            for (i = prevIndex; i < pos; i++) {
                var charCode = str.charCodeAt(i);

                if (charCode === R ||
                    (prevCharCode !== R && charCode === N) ||
                    charCode === F) {
                    line++;
                    column = 1;
                } else {
                    column++;
                }

                prevCharCode = charCode;
            }

            var info = {
                line: line,
                column: column
            };

            posMap.set(pos, info);

            return info;
        }

        handler.onopentag = function(name, attribs) {
            htmlparser.DomHandler.prototype.onopentag.call(this, name, attribs);

            var element = this._tagStack[this._tagStack.length - 1];

            if (options.location) {
                element.info = {
                    attrs: attrInfo,
                    start: posToLineColumn(html, parser.startIndex),
                    startContent: posToLineColumn(html, parser.endIndex + 1)
                };

                attrInfo = {};
            }

            switch (name) {
                case 'head':
                    if (!head) {
                        head = element;
                    }
                    break;

                case 'body':
                    if (!body) {
                        body = element;
                    }
                    break;

                case 'style':
                case 'script':
                    element.type = 'tag';
                    break;
            }
        };

        if (options.location) {
            handler.onclosetag = function() {
                var element = this._tagStack[this._tagStack.length - 1];

                element.info.endContent = posToLineColumn(html, parser.startIndex);
                element.info.end = posToLineColumn(html, parser.endIndex);

                htmlparser.DomHandler.prototype.onclosetag.call(this);
            };

            parser.onattribdata = function() {
                htmlparser.Parser.prototype.onattribdata.apply(this, arguments);

                var startIndex = parser._tokenizer._sectionStart;
                var endIndex = parser._tokenizer._index;

                attrInfo[this._attribname] = {
                    start: posToLineColumn(html, startIndex),
                    end: posToLineColumn(html, endIndex)
                };
            };
        }

        // parse html
        parser.parseComplete(html);

        var result = handler.dom;

        result.head = head;
        result.body = body;

        return result;
    },
    walk: walk,
    translate: translate,

    getElementByName: function(node, name) {
        if (node) {
            var nodes = Array.isArray(node) ? node.slice() : [node];

            while (nodes.length) {
                var cursor = nodes.shift();

                if (cursor.name == name) {
                    return cursor;
                }
                if (cursor.children) {
                    nodes.unshift.apply(nodes, cursor.children);
                }
            }
        }

        return null;
    },
    getElementsByName: function(node, name) {
        var result = [];

        if (node) {
            var nodes = Array.isArray(node) ? node.slice() : [node];

            while (nodes.length) {
                var cursor = nodes.shift();

                if (cursor.name == name) {
                    result.push(cursor);
                }
                if (cursor.children) {
                    nodes.unshift.apply(nodes, cursor.children);
                }
            }
        }

        return result;
    },

    getText: function getText(node) {
        var result = '';

        if (node.children) {
            result = node.children.reduce(function(res, node) {
                return res + (node.type == 'text' ? node.data : getText(node));
            }, '');
        }

        return result;
    },
    getAttrs: function(node) {
        return node.attribs || {};
    },
    rel: function(node, entry) {
        var rels = (this.getAttrs(node).rel || '').trim().split(/\s+/);

        return entry
            ? rels.indexOf(entry) != -1
            : rels;
    },

    injectToHead: function(ast, node, begin) {
        var insertPoint = ast;

        if (ast.head) {
            insertPoint = ast.head.children || (ast.head.children = []);
        } else {
            if (ast.body && ast.body.parent && ast.body.parent.children) {
                var html = ast.body.parent;

                html.children.splice(html.children.indexOf(ast.body), 0, node);

                return;
            }
        }

        if (begin) {
            insertPoint.unshift(node);
            prettyOffset(insertPoint, true);
        } else {
            prettyOffset(insertPoint);
            insertPoint.push(node);
            insertPoint.push({ type: 'text', data: '\n' });
        }
    },
    injectToBody: function(ast, node) {
        var insertPoint = ast;

        if (ast.body) {
            insertPoint = ast.body.children || (ast.body.children = []);
        }

        prettyOffset(insertPoint);
        insertPoint.push(node);
        insertPoint.push({ type: 'text', data: '\n' });
    },

    removeToken: function(token, remln) {
        if (remln && token.parent && token.parent.children) {
            var ar = token.parent.children;
            var index = ar.indexOf(token);

            ar.splice(ar.indexOf(token), 1);
            token.parent = null;

            if (index > 0 && ar[index].type == 'text') {
                var newData = ar[index].data.replace(/(\r\n?|\n\r?)\s*$/, '');

                if (newData) {
                    ar[index].data = newData;
                } else {
                    ar.splice(index, 1);
                }
            }
        } else {
            this.replaceToken(token, {
                type: 'text',
                data: ''
            });
        }
    },
    replaceToken: function(token, cfg) {
        var parent = token.parent;
        var key;

        for (key in token) {
            if (token.hasOwnProperty(key)) {
                delete token[key];
            }
        }

        for (key in cfg) {
            token[key] = cfg[key];
        }

        token.parent = parent;
    },
    insertBefore: function(refToken, token) {
        if (refToken.parent) {
            var children = refToken.parent.children;
            var idx = children.indexOf(refToken);

            token.parent = refToken.parent;
            if (idx == -1) {
                children.push(token);
            } else {
                children.splice(idx, 0, token);
            }
        }
    },
    insertAfter: function(refToken, token) {
        if (refToken.parent) {
            var children = refToken.parent.children;
            var idx = children.indexOf(refToken);

            token.parent = refToken.parent;
            if (idx == -1) {
                children.push(token);
            } else {
                children.splice(idx + 1, 0, token);
            }
        }
    }
};
