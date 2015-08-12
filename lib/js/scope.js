/*
  Analyse ast, create scopes
*/

var walker = require('./walker').ast_walker();

var fnWalker = function(token, scope){
  var type = token[0];
  var name = token[1];
  var args = token[2];

  if (name && type == 'defun')
    scope.put(name, {
      type: type,
      token: token,
      loc: token.start
    });

  var newScope = new Scope('function', scope);
  newScope.sourceToken = token;
  token.scope = newScope;

  newScope.put('arguments', {
    type: 'arguments',
    token: null,
    args: args
  });

  for (var i = 0; i < args.length; i++)
    newScope.put(args[i], {
      type: 'arg',
      token: null,
      loc: args.loc && args.loc[i],
      args: args,
      index: i
    });

  this.scopes.push(newScope);
};


//
// main function
//

function process(ast, scope){
  ast.scope = scope;
  ast.names = [];
  ast.scopes = [];

  var varWalker = function(token, scope){
    var defs = token[1];

    for (var i = 0, def; def = defs[i]; i++)
      scope.put(def[0], {
        type: 'var',
        token: def[1],
        loc: def.start
      });
  };

  return walker.walk(ast, {
    'var': varWalker,
    'const': varWalker,
    'defun': fnWalker,
    'function': fnWalker,

    'directive': function(token, scope){
      if (token[1] == 'use strict')
        scope.strict = true;
    },

    'try': function(token, scope){
      var catchNode = token[2];
      if (catchNode)
      {
        var newScope = new Scope('catch', scope);
        scope.put(catchNode[0], {
          type: 'catch',
          token: null
        });
        catchNode[1].scope = newScope;

        this.scopes.push(scope);
      }
    },
    'name': function(token, scope){
      var name = token[1];

      if (name == 'null' || name == 'false' || name == 'true')
        return;

      this.names.push({
        scope: scope,
        name: name
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

function Scope(type, parentScope, thisObject){
  this.type = type || 'unknown';
  this.thisObject = thisObject || ['name', 'undefined'];
  this.subscopes = [];
  this.names = {};

  if (parentScope)
  {
    this.parent = parentScope;
    this.root = parentScope.root;
    this.strict = parentScope.strict;
    parentScope.subscopes.push(this);
  }
  else
  {
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

  getOwnNames: function(){
    return Object.keys(this.names);
  },
  scopeByName: function(name){
    var cursor = this;
    while (cursor)
    {
      if (hasOwnProperty.call(cursor.names, name)) // hasOwnProperty may be overriden
        return cursor;

      cursor = cursor.parent;
    }

    return null;
  },
  has: function(name){
    return this.scopeByName(name) != null;
  },
  hasOwn: function(name){
    return hasOwnProperty.call(this.names, name);
  },
  get: function(name){
    var ownerScope = this.scopeByName(name);
    if (ownerScope)
      return ownerScope.names[name];
  },
  token: function(name){
    var ref = this.get(name);
    return ref && ref.token;
  },
  put: function(name, info){
    this.names[name] = info;
  },
  set: function(name, token){
    var scope = this.scopeByName(name);
    if (scope)
    {
      var ref = scope.names[name];
      ref.token = token;
    }
  },

  resolve: function(token){
    var path = [];
    var cursor = token;

    if (cursor.obj && cursor.ref_)
      return cursor.ref_;

    cycle:
    while (cursor && !cursor.obj)
    {
      switch (cursor[0])
      {
        case 'name':
          if (cursor[1] == 'this')
          {
            cursor = (cursor.scope || this).thisObject;  // FIXME: it seems a hack, remove cursor.scope - thisObject always must be of current scope
            break cycle;
          }

          var nameScope = cursor.scope || this.scopeByName(cursor[1]);

          if (!nameScope)
            return;

          if (nameScope === this)
          {
            cursor = this.names[cursor[1]];
            if (cursor)
              cursor = cursor.token;
          }
          else
            cursor = nameScope.resolve(cursor);

          break cycle;

        case 'dot':
          path.unshift(cursor[2]);
          cursor = cursor[1];
          break;

        case 'sub':
          var val = this.resolve(cursor[2]);

          if (val && (val[0] == 'string' || val[0] == 'num'))
            path.unshift(val[1]);
          else
            return;

          cursor = cursor[1];

          break;

        case 'string':
        case 'num':
        case 'regexp':
        case 'defun':
        case 'function':
        case 'object':
        case 'array':
          break cycle;

        case 'call':
          cursor = cursor.ref_;
          break;

        default:
          return;
      }
    }

    if (cursor && path.length)
    {
      if (cursor.ref_)
        cursor = cursor.ref_;

      if (!cursor.obj)
        return;

      for (var i = 0, key; key = path[i]; i++)
        if (cursor.obj && key in cursor.obj && cursor.obj[key])
        {
          cursor = cursor.obj[key];
          if (cursor.ref_)
           cursor = cursor.ref_;
        }
        else
          return;
    }

    return cursor;
  },

  deepResolve: function(token){
    var prev;
    do
    {
      prev = token;
      token = this.resolve(token);
    }
    while (token && token !== prev);

    return token;
  },
  simpleExpression: function(token){
    switch (token[0])
    {
      case 'binary':
        if (token[1] == '+')
        {
          var left = this.simpleExpression(token[2]);
          var right = this.simpleExpression(token[3]);
          if (left && left[0] == 'string' && right && right[0] == 'string')
            return ['string', left[1] + right[1]];
        }
        break;

      case 'array':
        return ['array', token[1].map(this.simpleExpression, this)];

      default:
        return this.deepResolve(token);
    }
  },

  isLocal: function(name){
    return hasOwnProperty.call(this.names, name);
  },
  isGlobal: function(name){
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
