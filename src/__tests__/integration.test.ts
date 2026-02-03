/**
 * Integration Tests for C/AL Dependency MCP Server
 * Tests full workflows, end-to-end scenarios, and performance benchmarks
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  searchObjects,
  getObjectDefinition,
  findReferences,
  searchObjectMembers,
  getObjectSummary,
  manageFiles,
  FileRegistry
} from '../tools/mcp-tools';
import { searchCode, getDependencies, getTableRelations } from '../tools/mcp-tools';
import { loadFile, loadDirectory } from '../core/file-loader';
import { CALObjectType } from '../types/cal-types';

describe('Integration Tests', () => {
  
  describe('Full Workflow', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should load, search, and analyze objects end-to-end', async () => {
      // Step 1: Load fixture files
      const loadResult = await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.stats).toBeDefined();
      expect(loadResult.stats?.totalObjects).toBeGreaterThan(0);

      // Step 2: Search for objects using pattern
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 20,
        offset: 0,
        summaryMode: true
      });
      
      expect(searchResult.objects).toBeDefined();
      expect(searchResult.objects.length).toBeGreaterThan(0);
      
      const firstObject = searchResult.objects[0];
      expect(firstObject.id).toBeDefined();
      expect(firstObject.name).toBeDefined();
      expect(firstObject.type).toBeDefined();

      // Step 3: Get object definition
      const defResult = await getObjectDefinition({
        objectType: firstObject.type,
        objectId: firstObject.id,
        summaryMode: false
      });
      
      expect(defResult.object).toBeDefined();
      expect(defResult.object?.id).toBe(firstObject.id);
      expect(defResult.object?.name).toBe(firstObject.name);

      // Step 4: Find references
      const refResult = await findReferences({
        targetName: firstObject.name,
        includeContext: false
      });
      
      expect(refResult.references).toBeDefined();
      expect(Array.isArray(refResult.references)).toBe(true);
    });

    test('should find cross-object references correctly', async () => {
      // Load files with cross-references
      await manageFiles({
        action: 'load',
        path: './fixtures/table-complex.txt'
      });

      await manageFiles({
        action: 'load',
        path: './fixtures/page-controls.txt'
      });

      // Search for objects
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 50,
        offset: 0,
        summaryMode: true
      });

      expect(searchResult.objects.length).toBeGreaterThan(0);

      // Find references between objects
      for (const obj of searchResult.objects.slice(0, 3)) {
        const refResult = await findReferences({
          targetName: obj.name,
          includeContext: false
        });

        expect(refResult.references).toBeDefined();
        expect(refResult.summary).toBeDefined();
        expect(refResult.summary?.total).toBeGreaterThanOrEqual(0);
      }
    });

    test('should search code patterns across all objects', async () => {
      // Load codeunit with procedures
      await manageFiles({
        action: 'load',
        path: './fixtures/codeunit-dotnet.txt'
      });

      const db = FileRegistry.getDatabase();
      
      // Search for common code patterns
      const patterns = [
        'IF',
        'BEGIN',
        'END',
        'PROCEDURE'
      ];

      for (const pattern of patterns) {
        const results = searchCode(db, {
          pattern,
          limit: 10
        });

        expect(Array.isArray(results)).toBe(true);
        // Results may be empty if pattern doesn't match
      }
    });

    test('should handle object members search across different types', async () => {
      // Load table
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      // Get first table
      const searchResult = await searchObjects({
        pattern: '*',
        objectType: 'Table',
        limit: 1,
        offset: 0,
        summaryMode: true
      });

      expect(searchResult.objects.length).toBeGreaterThan(0);
      const table = searchResult.objects[0];

      // Search fields
      const fieldResult = await searchObjectMembers({
        objectName: table.name,
        objectType: 'Table',
        memberType: 'fields',
        pattern: '*',
        limit: 20,
        offset: 0,
        includeDetails: true
      });

      expect(fieldResult.members).toBeDefined();
      expect(Array.isArray(fieldResult.members)).toBe(true);

      // Search procedures
      const procResult = await searchObjectMembers({
        objectName: table.name,
        objectType: 'Table',
        memberType: 'procedures',
        pattern: '*',
        limit: 20,
        offset: 0,
        includeDetails: true
      });

      expect(procResult.members).toBeDefined();
      expect(Array.isArray(procResult.members)).toBe(true);
    });

    test('should get object summary for different object types', async () => {
      // Load various object types
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      // Get list of all objects
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 50,
        offset: 0,
        summaryMode: true
      });

      // Get summary for each object type
      const objectTypes = new Set<string>();
      
      for (const obj of searchResult.objects) {
        if (!objectTypes.has(obj.type)) {
          objectTypes.add(obj.type);
          
          const summaryResult = await getObjectSummary({
            objectName: obj.name,
            objectType: obj.type
          });

          expect(summaryResult.summary || summaryResult.error).toBeDefined();
          
          if (summaryResult.summary) {
            expect(summaryResult.summary.id).toBe(obj.id);
            expect(summaryResult.summary.name).toBe(obj.name);
            expect(summaryResult.summary.type).toBe(obj.type);
          }
        }
      }
    });
  });

  describe('End-to-End Tests', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should load all fixture files successfully', async () => {
      const result = await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.totalFiles).toBeGreaterThan(0);
      expect(result.stats?.totalObjects).toBeGreaterThan(0);
    });

    test('should verify all object types are parsed correctly', async () => {
      // Load all fixtures
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      
      // Check for different object types
      const objectTypes = [
        CALObjectType.Table,
        CALObjectType.Page,
        CALObjectType.Codeunit,
        CALObjectType.Report,
        CALObjectType.Query,
        CALObjectType.XMLport,
        CALObjectType.MenuSuite
      ];

      const foundTypes: string[] = [];

      for (const type of objectTypes) {
        const objects = db.getObjectsByType(type);
        if (objects.length > 0) {
          foundTypes.push(type);
          
          // Verify each object has required properties
          for (const obj of objects) {
            expect(obj.id).toBeDefined();
            expect(obj.name).toBeDefined();
            expect(obj.type).toBe(type);
          }
        }
      }

      // We should have found at least some object types
      expect(foundTypes.length).toBeGreaterThan(0);
    });

    test('should verify all references are extracted', async () => {
      // Load fixtures with references
      await manageFiles({
        action: 'load',
        path: './fixtures/table-complex.txt'
      });

      const references = FileRegistry.getReferences();
      
      expect(Array.isArray(references)).toBe(true);
      
      // Verify reference structure
      for (const ref of references.slice(0, 5)) {
        expect(ref.sourceType).toBeDefined();
        expect(ref.sourceId).toBeDefined();
        expect(ref.sourceName).toBeDefined();
        expect(ref.targetType).toBeDefined();
        expect(ref.targetName).toBeDefined();
        expect(ref.referenceType).toBeDefined();
      }
    });

    test('should verify all MCP tools work with loaded data', async () => {
      // Load all fixtures
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      // Test 1: cal_search_objects
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 20,
        offset: 0,
        summaryMode: true
      });
      expect(searchResult.objects.length).toBeGreaterThan(0);

      // Test 2: cal_get_object_definition
      const firstObj = searchResult.objects[0];
      const defResult = await getObjectDefinition({
        objectType: firstObj.type,
        objectId: firstObj.id,
        summaryMode: false
      });
      expect(defResult.object).toBeDefined();

      // Test 3: cal_find_references
      const refResult = await findReferences({
        targetName: firstObj.name,
        includeContext: false
      });
      expect(refResult.references).toBeDefined();

      // Test 4: cal_search_object_members (for objects with members)
      if (firstObj.type === 'Table' || firstObj.type === 'Page') {
        const memberResult = await searchObjectMembers({
          objectName: firstObj.name,
          memberType: firstObj.type === 'Table' ? 'fields' : 'controls',
          pattern: '*',
          limit: 10,
          offset: 0,
          includeDetails: true
        });
        expect(memberResult.members).toBeDefined();
      }

      // Test 5: cal_get_object_summary
      const summaryResult = await getObjectSummary({
        objectName: firstObj.name
      });
      expect(summaryResult.summary || summaryResult.error).toBeDefined();

      // Test 6: cal_files (list and stats)
      const listResult = await manageFiles({ action: 'list' });
      expect(listResult.files).toBeDefined();
      expect(listResult.files!.length).toBeGreaterThan(0);

      const statsResult = await manageFiles({ action: 'stats' });
      expect(statsResult.stats).toBeDefined();
      expect(statsResult.stats?.totalObjects).toBeGreaterThan(0);
    });

    test('should handle malformed files gracefully', async () => {
      const result = await manageFiles({
        action: 'load',
        path: './fixtures/malformed.txt'
      });

      // Should succeed but may have errors
      expect(result.success).toBe(true);
      // Errors may be present
      if (result.errors && result.errors.length > 0) {
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should load all fixtures under 1 second', async () => {
      const startTime = Date.now();
      
      const result = await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });
      
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // 1 second
      
      console.log(`✓ Load time: ${duration}ms`);
    });

    test('should search patterns under 100ms', async () => {
      // Load fixtures first
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      // Measure search time
      const startTime = Date.now();
      
      await searchObjects({
        pattern: '*',
        limit: 100,
        offset: 0,
        summaryMode: true
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // 100ms
      
      console.log(`✓ Search time: ${duration}ms`);
    });

    test('should get object definition under 50ms', async () => {
      // Load fixtures first
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      // Get first object
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 1,
        offset: 0,
        summaryMode: true
      });

      expect(searchResult.objects.length).toBeGreaterThan(0);
      const obj = searchResult.objects[0];

      // Measure get definition time
      const startTime = Date.now();
      
      await getObjectDefinition({
        objectType: obj.type,
        objectId: obj.id,
        summaryMode: false
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(50); // 50ms
      
      console.log(`✓ Get definition time: ${duration}ms`);
    });

    test('should find references under 100ms', async () => {
      // Load fixtures first
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      // Get first object
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 1,
        offset: 0,
        summaryMode: true
      });

      expect(searchResult.objects.length).toBeGreaterThan(0);
      const obj = searchResult.objects[0];

      // Measure find references time
      const startTime = Date.now();
      
      await findReferences({
        targetName: obj.name,
        includeContext: false
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // 100ms
      
      console.log(`✓ Find references time: ${duration}ms`);
    });

    test('should search code patterns under 500ms', async () => {
      // Load all fixtures
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      const patterns = ['IF', 'BEGIN', 'END', 'PROCEDURE', 'VAR', 'THEN'];
      
      const startTime = Date.now();
      
      for (const pattern of patterns) {
        searchCode(db, {
          pattern,
          limit: 50
        });
      }
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500); // 500ms for 6 patterns
      
      console.log(`✓ Search ${patterns.length} code patterns time: ${duration}ms`);
    });

    test('should get dependencies under 100ms', async () => {
      // Load fixtures
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      const tables = db.getObjectsByType(CALObjectType.Table);
      
      if (tables.length > 0) {
        const startTime = Date.now();
        
        getDependencies(db, {
          objectType: 'Table',
          objectId: tables[0].id,
          direction: 'both'
        });
        
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(100); // 100ms
        
        console.log(`✓ Get dependencies time: ${duration}ms`);
      }
    });

    test('should get table relations under 150ms', async () => {
      // Load fixtures
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      
      const startTime = Date.now();
      
      getTableRelations(db, {
        includeCalcFormula: true
      });
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(150); // 150ms
      
      console.log(`✓ Get table relations time: ${duration}ms`);
    });

    test('should measure end-to-end workflow performance', async () => {
      const startTime = Date.now();
      
      // Step 1: Load
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });
      
      // Step 2: Search
      const searchResult = await searchObjects({
        pattern: '*',
        limit: 20,
        offset: 0,
        summaryMode: true
      });
      
      // Step 3: Get definition
      if (searchResult.objects.length > 0) {
        const obj = searchResult.objects[0];
        await getObjectDefinition({
          objectType: obj.type,
          objectId: obj.id,
          summaryMode: false
        });
        
        // Step 4: Find references
        await findReferences({
          targetName: obj.name,
          includeContext: false
        });
        
        // Step 5: Get summary
        await getObjectSummary({
          objectName: obj.name
        });
      }
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1500); // 1.5 seconds for full workflow
      
      console.log(`✓ End-to-end workflow time: ${duration}ms`);
    });
  });

  describe('Extended Tools Integration', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should search code across all loaded objects', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      
      const results = searchCode(db, {
        pattern: 'BEGIN',
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
      
      for (const result of results) {
        expect(result.objectType).toBeDefined();
        expect(result.objectId).toBeDefined();
        expect(result.objectName).toBeDefined();
        expect(result.procedureName).toBeDefined();
        expect(result.match).toBeDefined();
        expect(result.lineNumber).toBeGreaterThan(0);
      }
    });

    test('should get dependency graph for objects', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      const db = FileRegistry.getDatabase();
      const tables = db.getObjectsByType(CALObjectType.Table);
      
      if (tables.length > 0) {
        const graph = getDependencies(db, {
          objectType: 'Table',
          objectId: tables[0].id,
          direction: 'both'
        });

        expect(graph).toBeDefined();
        expect(Array.isArray(graph.incoming)).toBe(true);
        expect(Array.isArray(graph.outgoing)).toBe(true);
      }
    });

    test('should extract table relations with CalcFormula', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-complex.txt'
      });

      const db = FileRegistry.getDatabase();
      
      const relations = getTableRelations(db, {
        includeCalcFormula: true
      });

      expect(Array.isArray(relations)).toBe(true);
      
      for (const rel of relations) {
        expect(rel.sourceType).toBeDefined();
        expect(rel.targetType).toBeDefined();
        expect(['TableRelation', 'CalcFormula']).toContain(rel.referenceType);
      }
    });
  });

  describe('File Loader Integration', () => {
    test('should load single file directly', async () => {
      const result = await loadFile('./fixtures/table-simple.txt');
      
      expect(result.objects).toBeDefined();
      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalFiles).toBe(1);
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });

    test('should load directory with pattern', async () => {
      const result = await loadDirectory('./fixtures', '*.txt');
      
      expect(result.objects).toBeDefined();
      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalFiles).toBeGreaterThan(1);
      expect(result.stats.totalObjects).toBeGreaterThan(0);
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });

    test('should load directory with specific pattern', async () => {
      const result = await loadDirectory('./fixtures', 'table-*.txt');
      
      expect(result.objects).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalFiles).toBeGreaterThanOrEqual(0);
      
      // All objects should be tables
      for (const obj of result.objects) {
        expect(obj.type).toBe(CALObjectType.Table);
      }
    });

    test('should handle BOM in files', async () => {
      const result = await loadFile('./fixtures/table-with-bom.txt');
      
      expect(result.objects).toBeDefined();
      // Should parse correctly despite BOM
      expect(result.errors.length).toBe(0);
    });
  });
});
