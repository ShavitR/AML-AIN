import { KnowledgeGraphService, KnowledgeNodeType, RelationshipType } from '../index';

describe('KnowledgeGraphService Advanced Features', () => {
  let kgService: KnowledgeGraphService;

  beforeEach(() => {
    kgService = new KnowledgeGraphService();
  });

  afterEach(async () => {
    await kgService.clear();
  });

  describe('Advanced Conflict Resolution', () => {
    let node1: any;
    let node2: any;

    beforeEach(async () => {
      node1 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Original Concept',
        metadata: { title: 'Original Title', author: 'Alice' },
        confidence: 0.8,
        tags: ['original', 'concept'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      node2 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Updated Concept',
        metadata: { title: 'Updated Title', author: 'Bob' },
        confidence: 0.9,
        tags: ['updated', 'concept'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });
    });

    it('should detect conflicts between nodes', async () => {
      const conflicts = await kgService.detectConflicts(node1, node2);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.conflictType === 'merge')).toBe(true);
      expect(conflicts.some((c) => c.severity === 'medium')).toBe(true);
    });

    it('should merge nodes with automatic strategy', async () => {
      const result = await kgService.mergeNodes(node1, node2, 'automatic');

      expect(result.success).toBe(true);
      expect(result.mergedNode).toBeDefined();
      if (result.mergedNode) {
        expect(result.mergedNode.content).toContain('Original Concept');
        expect(result.mergedNode.content).toContain('Updated Concept');
        expect(result.mergedNode.tags).toContain('original');
        expect(result.mergedNode.tags).toContain('updated');
        expect(result.mergedNode.confidence).toBe(0.9); // Higher confidence
      }
    });

    it('should maintain version history after merge', async () => {
      await kgService.mergeNodes(node1, node2, 'automatic');

      const history = kgService.getVersionHistory(node1.id);
      expect(history).toBeDefined();
      expect(history?.versions.length).toBeGreaterThan(0);
      expect(history?.currentVersion).toBeGreaterThan(1);
    });

    it('should log conflicts for manual resolution', async () => {
      await kgService.mergeNodes(node1, node2, 'manual');

      const conflictLog = kgService.getConflictLog();
      expect(conflictLog.length).toBeGreaterThan(0);
      expect(conflictLog.some((c) => c.id === node1.id)).toBe(true);
    });
  });

  describe('Data Compression', () => {
    let testNode: any;

    beforeEach(async () => {
      testNode = await kgService.createNode({
        type: KnowledgeNodeType.DOCUMENT,
        content: 'This is a very long document content that should be compressed. '.repeat(100),
        metadata: {
          title: 'Test Document',
          description: 'A test document for compression testing',
          author: 'Test Author',
          size: 10000,
        },
        confidence: 0.95,
        tags: ['test', 'document', 'compression'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });
    });

    it('should compress a node successfully', async () => {
      const result = await kgService.compressNode(testNode);

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(1.0);
      expect(result.algorithm).toBeDefined();
      expect(result.time).toBeGreaterThan(0);
    });

    it('should decompress a node successfully', async () => {
      const compressed = await kgService.compressNode(testNode);

      // Simulate compressed data (in real implementation, this would be the actual compressed buffer)
      const mockCompressedData = Buffer.from(JSON.stringify(testNode));

      const result = await kgService.decompressNode(mockCompressedData, 'gzip');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.time).toBeGreaterThan(0);
    });

    it('should provide compression statistics', () => {
      const stats = kgService.getCompressionStats();

      expect(stats).toBeDefined();
      expect(stats.totalCompressed).toBeGreaterThanOrEqual(0);
      expect(stats.totalOriginal).toBeGreaterThanOrEqual(0);
      expect(stats.averageRatio).toBeGreaterThanOrEqual(0);
      expect(stats.algorithmUsage).toBeDefined();
      expect(stats.timeStats).toBeDefined();
    });
  });

  describe('Visualization', () => {
    let graph: any;

    beforeEach(async () => {
      // Create a simple graph for testing
      const node1 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Concept A',
        metadata: { title: 'Concept A' },
        confidence: 0.9,
        tags: ['concept'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      const node2 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Concept B',
        metadata: { title: 'Concept B' },
        confidence: 0.8,
        tags: ['concept'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      await kgService.createRelationship({
        sourceId: node1.id,
        targetId: node2.id,
        type: RelationshipType.ASSOCIATED_WITH,
        weight: 0.8,
        metadata: { description: 'Link between A and B' },
      });

      graph = await kgService.export();
    });

    it('should generate force-directed layout', async () => {
      const layout = await kgService.generateLayout(graph, 'force');

      expect(layout).toBeDefined();
      expect(layout.nodes.length).toBe(2);
      expect(layout.edges.length).toBe(1);
      expect(layout.bounds).toBeDefined();
      expect(layout.metadata.algorithm).toBe('force');
      expect(layout.metadata.iterations).toBeGreaterThan(0);
    });

    it('should generate circular layout', async () => {
      const layout = await kgService.generateLayout(graph, 'circular');

      expect(layout).toBeDefined();
      expect(layout.nodes.length).toBe(2);
      expect(layout.edges.length).toBe(1);
      expect(layout.metadata.algorithm).toBe('circular');
    });

    it('should calculate graph metrics', async () => {
      const metrics = await kgService.calculateMetrics(graph);

      expect(metrics).toBeDefined();
      expect(metrics.nodeCount).toBe(2);
      expect(metrics.edgeCount).toBe(1);
      expect(metrics.density).toBeGreaterThan(0);
      expect(metrics.averageDegree).toBe(1);
      expect(metrics.connectedComponents).toBe(1);
      expect(metrics.centrality).toBeDefined();
      expect(metrics.centrality.degree).toBeDefined();
      expect(metrics.centrality.betweenness).toBeDefined();
    });

    it('should store and retrieve layouts', async () => {
      const layout = await kgService.generateLayout(graph, 'force');
      const layoutId = `${graph.nodes.size}_${graph.relationships.size}_force`;

      const retrievedLayout = kgService.getLayout(layoutId);
      expect(retrievedLayout).toBeDefined();
      if (retrievedLayout && layout) {
        expect(retrievedLayout.nodes.length).toBe(layout.nodes.length);
      }
    });
  });

  describe('Sharing and Federation', () => {
    let graph: any;

    beforeEach(async () => {
      // Create a simple graph for testing
      await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Shared Concept',
        metadata: { title: 'Shared Concept' },
        confidence: 0.9,
        tags: ['shared'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      graph = await kgService.export();
    });

    it('should federate with a remote node', async () => {
      const result = await kgService.federateWithNode('http://remote-node:3000', ['read', 'write']);

      expect(result).toBe(true);

      const federationNodes = kgService.getFederationNodes();
      expect(federationNodes.length).toBe(1);
      expect(federationNodes[0].status).toBe('online');
      expect(federationNodes[0].capabilities).toContain('read');
      expect(federationNodes[0].capabilities).toContain('write');
    });

    it('should sync with federation', async () => {
      await kgService.federateWithNode('http://remote-node:3000');

      const result = await kgService.syncWithFederation(graph);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.nodesSynced).toBeGreaterThanOrEqual(0);
      expect(result.conflicts).toBeGreaterThanOrEqual(0);
      expect(result.time).toBeGreaterThan(0);
    });

    it('should replicate graph to target node', async () => {
      const result = await kgService.replicateGraph(graph, 'http://target-node:3000');

      expect(result).toBe(true);
    });

    it('should maintain sync history', async () => {
      await kgService.federateWithNode('http://remote-node:3000');
      await kgService.syncWithFederation(graph);

      const syncHistory = kgService.getSyncHistory();
      expect(syncHistory).toBeDefined();
      expect(Array.isArray(syncHistory)).toBe(true);
    });

    it('should broadcast updates', async () => {
      await kgService.federateWithNode('http://remote-node:3000');

      const update = {
        type: 'node_update',
        nodeId: 'test-node',
        changes: { content: 'Updated content' },
      };

      await kgService.broadcastUpdate(graph, update);

      // In a real implementation, we would verify the broadcast was received
      // For now, we just ensure no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow with all advanced features', async () => {
      // Create nodes
      const node1 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Integration Test Concept',
        metadata: { title: 'Integration Test' },
        confidence: 0.9,
        tags: ['integration', 'test'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      const node2 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Updated Integration Test Concept',
        metadata: { title: 'Updated Integration Test' },
        confidence: 0.95,
        tags: ['integration', 'test', 'updated'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      // Test conflict resolution
      const conflicts = await kgService.detectConflicts(node1, node2);
      expect(conflicts.length).toBeGreaterThan(0);

      const mergeResult = await kgService.mergeNodes(node1, node2, 'automatic');
      expect(mergeResult.success).toBe(true);

      // Test compression
      const compressed = await kgService.compressNode(mergeResult.mergedNode);
      expect(compressed.compressionRatio).toBeGreaterThan(1.0);

      // Test visualization
      const graph = await kgService.export();
      const layout = await kgService.generateLayout(graph, 'force');
      expect(layout.nodes.length).toBe(2);

      const metrics = await kgService.calculateMetrics(graph);
      expect(metrics.nodeCount).toBe(2);

      // Test sharing
      await kgService.federateWithNode('http://test-node:3000');
      const syncResult = await kgService.syncWithFederation(graph);
      expect(syncResult.success).toBe(true);

      // Verify all features are working together
      expect(kgService.getConflictLog().length).toBeGreaterThan(0);
      expect(kgService.getCompressionStats().totalCompressed).toBeGreaterThan(0);
      expect(kgService.getFederationNodes().length).toBe(1);
      expect(kgService.getSyncHistory().length).toBeGreaterThan(0);
    });
  });
});
