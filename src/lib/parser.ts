import { Parser, Language } from 'web-tree-sitter';

let parserInstance: any | null = null;
let initPromise: Promise<void> | null = null;

export async function parseCodeToCFG(code: string): Promise<any> {
  if (!initPromise) {
    initPromise = (async () => {
      await (Parser as any).init();
      parserInstance = new (Parser as any)();
      const basePath = import.meta.env.BASE_URL || '/';
      const cppLang = await (Language as any).load(`${basePath}tree-sitter-cpp.wasm`);
      parserInstance.setLanguage(cppLang);
    })();
  }
  
  await initPromise;
  
  if (!parserInstance) throw new Error("Parser not loaded");
  return parserInstance.parse(code);
}