import { KnowledgeNode, KnowledgeGraph } from './types';

export interface CompressionConfig {
  algorithm: 'gzip' | 'brotli' | 'lz4' | 'zstd' | 'custom';
  level: number; // 1-9 for most algorithms
  threshold: number; // Minimum size to compress (bytes)
  chunkSize: number; // Size of chunks for streaming compression
  enableDeduplication: boolean;
  enableDictionary: boolean;
  dictionarySize: number;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  time: number;
  checksum: string;
}

export interface DecompressionResult {
  success: boolean;
  data: any;
  time: number;
  error?: string;
}

export interface CompressionStats {
  totalCompressed: number;
  totalOriginal: number;
  averageRatio: number;
  algorithmUsage: Map<string, number>;
  timeStats: {
    averageCompressionTime: number;
    averageDecompressionTime: number;
    totalCompressionTime: number;
    totalDecompressionTime: number;
  };
}

export class KnowledgeCompressionEngine {
  private config: CompressionConfig;
  private stats: CompressionStats;
  private dictionary: Map<string, number> = new Map();
  private compressionCounts: Map<string, number> = new Map();

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      algorithm: 'gzip',
      level: 6,
      threshold: 1024, // 1KB
      chunkSize: 8192, // 8KB
      enableDeduplication: true,
      enableDictionary: true,
      dictionarySize: 10000,
      ...config,
    };

    this.stats = {
      totalCompressed: 0,
      totalOriginal: 0,
      averageRatio: 0,
      algorithmUsage: new Map(),
      timeStats: {
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
        totalCompressionTime: 0,
        totalDecompressionTime: 0,
      },
    };
  }

  async compressNode(node: KnowledgeNode): Promise<CompressionResult> {
    const startTime = Date.now();
    const originalData = JSON.stringify(node);
    const originalSize = Buffer.byteLength(originalData, 'utf8');

    if (originalSize < this.config.threshold) {
      return {
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        algorithm: 'none',
        time: Date.now() - startTime,
        checksum: this.generateChecksum(originalData),
      };
    }

    let compressedData: Buffer;
    let algorithm: string;

    switch (this.config.algorithm) {
      case 'gzip':
        compressedData = await this.compressGzip(originalData);
        algorithm = 'gzip';
        break;
      case 'brotli':
        compressedData = await this.compressBrotli(originalData);
        algorithm = 'brotli';
        break;
      case 'lz4':
        compressedData = await this.compressLZ4(originalData);
        algorithm = 'lz4';
        break;
      case 'zstd':
        compressedData = await this.compressZstd(originalData);
        algorithm = 'zstd';
        break;
      default:
        compressedData = await this.compressGzip(originalData);
        algorithm = 'gzip';
    }

    const compressedSize = compressedData.length;
    const compressionRatio = originalSize / compressedSize;
    const time = Date.now() - startTime;

    // Update statistics
    this.updateStats(algorithm, originalSize, compressedSize, time, 0);

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm,
      time,
      checksum: this.generateChecksum(compressedData.toString('base64')),
    };
  }

  async decompressNode(compressedData: Buffer, algorithm: string): Promise<DecompressionResult> {
    const startTime = Date.now();

    try {
      let decompressedData: string;

      switch (algorithm) {
        case 'gzip':
          decompressedData = await this.decompressGzip(compressedData);
          break;
        case 'brotli':
          decompressedData = await this.decompressBrotli(compressedData);
          break;
        case 'lz4':
          decompressedData = await this.decompressLZ4(compressedData);
          break;
        case 'zstd':
          decompressedData = await this.decompressZstd(compressedData);
          break;
        default:
          decompressedData = await this.decompressGzip(compressedData);
      }

      const node = JSON.parse(decompressedData);
      const time = Date.now() - startTime;

      // Update decompression statistics
      this.updateStats(algorithm, 0, 0, 0, time);

      return {
        success: true,
        data: node,
        time,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        time: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown decompression error',
      };
    }
  }

  async compressGraph(graph: KnowledgeGraph): Promise<CompressionResult> {
    const startTime = Date.now();

    // Convert graph to serializable format
    const graphData = {
      nodes: Array.from(graph.nodes.values()),
      relationships: Array.from(graph.relationships.values()),
      statistics: graph.statistics,
    };

    const originalData = JSON.stringify(graphData);
    const originalSize = Buffer.byteLength(originalData, 'utf8');

    // Use streaming compression for large graphs
    if (originalSize > this.config.chunkSize * 10) {
      return this.compressStreaming(originalData, startTime);
    }

    // Regular compression for smaller graphs
    const compressedData = await this.compressGzip(originalData);
    const compressedSize = compressedData.length;
    const compressionRatio = originalSize / compressedSize;
    const time = Date.now() - startTime;

    this.updateStats('gzip', originalSize, compressedSize, time, 0);

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm: 'gzip',
      time,
      checksum: this.generateChecksum(compressedData.toString('base64')),
    };
  }

  async compressBatch(nodes: KnowledgeNode[]): Promise<CompressionResult[]> {
    const compressionPromises = nodes.map((node) => this.compressNode(node));
    const batchResults = await Promise.all(compressionPromises);

    // Apply deduplication if enabled
    if (this.config.enableDeduplication) {
      return this.deduplicateBatch(batchResults);
    }

    return batchResults;
  }

  private async compressGzip(data: string): Promise<Buffer> {
    const { gzip } = require('zlib');
    const { promisify } = require('util');
    const gzipAsync = promisify(gzip);

    return await gzipAsync(data, { level: this.config.level });
  }

  private async decompressGzip(data: Buffer): Promise<string> {
    const { gunzip } = require('zlib');
    const { promisify } = require('util');
    const gunzipAsync = promisify(gunzip);

    const result = await gunzipAsync(data);
    return result.toString('utf8');
  }

  private async compressBrotli(data: string): Promise<Buffer> {
    // Brotli compression (if available)
    try {
      const { compress } = require('brotli');
      return Buffer.from(compress(Buffer.from(data, 'utf8')));
    } catch (error) {
      // Fallback to gzip if brotli is not available
      return await this.compressGzip(data);
    }
  }

  private async decompressBrotli(data: Buffer): Promise<string> {
    try {
      const { decompress } = require('brotli');
      const result = decompress(data);
      return Buffer.from(result).toString('utf8');
    } catch (error) {
      return await this.decompressGzip(data);
    }
  }

  private async compressLZ4(data: string): Promise<Buffer> {
    // LZ4 compression (if available)
    try {
      const lz4 = require('lz4');
      return lz4.encode(Buffer.from(data, 'utf8'));
    } catch (error) {
      return await this.compressGzip(data);
    }
  }

  private async decompressLZ4(data: Buffer): Promise<string> {
    try {
      const lz4 = require('lz4');
      const result = lz4.decode(data);
      return result.toString('utf8');
    } catch (error) {
      return await this.decompressGzip(data);
    }
  }

  private async compressZstd(data: string): Promise<Buffer> {
    // Zstandard compression (if available)
    try {
      const { compress } = require('node-zstd');
      return await compress(Buffer.from(data, 'utf8'), this.config.level);
    } catch (error) {
      return await this.compressGzip(data);
    }
  }

  private async decompressZstd(data: Buffer): Promise<string> {
    try {
      const { decompress } = require('node-zstd');
      const result = await decompress(data);
      return result.toString('utf8');
    } catch (error) {
      return await this.decompressGzip(data);
    }
  }

  private async compressStreaming(data: string, startTime: number): Promise<CompressionResult> {
    const { createGzip } = require('zlib');
    const { Readable } = require('stream');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gzip = createGzip({ level: this.config.level });

      const readable = new Readable({
        read() {
          this.push(Buffer.from(data, 'utf8'));
          this.push(null);
        },
      });

      readable
        .pipe(gzip)
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => {
          const compressedData = Buffer.concat(chunks);
          const originalSize = Buffer.byteLength(data, 'utf8');
          const compressedSize = compressedData.length;
          const compressionRatio = originalSize / compressedSize;
          const time = Date.now() - startTime;

          this.updateStats('gzip', originalSize, compressedSize, time, 0);

          resolve({
            originalSize,
            compressedSize,
            compressionRatio,
            algorithm: 'gzip',
            time,
            checksum: this.generateChecksum(compressedData.toString('base64')),
          });
        })
        .on('error', reject);
    });
  }

  private deduplicateBatch(results: CompressionResult[]): CompressionResult[] {
    const seen = new Map<string, CompressionResult>();
    const deduplicated: CompressionResult[] = [];

    for (const result of results) {
      const key = result.checksum;
      if (!seen.has(key)) {
        seen.set(key, result);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  private updateStats(
    algorithm: string,
    originalSize: number,
    compressedSize: number,
    compressionTime: number,
    decompressionTime: number,
  ): void {
    // Update algorithm usage
    const currentCount = this.compressionCounts.get(algorithm) || 0;
    this.compressionCounts.set(algorithm, currentCount + 1);

    // Update size statistics
    this.stats.totalOriginal += originalSize;
    this.stats.totalCompressed += compressedSize;
    this.stats.averageRatio = this.stats.totalOriginal / this.stats.totalCompressed;

    // Update time statistics
    this.stats.timeStats.totalCompressionTime += compressionTime;
    this.stats.timeStats.totalDecompressionTime += decompressionTime;

    const totalCompressions = Array.from(this.compressionCounts.values()).reduce(
      (a, b) => a + b,
      0,
    );
    this.stats.timeStats.averageCompressionTime =
      this.stats.timeStats.totalCompressionTime / totalCompressions;
    this.stats.timeStats.averageDecompressionTime =
      this.stats.timeStats.totalDecompressionTime / totalCompressions;
  }

  private generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getStats(): CompressionStats {
    return { ...this.stats };
  }

  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  // Dictionary-based compression for repeated patterns
  buildDictionary(nodes: KnowledgeNode[]): void {
    if (!this.config.enableDictionary) {
      return;
    }

    const patterns = new Map<string, number>();

    for (const node of nodes) {
      const content = JSON.stringify(node.content);
      const words = content.split(/\s+/);

      for (const word of words) {
        if (word.length > 3) {
          // Only consider words longer than 3 characters
          patterns.set(word, (patterns.get(word) || 0) + 1);
        }
      }
    }

    // Keep only the most frequent patterns
    const sortedPatterns = Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.dictionarySize);

    this.dictionary.clear();
    sortedPatterns.forEach(([pattern], index) => {
      this.dictionary.set(pattern, index);
    });
  }

  compressWithDictionary(data: string): string {
    if (!this.config.enableDictionary || this.dictionary.size === 0) {
      return data;
    }

    let compressed = data;
    for (const [pattern, index] of this.dictionary) {
      const regex = new RegExp(pattern, 'g');
      compressed = compressed.replace(regex, `__DICT_${index}__`);
    }

    return compressed;
  }

  decompressWithDictionary(data: string): string {
    if (!this.config.enableDictionary || this.dictionary.size === 0) {
      return data;
    }

    let decompressed = data;
    for (const [pattern, index] of this.dictionary) {
      const regex = new RegExp(`__DICT_${index}__`, 'g');
      decompressed = decompressed.replace(regex, pattern);
    }

    return decompressed;
  }
}
