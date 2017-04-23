var fs = require('fs');
var assert = require('assert');
var html = require('../lib/html/index.js');

var tests = [
    {
        source: fs.readFileSync(__dirname + '/fixture/1.html', 'utf-8').trim(),
        ast: JSON.parse(fs.readFileSync(__dirname + '/fixture/1.ast', 'utf-8'))
    }
];

function cleanAst(ast) {
    function walkNode(nodes) {
        nodes = nodes.slice();

        for (var i = 0, node; node = nodes[i]; i++) {
            var newNode = {};

            nodes[i] = newNode;

            for (var key in node) {
                if (key !== 'next' && key !== 'prev' && key !== 'parent') {
                    newNode[key] = node[key];
                }
            }

            if (node.children) {
                newNode.children = walkNode(node.children);
            }
        }

        return nodes;
    }

    return walkNode(ast);
}

describe('parse html', function() {
    function createTest(num) {
        it('test#' + num, function() {
            var expected = tests[num].ast;
            var actual = cleanAst(html.parse(tests[num].source));

            assert.deepEqual(actual, expected);
        });
    }

    for (var i = 0; i < tests.length; i++) {
        createTest(i);
    }
});
