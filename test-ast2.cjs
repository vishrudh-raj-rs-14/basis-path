const { Parser, Language } = require('web-tree-sitter');
(async () => {
  await Parser.init();
  const parser = new Parser();
  const lang = await Language.load('./public/tree-sitter-cpp.wasm');
  parser.setLanguage(lang);
  const tree = parser.parse(`int main() { if (x > 5) { x--; } else { x++; } }`);
  const ifStmt = tree.rootNode.children[0].childForFieldName('body').children[1];
  console.log("Alternative type:", ifStmt.childForFieldName('alternative').type);
  console.log("Alternative children:", ifStmt.childForFieldName('alternative').children.map(c => c.type));
  console.log("Alternative named:", ifStmt.childForFieldName('alternative').namedChildren.map(c => c.type));
})();
