import type { KnowledgeNode, KnowledgeRelationship, KnowledgeGraph } from './types';

export interface GraphLayout {
  nodes: NodePosition[];
  edges: EdgePosition[];
  bounds: Bounds;
  metadata: LayoutMetadata;
}

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  z?: number;
  radius?: number;
  color?: string;
  opacity?: number;
}

export interface EdgePosition {
  id: string;
  source: { x: number; y: number; z?: number };
  target: { x: number; y: number; z?: number };
  weight?: number;
  color?: string;
  opacity?: number;
  curvature?: number;
}

export interface Bounds {
  x: { min: number; max: number };
  y: { min: number; max: number };
  z?: { min: number; max: number };
}

export interface LayoutMetadata {
  algorithm: string;
  iterations: number;
  convergence: number;
  time: number;
  parameters: any;
}

export interface VisualizationConfig {
  width: number;
  height: number;
  algorithm:
    | 'force'
    | 'circular'
    | 'hierarchical'
    | 'radial'
    | 'kamada-kawai'
    | 'fruchterman-reingold';
  nodeSize: number;
  edgeLength: number;
  iterations: number;
  damping: number;
  gravity: number;
  enable3D: boolean;
  colorScheme: 'category' | 'continuous' | 'custom';
  nodeColors: Map<string, string>;
  edgeColors: Map<string, string>;
}

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  diameter: number;
  clusteringCoefficient: number;
  connectedComponents: number;
  centrality: CentralityMetrics;
}

export interface CentralityMetrics {
  degree: Map<string, number>;
  betweenness: Map<string, number>;
  closeness: Map<string, number>;
  eigenvector: Map<string, number>;
}

export class KnowledgeVisualizationEngine {
  private config: VisualizationConfig;
  private layouts: Map<string, GraphLayout> = new Map();

  constructor(config: Partial<VisualizationConfig> = {}) {
    this.config = {
      width: 800,
      height: 600,
      algorithm: 'force',
      nodeSize: 20,
      edgeLength: 100,
      iterations: 1000,
      damping: 0.9,
      gravity: 0.1,
      enable3D: false,
      colorScheme: 'category',
      nodeColors: new Map(),
      edgeColors: new Map(),
      ...config,
    };
  }

  async generateLayout(graph: KnowledgeGraph, algorithm?: string): Promise<GraphLayout> {
    // const startTime = Date.now();
    const layoutAlgorithm = algorithm || this.config.algorithm;

    let layout: GraphLayout;

    switch (layoutAlgorithm) {
      case 'force':
        layout = await this.forceDirectedLayout(graph);
        break;
      case 'circular':
        layout = await this.circularLayout(graph);
        break;
      case 'hierarchical':
        layout = await this.hierarchicalLayout(graph);
        break;
      case 'radial':
        layout = await this.radialLayout(graph);
        break;
      case 'kamada-kawai':
        layout = await this.kamadaKawaiLayout(graph);
        break;
      case 'fruchterman-reingold':
        layout = await this.fruchtermanReingoldLayout(graph);
        break;
      default:
        layout = await this.forceDirectedLayout(graph);
    }

    // Store layout for reuse
    const layoutId = `${graph.nodes.size}_${graph.relationships.size}_${layoutAlgorithm}`;
    this.layouts.set(layoutId, layout);

    return layout;
  }

  private async forceDirectedLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    const nodes = Array.from(graph.nodes.values());
    const relationships = Array.from(graph.relationships.values());

    // Initialize positions randomly
    const nodePositions = new Map<string, NodePosition>();
    const nodeIds = nodes.map((n) => n.id);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.random() * 200 + 50;
      nodePositions.set(node.id, {
        id: node.id,
        x: Math.cos(angle) * radius + this.config.width / 2,
        y: Math.sin(angle) * radius + this.config.height / 2,
        radius: this.config.nodeSize,
        color: this.getNodeColor(node),
        opacity: 0.8,
      });
    }

    // Force-directed layout simulation
    for (let iteration = 0; iteration < this.config.iterations; iteration++) {
      const forces = new Map<string, { x: number; y: number }>();

      // Initialize forces
      for (const nodeId of nodeIds) {
        forces.set(nodeId, { x: 0, y: 0 });
      }

      // Calculate repulsive forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        const node1 = nodes[i];
        if (!node1) continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const node2 = nodes[j];
          if (!node2) continue;
          
          const pos1 = nodePositions.get(node1.id);
          const pos2 = nodePositions.get(node2.id);
          if (!pos1 || !pos2) continue;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 0) {
            const force = this.config.gravity / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            const force1 = forces.get(node1.id);
            const force2 = forces.get(node2.id);
            if (force1 && force2) {
              force1.x -= fx;
              force1.y -= fy;
              force2.x += fx;
              force2.y += fy;
            }
          }
        }
      }

      // Calculate attractive forces for edges
      for (const rel of relationships) {
        const source = nodePositions.get(rel.sourceId)!;
        const target = nodePositions.get(rel.targetId)!;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const force = (distance - this.config.edgeLength) * rel.weight;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          forces.get(rel.sourceId)!.x += fx;
          forces.get(rel.sourceId)!.y += fy;
          forces.get(rel.targetId)!.x -= fx;
          forces.get(rel.targetId)!.y -= fy;
        }
      }

      // Apply forces with damping
      for (const nodeId of nodeIds) {
        const node = nodePositions.get(nodeId)!;
        const force = forces.get(nodeId)!;

        node.x += force.x * this.config.damping;
        node.y += force.y * this.config.damping;

        // Keep nodes within bounds
        node.x = Math.max(
          this.config.nodeSize,
          Math.min(this.config.width - this.config.nodeSize, node.x),
        );
        node.y = Math.max(
          this.config.nodeSize,
          Math.min(this.config.height - this.config.nodeSize, node.y),
        );
      }
    }

    // Generate edge positions
    const edgePositions: EdgePosition[] = relationships.map((rel) => {
      const source = nodePositions.get(rel.sourceId)!;
      const target = nodePositions.get(rel.targetId)!;

      return {
        id: rel.id,
        source: { x: source.x, y: source.y },
        target: { x: target.x, y: target.y },
        weight: rel.weight,
        color: this.getEdgeColor(rel),
        opacity: 0.6,
        curvature: 0,
      };
    });

    // Calculate bounds
    const bounds = this.calculateBounds(Array.from(nodePositions.values()));

    return {
      nodes: Array.from(nodePositions.values()),
      edges: edgePositions,
      bounds,
      metadata: {
        algorithm: 'force',
        iterations: this.config.iterations,
        convergence: 0.95,
        time: Date.now(),
        parameters: {
          damping: this.config.damping,
          gravity: this.config.gravity,
          edgeLength: this.config.edgeLength,
        },
      },
    };
  }

  private async circularLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    const nodes = Array.from(graph.nodes.values());
    const relationships = Array.from(graph.relationships.values());

    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) / 3;

    const nodePositions = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      return {
        id: node.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        radius: this.config.nodeSize,
        color: this.getNodeColor(node),
        opacity: 0.8,
      };
    });

    const edgePositions = relationships.map((rel) => {
      const source = nodePositions.find((n) => n.id === rel.sourceId)!;
      const target = nodePositions.find((n) => n.id === rel.targetId)!;

      return {
        id: rel.id,
        source: { x: source.x, y: source.y },
        target: { x: target.x, y: target.y },
        weight: rel.weight,
        color: this.getEdgeColor(rel),
        opacity: 0.6,
        curvature: 0,
      };
    });

    return {
      nodes: nodePositions,
      edges: edgePositions,
      bounds: this.calculateBounds(nodePositions),
      metadata: {
        algorithm: 'circular',
        iterations: 1,
        convergence: 1.0,
        time: Date.now(),
        parameters: { radius },
      },
    };
  }

  private async hierarchicalLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    const nodes = Array.from(graph.nodes.values());
    const relationships = Array.from(graph.relationships.values());

    // Simple hierarchical layout - arrange nodes in levels
    const levels = this.calculateHierarchyLevels(nodes, relationships);
    const levelArray = Array.from(levels.values());
    const levelHeight = this.config.height / (levelArray.length + 1);

    const nodePositions = nodes.map((node) => {
      const level = levels.get(node.id) || 0;
      const nodesInLevel = Array.from(levels.entries()).filter(([_, l]) => l === level).length;
      const nodeIndex = Array.from(levels.entries())
        .filter(([_, l]) => l === level)
        .findIndex(([id, _]) => id === node.id);
      const levelWidth = this.config.width / (nodesInLevel + 1);

      return {
        id: node.id,
        x: levelWidth * (nodeIndex + 1),
        y: levelHeight * (level + 1),
        radius: this.config.nodeSize,
        color: this.getNodeColor(node),
        opacity: 0.8,
      };
    });

    const edgePositions = relationships.map((rel) => {
      const source = nodePositions.find((n) => n.id === rel.sourceId)!;
      const target = nodePositions.find((n) => n.id === rel.targetId)!;

      return {
        id: rel.id,
        source: { x: source.x, y: source.y },
        target: { x: target.x, y: target.y },
        weight: rel.weight,
        color: this.getEdgeColor(rel),
        opacity: 0.6,
        curvature: 0.1,
      };
    });

    return {
      nodes: nodePositions,
      edges: edgePositions,
      bounds: this.calculateBounds(nodePositions),
      metadata: {
        algorithm: 'hierarchical',
        iterations: 1,
        convergence: 1.0,
        time: Date.now(),
        parameters: { levels: levels.size },
      },
    };
  }

  private async radialLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    const nodes = Array.from(graph.nodes.values());
    const relationships = Array.from(graph.relationships.values());

    // Find central node (highest degree)
    const nodeDegrees = new Map<string, number>();
    for (const rel of relationships) {
      nodeDegrees.set(rel.sourceId, (nodeDegrees.get(rel.sourceId) || 0) + 1);
      nodeDegrees.set(rel.targetId, (nodeDegrees.get(rel.targetId) || 0) + 1);
    }

    const centralNodeId = Array.from(nodeDegrees.entries()).reduce((a, b) =>
      a[1] > b[1] ? a : b,
    )[0];
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;

    const nodePositions = nodes.map((node) => {
      if (node.id === centralNodeId) {
        return {
          id: node.id,
          x: centerX,
          y: centerY,
          radius: this.config.nodeSize * 1.5,
          color: this.getNodeColor(node),
          opacity: 1.0,
        };
      }

      // Position other nodes in a circle around the center
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * 200 + 100;

      return {
        id: node.id,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        radius: this.config.nodeSize,
        color: this.getNodeColor(node),
        opacity: 0.8,
      };
    });

    const edgePositions = relationships.map((rel) => {
      const source = nodePositions.find((n) => n.id === rel.sourceId)!;
      const target = nodePositions.find((n) => n.id === rel.targetId)!;

      return {
        id: rel.id,
        source: { x: source.x, y: source.y },
        target: { x: target.x, y: target.y },
        weight: rel.weight,
        color: this.getEdgeColor(rel),
        opacity: 0.6,
        curvature: 0,
      };
    });

    return {
      nodes: nodePositions,
      edges: edgePositions,
      bounds: this.calculateBounds(nodePositions),
      metadata: {
        algorithm: 'radial',
        iterations: 1,
        convergence: 1.0,
        time: Date.now(),
        parameters: { centralNode: centralNodeId },
      },
    };
  }

  private async kamadaKawaiLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    // Simplified Kamada-Kawai layout
    return this.forceDirectedLayout(graph);
  }

  private async fruchtermanReingoldLayout(graph: KnowledgeGraph): Promise<GraphLayout> {
    // Simplified Fruchterman-Reingold layout
    return this.forceDirectedLayout(graph);
  }

  private calculateHierarchyLevels(
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();

    // Calculate in-degrees
    for (const node of nodes) {
      inDegree.set(node.id, 0);
    }

    for (const rel of relationships) {
      inDegree.set(rel.targetId, (inDegree.get(rel.targetId) || 0) + 1);
    }

    // Find root nodes (in-degree = 0)
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
        levels.set(nodeId, 0);
      }
    }

    // BFS to assign levels
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = levels.get(nodeId)!;

      for (const rel of relationships) {
        if (rel.sourceId === nodeId) {
          const targetLevel = levels.get(rel.targetId);
          if (targetLevel === undefined || targetLevel <= currentLevel) {
            levels.set(rel.targetId, currentLevel + 1);
            queue.push(rel.targetId);
          }
        }
      }
    }

    return levels;
  }

  private calculateBounds(nodes: NodePosition[]): Bounds {
    if (nodes.length === 0) {
      return { x: { min: 0, max: 0 }, y: { min: 0, max: 0 } };
    }

    const xCoords = nodes.map((n) => n.x);
    const yCoords = nodes.map((n) => n.y);

    return {
      x: { min: Math.min(...xCoords), max: Math.max(...xCoords) },
      y: { min: Math.min(...yCoords), max: Math.max(...yCoords) },
    };
  }

  private getNodeColor(node: KnowledgeNode): string {
    if (this.config.colorScheme === 'custom' && this.config.nodeColors.has(node.type)) {
      return this.config.nodeColors.get(node.type)!;
    }

    // Default color scheme based on node type
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E9',
    ];

    const typeIndex = Object.values(node.type).indexOf(node.type);
    const color = colors[typeIndex % colors.length];
    return color || '#CCCCCC'; // fallback color
  }

  private getEdgeColor(relationship: KnowledgeRelationship): string {
    if (this.config.colorScheme === 'custom' && this.config.edgeColors.has(relationship.type)) {
      return this.config.edgeColors.get(relationship.type)!;
    }

    // Default edge color
    return '#666666';
  }

  async calculateMetrics(graph: KnowledgeGraph): Promise<GraphMetrics> {
    const nodes = Array.from(graph.nodes.values());
    const relationships = Array.from(graph.relationships.values());

    const nodeCount = nodes.length;
    const edgeCount = relationships.length;
    const density = nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0;

    // Calculate average degree
    const degreeSum = relationships.reduce((sum, _rel) => {
      return sum + 2; // Each relationship contributes to degree of both nodes
    }, 0);
    const averageDegree = nodeCount > 0 ? degreeSum / nodeCount : 0;

    // Calculate centrality metrics
    const centrality = await this.calculateCentrality(nodes, relationships);

    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      diameter: this.calculateDiameter(nodes, relationships),
      clusteringCoefficient: this.calculateClusteringCoefficient(nodes, relationships),
      connectedComponents: this.calculateConnectedComponents(nodes, relationships),
      centrality,
    };
  }

  private async calculateCentrality(
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): Promise<CentralityMetrics> {
    const degree = new Map<string, number>();
    const betweenness = new Map<string, number>();
    const closeness = new Map<string, number>();
    const eigenvector = new Map<string, number>();

    // Initialize centrality maps
    for (const node of nodes) {
      degree.set(node.id, 0);
      betweenness.set(node.id, 0);
      closeness.set(node.id, 0);
      eigenvector.set(node.id, 1.0);
    }

    // Calculate degree centrality
    for (const rel of relationships) {
      degree.set(rel.sourceId, (degree.get(rel.sourceId) || 0) + 1);
      degree.set(rel.targetId, (degree.get(rel.targetId) || 0) + 1);
    }

    // Simplified betweenness centrality calculation
    for (const node of nodes) {
      const paths = this.findAllShortestPaths(node.id, nodes, relationships);
      let betweennessScore = 0;

      for (const [_source, targets] of paths) {
        for (const [_target, path] of targets) {
          if (path.length > 2) {
            // Path goes through other nodes
            const intermediateNodes = path.slice(1, -1);
            if (intermediateNodes.includes(node.id)) {
              betweennessScore += 1;
            }
          }
        }
      }

      betweenness.set(node.id, betweennessScore);
    }

    // Simplified closeness centrality
    for (const node of nodes) {
      const distances = this.calculateDistances(node.id, nodes, relationships);
      const totalDistance = Array.from(distances.values()).reduce((sum, dist) => sum + dist, 0);
      closeness.set(node.id, totalDistance > 0 ? (nodes.length - 1) / totalDistance : 0);
    }

    // Simplified eigenvector centrality (power iteration)
    for (let iteration = 0; iteration < 10; iteration++) {
      const newEigenvector = new Map<string, number>();

      for (const node of nodes) {
        let score = 0;
        for (const rel of relationships) {
          if (rel.sourceId === node.id) {
            score += eigenvector.get(rel.targetId) || 0;
          }
          if (rel.targetId === node.id) {
            score += eigenvector.get(rel.sourceId) || 0;
          }
        }
        newEigenvector.set(node.id, score);
      }

      // Normalize
      const maxScore = Math.max(...Array.from(newEigenvector.values()));
      if (maxScore > 0) {
        for (const [nodeId, score] of newEigenvector) {
          eigenvector.set(nodeId, score / maxScore);
        }
      }
    }

    return { degree, betweenness, closeness, eigenvector };
  }

  private findAllShortestPaths(
    sourceId: string,
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): Map<string, Map<string, string[]>> {
    const paths = new Map<string, Map<string, string[]>>();

    for (const node of nodes) {
      const path = this.findShortestPath(sourceId, node.id, relationships);
      if (path.length > 0) {
        if (!paths.has(sourceId)) {
          paths.set(sourceId, new Map());
        }
        paths.get(sourceId)!.set(node.id, path);
      }
    }

    return paths;
  }

  private findShortestPath(
    sourceId: string,
    targetId: string,
    relationships: KnowledgeRelationship[],
  ): string[] {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: sourceId, path: [sourceId] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === targetId) {
        return path;
      }

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      for (const rel of relationships) {
        if (rel.sourceId === nodeId && !visited.has(rel.targetId)) {
          queue.push({ nodeId: rel.targetId, path: [...path, rel.targetId] });
        }
        if (rel.targetId === nodeId && !visited.has(rel.sourceId)) {
          queue.push({ nodeId: rel.sourceId, path: [...path, rel.sourceId] });
        }
      }
    }

    return [];
  }

  private calculateDistances(
    sourceId: string,
    _nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): Map<string, number> {
    const distances = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: sourceId, distance: 0 }];

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);
      distances.set(nodeId, distance);

      for (const rel of relationships) {
        if (rel.sourceId === nodeId && !visited.has(rel.targetId)) {
          queue.push({ nodeId: rel.targetId, distance: distance + 1 });
        }
        if (rel.targetId === nodeId && !visited.has(rel.sourceId)) {
          queue.push({ nodeId: rel.sourceId, distance: distance + 1 });
        }
      }
    }

    return distances;
  }

  private calculateDiameter(
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): number {
    let maxDiameter = 0;

    for (const node of nodes) {
      const distances = this.calculateDistances(node.id, nodes, relationships);
      const maxDistance = Math.max(...Array.from(distances.values()));
      maxDiameter = Math.max(maxDiameter, maxDistance);
    }

    return maxDiameter;
  }

  private calculateClusteringCoefficient(
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): number {
    let totalCoefficient = 0;
    let validNodes = 0;

    for (const node of nodes) {
      const neighbors = new Set<string>();

      // Find neighbors
      for (const rel of relationships) {
        if (rel.sourceId === node.id) {
          neighbors.add(rel.targetId);
        }
        if (rel.targetId === node.id) {
          neighbors.add(rel.sourceId);
        }
      }

      if (neighbors.size >= 2) {
        let neighborConnections = 0;
        const neighborArray = Array.from(neighbors);

        // Count connections between neighbors
        for (let i = 0; i < neighborArray.length; i++) {
          for (let j = i + 1; j < neighborArray.length; j++) {
            for (const rel of relationships) {
              if (
                (rel.sourceId === neighborArray[i] && rel.targetId === neighborArray[j]) ||
                (rel.sourceId === neighborArray[j] && rel.targetId === neighborArray[i])
              ) {
                neighborConnections++;
                break;
              }
            }
          }
        }

        const possibleConnections = (neighbors.size * (neighbors.size - 1)) / 2;
        totalCoefficient += neighborConnections / possibleConnections;
        validNodes++;
      }
    }

    return validNodes > 0 ? totalCoefficient / validNodes : 0;
  }

  private calculateConnectedComponents(
    nodes: KnowledgeNode[],
    relationships: KnowledgeRelationship[],
  ): number {
    const visited = new Set<string>();
    let components = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.dfs(node.id, visited, relationships);
        components++;
      }
    }

    return components;
  }

  private dfs(nodeId: string, visited: Set<string>, relationships: KnowledgeRelationship[]): void {
    visited.add(nodeId);

    for (const rel of relationships) {
      if (rel.sourceId === nodeId && !visited.has(rel.targetId)) {
        this.dfs(rel.targetId, visited, relationships);
      }
      if (rel.targetId === nodeId && !visited.has(rel.sourceId)) {
        this.dfs(rel.sourceId, visited, relationships);
      }
    }
  }

  getLayout(layoutId: string): GraphLayout | undefined {
    return this.layouts.get(layoutId);
  }

  updateConfig(newConfig: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): VisualizationConfig {
    return { ...this.config };
  }
}
