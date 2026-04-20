import { MarkerType } from '@xyflow/react';
import { Position } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';

export type FlowNode = {
    id: string;
    label: string;
    type: 'decision' | 'junction' | 'statement' | 'entry' | 'exit';
    originalCode?: string;
    astNode?: any;
};

export type FlowEdge = {
    id: string;
    source: string;
    target: string;
    label?: string;
};

class CFGBuilder {
    nodes: FlowNode[] = [];
    edges: FlowEdge[] = [];
    nodeCounter = 0;

    createNodeId() {
        return `n${++this.nodeCounter}`;
    }

    addNode(node: Partial<FlowNode>): FlowNode {
        const fullNode = { ...node, id: node.id || this.createNodeId() } as FlowNode;
        this.nodes.push(fullNode);
        return fullNode;
    }

    addEdge(source: string, target: string, label?: string) {
        this.edges.push({ id: `e_${source}_${target}`, source, target, label });
    }

    build(ast: any) {
        this.nodes = [];
        this.edges = [];
        this.nodeCounter = 0;

        const mainFunc = this.findMainFunction(ast.rootNode);
        if (!mainFunc) {
            this.addNode({ id: 'err', label: 'No main function found', type: 'statement' });
            return;
        }

        const entry = this.addNode({ id: 'entry', label: 'Start', type: 'entry' });
        const exit = this.addNode({ id: 'exit', label: 'End', type: 'exit' });

        const body = mainFunc.childForFieldName('body');
        if (body) {
            const nextNodes = this.traverseBlock(body, [entry.id], exit.id, exit.id);
            for (const n of nextNodes) {
                this.addEdge(n, exit.id);
            }
        } else {
            this.addEdge(entry.id, exit.id);
        }
    }

    findMainFunction(node: any): any | null {
        if (node.type === 'function_definition') {
            const decl = node.childForFieldName('declarator');
            if (decl?.text.includes('main')) return node;
        }
        for (const child of node.children) {
            const result = this.findMainFunction(child);
            if (result) return result;
        }
        return null;
    }

    traverseBlock(block: any, previousHeads: string[], loopContinuesTo: string, loopBreaksTo: string): string[] {
        let currentHeads = [...previousHeads];
        
        for (const child of block.namedChildren) {
            if (child.type === 'comment') continue;
            
            // Sequential Statements
            if (['expression_statement', 'declaration'].includes(child.type)) {
                const sn = this.addNode({ label: child.text.length > 20 ? child.text.substring(0, 20) + '...' : child.text, type: 'statement', astNode: child });
                for (const h of currentHeads) {
                    this.addEdge(h, sn.id);
                }
                currentHeads = [sn.id];
            } 
            else if (child.type === 'return_statement') {
                const sn = this.addNode({ label: child.text, type: 'statement' });
                for (const h of currentHeads) {
                    this.addEdge(h, sn.id);
                }
                this.addEdge(sn.id, 'exit');
                currentHeads = []; // Dead end
            } 
            else if (child.type === 'if_statement') {
                const condition = child.childForFieldName('condition');
                const consequence = child.childForFieldName('consequence');
                const alternative = child.childForFieldName('alternative');
                
                const decNode = this.addNode({ label: `if (${condition?.text || '?'})`, type: 'decision' });
                for (const h of currentHeads) {
                    this.addEdge(h, decNode.id);
                }

                // True branch
                let trueHeads = [decNode.id];
                const edgesBeforeConsequence = this.edges.length;
                if (consequence) {
                    trueHeads = this.traverseBlockOrSingle(consequence, trueHeads, loopContinuesTo, loopBreaksTo);
                }
                // Finds the edge originating from the decision node for the true branch
                for (let i = edgesBeforeConsequence; i < this.edges.length; i++) {
                    if (this.edges[i].source === decNode.id) {
                        this.edges[i].label = 'T';
                    }
                }

                // False branch
                let falseHeads = [decNode.id];
                const edgesBeforeAlternative = this.edges.length;
                if (alternative) {
                    let falseNode = alternative;
                    if (alternative.type === 'else_clause') {
                         falseNode = alternative.namedChildren[0] || alternative;
                    } else if (alternative.type === 'else') {
                         falseNode = alternative.nextNamedSibling || alternative;
                    }
                    falseHeads = this.traverseBlockOrSingle(falseNode, falseHeads, loopContinuesTo, loopBreaksTo);
                    // Finds the edge originating from the decision node for the false branch
                    for (let i = edgesBeforeAlternative; i < this.edges.length; i++) {
                        if (this.edges[i].source === decNode.id) {
                            this.edges[i].label = 'F';
                        }
                    }
                } else {
                    // Implicit false branch directly connects back to junction later
                }
                
                // Combine
                currentHeads = [...trueHeads, ...falseHeads];
                if(trueHeads.length > 0 || falseHeads.length > 0) {
                    const junc = this.addNode({ label: 'Merge', type: 'junction' });
                    // To prevent multiple direct T/F edges from decNode to junc if they are empty
                    let addedT = false;
                    let addedF = false;

                    for(const h of currentHeads) {
                         if(h === decNode.id) {
                             // It means one of the branches was empty and the decision node falls straight through
                             const isTrueBranchHeads = trueHeads.includes(h);
                             const isFalseBranchHeads = falseHeads.includes(h);
                             
                             if (isTrueBranchHeads && !addedT) {
                                 this.addEdge(h, junc.id, 'T');
                                 addedT = true;
                             }
                             if (isFalseBranchHeads && !addedF) {
                                 this.addEdge(h, junc.id, 'F');
                                 addedF = true;
                             }
                         } else {
                             this.addEdge(h, junc.id);
                         }
                    }
                    currentHeads = [junc.id];
                }
            } 
            else if (child.type === 'while_statement') {
                const condition = child.childForFieldName('condition');
                const body = child.childForFieldName('body');

                const decNode = this.addNode({ label: `while (${condition?.text || '?'})`, type: 'decision' });
                const juncNode = this.addNode({ label: 'Loop Entry', type: 'junction' }); // Loop header junction

                for (const h of currentHeads) {
                    this.addEdge(h, juncNode.id);
                }
                this.addEdge(juncNode.id, decNode.id);
                
                let loopBodyHeads = [decNode.id];
                const edgesBeforeBody = this.edges.length;
                if (body) {
                    loopBodyHeads = this.traverseBlockOrSingle(body, loopBodyHeads, decNode.id, 'exit'); // Simplified breaks
                }
                
                for (let i = edgesBeforeBody; i < this.edges.length; i++) {
                    if (this.edges[i].source === decNode.id) {
                        this.edges[i].label = 'T';
                    }
                }
                
                // Loop back
                for(const h of loopBodyHeads) {
                    if (h === decNode.id) {
                        this.addEdge(h, juncNode.id, 'T'); // empty body loops immediately
                    } else {
                        this.addEdge(h, juncNode.id);
                    }
                }

                currentHeads = [decNode.id]; // False exits the loop
                 // Add an implicit edge for the exit of the while loop (false condition)
                 // Let's create a junction for exit
                  const outJunc = this.addNode({ label: 'Loop Exit', type: 'junction' });
                  this.addEdge(decNode.id, outJunc.id, 'F');
                  currentHeads = [outJunc.id];

            }
            // For loops and other constructs can be added...
        }
        return currentHeads;
    }

    traverseBlockOrSingle(node: any, previousHeads: string[], loopContinuesTo: string, loopBreaksTo: string): string[] {
        if (node.type === 'compound_statement') {
            return this.traverseBlock(node, previousHeads, loopContinuesTo, loopBreaksTo);
        } else {
            // Simulated block of 1
            return this.traverseBlock({ namedChildren: [node], type: 'compound_statement' } as any, previousHeads, loopContinuesTo, loopBreaksTo);
        }
    }
}

export function generateGraphElements(ast: any) {
    const builder = new CFGBuilder();
    builder.build(ast);

    // Filter out disconnected sub-graphs potentially left by error paths to ensure single component for CC calculation
    // Dagre Layout
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', marginx: 40, marginy: 40, ranksep: 80, nodesep: 100, edgesep: 30 });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to Dagre
    builder.nodes.forEach(n => {
        g.setNode(n.id, { width: 120, height: 40 });
    });

    // Add edges to Dagre
    builder.edges.forEach(e => {
        g.setEdge(e.source, e.target);
    });

    dagre.layout(g);

    const reactNodes: Node[] = builder.nodes.map(n => {
        const dnode = g.node(n.id);
        
        let styleCls = "px-4 py-2 shadow-md rounded-md bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs border text-center relative flex items-center justify-center min-w-[100px]";
        let inlineStyle: any = { backgroundColor: '#1e293b', color: '#f1f5f9', borderColor: '#334155' };
        
        if (n.type === 'decision') {
            styleCls = "px-4 py-2 shadow-md rounded-lg bg-amber-900 border-amber-600 text-amber-100 text-xs font-mono drop-shadow-md flex items-center justify-center text-center relative border-2 min-w-[120px]";
            inlineStyle = { backgroundColor: '#78350f', color: '#fef3c7', borderColor: '#d97706', borderRadius: '8px', borderWidth: '2px' };
        }
        else if(n.type === 'junction') {
            styleCls = "px-2 py-1 shadow-sm rounded bg-slate-700/50 border-slate-500 text-slate-300 font-mono text-[10px] border border-dashed text-center min-w-[60px]";
            inlineStyle = { backgroundColor: '#334155', color: '#cbd5e1', borderColor: '#64748b', borderRadius: '4px', borderStyle: 'dashed', borderWidth: '1px' };
        }
        else if(n.type === 'entry') {
            styleCls = "px-4 py-2 shadow-md rounded-full bg-emerald-900/50 border-emerald-500/50 text-emerald-200 font-mono text-sm border-2 text-center";
            inlineStyle = { backgroundColor: '#064e3b', color: '#a7f3d0', borderColor: '#059669', borderRadius: '9999px', borderWidth: '2px' };
        }
        else if(n.type === 'exit') {
            styleCls = "px-4 py-2 shadow-md rounded-full bg-rose-900/50 border-rose-500/50 text-rose-200 font-mono text-sm border-2 text-center";
            inlineStyle = { backgroundColor: '#4c0519', color: '#fecdd3', borderColor: '#e11d48', borderRadius: '9999px', borderWidth: '2px' };
        }

        return {
            id: n.id,
            position: { x: dnode.x - dnode.width/2, y: dnode.y - dnode.height/2 },
            data: { 
                label: n.type === 'decision' 
                     ? (<div>
                         <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 font-mono tracking-tighter">{n.id}</div>
                         <div className="block max-w-full truncate whitespace-nowrap overflow-hidden px-1">{n.label}</div>
                       </div>)
                     : (<div>
                         {n.type !== 'junction' && <div className="absolute -top-4 right-1 text-[9px] text-slate-400 font-mono tracking-tighter">{n.id}</div>}
                         <div className="px-1">{n.label}</div>
                       </div>),
                nodeType: n.type
            },
            type: 'default', // Might want custom node for diamond
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
            className: styleCls,
            style: inlineStyle,
        };
    });

    const reactEdges: Edge[] = builder.edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelStyle: { fill: e.label === 'T' ? '#34d399' : '#f87171', fontWeight: 600, fontSize: 13 },
        labelBgStyle: { fill: '#1e293b', stroke: '#334155', strokeWidth: 1 },
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#64748b' },
        style: { stroke: '#64748b', strokeWidth: 2 }
    }));

    return { nodes: reactNodes, edges: reactEdges, rawNodes: builder.nodes, rawEdges: builder.edges };
}