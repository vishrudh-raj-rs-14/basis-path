import type { Edge } from '@xyflow/react';

export function calculateMetrics(nodes: any[], edges: Edge[]) {
  // E - N + 2
  const E = edges.length;
  const N = nodes.length;
  // If there are no nodes, complexity is 0
  if (N === 0) return { vG: 0, nodesCount: 0, edgesCount: 0, distinctPaths: 0, allPaths: [] };
  
  const vG = E - N + 2;

  // Find all paths from start to end (DFS)
  const paths: string[][] = [];
  const adjacencyList = new Map<string, string[]>();
  
  nodes.forEach(n => adjacencyList.set(n.id, []));
  edges.forEach(e => {
    if (adjacencyList.has(e.source)) {
      adjacencyList.get(e.source)!.push(e.target);
    }
  });

  const entryNode = nodes.find(n => n.id === 'entry');
  const exitNode = nodes.find(n => n.id === 'exit');

  if (!entryNode || !exitNode) return { vG, nodesCount: N, edgesCount: E, distinctPaths: 0, allPaths: [] };

  // Helper DFS function with path limit to avoid infinite loops from unbounded while loops
  const findPaths = (currentId: string, currentPath: string[], maxDepth = 20) => {
    if (maxDepth === 0) return; // Prevent deep recursion/cycles
    if (currentId === exitNode.id) {
       // Deep copy the path and filter out junctions just to make visualization nicer
      paths.push([...currentPath, currentId]);
      if (paths.length > 50) return; // Hard limit for display purposes
      return;
    }

    const neighbors = adjacencyList.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!currentPath.includes(neighbor) || currentPath.filter(id => id === neighbor).length < 2) {
          // Allow visiting a node twice to capture loop unrolling (1 iteration)
          findPaths(neighbor, [...currentPath, currentId], maxDepth - 1);
      }
    }
  };

  findPaths(entryNode.id, []);

  // Filter paths to find linearly independent ones (conceptually complex, here we just return unique functional paths taking looping into account)
  const uniquePaths = Array.from(new Set(paths.map(p => JSON.stringify(p)))).map(p => JSON.parse(p));

  return {
    vG: vG,
    nodesCount: N,
    edgesCount: E,
    distinctPaths: uniquePaths.length > vG ? vG : uniquePaths.length, // Upper bound approximation for independent path count
    allPaths: uniquePaths.slice(0, vG) // Returning a set of basic paths
  };
}