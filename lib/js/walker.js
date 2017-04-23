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
    var stack = [];
    var scope;
    var storedScope;

    function walk(ast) {
        estraverse.traverse(ast, {
            enter: function(token) {
                storedScope = scope;

                if (token.scope) {
                    scope = token.scope;
                }

                stack.push(token);

                var userFn = user[token.type] || user['*'];
                if (userFn) {
                    var ret = userFn.call(walkerContext, token, scope);

                    if (ret != null) {
                        scope = storedScope;
                        stack.pop();

                        return ret;
                    }

                    if (token.scope) {
                        scope = token.scope;
                    }
                }
            },
            leave: function() {
                scope = storedScope;
                stack.pop();
            }
        });

        return ast;
    }

    function top(idx) {
        return stack[stack.length - (idx || 0) - 1];
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
        stack: stack,
        top: top
    };

    var overrideProps = {
        walker: walker,
        walk: walk,
        stack: stack,
        top: top
    };

    var contextStack = [];
    var walkerContext = {};

    overrideObject(walkerContext, overrideProps);

    return walker;
}

exports.astWalker = astWalker;
