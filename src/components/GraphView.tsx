import { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface GraphViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedPath: string[] | null;
}

export default function GraphView({ nodes, edges, selectedPath }: GraphViewProps) {
  const [internalNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [internalEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const styledNodes = useMemo(() => {
    return internalNodes.map(node => {
      const isSelected = selectedPath?.includes(node.id);
      return {
        ...node,
        style: {
          backgroundColor: isSelected && node.data.nodeType !== 'decision' && node.data.nodeType !== 'entry' && node.data.nodeType !== 'exit' ? '#1e1b4b' : (node.style?.backgroundColor || undefined),
          boxShadow: isSelected ? '0 0 15px 2px rgba(79, 70, 229, 0.6)' : (node.style?.boxShadow || 'none'),
          borderColor: isSelected ? '#818cf8' : (node.style?.borderColor || undefined),
          color: node.style?.color || undefined
        }
      };
    });
  }, [internalNodes, selectedPath]);

  const styledEdges = useMemo(() => {
    return internalEdges.map(edge => {
      const isSelected = selectedPath ? selectedPath.some((nodeId, idx) => 
        idx < selectedPath.length - 1 && nodeId === edge.source && selectedPath[idx + 1] === edge.target
      ) : false;

      return {
        ...edge,
        animated: isSelected,
        style: {
          stroke: isSelected ? '#818cf8' : '#64748b',
          strokeWidth: isSelected ? 4 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? '#818cf8' : '#64748b',
        }
      };
    });
  }, [internalEdges, selectedPath]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
        <Background color="#334155" gap={20} />
      </ReactFlow>
    </div>
  );
}