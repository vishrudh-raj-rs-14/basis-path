import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export default function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="h-full w-full relative group">
      <div className="absolute top-0 right-0 z-10 px-2 flex gap-1">
         <span className="text-white bg-slate-800/80 px-2 py-1 rounded-bl-lg text-xs font-mono border-b border-l border-slate-700">C++ Mode</span>
      </div>
      <Editor
        height="100%"
        defaultLanguage="cpp"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 16 }
        }}
      />
    </div>
  );
}