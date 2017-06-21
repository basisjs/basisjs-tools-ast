/**
 * @typedef {Object} Node
 * @property {string} type
 */

module.exports = {
  /**
   * Returns first expression in BlockStatement
   *
   * @param {?Array} body
   * @returns {?Node}
   */
  getFirstExpression: function(body){
    if (body)
      return body[0] && body[0].expression || body[0];

    return null;
  },
  /**
   * Returns node body if its has a body
   *
   * @param {Node} node
   * @returns {?Array}
   */
  getBody: function(node){
    if (node.type === 'BlockStatement' || node.type === 'ClassBody' || node.type === 'Program')
      return node.body;
    else if(this.isTypeBlock(node.type) || this.isTypeClass(node.type) || this.isTypeFunction(node.type))
      return node.body.body;

    return null;
  },
  /**
   * Create literal from string, number or boolean
   *
   * @param {string|number|boolean} value
   * @returns {?Literal}
   */
  createLiteral: function(value){
    var valueType = typeof value;

    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean')
    {
      return {
        type: 'Literal',
        value: value,
        raw: valueType === 'string' ? '"' + value + '"' : String(value)
      };
    }

    return null;
  },
  /**
   * Create identifier
   *
   * @param {string} name
   * @returns {Identifier}
   */
  createIdentifier: function(name){
    return {
      type: 'Identifier',
      name: name
    };
  },
  /**
   * Create quoted identifier for object key
   *
   * @param {string} name
   * @returns {Identifier}
   */
  createKeyIdentifier: function(name){
    return {
      type: 'Identifier',
      name: '"' + name + '"'
    };
  },
  /**
   * Create identifiers
   *
   * @param {Array<string>} names
   * @returns {Array<Identifier>}
   */
  createIdentifiers: function(names){
    if (Array.isArray(names))
      return names.map(function(name){
        return this.createIdentifier(name);
      }, this);

    return [];
  },
  /**
   * Normalize arrow function
   * Add brackets and return ReturnStatement
   *
   * @param {ArrowFunctionExpression} node
   * @returns {FunctionExpression|FunctionDeclaration|ArrowFunctionExpression}
   */
  normalizeFunction: function(node){
    if (node.type === 'ArrowFunctionExpression' && node.expression)
      node.body = {
        type: 'BlockStatement',
        body: [
          {
            type: 'ReturnStatement',
            argument: node.body
          }
        ]
      };

    return node;
  },
  /**
   * Prepend node to block or function
   *
   * @param {BlockStatement|ForStatement|SwitchStatement|ClassBody} node
   * @param {Node} prepend
   */
  prepend: function(node, prepend){
    var prependTo = this.getBody(node);
    var prependFrom = prepend;
    var firstExpr = this.getFirstExpression(prependTo);

    // if the first expression of the body is a function, then prepend nodes to its body
    if (firstExpr && this.isTypeFunction(firstExpr.type))
      prependTo = firstExpr.body.body;

    if (prepend.type === 'BlockStatement' || prepend.type === 'ClassBody' || prepend.type === 'Program')
      prependFrom = this.getBody(prepend);
    else if (!Array.isArray(prepend))
      prependFrom = [prepend];

    Array.prototype.unshift.apply(prependTo, prependFrom);
  },
  /**
   * Append node to block or function
   *
   * @param {BlockStatement|ForStatement|SwitchStatement|ClassBody} node
   * @param {Node} append
   */
  append: function(node, append){
    var appendTo = this.getBody(node);
    var appendFrom = append;
    var firstExpr = this.getFirstExpression(appendTo);

    // if the first expression of the body is a function, then append nodes to its body
    if (firstExpr && this.isTypeFunction(firstExpr.type))
      appendTo = firstExpr.body.body;

    // if append from block then get its body
    if (appendFrom.type === 'BlockStatement' || appendFrom.type === 'ClassBody' || appendFrom.type === 'Program')
      appendFrom = this.getBody(append);
    else if (!Array.isArray(append))
      appendFrom = [appendFrom];

    Array.prototype.push.apply(appendTo, appendFrom);
  },
  /**
   * Replace node, but save the reference to the old node object
   *
   * @param {Node} oldNode
   * @param {Node} newNode
   * @return {Node}
   */
  replaceNode: function(oldNode, newNode){
    for (var propName in oldNode)
      delete oldNode[propName];

    return this.extend(oldNode, newNode);
  },
  memberExpression: function(name){
    var result = {
      type: 'Identifier',
      name: name
    };

    for (var i = 1; i < arguments.length; i++)
      result = {
        type: 'MemberExpression',
        computed: false,
        object: result,
        property: this.createIdentifier(arguments[i])
      };

    return result;
  },
  /**
   * Is node a function
   *
   * @param {Node} node
   * @returns {boolean}
   */
  isFunction: function(node){
    return this.isTypeFunction(node.type);
  },
  /**
   * Is type a function
   *
   * @param {string} type node type
   * @returns {boolean}
   */
  isTypeFunction: function(type){
    return type === 'FunctionDeclaration' || type ===  'FunctionExpression' || type === 'ArrowFunctionExpression';
  },
  /**
   * Is node a class
   *
   * @param {Node} node
   * @returns {boolean}
   */
  isClass: function(node){
    return this.isTypeClass(node.type);
  },
  /**
   * Is type a class
   *
   * @param {string} type node type
   * @returns {boolean}
   */
  isTypeClass: function(type){
    return type === 'ClassDeclaration' || type === 'ClassExpression';
  },
  /**
   * Is node a block
   *
   * @param {Node} node
   * @returns {boolean}
   */
  isBlock: function(node){
    return this.isTypeBlock(node.type);
  },
  /**
   * Is type a block
   *
   * @param {string} type node type
   * @returns {boolean}
   */
  isTypeBlock: function(type){
    return type === 'BlockStatement' || type === 'ForStatement' || type === 'SwitchStatement' || type === 'ClassBody';
  },
  /**
   * Create function
   * @param {?Identifier} id
   * @param {?Array<Identifier>} params
   * @param {?Array<Node>} body
   * @returns {FunctionExpression}
   */
  createFunction: function(id, params, body){
    return {
      type: 'FunctionExpression',
      id: id || null,
      params: params || [],
      body: {
        type: 'BlockStatement',
        body: body || []
      }
    }
  },
  isObject: function(obj){
    return typeof obj === 'object' && obj;
  },
  cloneArray: function(array){
    return array.map(function(el){
      if (Array.isArray(el))
        return this.cloneArray(el);

      if (this.isObject(el) && el.constructor === Object)
        return this.deepExtend({}, el);

      return el;
    }, this);
  },
  extend: function(target){
    if (typeof target !== 'object' || !target)
      return;

    for (var i = 1; i < arguments.length; i++)
    {
      var source = arguments[i];

      if (this.isObject(source))
        for (var sourceKey in source)
          if (source.hasOwnProperty(sourceKey))
            target[sourceKey] = source[sourceKey];
    }

    return target;
  },
  deepExtend: function(target){
    if (typeof target !== 'object' || !target)
      return;

    for (var i = 1; i < arguments.length; i++)
    {
      var source = arguments[i];

      if (this.isObject(source))
        for (var sourceKey in source)
          if (source.hasOwnProperty(sourceKey))
          {
            var value = source[sourceKey];

            if (Array.isArray(value))
              target[sourceKey] = this.cloneArray(value);
            else if (this.isObject(value) && value.constructor === Object)
            {
              if (this.isObject(target[sourceKey]))
                this.deepExtend(target[sourceKey], value);
              else
                target[sourceKey] = this.deepExtend({}, value);
            }
            else
              target[sourceKey] = value;
          }
    }

    return target;
  }
};
