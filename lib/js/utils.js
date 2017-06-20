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
  getFirstExpression: function(node){
    if (node.type === 'BlockStatement' || node.type === 'ClassBody' || node.type === 'Program')
      return node.body[0] && node.body[0].expression || node.body[0];

    return node;
  },
  /**
   * Create literal from string, number or boolean
   *
   * @param {string|number|boolean} value
   * @returns {?Literal}
   */
  createLiteral: function(value){
    if (['string', 'number', 'boolean'].indexOf(typeof value) > -1)
    {
      var literal = {
        type: 'Literal',
        value: value,
        raw: typeof value === 'string' ? ('"' + value + '"') : String(value)
      };

      if (typeof value !== 'number' || typeof value === 'number' && isFinite(value))
        return literal;
    }

    return null;
  },
  /**
   * Create identifier
   *
   * @param {string} name
   * @param {boolean} wrap
   * @returns {Identifier}
   */
  createIdentifier: function(name, wrap){
    return {
      type: 'Identifier',
      name: wrap ? ('"' + name + '"') : name
    };
  },
  /**
   * Create identifiers
   *
   * @param {Array<string>} names
   * @param {boolean} wrap
   * @returns {Array<Identifier>}
   */
  createIdentifiers: function(names, wrap){
    if (Array.isArray(names))
      return names.map(function(name){
        return this.createIdentifier(name, wrap);
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
    if (node.type === 'Program')
      node = node.body;
    else if (this.isBlock(node))
      node = node.body.body;

    if (node && node[0] && this.isFunction(node[0]) && !node[0].id)
      node = this.normalizeFunction(node[0]).body.body;
    else if (!Array.isArray(node))
      return;

    if (prepend.type === 'Program')
      prepend = prepend.body;
    else if (this.isBlock(prepend))
      prepend = prepend.body.body;
    else if (!Array.isArray(prepend))
      prepend = [prepend];

    Array.prototype.unshift.apply(node, prepend);
  },
  /**
   * Append node to block or function
   *
   * @param {BlockStatement|ForStatement|SwitchStatement|ClassBody} node
   * @param {Node} append
   */
  append: function(node, append){
    if (node.type === 'Program')
      node = node.body;
    else if (this.isBlock(node))
      node = node.body.body;

    if (node && node[0] && this.isFunction(node[0]) && !node[0].id)
      node = this.normalizeFunction(node[0]).body.body;
    else if (!Array.isArray(node))
      return;

    if (append.type === 'Program')
      append = append.body;
    else if (this.isBlock(append))
      append = append.body.body;
    else if (!Array.isArray(append))
      append = [append];

    Array.prototype.push.apply(node, append);
  },
  /**
   * Replace node, but save the reference to the old node object
   *
   * @param {Node} oldNode
   * @param {Node} newNode
   * @return {Node}
   */
  replaceNode: function(oldNode, newNode){
    var keys = Object.keys(oldNode);

    for (var i = 0; i < keys.length; i++)
      delete oldNode[keys[i]];

    return this.extend(oldNode, newNode);
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
    return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].indexOf(type) > -1;
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
    return ['ClassDeclaration', 'ClassExpression'].indexOf(type) > -1;
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
    return ['BlockStatement', 'ForStatement', 'SwitchStatement', 'ClassBody'].indexOf(type) > -1;
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
    var sources = Array.prototype.slice.call(arguments, 1);

    if (typeof target !== 'object' || !target)
      return;

    for (var i = 0; i < sources.length; i++)
    {
      var source = sources[i];

      if (this.isObject(source))
        for (var sourceKey in source)
          if (source.hasOwnProperty(sourceKey))
            target[sourceKey] = source[sourceKey];
    }

    return target;
  },
  deepExtend: function(target){
    var sources = Array.prototype.slice.call(arguments, 1);

    if (typeof target !== 'object' || !target)
      return;

    for (var i = 0; i < sources.length; i++)
    {
      var source = sources[i];

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
