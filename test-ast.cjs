const { Parser, Language } = require('web-tree-sitter');
(async () => {
  await Parser.init();
  const parser = new Parser();
  const lang = await Language.load('./public/tree-sitter-cpp.wasm');
  parser.setLanguage(lang);
  const tree = parser.parse(`int main() { if (x > 5) { x--; } else { x++; } }`);
  console.log(tree.rootNode.toString());
})();
