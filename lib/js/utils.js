/**
 * @typedef {Object} Node
 * @property {string} type
 */

module.exports = {
    /**
     * Returns first expression in BlockStatement
     *
     * @param {BlockStatement|Node} node
     * @returns {Node}
     */
    getFirstExpression: function(node) {
        if (node.type == 'BlockStatement' || node.type == 'ClassBody' || node.type == 'Program') {
            return node.body[0] && node.body[0].expression || node.body[0];
        }

        return node;
    },
    /**
     * Create literal from string, number or boolean
     *
     * @param {string|number|boolean} value
     * @returns {?Literal}
     */
    createLiteral: function(value) {
        if (['string', 'number', 'boolean'].indexOf(typeof value) > -1) {
            var literal = {
                type: 'Literal',
                value: value,
                raw: typeof value == 'string' ? ('"' + value + '"') : String(value)
            };

            if (typeof value != 'number' || typeof value == 'number' && isFinite(value)) {
                return literal;
            }
        }

        return null;
    },
    /**
     * Create identifier
     *
     * @param {string} name
     * @returns {Identifier}
     */
    createIdentifier: function(name) {
        return {
            type: 'Identifier',
            name: name
        };
    },
    /**
     * Normalize arrow function
     * Add brackets and return ReturnStatement
     *
     * @param {ArrowFunctionExpression} node
     */
    normalizeFunction: function(node) {
        if (node.type == 'ArrowFunctionExpression' && node.expression) {
            node.body = {
                type: 'BlockStatement',
                body: [
                    {
                        type: 'ReturnStatement',
                        argument: node.body
                    }
                ]
            }
        }
    },
    /**
     * Prepend node to block or function
     *
     * @param {BlockStatement|ForStatement|SwitchStatement|ClassBody} node
     * @param {Node} prepend
     */
    prepend: function(node, prepend) {
        if (this.isBlock(node)) {
            node.body.unshift(prepend);
        } else if (this.isFunction(node)) {
            this.normalizeFunction(node);

            node.body.body.unshift(prepend);
        }
    },
    /**
     * Append node to block or function
     *
     * @param {BlockStatement|ForStatement|SwitchStatement|ClassBody} node
     * @param {Node} prepend
     */
    append: function(node, prepend) {
        if (this.isBlock(node)) {
            node.body.unshift(prepend);
        } else if (this.isFunction(node)) {
            this.normalizeFunction(node);

            node.body.body.push(prepend);
        }
    },
    /**
     * Is node a function
     *
     * @param {Node} node
     * @returns {boolean}
     */
    isFunction: function(node) {
        return this.isTypeFunction(node.type);
    },
    /**
     * Is type a function
     *
     * @param {string} type node type
     * @returns {boolean}
     */
    isTypeFunction: function(type) {
        return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].indexOf(type) > -1;
    },
    /**
     * Is node a class
     *
     * @param {Node} node
     * @returns {boolean}
     */
    isClass: function(node) {
        return this.isTypeClass(node.type);
    },
    /**
     * Is type a class
     *
     * @param {string} type node type
     * @returns {boolean}
     */
    isTypeClass: function(type) {
        return ['ClassDeclaration', 'ClassExpression'].indexOf(type) > -1;
    },
    /**
     * Is node a block
     *
     * @param {Node} node
     * @returns {boolean}
     */
    isBlock: function(node) {
        return this.isTypeBlock(node.type);
    },
    /**
     * Is type a block
     *
     * @param {string} type node type
     * @returns {boolean}
     */
    isTypeBlock: function(type) {
        return ['BlockStatement', 'ForStatement', 'SwitchStatement', 'ClassBody'].indexOf(type) > -1;
    },
    /**
     * Bubble to nearest function scope or global scope
     * Uses for hoisting emulation
     *
     * @param {Scope} scope from
     * @returns {?Scope}
     */
    bubble: function(scope) {
        var cursor = scope;

        while (cursor) {
            if (this.isBlock(cursor.node) && this.isFunction(cursor.node.parent) || cursor.node.type == 'Program') {
                break;
            }

            cursor = cursor.parent;
        }

        return cursor || null;
    },
    /**
     * Bubble to nearest BlockStatement or ForStatement or SwitchStatement or global scope
     * Uses for let/const/class hoisting emulation
     *
     * @param {Scope} scope from
     * @returns {Scope}
     */
    bubbleToBlock: function(scope) {
        var cursor = scope;

        while (cursor) {
            if (this.isBlock(cursor.node) || cursor.node.type == 'Program') {
                break;
            }

            cursor = cursor.parent;
        }

        return cursor;
    },
    /**
     * Get scope from node
     *
     * @param {Node} node
     * @return {?Scope}
     */
    resolveScope: function(node) {
        var scope;
        var cursor = node;

        while (cursor && !scope) {
            scope = cursor.scope;

            if (scope) {
                break;
            }

            cursor = cursor.parent;
        }

        return scope || null;
    }
};
