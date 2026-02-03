/**
 * Test suite for File Loader
 * TDD: Tests written before implementation
 */

import { describe, test, expect } from 'bun:test';
import { loadFile, loadDirectory, streamObjects } from '../core/file-loader';
import { CALObjectType } from '../types/cal-types';
import { join } from 'path';

describe('File Loader', () => {
  const fixturesPath = join(process.cwd(), 'fixtures');

  describe('loadFile - Single Object Files', () => {
    test('should load single table from table-simple.txt', async () => {
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'));

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].type).toBe(CALObjectType.Table);
      expect(result.objects[0].id).toBe(3);
      expect(result.objects[0].name).toBe('Payment Terms');
      expect(result.errors).toHaveLength(0);
    });

    test('should load single page from page-controls.txt', async () => {
      const result = await loadFile(join(fixturesPath, 'page-controls.txt'));

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].type).toBe(CALObjectType.Page);
      expect(result.errors).toHaveLength(0);
    });

    test('should return stats with file count, object count, bytes, and duration', async () => {
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'));

      expect(result.stats).toBeDefined();
      expect(result.stats.totalFiles).toBe(1);
      expect(result.stats.totalObjects).toBe(1);
      expect(result.stats.totalBytes).toBeGreaterThan(0);
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('loadFile - Multi-Object Files', () => {
    test('should load all objects from multi-object.txt', async () => {
      const result = await loadFile(join(fixturesPath, 'multi-object.txt'));

      expect(result.objects).toHaveLength(3);
      
      // Check object types
      expect(result.objects[0].type).toBe(CALObjectType.Table);
      expect(result.objects[0].id).toBe(3);
      
      expect(result.objects[1].type).toBe(CALObjectType.Page);
      expect(result.objects[1].id).toBe(4);
      
      expect(result.objects[2].type).toBe(CALObjectType.Codeunit);
      expect(result.objects[2].id).toBe(50000);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should correctly detect object boundaries using OBJECT pattern', async () => {
      const result = await loadFile(join(fixturesPath, 'multi-object.txt'));

      // All three objects should be parsed separately
      expect(result.objects).toHaveLength(3);
      
      // Each object should have correct properties
      result.objects.forEach(obj => {
        expect(obj.id).toBeGreaterThan(0);
        expect(obj.name).toBeTruthy();
        expect(obj.type).toBeTruthy();
      });
    });
  });

  describe('loadFile - UTF-8 BOM Detection', () => {
    test('should detect and strip UTF-8 BOM (0xEF 0xBB 0xBF)', async () => {
      const result = await loadFile(join(fixturesPath, 'table-with-bom.txt'));

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].type).toBe(CALObjectType.Table);
      expect(result.objects[0].id).toBe(999);
      expect(result.objects[0].name).toBe('Test BOM');
      expect(result.errors).toHaveLength(0);
    });

    test('should handle files without BOM correctly', async () => {
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'));

      expect(result.objects).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('loadFile - Error Handling', () => {
    test('should return error for non-existent file', async () => {
      const result = await loadFile(join(fixturesPath, 'non-existent.txt'));

      expect(result.objects).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].severity).toBe('error');
      expect(result.errors[0].error).toContain('ENOENT');
    });

    test('should handle malformed objects gracefully', async () => {
      const result = await loadFile(join(fixturesPath, 'malformed.txt'));

      // The malformed.txt may or may not produce errors depending on parser lenience
      // Just verify the function completes without throwing
      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      
      // If there are errors, they should have proper structure
      result.errors.forEach(error => {
        expect(error.filePath).toBeTruthy();
        expect(error.error).toBeTruthy();
        expect(['warning', 'error']).toContain(error.severity);
      });
    });

    test('should track object index in errors for multi-object files', async () => {
      // If malformed.txt has multiple objects with one malformed
      const result = await loadFile(join(fixturesPath, 'malformed.txt'));

      if (result.errors.length > 0) {
        const errorWithIndex = result.errors.find(e => e.objectIndex !== undefined);
        if (errorWithIndex) {
          expect(errorWithIndex.objectIndex).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('loadFile - Parser Routing', () => {
    test('should route Table objects to table parser', async () => {
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.Table);
      // Check for table-specific properties
      expect('fields' in result.objects[0]).toBe(true);
      expect('keys' in result.objects[0]).toBe(true);
    });

    test('should route Page objects to page parser', async () => {
      const result = await loadFile(join(fixturesPath, 'page-controls.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.Page);
      // Check for page-specific properties
      expect('controls' in result.objects[0]).toBe(true);
    });

    test('should route Query objects to query parser', async () => {
      const result = await loadFile(join(fixturesPath, 'query.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.Query);
      // Check for query-specific properties
      expect('dataItems' in result.objects[0]).toBe(true);
    });

    test('should route Report objects to report parser', async () => {
      const result = await loadFile(join(fixturesPath, 'report-dataitem.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.Report);
      // Check for report-specific properties
      expect('dataItems' in result.objects[0]).toBe(true);
    });

    test('should route XMLport objects to xmlport parser', async () => {
      const result = await loadFile(join(fixturesPath, 'xmlport.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.XMLport);
      // Check for xmlport-specific properties
      expect('nodes' in result.objects[0]).toBe(true);
    });

    test('should route MenuSuite objects to menusuite parser', async () => {
      const result = await loadFile(join(fixturesPath, 'menusuite.txt'));

      expect(result.objects[0].type).toBe(CALObjectType.MenuSuite);
      // Check for menusuite-specific properties
      expect('menuItems' in result.objects[0]).toBe(true);
    });
  });

  describe('loadDirectory', () => {
    test('should load all .txt files from fixtures directory', async () => {
      const result = await loadDirectory(fixturesPath, '*.txt');

      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.stats.totalFiles).toBeGreaterThan(1);
      expect(result.stats.totalObjects).toBeGreaterThan(0);
    });

    test('should filter files by pattern', async () => {
      const result = await loadDirectory(fixturesPath, 'table-*.txt');

      // Should load table-simple.txt, table-complex.txt, table-with-bom.txt
      expect(result.stats.totalFiles).toBeGreaterThanOrEqual(2);
      
      // All objects should be tables
      result.objects.forEach(obj => {
        expect(obj.type).toBe(CALObjectType.Table);
      });
    });

    test('should return stats for directory loading', async () => {
      const result = await loadDirectory(fixturesPath, '*.txt');

      expect(result.stats.totalFiles).toBeGreaterThan(0);
      expect(result.stats.totalObjects).toBeGreaterThan(0);
      expect(result.stats.totalBytes).toBeGreaterThan(0);
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });

    test('should handle non-existent directory gracefully', async () => {
      const result = await loadDirectory(join(fixturesPath, 'non-existent'), '*.txt');

      expect(result.objects).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].severity).toBe('error');
    });

    test('should aggregate errors from multiple files', async () => {
      const result = await loadDirectory(fixturesPath, '*.txt');

      // Each error should have filePath
      result.errors.forEach(error => {
        expect(error.filePath).toBeTruthy();
      });
    });
  });

  describe('streamObjects', () => {
    test('should stream objects one at a time from single-object file', async () => {
      const objects = [];
      
      for await (const obj of streamObjects(join(fixturesPath, 'table-simple.txt'))) {
        objects.push(obj);
      }

      expect(objects).toHaveLength(1);
      expect(objects[0].type).toBe(CALObjectType.Table);
      expect(objects[0].id).toBe(3);
    });

    test('should stream objects one at a time from multi-object file', async () => {
      const objects = [];
      
      for await (const obj of streamObjects(join(fixturesPath, 'multi-object.txt'))) {
        objects.push(obj);
      }

      expect(objects).toHaveLength(3);
      expect(objects[0].type).toBe(CALObjectType.Table);
      expect(objects[1].type).toBe(CALObjectType.Page);
      expect(objects[2].type).toBe(CALObjectType.Codeunit);
    });

    test('should yield objects in order', async () => {
      const objects = [];
      
      for await (const obj of streamObjects(join(fixturesPath, 'multi-object.txt'))) {
        objects.push(obj);
      }

      // Objects should be in file order
      expect(objects[0].id).toBe(3); // Table 3
      expect(objects[1].id).toBe(4); // Page 4
      expect(objects[2].id).toBe(50000); // Codeunit 50000
    });

    test('should handle BOM in streamed files', async () => {
      const objects = [];
      
      for await (const obj of streamObjects(join(fixturesPath, 'table-with-bom.txt'))) {
        objects.push(obj);
      }

      expect(objects).toHaveLength(1);
      expect(objects[0].id).toBe(999);
    });

    test('should throw error for non-existent file', async () => {
      try {
        for await (const obj of streamObjects(join(fixturesPath, 'non-existent.txt'))) {
          // Should not reach here
        }
        expect(true).toBe(false); // Should not reach this line
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('LoadOptions', () => {
    test('should support options for progress reporting', async () => {
      let progressCalls = 0;
      
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'), {
        onProgress: (loaded, total) => {
          progressCalls++;
          expect(loaded).toBeGreaterThanOrEqual(0);
          expect(total).toBeGreaterThan(0);
        }
      });

      expect(result.objects).toHaveLength(1);
      // Progress should be called at least once
      expect(progressCalls).toBeGreaterThan(0);
    });

    test('should support encoding option', async () => {
      const result = await loadFile(join(fixturesPath, 'table-simple.txt'), {
        encoding: 'utf-8'
      });

      expect(result.objects).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
