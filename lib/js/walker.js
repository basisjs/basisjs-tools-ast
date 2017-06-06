var estraverse = require('estraverse');

function overrideObject(obj, props) {
    var old = {};
    for (var key in props) {
        if (props.hasOwnProperty(key)) {
            if (obj.hasOwnProperty(key)) {
                old[key] = obj[key];
            }

            obj[key] = props[key];
        }
    }
    return old;
}

function restoreObject(obj, props, old) {
    for (var key in props) {
        if (props.hasOwnProperty(key)) {
            if (old.hasOwnProperty(key)) {
                obj[key] = old[key];
            } else {
                delete obj[key];
            }
        }
    }
}

function astWalker() {
    var user = {};
    var tokenStack = [];
    var scopeStack = [];
    var scope;

    function walkEach(array) {
        if (array) {
            var storedScope = scope;

            if (array.scope) {
                scope = array.scope;
            }

            for (var i = 0, len = array.length; i < len; i++) {
                walk(array[i]);
            }

            scope = storedScope;
        }
    }

    function walk(ast) {
        estraverse.traverse(ast, {
            enter: function(token) {
                tokenStack.push(token);
                if (token.scope) {
                    scope = token.scope;
                    scopeStack.push(scope)
                }

                var userFn = user[token.type] || user['*'];

                if (userFn) {
                    var managerContext = Object.create(walkerContext);

                    managerContext.break = this.break.bind(this);
                    managerContext.skip = this.skip.bind(this);

                    userFn.call(managerContext, token, scope);

                    if (token.scope && token.scope != scope) {
                        scope = token.scope;
                        scopeStack.push(scope);
                    }
                }
            },
            leave: function(token) {
                tokenStack.pop();

                if (token.scope) {
                    var oldScope = scopeStack.pop();

                    scope = scopeStack[scopeStack.length - 1] || oldScope;
                }
            }
        });

        return ast;
    }

    function top(idx) {
        return tokenStack[tokenStack.length - (idx || 0) - 1];
    }

    var walker = {
        walk: function(ast, customWalkers, context) {
            if (typeof customWalkers == 'function') {
                customWalkers = {'*': customWalkers};
            }

            var oldContext;
            var oldUser = overrideObject(user, customWalkers);

            if (context && context !== contextStack) {
                contextStack.push(walkerContext);
                oldContext = overrideObject(context, overrideProps);
                walkerContext = context;
            }

            ast = walk(ast);

            if (context && context !== contextStack) {
                restoreObject(context, overrideProps, oldContext);
                walkerContext = contextStack.pop();
            }

            restoreObject(user, customWalkers, oldUser);

            return ast;
        },
        stack: tokenStack,
        top: top,
        walkro: function(token) {
            return walk(token);
        }
    };

    var overrideProps = {
        walker: walker,
        walk: walk,
        walkro: function(token) {
            return walk(token);
        },
        walkEach: walkEach,
        stack: tokenStack,
        top: top
    };

    var contextStack = [];
    var walkerContext = {};

    overrideObject(walkerContext, overrideProps);

    return walker;
}

exports.astWalker = astWalker;
