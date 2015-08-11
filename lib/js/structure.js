var walker = require('./walker').ast_walker();
var translate = require('./translator.js').gen_code;

function process(ast, context){
  ast.throws = [];

  return walker.walk(ast, {
    'call': function(token, scope){
      var expr = token[1];
      var args = token[2];

      this.walk(token, 1);
      this.walkEach(token[2]);

      var fn = scope.resolve(expr);

      if (fn)
      {
        if (fn.ref_)
          fn = fn.ref_;

        if (fn[0] == 'function' || fn[0] == 'defun')
        {
          if (fn.run)
          {
            context.console.start('> ' + translate(token));
            fn.run.call(
              this,
              token,
              expr[0] == 'dot' || expr[0] == 'name' ? scope.resolve(expr[1]) : null,
              args,
              scope
            );
            context.console.end();
          }
        }
        else
        {
          if (fn[0] == 'call' && fn.call && fn.call.run)
          {
            context.console.start('> ' + translate(token));
            fn.call.run.call(
              this,
              token,
              fn.call,
              args,
              scope
            );
            context.console.end();
          }
        }
      }

      return token;
    },
    'return': function(token){
      var res = this.walk(token, 1);
      if (res.obj)
      {
        var callToken = this.top(2);
        callToken.ref_ = res.ref_ || res;
        if (callToken && callToken[0] == 'call' && !callToken.obj)
          callToken.obj = res.obj;
      }
      return token;
    },
    'defun': function(token){
      token.parent_ = this.top(1);
    },
    'dot': function(token){
      if (token.ref_)
        return;

      var path = this.walk(token[1]);
      if (path.ref_)
      {
        var obj = path.ref_.obj;
        if (obj && path.ref_[0] == 'call')
          obj = obj.obj;
        token.ref_ = obj && obj[token[2]];
        token.refPath_ = path.refPath_ + '.' + token[2];
      }
      return token;
    },
    'name': function(token, scope){
      if (token.ref_)
        return;

      var name = token[1];
      if (scope.isGlobal(name) && name != 'global' && name != 'this') // TODO: make correct test for global
      {
        var ref = scope.get(name);
        if (ref)
        {
          token.ref_ = ref.token;
          token.refPath_ = name;
        }
      }
      else
      {
        var ref = scope.resolve(token);
        if (ref && ref.ref_)
        {
          token.ref_ = ref.ref_;
          token.refPath_ = ref.refPath_;
        }
      }
    },
    'object': function(token, scope){
      token.obj = {};
      token.objSource = {};
      for (var i = 0, prop; prop = token[1][i]; i++)
      {
        token.obj[prop[0]] = scope.resolve(prop[1]) || prop[1];
        token.objSource[prop[0]] = token;
      }
    },
    'assign': function(token, scope){
      var op = token[1];
      var lvalue = token[2];
      var rvalue = token[3];

      if (op == true)
      {
        if (lvalue[0] == 'name')
        {
          rvalue = this.walk(rvalue);
          scope.set(lvalue[1], rvalue);

          return token;
        }
        if (lvalue[0] == 'dot')
        {
          lvalue = this.walk(lvalue);
          rvalue = this.walk(rvalue);

          var dest = scope.resolve(lvalue[1]);

          if (dest && dest.obj)
            dest.obj[lvalue[2]] = scope.resolve(rvalue) || rvalue;

          return token;
        }
      }
    },
    'throw': function(token){
      ast.throws.push(token);
    }
  }, context);
}

module.exports.process = process;
