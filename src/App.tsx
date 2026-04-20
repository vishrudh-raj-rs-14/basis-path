import React, { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import GraphView from './components/GraphView';
import { Activity } from 'lucide-react';
import { parseCodeToCFG } from './lib/parser';
import { generateGraphElements } from './lib/cfg';
import { calculateMetrics } from './lib/metrics';
import type { Node, Edge } from '@xyflow/react';
import './index.css';

const DEFAULT_CODE = `int main() {
    int x = 10;
    if (x > 5) {
        x = x - 1;
    } else {
        x = x + 1;
    }
    
    while (x > 0) {
        x--;
    }
    
    return 0;
}`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [metrics, setMetrics] = useState({ vG: 0, nodesCount: 0, edgesCount: 0, distinctPaths: 0, allPaths: [] as string[][] });
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ast = await parseCodeToCFG(code);
        if (!active) return;
        const resultElements = generateGraphElements(ast);
        if (!active) return;
        setNodes(resultElements.nodes);
        setEdges(resultElements.edges);
        
        const calculatedMetrics = calculateMetrics(resultElements.nodes, resultElements.edges);
        setMetrics(calculatedMetrics);
        setSelectedPathIndex(null);
      } catch (err) {
        console.error("Error parsing/generating CFG", err);
      }
    })();
    return () => { active = false; };
  }, [code]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700 h-16 shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Basis Path Visualizer
          </h1>
        </div>
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <span>Client-side C++ CFG Generator</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-1/3 flex flex-col border-r border-slate-700">
          <div className="flex-1 min-h-[50%]">
            <CodeEditor value={code} onChange={(val) => setCode(val || '')} />
          </div>
          <div className="h-2/5 min-h-[250px] bg-slate-800 border-t border-slate-700 p-4 shrink-0 overflow-y-auto">
            <h3 className="text-indigo-400 font-semibold mb-3 text-sm flex justify-between items-center">
               <span>Complexity Metrics</span>
               <span className="text-xs font-normal text-slate-500">Live Updates</span>
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700/50 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div>
                <div className="text-slate-400 text-xs mb-1 relative z-10">Cyclomatic Complexity V(G)</div>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="text-2xl text-blue-400 font-mono">{metrics.vG}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono relative z-10 mt-1">
                  E - N + 2 = {metrics.edgesCount} - {metrics.nodesCount} + 2
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4"></div>
                <div className="text-slate-400 text-xs mb-1">Independent Paths</div>
                <div className="text-2xl text-indigo-400 font-mono relative z-10">{metrics.distinctPaths}</div>
              </div>
            </div>
            {metrics.allPaths.length > 0 ? (
              <div>
                <h4 className="text-slate-400 text-xs mb-2 uppercase tracking-wide font-medium">Independent Paths:</h4>
                <div className="space-y-1.5 px-1 pb-4">
                  {metrics.allPaths.map((p, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedPathIndex(idx)}
                      className={`text-xs p-2 rounded-md cursor-pointer transition-all duration-200 border ${
                        selectedPathIndex === idx 
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.1)]' 
                        : 'hover:bg-slate-700/50 text-slate-300 border-transparent hover:border-slate-600'
                      }`}
                    >
                      <div className="font-mono flex items-center gap-2 flex-wrap">
                        <span className="text-slate-500 w-12 shrink-0">Path {idx + 1}:</span>
                        {p.map((node, i) => (
                            <React.Fragment key={i}>
                                <span className={selectedPathIndex === idx ? 'text-indigo-200 font-semibold' : 'text-slate-300'}>{node}</span>
                                {i < p.length - 1 && <span className="text-slate-600">→</span>}
                            </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
                <div className="text-slate-500 text-xs italic py-4 text-center">No complete paths found</div>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col relative bg-slate-950/50" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
           <GraphView 
            nodes={nodes} 
            edges={edges} 
            selectedPath={selectedPathIndex !== null ? metrics.allPaths[selectedPathIndex] : null} 
           />
        </div>
      </main>
    </div>
  );
}