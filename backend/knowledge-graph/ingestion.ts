import type { KnowledgeNode, KnowledgeRelationship, KnowledgeIngestionResult } from './types';
import {
  IngestionError,
  KnowledgeNodeType,
  RelationshipType,
  KnowledgeValidationResult,
  ValidationError,
} from './types';
import type { KnowledgeGraphDatabase } from './database';
import type { KnowledgeValidator } from './validator';

export interface IngestionSource {
  type: 'json' | 'csv' | 'xml' | 'rdf' | 'text' | 'api';
  data: any;
  metadata?: {
    source: string;
    format: string;
    encoding?: string;
    timestamp?: Date;
  };
}

export interface IngestionOptions {
  validateOnIngestion: boolean;
  createRelationships: boolean;
  updateExisting: boolean;
  batchSize: number;
  maxErrors: number;
  source: string;
}

export class KnowledgeIngestionPipeline {
  private database: KnowledgeGraphDatabase;
  private validator: KnowledgeValidator;
  private defaultOptions: IngestionOptions = {
    validateOnIngestion: true,
    createRelationships: true,
    updateExisting: false,
    batchSize: 100,
    maxErrors: 10,
    source: 'unknown',
  };

  constructor(database: KnowledgeGraphDatabase, validator: KnowledgeValidator) {
    this.database = database;
    this.validator = validator;
  }

  async ingest(
    source: IngestionSource,
    options: Partial<IngestionOptions> = {},
  ): Promise<KnowledgeIngestionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const result: KnowledgeIngestionResult = {
      success: true,
      nodesCreated: 0,
      nodesUpdated: 0,
      relationshipsCreated: 0,
      relationshipsUpdated: 0,
      errors: [],
      warnings: [],
    };

    try {
      const parsedData = await this.parseSource(source);

      if (opts.validateOnIngestion) {
        const validation = await this.validator.validateIngestionData(parsedData);
        if (!validation.valid) {
          result.errors.push(
            ...validation.errors.map((error: any) => ({
              type: 'validation',
              message: error.message,
              data: error,
            })),
          );
          result.warnings.push(...validation.warnings);
          result.success = false;
        }
      }

      if (result.errors.length >= opts.maxErrors) {
        result.success = false;
        return result;
      }

      const ingestionResult = await this.processData(parsedData, opts);

      result.nodesCreated = ingestionResult.nodesCreated;
      result.nodesUpdated = ingestionResult.nodesUpdated;
      result.relationshipsCreated = ingestionResult.relationshipsCreated;
      result.relationshipsUpdated = ingestionResult.relationshipsUpdated;
      result.errors.push(...ingestionResult.errors);
      result.warnings.push(...ingestionResult.warnings);
    } catch (error: any) {
      result.success = false;
      result.errors.push({
        type: 'ingestion',
        message: error instanceof Error ? error.message : 'Unknown ingestion error',
        data: error,
      });
    }

    return result;
  }

  private async parseSource(
    source: IngestionSource,
  ): Promise<{ nodes: any[]; relationships: any[] }> {
    switch (source.type) {
      case 'json':
        return this.parseJSON(source.data);
      case 'csv':
        return this.parseCSV(source.data);
      case 'xml':
        return this.parseXML(source.data);
      case 'rdf':
        return this.parseRDF(source.data);
      case 'text':
        return this.parseText(source.data);
      case 'api':
        return this.parseAPI(source.data);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async parseJSON(data: any): Promise<{ nodes: any[]; relationships: any[] }> {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    if (Array.isArray(data)) {
      return {
        nodes: data.filter((item) => item.type && item.content),
        relationships: data.filter((item) => item.sourceId && item.targetId),
      };
    }

    if (data.nodes && data.relationships) {
      return {
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        relationships: Array.isArray(data.relationships) ? data.relationships : [],
      };
    }

    // Single node
    if (data.type && data.content) {
      return {
        nodes: [data],
        relationships: [],
      };
    }

    throw new Error('Invalid JSON format for knowledge graph data');
  }

  private async parseCSV(data: string): Promise<{ nodes: any[]; relationships: any[] }> {
    const lines = data.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      return { nodes: [], relationships: [] };
    }

    const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
    const nodes: any[] = [];
    const relationships: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        continue;
      }

      const values = line.split(',').map((v) => v.trim()) || [];
      const row: any = {};

      headers.forEach((header, index) => {
        if (header) {
          row[header] = values[index] || '';
        }
      });

      if (row.type && row.content) {
        nodes.push(row);
      } else if (row.sourceId && row.targetId) {
        relationships.push(row);
      }
    }

    return { nodes, relationships };
  }

  private async parseXML(data: string): Promise<{ nodes: any[]; relationships: any[] }> {
    // Simple XML parsing - in production, use a proper XML parser
    const nodes: any[] = [];
    const relationships: any[] = [];

    const nodeMatches = data.match(/<node[^>]*>[\s\S]*?<\/node>/g) || [];
    const relationshipMatches = data.match(/<relationship[^>]*>[\s\S]*?<\/relationship>/g) || [];

    for (const match of nodeMatches) {
      const node = this.parseXMLElement(match, 'node');
      if (node) {
        nodes.push(node);
      }
    }

    for (const match of relationshipMatches) {
      const relationship = this.parseXMLElement(match, 'relationship');
      if (relationship) {
        relationships.push(relationship);
      }
    }

    return { nodes, relationships };
  }

  private parseXMLElement(xml: string, tag: string): any {
    const contentMatch = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    if (!contentMatch) {
      return null;
    }

    const content = contentMatch[1];
    const attributes: any = {};

    // Extract attributes
    const attrMatches = xml.match(new RegExp(`<${tag}\\s+([^>]*)>`));
    if (attrMatches) {
      const attrString = attrMatches[1];
      const attrRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(attrString)) !== null) {
        attributes[match[1]] = match[2];
      }
    }

    return { ...attributes, content };
  }

  private async parseRDF(data: string): Promise<{ nodes: any[]; relationships: any[] }> {
    // Simple RDF parsing - in production, use a proper RDF parser
    const nodes: any[] = [];
    const relationships: any[] = [];
    const subjects = new Map<string, any>();

    const lines = data.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const match = line.match(/<([^>]+)>\s+<([^>]+)>\s+(.+)/);
      if (match) {
        const [, subject, predicate, object] = match;

        if (subject && predicate && object) {
          if (!subjects.has(subject)) {
            subjects.set(subject, {
              id: subject,
              type: KnowledgeNodeType.CONCEPT,
              content: subject,
              metadata: { title: subject },
            });
          }

          if (predicate.includes('type')) {
            // This is a type declaration
            const node = subjects.get(subject);
            if (node) {
              node.type = object.replace(/[<>]/g, '');
            }
          } else {
            // This is a relationship
            relationships.push({
              sourceId: subject,
              targetId: object.replace(/[<>]/g, ''),
              type: RelationshipType.ASSOCIATED_WITH,
              weight: 1.0,
              metadata: { description: predicate },
            });
          }
        }
      }
    }

    return {
      nodes: Array.from(subjects.values()),
      relationships,
    };
  }

  private async parseText(data: string): Promise<{ nodes: any[]; relationships: any[] }> {
    // Simple text parsing - extract concepts and basic relationships
    const nodes: any[] = [];
    const relationships: any[] = [];
    const concepts = new Set<string>();

    // Extract potential concepts (capitalized words)
    const conceptMatches = data.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    conceptMatches.forEach((concept) => {
      concepts.add(concept);
    });

    // Create nodes for concepts
    concepts.forEach((concept) => {
      nodes.push({
        type: KnowledgeNodeType.CONCEPT,
        content: concept,
        metadata: {
          title: concept,
          description: `Concept extracted from text: ${concept}`,
        },
        confidence: 0.5,
        tags: ['extracted', 'text'],
        accessControl: {
          owner: 'system',
          permissions: [],
          groups: [],
          public: true,
        },
      });
    });

    // Extract basic relationships (A is B, A has B, etc.)
    const relationshipPatterns = [
      /(\w+)\s+is\s+(\w+)/gi,
      /(\w+)\s+has\s+(\w+)/gi,
      /(\w+)\s+contains\s+(\w+)/gi,
    ];

    relationshipPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(data)) !== null) {
        const [, source, target] = match;
        if (concepts.has(source) && concepts.has(target)) {
          relationships.push({
            sourceId: source,
            targetId: target,
            type: RelationshipType.ASSOCIATED_WITH,
            weight: 0.5,
            metadata: {
              description: 'Relationship extracted from text',
              confidence: 0.3,
            },
          });
        }
      }
    });

    return { nodes, relationships };
  }

  private async parseAPI(data: any): Promise<{ nodes: any[]; relationships: any[] }> {
    // Handle API responses - assume they follow a standard format
    if (Array.isArray(data)) {
      return {
        nodes: data.filter((item) => item.type && item.content),
        relationships: data.filter((item) => item.sourceId && item.targetId),
      };
    }

    if (data.data) {
      return this.parseAPI(data.data);
    }

    if (data.result) {
      return this.parseAPI(data.result);
    }

    // Try to extract nodes and relationships from any object structure
    const nodes: any[] = [];
    const relationships: any[] = [];

    this.extractFromObject(data, nodes, relationships);

    return { nodes, relationships };
  }

  private extractFromObject(obj: any, nodes: any[], relationships: any[]): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    // Check if this object looks like a node
    if (obj.type && obj.content) {
      nodes.push(obj);
      return;
    }

    // Check if this object looks like a relationship
    if (obj.sourceId && obj.targetId) {
      relationships.push(obj);
      return;
    }

    // Recursively search for nodes and relationships
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        this.extractFromObject(obj[key], nodes, relationships);
      }
    }
  }

  private async processData(
    parsedData: { nodes: any[]; relationships: any[] },
    options: IngestionOptions,
  ): Promise<KnowledgeIngestionResult> {
    const result: KnowledgeIngestionResult = {
      success: true,
      nodesCreated: 0,
      nodesUpdated: 0,
      relationshipsCreated: 0,
      relationshipsUpdated: 0,
      errors: [],
      warnings: [],
    };

    // Process nodes in batches
    for (let i = 0; i < parsedData.nodes.length; i += options.batchSize) {
      const batch = parsedData.nodes.slice(i, i + options.batchSize);

      for (const nodeData of batch) {
        try {
          const node = await this.createNodeFromData(nodeData, options);
          if (node) {
            result.nodesCreated++;
          }
        } catch (error) {
          result.errors.push({
            type: 'node_creation',
            message: error instanceof Error ? error.message : 'Unknown error',
            data: nodeData,
            line: i + batch.indexOf(nodeData) + 1,
          });
        }
      }
    }

    // Process relationships if enabled
    if (options.createRelationships) {
      for (let i = 0; i < parsedData.relationships.length; i += options.batchSize) {
        const batch = parsedData.relationships.slice(i, i + options.batchSize);

        for (const relData of batch) {
          try {
            const relationship = await this.createRelationshipFromData(relData, options);
            if (relationship) {
              result.relationshipsCreated++;
            }
          } catch (error) {
            result.errors.push({
              type: 'relationship_creation',
              message: error instanceof Error ? error.message : 'Unknown error',
              data: relData,
              line: i + batch.indexOf(relData) + 1,
            });
          }
        }
      }
    }

    return result;
  }

  private async createNodeFromData(
    data: any,
    options: IngestionOptions,
  ): Promise<KnowledgeNode | null> {
    // Validate required fields
    if (!data.type || !data.content) {
      throw new Error('Node must have type and content');
    }

    // Check if node already exists (if updateExisting is true)
    let existingNode: KnowledgeNode | null = null;
    if (options.updateExisting && data.id) {
      existingNode = await this.database.getNode(data.id);
    }

    const nodeData: Partial<KnowledgeNode> = {
      type: data.type as KnowledgeNodeType,
      content: data.content,
      metadata: data.metadata || {},
      confidence: data.confidence || 1.0,
      tags: data.tags || [],
      accessControl: data.accessControl || {
        owner: 'system',
        permissions: [],
        groups: [],
        public: true,
      },
      source: options.source,
    };

    if (existingNode) {
      return await this.database.updateNode(data.id, nodeData);
    } else {
      return await this.database.createNode(nodeData as any);
    }
  }

  private async createRelationshipFromData(
    data: any,
    options: IngestionOptions,
  ): Promise<KnowledgeRelationship | null> {
    // Validate required fields
    if (!data.sourceId || !data.targetId || !data.type) {
      throw new Error('Relationship must have sourceId, targetId, and type');
    }

    // Verify that both nodes exist
    const sourceNode = await this.database.getNode(data.sourceId);
    const targetNode = await this.database.getNode(data.targetId);

    if (!sourceNode || !targetNode) {
      throw new Error(`Source or target node not found: ${data.sourceId} -> ${data.targetId}`);
    }

    const relationshipData = {
      sourceId: data.sourceId,
      targetId: data.targetId,
      type: data.type as RelationshipType,
      weight: data.weight || 1.0,
      metadata: data.metadata || {
        description: data.description || '',
        confidence: data.confidence || 1.0,
      },
    };

    return await this.database.createRelationship(relationshipData);
  }

  async ingestFromFile(
    filePath: string,
    options: Partial<IngestionOptions> = {},
  ): Promise<KnowledgeIngestionResult> {
    try {
      const fs = require('fs');
      const path = require('path');

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          nodesCreated: 0,
          nodesUpdated: 0,
          relationshipsCreated: 0,
          relationshipsUpdated: 0,
          errors: [
            {
              type: 'file_not_found',
              message: `File not found: ${filePath}`,
              data: { filePath },
            },
          ],
          warnings: [],
        };
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileExtension = path.extname(filePath).toLowerCase();

      let sourceType: 'json' | 'csv' | 'xml' | 'rdf' | 'text' = 'text';

      switch (fileExtension) {
        case '.json':
          sourceType = 'json';
          break;
        case '.csv':
          sourceType = 'csv';
          break;
        case '.xml':
          sourceType = 'xml';
          break;
        case '.rdf':
        case '.ttl':
        case '.n3':
          sourceType = 'rdf';
          break;
        default:
          sourceType = 'text';
      }

      const source: IngestionSource = {
        type: sourceType,
        data: fileContent,
        metadata: {
          source: filePath,
          format: fileExtension,
          timestamp: new Date(),
        },
      };

      return await this.ingest(source, {
        ...options,
        source: filePath,
      });
    } catch (error) {
      return {
        success: false,
        nodesCreated: 0,
        nodesUpdated: 0,
        relationshipsCreated: 0,
        relationshipsUpdated: 0,
        errors: [
          {
            type: 'file_ingestion',
            message: error instanceof Error ? error.message : 'Unknown file ingestion error',
            data: { filePath, error },
          },
        ],
        warnings: [],
      };
    }
  }

  async ingestFromAPI(
    apiUrl: string,
    options: Partial<IngestionOptions> = {},
  ): Promise<KnowledgeIngestionResult> {
    try {
      const https = require('https');
      const http = require('http');
      const url = require('url');

      const parsedUrl = url.parse(apiUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const response = await new Promise<any>((resolve, reject) => {
        const req = client.get(apiUrl, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, data });
          });
        });

        req.on('error', (error: any) => {
          reject(error);
        });

        req.setTimeout(30000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });

      if (response.statusCode !== 200) {
        return {
          success: false,
          nodesCreated: 0,
          nodesUpdated: 0,
          relationshipsCreated: 0,
          relationshipsUpdated: 0,
          errors: [
            {
              type: 'api_error',
              message: `API returned status code: ${response.statusCode}`,
              data: { apiUrl, statusCode: response.statusCode },
            },
          ],
          warnings: [],
        };
      }

      let parsedData;
      try {
        parsedData = JSON.parse(response.data);
      } catch (parseError) {
        return {
          success: false,
          nodesCreated: 0,
          nodesUpdated: 0,
          relationshipsCreated: 0,
          relationshipsUpdated: 0,
          errors: [
            {
              type: 'parse_error',
              message: 'Failed to parse API response as JSON',
              data: { apiUrl, error: parseError },
            },
          ],
          warnings: [],
        };
      }

      const source: IngestionSource = {
        type: 'api',
        data: parsedData,
        metadata: {
          source: apiUrl,
          format: 'json',
          timestamp: new Date(),
        },
      };

      return await this.ingest(source, {
        ...options,
        source: apiUrl,
      });
    } catch (error) {
      return {
        success: false,
        nodesCreated: 0,
        nodesUpdated: 0,
        relationshipsCreated: 0,
        relationshipsUpdated: 0,
        errors: [
          {
            type: 'api_ingestion',
            message: error instanceof Error ? error.message : 'Unknown API ingestion error',
            data: { apiUrl, error },
          },
        ],
        warnings: [],
      };
    }
  }
}
