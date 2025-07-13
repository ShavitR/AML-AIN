import { KnowledgeGraphService, KnowledgeNodeType, RelationshipType } from '../index';

describe('KnowledgeGraphService', () => {
  let kgService: KnowledgeGraphService;

  beforeEach(() => {
    kgService = new KnowledgeGraphService();
  });

  afterEach(async () => {
    await kgService.clear();
  });

  describe('Node Operations', () => {
    it('should create a node successfully', async () => {
      const nodeData = {
        type: KnowledgeNodeType.CONCEPT,
        content: 'Test Concept',
        metadata: {
          title: 'Test Concept',
          description: 'A test concept',
        },
        confidence: 0.9,
        tags: ['test'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      };

      const node = await kgService.createNode(nodeData);

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.type).toBe(KnowledgeNodeType.CONCEPT);
      expect(node.content).toBe('Test Concept');
      expect(node.createdAt).toBeInstanceOf(Date);
      expect(node.updatedAt).toBeInstanceOf(Date);
      expect(node.version).toBe(1);
    });

    it('should retrieve a node by ID', async () => {
      const nodeData = {
        type: KnowledgeNodeType.FACT,
        content: 'Test Fact',
        metadata: { title: 'Test Fact' },
        confidence: 0.8,
        tags: ['test'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      };

      const createdNode = await kgService.createNode(nodeData);
      const retrievedNode = await kgService.getNode(createdNode.id);

      expect(retrievedNode).toBeDefined();
      expect(retrievedNode?.id).toBe(createdNode.id);
      expect(retrievedNode?.content).toBe('Test Fact');
    });

    it('should update a node successfully', async () => {
      const nodeData = {
        type: KnowledgeNodeType.CONCEPT,
        content: 'Original Content',
        metadata: { title: 'Original Title' },
        confidence: 0.7,
        tags: ['original'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      };

      const node = await kgService.createNode(nodeData);
      const updatedNode = await kgService.updateNode(node.id, {
        content: 'Updated Content',
        metadata: { title: 'Updated Title' },
      });

      expect(updatedNode).toBeDefined();
      expect(updatedNode?.content).toBe('Updated Content');
      expect(updatedNode?.metadata.title).toBe('Updated Title');
      expect(updatedNode?.version).toBe(2);
    });

    it('should delete a node successfully', async () => {
      const nodeData = {
        type: KnowledgeNodeType.CONCEPT,
        content: 'To Delete',
        metadata: { title: 'To Delete' },
        confidence: 0.5,
        tags: ['delete'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      };

      const node = await kgService.createNode(nodeData);
      const deleteResult = await kgService.deleteNode(node.id);
      const retrievedNode = await kgService.getNode(node.id);

      expect(deleteResult).toBe(true);
      expect(retrievedNode).toBeNull();
    });
  });

  describe('Relationship Operations', () => {
    let sourceNode: any;
    let targetNode: any;

    beforeEach(async () => {
      sourceNode = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Source Concept',
        metadata: { title: 'Source' },
        confidence: 0.9,
        tags: ['source'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      targetNode = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Target Concept',
        metadata: { title: 'Target' },
        confidence: 0.9,
        tags: ['target'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });
    });

    it('should create a relationship successfully', async () => {
      const relationshipData = {
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: RelationshipType.ASSOCIATED_WITH,
        weight: 0.8,
        metadata: {
          description: 'Test relationship',
          confidence: 0.8,
        },
      };

      const relationship = await kgService.createRelationship(relationshipData);

      expect(relationship).toBeDefined();
      expect(relationship.id).toBeDefined();
      expect(relationship.sourceId).toBe(sourceNode.id);
      expect(relationship.targetId).toBe(targetNode.id);
      expect(relationship.type).toBe(RelationshipType.ASSOCIATED_WITH);
    });

    it('should retrieve a relationship by ID', async () => {
      const relationshipData = {
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: RelationshipType.USES,
        weight: 0.7,
        metadata: {
          description: 'Uses relationship',
          confidence: 0.7,
        },
      };

      const createdRel = await kgService.createRelationship(relationshipData);
      const retrievedRel = await kgService.getRelationship(createdRel.id);

      expect(retrievedRel).toBeDefined();
      expect(retrievedRel?.id).toBe(createdRel.id);
      expect(retrievedRel?.type).toBe(RelationshipType.USES);
    });

    it('should update a relationship successfully', async () => {
      const relationshipData = {
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: RelationshipType.DEPENDS_ON,
        weight: 0.6,
        metadata: {
          description: 'Original description',
          confidence: 0.6,
        },
      };

      const relationship = await kgService.createRelationship(relationshipData);
      const updatedRel = await kgService.updateRelationship(relationship.id, {
        weight: 0.9,
        metadata: {
          description: 'Updated description',
          confidence: 0.9,
        },
      });

      expect(updatedRel).toBeDefined();
      expect(updatedRel?.weight).toBe(0.9);
      expect(updatedRel?.metadata.description).toBe('Updated description');
    });

    it('should delete a relationship successfully', async () => {
      const relationshipData = {
        sourceId: sourceNode.id,
        targetId: targetNode.id,
        type: RelationshipType.SIMILAR_TO,
        weight: 0.5,
        metadata: {
          description: 'Similar relationship',
          confidence: 0.5,
        },
      };

      const relationship = await kgService.createRelationship(relationshipData);
      const deleteResult = await kgService.deleteRelationship(relationship.id);
      const retrievedRel = await kgService.getRelationship(relationship.id);

      expect(deleteResult).toBe(true);
      expect(retrievedRel).toBeNull();
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Machine Learning',
        metadata: { title: 'Machine Learning' },
        confidence: 0.9,
        tags: ['ai', 'ml'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      await kgService.createNode({
        type: KnowledgeNodeType.ALGORITHM,
        content: 'Random Forest',
        metadata: { title: 'Random Forest Algorithm' },
        confidence: 0.8,
        tags: ['algorithm', 'ensemble'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });
    });

    it('should search for nodes by text', async () => {
      const results = await kgService.search('Machine Learning');

      expect(results.nodes.length).toBeGreaterThan(0);
      expect(results.total).toBeGreaterThan(0);
      expect(results.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should search for nodes by type', async () => {
      const results = await kgService.searchByType(KnowledgeNodeType.CONCEPT);

      expect(results.nodes.length).toBeGreaterThan(0);
      expect(results.nodes.every((node) => node.type === KnowledgeNodeType.CONCEPT)).toBe(true);
    });

    it('should search for nodes by tag', async () => {
      const results = await kgService.searchByTag('ai');

      expect(results.nodes.length).toBeGreaterThan(0);
      expect(results.nodes.some((node) => node.tags.includes('ai'))).toBe(true);
    });
  });

  describe('Graph Operations', () => {
    let node1: any;
    let node2: any;
    let node3: any;

    beforeEach(async () => {
      node1 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Concept 1',
        metadata: { title: 'Concept 1' },
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

      node2 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Concept 2',
        metadata: { title: 'Concept 2' },
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

      node3 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Concept 3',
        metadata: { title: 'Concept 3' },
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

      await kgService.createRelationship({
        sourceId: node1.id,
        targetId: node2.id,
        type: RelationshipType.ASSOCIATED_WITH,
        weight: 0.8,
        metadata: { description: 'Link 1-2', confidence: 0.8 },
      });

      await kgService.createRelationship({
        sourceId: node2.id,
        targetId: node3.id,
        type: RelationshipType.ASSOCIATED_WITH,
        weight: 0.8,
        metadata: { description: 'Link 2-3', confidence: 0.8 },
      });
    });

    it('should get graph statistics', async () => {
      const stats = await kgService.getGraphStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.totalRelationships).toBe(2);
      expect(stats.averageDegree).toBeGreaterThan(0);
      expect(stats.density).toBeGreaterThan(0);
      expect(stats.connectedComponents).toBe(1);
    });

    it('should find connected nodes', async () => {
      const connectedNodes = await kgService.getConnectedNodes(node1.id, 2);

      expect(connectedNodes.size).toBe(3); // node1, node2, node3
      expect(connectedNodes.has(node1.id)).toBe(true);
      expect(connectedNodes.has(node2.id)).toBe(true);
      expect(connectedNodes.has(node3.id)).toBe(true);
    });

    it('should find shortest path between nodes', async () => {
      const path = await kgService.findShortestPath(node1.id, node3.id);

      expect(path.length).toBe(2); // Two relationships: 1->2->3
    });
  });

  describe('Validation', () => {
    it('should validate a valid node', async () => {
      const nodeData = {
        type: KnowledgeNodeType.CONCEPT,
        content: 'Valid Concept',
        metadata: { title: 'Valid Concept' },
        confidence: 0.9,
        tags: ['valid'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
      };

      const validation = await kgService.validateNode(nodeData);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should reject an invalid node', async () => {
      const nodeData = {
        // Missing required fields
        content: 'Invalid Concept',
      };

      const validation = await kgService.validateNode(nodeData);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate a valid relationship', async () => {
      const node1 = await kgService.createNode({
        type: KnowledgeNodeType.CONCEPT,
        content: 'Source',
        metadata: { title: 'Source' },
        confidence: 0.9,
        tags: ['source'],
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
        content: 'Target',
        metadata: { title: 'Target' },
        confidence: 0.9,
        tags: ['target'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
        source: 'test',
      });

      const relData = {
        sourceId: node1.id,
        targetId: node2.id,
        type: RelationshipType.ASSOCIATED_WITH,
        weight: 0.8,
        metadata: { description: 'Valid relationship', confidence: 0.8 },
      };

      const validation = await kgService.validateRelationship(relData);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('Ingestion', () => {
    it('should ingest JSON data successfully', async () => {
      const jsonData = {
        type: 'json',
        data: {
          nodes: [
            {
              type: KnowledgeNodeType.FACT,
              content: 'Test Fact',
              metadata: { title: 'Test Fact' },
              confidence: 0.9,
              tags: ['test'],
              accessControl: {
                owner: 'system',
                permissions: [],
                groups: [],
                public: true,
              },
            },
          ],
          relationships: [],
        },
      };

      const result = await kgService.ingest(jsonData, {
        source: 'test-json',
        validateOnIngestion: true,
      });

      expect(result.success).toBe(true);
      expect(result.nodesCreated).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should handle ingestion errors gracefully', async () => {
      const invalidData = {
        type: 'json',
        data: {
          nodes: [
            {
              // Missing required fields
              content: 'Invalid Node',
            },
          ],
          relationships: [],
        },
      };

      const result = await kgService.ingest(invalidData, {
        source: 'test-invalid',
        validateOnIngestion: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
