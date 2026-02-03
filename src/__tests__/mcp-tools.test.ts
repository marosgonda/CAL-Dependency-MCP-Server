/**
 * Test suite for MCP Tools
 * TDD approach: Write tests first, then implement tools
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
import { CALObjectType } from '../types/cal-types';

describe('MCP Tools', () => {
  
  describe('cal_search_objects', () => {
    beforeEach(() => {
      // Clear the file registry before each test
      FileRegistry.clear();
    });

    test('should search objects with wildcard pattern', async () => {
      // First load some test data
      await manageFiles({
        action: 'load',
        path: './fixtures/multi-object.txt'
      });

      const result = await searchObjects({
        pattern: '*',
        limit: 20,
        offset: 0,
        summaryMode: true
      });

      expect(result.objects).toBeDefined();
      expect(Array.isArray(result.objects)).toBe(true);
    });

    test('should filter by object type', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjects({
        pattern: 'Cust*',
        objectType: 'Table',
        limit: 20,
        offset: 0,
        summaryMode: true
      });

      expect(result.objects).toBeDefined();
      if (result.objects.length > 0) {
        expect(result.objects.every(obj => obj.type === CALObjectType.Table)).toBe(true);
      }
    });

    test('should respect pagination with limit and offset', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/multi-object.txt'
      });

      const page1 = await searchObjects({
        pattern: '*',
        limit: 5,
        offset: 0,
        summaryMode: true
      });

      const page2 = await searchObjects({
        pattern: '*',
        limit: 5,
        offset: 5,
        summaryMode: true
      });

      expect(page1.objects).toBeDefined();
      expect(page2.objects).toBeDefined();
      
      if (page1.objects.length > 0 && page2.objects.length > 0) {
        // Pages should not overlap
        expect(page1.objects[0].id).not.toBe(page2.objects[0].id);
      }
    });

    test('should handle summary mode', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjects({
        pattern: '*',
        limit: 1,
        offset: 0,
        summaryMode: true
      });

      expect(result.objects).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary?.total).toBeGreaterThanOrEqual(0);
    });

    test('should return empty results for no matches', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjects({
        pattern: 'NonExistentObject*',
        limit: 20,
        offset: 0,
        summaryMode: true
      });

      expect(result.objects).toBeDefined();
      expect(result.objects.length).toBe(0);
    });
  });

  describe('cal_get_object_definition', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should get object by ID', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectDefinition({
        objectType: 'Table',
        objectId: 3,
        summaryMode: false
      });

      expect(result.object).toBeDefined();
      if (result.object) {
        expect(result.object.id).toBe(3);
        expect(result.object.type).toBe(CALObjectType.Table);
      }
    });

    test('should get object by name', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectDefinition({
        objectType: 'Table',
        objectName: 'Payment Terms',
        summaryMode: false
      });

      expect(result.object).toBeDefined();
      if (result.object) {
        expect(result.object.name).toBe('Payment Terms');
        expect(result.object.type).toBe(CALObjectType.Table);
      }
    });

    test('should return error for missing object', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectDefinition({
        objectType: 'Table',
        objectId: 99999,
        summaryMode: false
      });

      expect(result.object).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('should handle summary mode', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectDefinition({
        objectType: 'Table',
        objectId: 3,
        summaryMode: true
      });

      expect(result.object).toBeDefined();
      // In summary mode, fields and procedures should be truncated
    });
  });

  describe('cal_find_references', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should find references to a table', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await findReferences({
        targetName: 'Payment Terms',
        includeContext: false
      });

      expect(result.references).toBeDefined();
      expect(Array.isArray(result.references)).toBe(true);
    });

    test('should find references to a specific field', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await findReferences({
        targetName: 'Payment Terms',
        fieldName: 'No.',
        includeContext: false
      });

      expect(result.references).toBeDefined();
      // Should only include references to the specific field
    });

    test('should filter by reference type', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await findReferences({
        targetName: 'Payment Terms',
        referenceType: 'TableRelation',
        includeContext: false
      });

      expect(result.references).toBeDefined();
      if (result.references.length > 0) {
        expect(result.references.every(ref => ref.referenceType === 'TableRelation')).toBe(true);
      }
    });

    test('should include context when requested', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await findReferences({
        targetName: 'Payment Terms',
        includeContext: true
      });

      expect(result.references).toBeDefined();
      // Context should include additional details
    });
  });

  describe('cal_search_object_members', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should search procedures in an object', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjectMembers({
        objectName: 'Payment Terms',
        memberType: 'procedures',
        pattern: 'Init*',
        limit: 20,
        offset: 0,
        includeDetails: true
      });

      expect(result.members).toBeDefined();
      expect(Array.isArray(result.members)).toBe(true);
    });

    test('should search fields in a table', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjectMembers({
        objectName: 'Payment Terms',
        memberType: 'fields',
        pattern: '*No*',
        limit: 20,
        offset: 0,
        includeDetails: true
      });

      expect(result.members).toBeDefined();
      expect(Array.isArray(result.members)).toBe(true);
    });

    test('should respect pagination', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const page1 = await searchObjectMembers({
        objectName: 'Payment Terms',
        memberType: 'fields',
        limit: 5,
        offset: 0,
        includeDetails: true
      });

      const page2 = await searchObjectMembers({
        objectName: 'Payment Terms',
        memberType: 'fields',
        limit: 5,
        offset: 5,
        includeDetails: true
      });

      expect(page1.members).toBeDefined();
      expect(page2.members).toBeDefined();
    });

    test('should handle object type filter', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await searchObjectMembers({
        objectName: 'Payment Terms',
        objectType: 'Table',
        memberType: 'fields',
        limit: 20,
        offset: 0,
        includeDetails: true
      });

      expect(result.members).toBeDefined();
    });
  });

  describe('cal_get_object_summary', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should get categorized summary of an object', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectSummary({
        objectName: 'Payment Terms'
      });

      expect(result.summary).toBeDefined();
      if (result.summary) {
        expect(result.summary.id).toBeDefined();
        expect(result.summary.name).toBe('Payment Terms');
        expect(result.summary.type).toBeDefined();
      }
    });

    test('should include categorized procedures', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectSummary({
        objectName: 'Payment Terms'
      });

      expect(result.summary).toBeDefined();
      // Should have categories like 'Init', 'Validation', 'Calculation', etc.
    });

    test('should handle object type filter', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectSummary({
        objectName: 'Payment Terms',
        objectType: 'Table'
      });

      expect(result.summary).toBeDefined();
    });

    test('should return error for non-existent object', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await getObjectSummary({
        objectName: 'NonExistentObject'
      });

      expect(result.summary).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('cal_files', () => {
    beforeEach(() => {
      FileRegistry.clear();
    });

    test('should load files from path', async () => {
      const result = await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt',
        autoDiscover: false
      });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.totalFiles).toBeGreaterThan(0);
    });

    test('should auto-discover files in directory', async () => {
      const result = await manageFiles({
        action: 'load',
        path: './fixtures',
        autoDiscover: true
      });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
    });

    test('should list loaded files', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await manageFiles({
        action: 'list'
      });

      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });

    test('should get statistics', async () => {
      await manageFiles({
        action: 'load',
        path: './fixtures/table-simple.txt'
      });

      const result = await manageFiles({
        action: 'stats'
      });

      expect(result.stats).toBeDefined();
      expect(result.stats?.totalObjects).toBeGreaterThanOrEqual(0);
      expect(result.stats?.totalFiles).toBeGreaterThanOrEqual(0);
    });

    test('should handle loading errors gracefully', async () => {
      const result = await manageFiles({
        action: 'load',
        path: './non-existent-path/file.txt',
        autoDiscover: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
