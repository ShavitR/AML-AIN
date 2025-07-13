import {
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeValidationResult,
  ValidationError,
  KnowledgeNodeType,
  RelationshipType,
  KnowledgeGraphDatabase
} from './types';

export class KnowledgeValidator {
  private database: KnowledgeGraphDatabase;

  constructor(database: KnowledgeGraphDatabase) {
    this.database = database;
  }

  async validateNode(node: Partial<KnowledgeNode>): Promise<KnowledgeValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    if (!node.type) {
      errors.push({
        type: 'missing_field',
        message: 'Node type is required',
        field: 'type'
      });
    } else if (!Object.values(KnowledgeNodeType).includes(node.type as KnowledgeNodeType)) {
      errors.push({
        type: 'invalid_field',
        message: `Invalid node type: ${node.type}`,
        field: 'type',
        value: node.type
      });
    }

    if (!node.content) {
      errors.push({
        type: 'missing_field',
        message: 'Node content is required',
        field: 'content'
      });
    }

    if (!node.metadata) {
      warnings.push('Node metadata is missing');
      suggestions.push('Add metadata to improve node discoverability');
    }

    if (!node.accessControl) {
      warnings.push('Node access control is missing');
      suggestions.push('Add access control to secure the node');
    }

    // Content validation based on type
    if (node.type && node.content) {
      const contentValidation = this.validateContentByType(node.type as KnowledgeNodeType, node.content);
      errors.push(...contentValidation.errors);
      warnings.push(...contentValidation.warnings);
    }

    // Metadata validation
    if (node.metadata) {
      const metadataValidation = this.validateMetadata(node.metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);
    }

    // Access control validation
    if (node.accessControl) {
      const accessValidation = this.validateAccessControl(node.accessControl);
      errors.push(...accessValidation.errors);
      warnings.push(...accessValidation.warnings);
    }

    // Quality metrics validation
    if (node.metadata?.quality) {
      const qualityValidation = this.validateQualityMetrics(node.metadata.quality);
      errors.push(...qualityValidation.errors);
      warnings.push(...qualityValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  async validateRelationship(relationship: Partial<KnowledgeRelationship>): Promise<KnowledgeValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    if (!relationship.sourceId) {
      errors.push({
        type: 'missing_field',
        message: 'Source ID is required',
        field: 'sourceId'
      });
    }

    if (!relationship.targetId) {
      errors.push({
        type: 'missing_field',
        message: 'Target ID is required',
        field: 'targetId'
      });
    }

    if (!relationship.type) {
      errors.push({
        type: 'missing_field',
        message: 'Relationship type is required',
        field: 'type'
      });
    } else if (!Object.values(RelationshipType).includes(relationship.type as RelationshipType)) {
      errors.push({
        type: 'invalid_field',
        message: `Invalid relationship type: ${relationship.type}`,
        field: 'type',
        value: relationship.type
      });
    }

    // Validate that source and target nodes exist
    if (relationship.sourceId && relationship.targetId) {
      const sourceNode = await this.database.getNode(relationship.sourceId);
      const targetNode = await this.database.getNode(relationship.targetId);

      if (!sourceNode) {
        errors.push({
          type: 'invalid_reference',
          message: `Source node not found: ${relationship.sourceId}`,
          field: 'sourceId',
          value: relationship.sourceId
        });
      }

      if (!targetNode) {
        errors.push({
          type: 'invalid_reference',
          message: `Target node not found: ${relationship.targetId}`,
          field: 'targetId',
          value: relationship.targetId
        });
      }

      // Prevent self-references
      if (relationship.sourceId === relationship.targetId) {
        errors.push({
          type: 'invalid_relationship',
          message: 'Source and target cannot be the same',
          field: 'sourceId',
          value: relationship.sourceId
        });
      }
    }

    // Weight validation
    if (relationship.weight !== undefined) {
      if (typeof relationship.weight !== 'number' || relationship.weight < 0 || relationship.weight > 1) {
        errors.push({
          type: 'invalid_field',
          message: 'Weight must be a number between 0 and 1',
          field: 'weight',
          value: relationship.weight
        });
      }
    }

    // Metadata validation
    if (relationship.metadata) {
      const metadataValidation = this.validateRelationshipMetadata(relationship.metadata);
      errors.push(...metadataValidation.errors);
      warnings.push(...metadataValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  async validateIngestionData(data: { nodes: any[]; relationships: any[] }): Promise<KnowledgeValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate nodes
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const nodeValidation = await this.validateNode(node);
      
      nodeValidation.errors.forEach(error => {
        errors.push({
          ...error,
          nodeId: node.id,
          line: i + 1
        });
      });
      
      warnings.push(...nodeValidation.warnings);
      suggestions.push(...nodeValidation.suggestions);
    }

    // Validate relationships
    for (let i = 0; i < data.relationships.length; i++) {
      const relationship = data.relationships[i];
      const relationshipValidation = await this.validateRelationship(relationship);
      
      relationshipValidation.errors.forEach(error => {
        errors.push({
          ...error,
          relationshipId: relationship.id,
          line: i + 1
        });
      });
      
      warnings.push(...relationshipValidation.warnings);
      suggestions.push(...relationshipValidation.suggestions);
    }

    // Check for duplicate IDs
    const nodeIds = new Set<string>();
    const relationshipIds = new Set<string>();

    data.nodes.forEach((node, index) => {
      if (node.id) {
        if (nodeIds.has(node.id)) {
          errors.push({
            type: 'duplicate_id',
            message: `Duplicate node ID: ${node.id}`,
            nodeId: node.id,
            line: index + 1
          });
        } else {
          nodeIds.add(node.id);
        }
      }
    });

    data.relationships.forEach((relationship, index) => {
      if (relationship.id) {
        if (relationshipIds.has(relationship.id)) {
          errors.push({
            type: 'duplicate_id',
            message: `Duplicate relationship ID: ${relationship.id}`,
            relationshipId: relationship.id,
            line: index + 1
          });
        } else {
          relationshipIds.add(relationship.id);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private validateContentByType(type: KnowledgeNodeType, content: any): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    switch (type) {
      case KnowledgeNodeType.CODE:
        if (typeof content !== 'string') {
          errors.push({
            type: 'invalid_content',
            message: 'Code content must be a string',
            field: 'content',
            value: typeof content
          });
        }
        break;

      case KnowledgeNodeType.IMAGE:
      case KnowledgeNodeType.AUDIO:
      case KnowledgeNodeType.VIDEO:
        if (typeof content !== 'string' && typeof content !== 'object') {
          errors.push({
            type: 'invalid_content',
            message: `${type} content must be a string (URL) or object (binary data)`,
            field: 'content',
            value: typeof content
          });
        }
        break;

      case KnowledgeNodeType.DATASET:
        if (!Array.isArray(content) && typeof content !== 'object') {
          errors.push({
            type: 'invalid_content',
            message: 'Dataset content must be an array or object',
            field: 'content',
            value: typeof content
          });
        }
        break;

      case KnowledgeNodeType.MODEL:
        if (typeof content !== 'object') {
          errors.push({
            type: 'invalid_content',
            message: 'Model content must be an object',
            field: 'content',
            value: typeof content
          });
        }
        break;

      default:
        // For other types, content can be anything
        break;
    }

    return { errors, warnings };
  }

  private validateMetadata(metadata: any): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof metadata !== 'object' || metadata === null) {
      errors.push({
        type: 'invalid_field',
        message: 'Metadata must be an object',
        field: 'metadata',
        value: typeof metadata
      });
      return { errors, warnings };
    }

    // Validate title
    if (metadata.title !== undefined && typeof metadata.title !== 'string') {
      errors.push({
        type: 'invalid_field',
        message: 'Title must be a string',
        field: 'metadata.title',
        value: typeof metadata.title
      });
    }

    // Validate description
    if (metadata.description !== undefined && typeof metadata.description !== 'string') {
      errors.push({
        type: 'invalid_field',
        message: 'Description must be a string',
        field: 'metadata.description',
        value: typeof metadata.description
      });
    }

    // Validate author
    if (metadata.author !== undefined && typeof metadata.author !== 'string') {
      errors.push({
        type: 'invalid_field',
        message: 'Author must be a string',
        field: 'metadata.author',
        value: typeof metadata.author
      });
    }

    // Validate dependencies
    if (metadata.dependencies !== undefined) {
      if (!Array.isArray(metadata.dependencies)) {
        errors.push({
          type: 'invalid_field',
          message: 'Dependencies must be an array',
          field: 'metadata.dependencies',
          value: typeof metadata.dependencies
        });
      } else {
        metadata.dependencies.forEach((dep: any, index: number) => {
          if (typeof dep !== 'string') {
            errors.push({
              type: 'invalid_field',
              message: `Dependency at index ${index} must be a string`,
              field: `metadata.dependencies[${index}]`,
              value: typeof dep
            });
          }
        });
      }
    }

    return { errors, warnings };
  }

  private validateAccessControl(accessControl: any): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof accessControl !== 'object' || accessControl === null) {
      errors.push({
        type: 'invalid_field',
        message: 'Access control must be an object',
        field: 'accessControl',
        value: typeof accessControl
      });
      return { errors, warnings };
    }

    // Validate owner
    if (!accessControl.owner || typeof accessControl.owner !== 'string') {
      errors.push({
        type: 'missing_field',
        message: 'Owner is required and must be a string',
        field: 'accessControl.owner'
      });
    }

    // Validate permissions
    if (accessControl.permissions !== undefined) {
      if (!Array.isArray(accessControl.permissions)) {
        errors.push({
          type: 'invalid_field',
          message: 'Permissions must be an array',
          field: 'accessControl.permissions',
          value: typeof accessControl.permissions
        });
      } else {
        accessControl.permissions.forEach((perm: any, index: number) => {
          if (typeof perm !== 'object' || !perm.subject || !perm.actions) {
            errors.push({
              type: 'invalid_field',
              message: `Permission at index ${index} must have subject and actions`,
              field: `accessControl.permissions[${index}]`
            });
          }
        });
      }
    }

    // Validate groups
    if (accessControl.groups !== undefined) {
      if (!Array.isArray(accessControl.groups)) {
        errors.push({
          type: 'invalid_field',
          message: 'Groups must be an array',
          field: 'accessControl.groups',
          value: typeof accessControl.groups
        });
      } else {
        accessControl.groups.forEach((group: any, index: number) => {
          if (typeof group !== 'string') {
            errors.push({
              type: 'invalid_field',
              message: `Group at index ${index} must be a string`,
              field: `accessControl.groups[${index}]`,
              value: typeof group
            });
          }
        });
      }
    }

    // Validate public flag
    if (accessControl.public !== undefined && typeof accessControl.public !== 'boolean') {
      errors.push({
        type: 'invalid_field',
        message: 'Public flag must be a boolean',
        field: 'accessControl.public',
        value: typeof accessControl.public
      });
    }

    return { errors, warnings };
  }

  private validateQualityMetrics(quality: any): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof quality !== 'object' || quality === null) {
      errors.push({
        type: 'invalid_field',
        message: 'Quality metrics must be an object',
        field: 'metadata.quality',
        value: typeof quality
      });
      return { errors, warnings };
    }

    const metrics = ['accuracy', 'completeness', 'consistency', 'timeliness', 'relevance', 'overall'];
    
    metrics.forEach(metric => {
      if (quality[metric] !== undefined) {
        if (typeof quality[metric] !== 'number' || quality[metric] < 0 || quality[metric] > 1) {
          errors.push({
            type: 'invalid_field',
            message: `${metric} must be a number between 0 and 1`,
            field: `metadata.quality.${metric}`,
            value: quality[metric]
          });
        }
      }
    });

    return { errors, warnings };
  }

  private validateRelationshipMetadata(metadata: any): { errors: ValidationError[]; warnings: string[] } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (typeof metadata !== 'object' || metadata === null) {
      errors.push({
        type: 'invalid_field',
        message: 'Relationship metadata must be an object',
        field: 'metadata',
        value: typeof metadata
      });
      return { errors, warnings };
    }

    // Validate description
    if (metadata.description !== undefined && typeof metadata.description !== 'string') {
      errors.push({
        type: 'invalid_field',
        message: 'Description must be a string',
        field: 'metadata.description',
        value: typeof metadata.description
      });
    }

    // Validate confidence
    if (metadata.confidence !== undefined) {
      if (typeof metadata.confidence !== 'number' || metadata.confidence < 0 || metadata.confidence > 1) {
        errors.push({
          type: 'invalid_field',
          message: 'Confidence must be a number between 0 and 1',
          field: 'metadata.confidence',
          value: metadata.confidence
        });
      }
    }

    // Validate evidence
    if (metadata.evidence !== undefined) {
      if (!Array.isArray(metadata.evidence)) {
        errors.push({
          type: 'invalid_field',
          message: 'Evidence must be an array',
          field: 'metadata.evidence',
          value: typeof metadata.evidence
        });
      } else {
        metadata.evidence.forEach((item: any, index: number) => {
          if (typeof item !== 'string') {
            errors.push({
              type: 'invalid_field',
              message: `Evidence at index ${index} must be a string`,
              field: `metadata.evidence[${index}]`,
              value: typeof item
            });
          }
        });
      }
    }

    return { errors, warnings };
  }
} 