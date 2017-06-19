/*
 Analyse ast, create scopes
 */

var walker = require('./walker').astWalker();
var utils = require('./utils');
var hasOwnProperty = Object.prototype.hasOwnProperty;

var fnWalker = function(token, scope) {
    var type = token.type;
    var name = token.id && token.id.name;
    var args = token.params;

    var newScope = new Scope('function', scope);

    newScope.sourceToken = token;
    token.scope = newScope;

    if (name) {
        if (type == 'FunctionDeclaration') {
            scope.put(name, {
                type: type,
                token: token,
                loc: token.loc
            });
        } else {
            newScope.put(name, {
                type: type,
                token: token,
                loc: token.loc
            });
        }
    }

    if (type !== 'ArrowFunctionExpression') {
        newScope.put('arguments', {
            type: 'arguments',
            token: null,
            args: args
        });
    }

    for (var i = 0; i < args.length; i++) {
        newScope.put(args[i].name, {
            type: 'arg',
            token: null,
            loc: args[i].loc,
            args: args,
            index: i
        });
    }

    this.scopes.push(newScope);
};

//
// main function
//

function process(ast, scope) {
    ast.scope = scope;
    ast.names = [];
    ast.scopes = [];

    var varWalker = function(token, scope) {
        scope.declarations.push({
            type: 'var',
            name: token.id.name,
            parent: this.top(1),
            loc: token.loc
        });

        scope.put(token.id.name, {
            type: 'var',
            token: token.init,
            loc: token.loc
        });
    };

    return walker.walk(ast, {
        VariableDeclarator: varWalker,
        FunctionDeclaration: fnWalker,
        FunctionExpression: fnWalker,
        ArrowFunctionExpression: fnWalker,
        ExpressionStatement: function(token) {
            if (token.directive && token.directive.toLowerCase() == 'use strict') {
                scope.strict = true;
            }
        },

        CatchClause: function(token, scope) {
            var newScope = new Scope('catch', scope);

            scope.put(token.param.name, {
                type: 'catch',
                token: null
            });
            token.body.scope = newScope;

            this.scopes.push(scope);
        },

        Identifier: function(token, scope) {
            // todo implement more efficient solution in a future version
            var parent = this.top(1);
            var labelTypes = ['LabeledStatement', 'ContinueStatement', 'BreakStatement'];
            var functionTypes = ['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression'];
            var typesToCheck = functionTypes.concat(labelTypes, ['Property', 'MemberExpression', 'VariableDeclarator', 'AssignmentExpression']);

            if (typesToCheck.indexOf(parent.type) > -1) {
                var isLabel = labelTypes.indexOf(parent.type) > -1;
                var isFunctionName = functionTypes.indexOf(parent.type) > -1;
                var isObjectKey = parent.type == 'Property' && parent.key == token && parent.computed;
                var isObjectValue = parent.type == 'Property' && parent.value == token;
                var isMemberExpressionProperty = parent.type == 'MemberExpression' && parent.property == token && parent.computed;
                var isMemberExpressionObject = parent.type == 'MemberExpression' && parent.object == token;
                var isVariableInit = parent.type == 'VariableDeclarator' && parent.init == token;
                var isLeftOfAssignment = parent.type == 'AssignmentExpression' && parent.left == token && parent.operator != '=';
                var isRightOfAssignment = parent.type == 'AssignmentExpression' && parent.right == token;

                if (isFunctionName || isLabel ||
                    !isObjectKey && !isObjectValue &&
                    !isMemberExpressionProperty && !isMemberExpressionObject &&
                    !isLeftOfAssignment && !isRightOfAssignment &&
                    !isVariableInit) {
                    return;
                }
            }

            this.names.push({
                scope: scope,
                token: token
            });
        }
    }, {
        names: ast.names,
        scopes: ast.scopes
    });
}

//
// Scope class
//

function Scope(type, parentScope, thisObject) {
    this.type = type || 'unknown';
    this.thisObject = thisObject || utils.createIdentifier('undefined');
    this.subscopes = [];
    this.names = {};
    this.declarations = [];

    if (parentScope) {
        this.parent = parentScope;
        this.root = parentScope.root;
        this.strict = parentScope.strict;
        parentScope.subscopes.push(this);
    } else {
        this.root = this;
    }

    this.put('this', {
        type: 'readonly',
        token: this.thisObject
    });
}

Scope.prototype = {
    root: null,
    parent: null,
    subscopes: null,
    thisObject: null,
    names: null,
    strict: false,

    getOwnNames: function() {
        return Object.keys(this.names);
    },
    scopeByName: function(name) {
        var cursor = this;

        while (cursor) {
            if (hasOwnProperty.call(cursor.names, name)) {
                return cursor;
            }

            cursor = cursor.parent;
        }

        return null;
    },
    has: function(name) {
        return this.scopeByName(name) != null;
    },
    hasOwn: function(name) {
        return hasOwnProperty.call(this.names, name);
    },
    get: function(name) {
        var ownerScope = this.scopeByName(name);

        if (ownerScope) {
            return ownerScope.names[name];
        }
    },
    getOwn: function(name) {
        return this.names[name] || null;
    },
    token: function(name) {
        var ref = this.get(name);

        return ref && ref.token;
    },
    put: function(name, info) {
        this.names[name] = info;
    },
    set: function(name, token) {
        var scope = this.scopeByName(name);

        if (scope) {
            var ref = scope.names[name];

            ref.token = token;
        }
    },

    resolve: function(token) {
        var path = [];
        var cursor = token;

        if (cursor.obj && cursor.ref_) {
            return cursor.ref_;
        }

        cycle:
            while (cursor && !cursor.obj) {
                switch (cursor.type) {
                    case 'ThisExpression':
                        // FIXME: it seems a hack, remove cursor.scope - thisObject always must be of current scope
                        cursor = (cursor.scope || this).thisObject;
                        break cycle;
                    case 'Identifier':
                        var nameScope = cursor.scope || this.scopeByName(cursor.name);

                        if (!nameScope) {
                            return;
                        }

                        if (nameScope === this) {
                            cursor = this.names[cursor.name];
                            if (cursor) {
                                cursor = cursor.token;
                            }
                        } else {
                            cursor = nameScope.resolve(cursor);
                        }

                        break cycle;

                    case 'MemberExpression':
                        var property = cursor.property;

                        if (cursor.property.computed) {
                            property = this.resolve(cursor.property);
                        }

                        if (!property) {
                            return;
                        }

                        if (property.type == 'Literal') {
                            path.unshift(property.value);
                        } else {
                            path.unshift(property.name);
                        }

                        cursor = cursor.object;

                        break;

                    case 'Literal':
                    case 'FunctionDeclaration':
                    case 'FunctionExpression':
                    case 'ArrowFunctionExpression':
                    case 'ObjectExpression':
                    case 'ArrayExpression':
                        break cycle;

                    case 'CallExpression':
                        cursor = cursor.ref_;
                        break;

                    default:
                        return;
                }
            }

        if (cursor && path.length) {
            if (cursor.ref_) {
                cursor = cursor.ref_;
            }

            if (!cursor.obj) {
                return;
            }

            for (var i = 0, key; key = path[i]; i++) {
                if (cursor.obj && key in cursor.obj && cursor.obj[key]) {
                    cursor = cursor.obj[key];
                    if (cursor.ref_) {
                        cursor = cursor.ref_;
                    }
                } else {
                    return;
                }
            }
        }

        return cursor;
    },

    deepResolve: function(token) {
        var prev;

        do {
            prev = token;
            token = this.resolve(token);
        }
        while (token && token !== prev);

        return token;
    },
    simpleExpression: function(token) {
        switch (token.type) {
            case 'BinaryExpression':
                if (token.operator == '+') {
                    var left = this.simpleExpression(token.left);
                    var right = this.simpleExpression(token.right);

                    if (left.type == 'Literal' && right.type == 'Literal') {
                        return utils.createLiteral(left.value + right.value);
                    }
                }
                break;

            case 'ArrayExpression':
                return { type: 'ArrayExpression', elements: token.elements.map(this.simpleExpression, this) };

            default:
                return this.deepResolve(token);
        }
    },

    isLocal: function(name) {
        return hasOwnProperty.call(this.names, name);
    },
    isGlobal: function(name) {
        var scope = this.scopeByName(name);

        return scope ? scope.root === scope : true;
    }
};

//
// export
//

module.exports = {
    Scope: Scope,
    process: process
};
