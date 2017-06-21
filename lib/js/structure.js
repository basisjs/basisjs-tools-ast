var walker = require('./walker').astWalker();
var translate = require('./translate').translate;

function process(ast, context){
  ast.throws = [];

  return walker.walk(ast, {
    CallExpression: function(token, scope){
      var expr = token.callee;
      var args = token.arguments;

      this.walk(expr);
      this.walkEach(args);

      var fn = scope.resolve(expr);

      if (fn)
      {
        var verbose = context.console.enabled;

        if (fn.ref_)
          fn = fn.ref_;

        if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].indexOf(fn.type) > -1)
        {
          if (fn.run)
          {
            if (verbose)
              context.console.start('> ' + translate(token));

            fn.run.call(
              this,
              token,
              ['Identifier', 'MemberExpression'].indexOf(expr.type) > -1 ? scope.resolve(expr.object || expr.name) : null,
              args,
              scope
            );

            if (verbose)
              context.console.end();
          }
        }
        else
        {
          if (fn.type === 'CallExpression' && fn.call && fn.call.run)
          {
            if (verbose)
              context.console.start('> ' + translate(token));

            fn.call.run.call(
              this,
              token,
              fn.call,
              args,
              scope
            );

            if (verbose)
              context.console.end();
          }
        }
      }

      return this.SKIP;
    },
    ReturnStatement: function(token){
      var res = this.walk(token.argument);
      if (res && res.obj)
      {
        var callToken = this.top(2);
        callToken.ref_ = res.ref_ || res;

        if (callToken && callToken.type === 'CallExpression' && !callToken.obj)
          callToken.obj = res.obj;
      }
      return this.SKIP;
    },
    MemberExpression: function(token){
      if (token.ref_)
        return;

      var path = this.walk(token.object);

      if (path.ref_)
      {
        var obj = path.ref_.obj;
        if (obj && path.ref_.type === 'CallExpression')
          obj = obj.obj;
        token.ref_ = obj && obj[token.property.name];
      }
      return this.SKIP;
    },
    Identifier: function(token, scope){
      if (token.ref_)
        return;
      var name = token.name;
      if (scope.isGlobal(name) && name !== 'global') // TODO: make correct test for global
      {
        var ref = scope.get(name);
        if (ref)
          token.ref_ = ref.token;
      }
      else
      {
        var ref = scope.resolve(token);
        if (ref && ref.ref_)
          token.ref_ = ref.ref_;
      }
    },
    ThisExpression: function(token, scope){
      var ref = scope.resolve(token);
      if (ref && ref.ref_)
        token.ref_ = ref.ref_;
    },
    ObjectExpression: function(token, scope){
      var props = token.properties;
      var obj = {};

      for (var i = 0, prop; prop = props[i]; i++)
      {
        var key = prop.key.type === 'Literal' ? prop.key.value : prop.key.name;

        if (key === undefined)
          throw new Error('Unknown key type');

        obj[key] = scope.resolve(prop.value) || prop.value;
      }

      token.obj = obj;
    },
    AssignmentExpression: function(token, scope){
      var op = token.operator;
      var lvalue = token.left;
      var rvalue = token.right;

      if (op === '=')
      {
        if (lvalue.type === 'Identifier')
        {
          rvalue = this.walk(rvalue);
          scope.set(lvalue.name, rvalue);

          return this.SKIP;
        }
        if (lvalue.type === 'MemberExpression')
        {
          lvalue = this.walk(lvalue);
          rvalue = this.walk(rvalue);

          var dest = scope.resolve(lvalue.object);

          if (dest && dest.obj)
          {
            var key = lvalue.property.type === 'Literal' ? lvalue.property.value : lvalue.property.name;
            dest.obj[key] = scope.resolve(rvalue) || rvalue;
          }

          return this.SKIP;
        }
      }
    },
    ThrowStatement: function(token){
      ast.throws.push(token);
    }
  }, context);
}

module.exports.process = process;
