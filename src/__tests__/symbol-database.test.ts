/**
 * Test suite for Symbol Database
 * TDD approach: Write tests first before implementing
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { SymbolDatabase } from '../core/symbol-database';
import { CALObjectType, CALTable, CALPage, CALCodeunit } from '../types/cal-types';

describe('SymbolDatabase', () => {
  let db: SymbolDatabase;

  beforeEach(() => {
    db = new SymbolDatabase();
  });

  // Test fixtures
  const createTestTable = (id: number, name: string, fieldCount: number = 3): CALTable => ({
    id,
    name,
    type: CALObjectType.Table,
    properties: [],
    fields: Array.from({ length: fieldCount }, (_, i) => ({
      id: i + 1,
      name: `Field${i + 1}`,
      dataType: 'Code',
      properties: [],
    })),
    keys: [],
    fieldGroups: [],
    procedures: Array.from({ length: fieldCount }, (_, i) => ({
      id: i + 1,
      name: `Procedure${i + 1}`,
      parameters: [],
      localVariables: [],
      body: '',
    })),
  });

  const createTestPage = (id: number, name: string, sourceTable?: number): CALPage => ({
    id,
    name,
    type: CALObjectType.Page,
    properties: [],
    sourceTable,
    controls: [],
    actions: [],
    procedures: [{
      id: 1,
      name: 'OnOpenPage',
      parameters: [],
      localVariables: [],
      body: '',
    }],
  });

  const createTestCodeunit = (id: number, name: string, procCount: number = 2): CALCodeunit => ({
    id,
    name,
    type: CALObjectType.Codeunit,
    properties: [],
    variables: [],
    procedures: Array.from({ length: procCount }, (_, i) => ({
      id: i + 1,
      name: `Function${i + 1}`,
      parameters: [],
      localVariables: [],
      body: '',
    })),
  });

  describe('addObject', () => {
    test('should add object and build all indices', () => {
      const table = createTestTable(18, 'Customer', 3);
      db.addObject(table);

      expect(db.getObject(CALObjectType.Table, 18)).toBeDefined();
      expect(db.getObject(CALObjectType.Table, 'Customer')).toBeDefined();
      expect(db.getObjectsByType(CALObjectType.Table)).toHaveLength(1);
    });

    test('should index fields by table', () => {
      const table = createTestTable(18, 'Customer', 5);
      db.addObject(table);

      const fields = db.getFieldsByTable(18);
      expect(fields).toHaveLength(5);
      expect(fields[0].name).toBe('Field1');
    });

    test('should index procedures by object', () => {
      const codeunit = createTestCodeunit(50, 'SalesPost', 4);
      db.addObject(codeunit);

      const procedures = db.getProceduresByObject(CALObjectType.Codeunit, 50);
      expect(procedures).toHaveLength(4);
      expect(procedures[0].name).toBe('Function1');
    });

    test('should handle multiple objects with same name but different types', () => {
      const table = createTestTable(18, 'Customer', 2);
      const page = createTestPage(21, 'Customer', 18);
      
      db.addObject(table);
      db.addObject(page);

      const tableObj = db.getObject(CALObjectType.Table, 'Customer');
      const pageObj = db.getObject(CALObjectType.Page, 'Customer');

      expect(tableObj?.id).toBe(18);
      expect(pageObj?.id).toBe(21);
    });

    test('should update object if same type and id already exists', () => {
      const table1 = createTestTable(18, 'Customer', 2);
      const table2 = createTestTable(18, 'Customer Updated', 5);
      
      db.addObject(table1);
      db.addObject(table2);

      const result = db.getObject(CALObjectType.Table, 18);
      expect(result?.name).toBe('Customer Updated');
      expect((result as CALTable).fields).toHaveLength(5);
    });
  });

  describe('searchObjects - wildcard patterns', () => {
    beforeEach(() => {
      db.addObject(createTestTable(18, 'Customer', 2));
      db.addObject(createTestTable(23, 'Vendor', 2));
      db.addObject(createTestTable(36, 'Sales Header', 2));
      db.addObject(createTestTable(37, 'Sales Line', 2));
      db.addObject(createTestPage(21, 'Customer Card', 18));
      db.addObject(createTestPage(22, 'Customer List', 18));
      db.addObject(createTestCodeunit(80, 'Sales-Post', 2));
    });

    test('should search with wildcard at end: "Cust*"', () => {
      const results = db.searchObjects('Cust*');
      expect(results).toHaveLength(3);
      expect(results.every(r => r.name.toLowerCase().startsWith('cust'))).toBe(true);
    });

    test('should search with wildcard at start: "*Post"', () => {
      const results = db.searchObjects('*Post');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Sales-Post');
    });

    test('should search with wildcard in middle: "Sales*Header"', () => {
      const results = db.searchObjects('Sales*Header');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Sales Header');
    });

    test('should search case-insensitively', () => {
      const results = db.searchObjects('CUSTOMER*');
      expect(results).toHaveLength(3);
    });

    test('should search without wildcards (exact match)', () => {
      const results = db.searchObjects('Vendor');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Vendor');
    });

    test('should filter by object type', () => {
      const results = db.searchObjects('Cust*', CALObjectType.Table);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(CALObjectType.Table);
    });

    test('should return empty array for no matches', () => {
      const results = db.searchObjects('NonExistent*');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchObjects - pagination', () => {
    beforeEach(() => {
      // Add 10 tables
      for (let i = 1; i <= 10; i++) {
        db.addObject(createTestTable(i, `Table${i}`, 1));
      }
    });

    test('should respect limit parameter', () => {
      const results = db.searchObjects('Table*', undefined, 5);
      expect(results).toHaveLength(5);
    });

    test('should respect offset parameter', () => {
      const firstPage = db.searchObjects('Table*', undefined, 5, 0);
      const secondPage = db.searchObjects('Table*', undefined, 5, 5);
      
      expect(firstPage).toHaveLength(5);
      expect(secondPage).toHaveLength(5);
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    test('should handle offset beyond results', () => {
      const results = db.searchObjects('Table*', undefined, 5, 100);
      expect(results).toHaveLength(0);
    });

    test('should handle limit + offset correctly', () => {
      const results = db.searchObjects('Table*', undefined, 3, 7);
      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Table8');
    });
  });

  describe('getObject', () => {
    beforeEach(() => {
      db.addObject(createTestTable(18, 'Customer', 2));
      db.addObject(createTestPage(21, 'Customer Card', 18));
    });

    test('should get object by ID', () => {
      const result = db.getObject(CALObjectType.Table, 18);
      expect(result).toBeDefined();
      expect(result?.id).toBe(18);
      expect(result?.name).toBe('Customer');
    });

    test('should get object by name', () => {
      const result = db.getObject(CALObjectType.Table, 'Customer');
      expect(result).toBeDefined();
      expect(result?.id).toBe(18);
    });

    test('should return undefined for non-existent ID', () => {
      const result = db.getObject(CALObjectType.Table, 999);
      expect(result).toBeUndefined();
    });

    test('should return undefined for non-existent name', () => {
      const result = db.getObject(CALObjectType.Table, 'NonExistent');
      expect(result).toBeUndefined();
    });

    test('should distinguish between types when searching by name', () => {
      const table = db.getObject(CALObjectType.Table, 'Customer');
      const page = db.getObject(CALObjectType.Page, 'Customer Card');
      
      expect(table?.type).toBe(CALObjectType.Table);
      expect(page?.type).toBe(CALObjectType.Page);
    });
  });

  describe('getObjectsByType', () => {
    beforeEach(() => {
      db.addObject(createTestTable(18, 'Customer', 2));
      db.addObject(createTestTable(23, 'Vendor', 2));
      db.addObject(createTestPage(21, 'Customer Card', 18));
      db.addObject(createTestCodeunit(80, 'Sales-Post', 2));
    });

    test('should return all objects of given type', () => {
      const tables = db.getObjectsByType(CALObjectType.Table);
      expect(tables).toHaveLength(2);
      expect(tables.every(t => t.type === CALObjectType.Table)).toBe(true);
    });

    test('should return empty array for type with no objects', () => {
      const queries = db.getObjectsByType(CALObjectType.Query);
      expect(queries).toHaveLength(0);
    });
  });

  describe('getFieldsByTable', () => {
    test('should return fields for existing table', () => {
      const table = createTestTable(18, 'Customer', 5);
      db.addObject(table);

      const fields = db.getFieldsByTable(18);
      expect(fields).toHaveLength(5);
    });

    test('should return empty array for non-existent table', () => {
      const fields = db.getFieldsByTable(999);
      expect(fields).toHaveLength(0);
    });

    test('should return empty array for non-table object', () => {
      const page = createTestPage(21, 'Customer Card');
      db.addObject(page);

      const fields = db.getFieldsByTable(21);
      expect(fields).toHaveLength(0);
    });
  });

  describe('getProceduresByObject', () => {
    test('should return procedures for table', () => {
      const table = createTestTable(18, 'Customer', 3);
      db.addObject(table);

      const procedures = db.getProceduresByObject(CALObjectType.Table, 18);
      expect(procedures).toHaveLength(3);
    });

    test('should return procedures for codeunit', () => {
      const codeunit = createTestCodeunit(80, 'Sales-Post', 5);
      db.addObject(codeunit);

      const procedures = db.getProceduresByObject(CALObjectType.Codeunit, 80);
      expect(procedures).toHaveLength(5);
    });

    test('should return empty array for non-existent object', () => {
      const procedures = db.getProceduresByObject(CALObjectType.Table, 999);
      expect(procedures).toHaveLength(0);
    });
  });

  describe('getObjectSummary', () => {
    test('should truncate fields to max 10 in summary mode', () => {
      const table = createTestTable(18, 'Customer', 15);
      db.addObject(table);

      const summary = db.getObjectSummary(CALObjectType.Table, 18);
      expect(summary.fields).toHaveLength(10);
      expect(summary.totalFields).toBe(15);
    });

    test('should truncate procedures to max 10 in summary mode', () => {
      const codeunit = createTestCodeunit(80, 'Sales-Post', 12);
      db.addObject(codeunit);

      const summary = db.getObjectSummary(CALObjectType.Codeunit, 80);
      expect(summary.procedures).toHaveLength(10);
      expect(summary.totalProcedures).toBe(12);
    });

    test('should not truncate if fields <= 10', () => {
      const table = createTestTable(18, 'Customer', 5);
      db.addObject(table);

      const summary = db.getObjectSummary(CALObjectType.Table, 18);
      expect(summary.fields).toHaveLength(5);
      expect(summary.totalFields).toBe(5);
    });

    test('should include basic object info in summary', () => {
      const table = createTestTable(18, 'Customer', 3);
      db.addObject(table);

      const summary = db.getObjectSummary(CALObjectType.Table, 18);
      expect(summary.id).toBe(18);
      expect(summary.name).toBe('Customer');
      expect(summary.type).toBe(CALObjectType.Table);
    });

    test('should return undefined for non-existent object', () => {
      const summary = db.getObjectSummary(CALObjectType.Table, 999);
      expect(summary).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    test('should handle empty database searches', () => {
      const results = db.searchObjects('*');
      expect(results).toHaveLength(0);
    });

    test('should handle wildcard-only search pattern', () => {
      db.addObject(createTestTable(18, 'Customer', 2));
      const results = db.searchObjects('*');
      expect(results).toHaveLength(1);
    });

    test('should handle multiple wildcards in pattern', () => {
      db.addObject(createTestTable(36, 'Sales Order Header', 2));
      const results = db.searchObjects('*Order*');
      expect(results).toHaveLength(1);
    });

    test('should handle special characters in object names', () => {
      const table = createTestTable(80, 'Sales-Post (Test)', 2);
      db.addObject(table);

      const byId = db.getObject(CALObjectType.Table, 80);
      const byName = db.getObject(CALObjectType.Table, 'Sales-Post (Test)');
      
      expect(byId).toBeDefined();
      expect(byName).toBeDefined();
    });
  });
});
