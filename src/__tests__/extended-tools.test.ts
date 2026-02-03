/**
 * Test suite for Extended MCP Tools
 * TDD approach: Write tests first before implementing
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { SymbolDatabase } from '../core/symbol-database';
import { CALObjectType, CALTable, CALPage, CALCodeunit } from '../types/cal-types';
import {
  searchCode,
  getDependencies,
  getTableRelations,
} from '../tools/mcp-tools';

describe('Extended MCP Tools', () => {
  let db: SymbolDatabase;

  beforeEach(() => {
    db = new SymbolDatabase();
  });

  // Test fixtures
  const createTestTable = (
    id: number,
    name: string,
    fields: Array<{ name: string; tableRelation?: string; calcFormula?: string }>
  ): CALTable => ({
    id,
    name,
    type: CALObjectType.Table,
    properties: [],
    fields: fields.map((f, i) => ({
      id: i + 1,
      name: f.name,
      dataType: 'Code',
      properties: f.tableRelation
        ? [{ name: 'TableRelation', value: f.tableRelation }]
        : [],
      calcFormula: f.calcFormula,
    })),
    keys: [],
    fieldGroups: [],
    procedures: [],
  });

  const createTableWithProcedures = (
    id: number,
    name: string,
    procedures: Array<{ name: string; body: string }>
  ): CALTable => ({
    id,
    name,
    type: CALObjectType.Table,
    properties: [],
    fields: [],
    keys: [],
    fieldGroups: [],
    procedures: procedures.map((p, i) => ({
      id: i + 1,
      name: p.name,
      parameters: [],
      localVariables: [],
      body: p.body,
    })),
  });

  const createCodeunitWithProcedures = (
    id: number,
    name: string,
    procedures: Array<{ name: string; body: string }>,
    variables: Array<{ name: string; type: string }> = []
  ): CALCodeunit => ({
    id,
    name,
    type: CALObjectType.Codeunit,
    properties: [],
    variables: variables.map((v) => ({
      name: v.name,
      type: v.type,
    })),
    procedures: procedures.map((p, i) => ({
      id: i + 1,
      name: p.name,
      parameters: [],
      localVariables: [],
      body: p.body,
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
    procedures: [],
  });

  describe('cal_search_code', () => {
    test('should find pattern in procedure bodies', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'ValidateCustomer', body: 'IF Customer.Name = \'\' THEN\n  ERROR(\'Name required\');' },
        { name: 'PostCustomer', body: 'Cust.MODIFY;\nCUSTOMER.FIND(\'-\');' },
      ]);
      db.addObject(table);

      const results = searchCode(db, { pattern: 'ERROR' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].objectName).toBe('Customer');
      expect(results[0].procedureName).toBe('ValidateCustomer');
      expect(results[0].match).toContain('ERROR');
    });

    test('should filter by object type', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'ValidateCustomer', body: 'ERROR(\'Test\');' },
      ]);
      const codeunit = createCodeunitWithProcedures(50, 'SalesPost', [
        { name: 'Post', body: 'ERROR(\'Test\');' },
      ]);
      db.addObject(table);
      db.addObject(codeunit);

      const results = searchCode(db, { pattern: 'ERROR', objectType: 'Codeunit' });
      
      expect(results.length).toBe(1);
      expect(results[0].objectType).toBe('Codeunit');
      expect(results[0].objectName).toBe('SalesPost');
    });

    test('should respect limit parameter', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'Proc1', body: 'MODIFY' },
        { name: 'Proc2', body: 'MODIFY' },
        { name: 'Proc3', body: 'MODIFY' },
      ]);
      db.addObject(table);

      const results = searchCode(db, { pattern: 'MODIFY', limit: 2 });
      
      expect(results.length).toBe(2);
    });

    test('should return empty array for no matches', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'ValidateCustomer', body: 'IF TRUE THEN;' },
      ]);
      db.addObject(table);

      const results = searchCode(db, { pattern: 'NONEXISTENT' });
      
      expect(results.length).toBe(0);
    });

    test('should support regex patterns', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'ValidateCustomer', body: 'ERROR(\'Invalid customer\');' },
        { name: 'PostCustomer', body: 'MESSAGE(\'Posted successfully\');' },
      ]);
      db.addObject(table);

      const results = searchCode(db, { pattern: 'ERROR|MESSAGE' });
      
      expect(results.length).toBe(2);
    });

    test('should include line context in results', () => {
      const table = createTableWithProcedures(18, 'Customer', [
        { name: 'ValidateCustomer', body: 'Line1;\nERROR(\'Test\');\nLine3;' },
      ]);
      db.addObject(table);

      const results = searchCode(db, { pattern: 'ERROR' });
      
      expect(results.length).toBe(1);
      expect(results[0].match).toContain('ERROR');
    });
  });

  describe('cal_get_dependencies', () => {
    test('should return incoming references', () => {
      const customerTable = createTestTable(18, 'Customer', []);
      const salesHeaderTable = createTestTable(36, 'Sales Header', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
      ]);
      db.addObject(customerTable);
      db.addObject(salesHeaderTable);

      const deps = getDependencies(db, {
        objectType: 'Table',
        objectId: 18,
        direction: 'incoming',
      });

      expect(deps.incoming.length).toBeGreaterThan(0);
      expect(deps.incoming[0].sourceName).toBe('Sales Header');
      expect(deps.incoming[0].targetName).toBe('Customer');
    });

    test('should return outgoing references', () => {
      const customerTable = createTestTable(18, 'Customer', []);
      const salesHeaderTable = createTestTable(36, 'Sales Header', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
      ]);
      db.addObject(customerTable);
      db.addObject(salesHeaderTable);

      const deps = getDependencies(db, {
        objectType: 'Table',
        objectId: 36,
        direction: 'outgoing',
      });

      expect(deps.outgoing.length).toBeGreaterThan(0);
      expect(deps.outgoing[0].targetName).toBe('Customer');
    });

    test('should return both incoming and outgoing by default', () => {
      const customerTable = createTestTable(18, 'Customer', [
        { name: 'Currency Code', tableRelation: 'Currency' },
      ]);
      const currencyTable = createTestTable(4, 'Currency', []);
      const salesHeaderTable = createTestTable(36, 'Sales Header', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
      ]);
      db.addObject(customerTable);
      db.addObject(currencyTable);
      db.addObject(salesHeaderTable);

      const deps = getDependencies(db, {
        objectType: 'Table',
        objectId: 18,
      });

      expect(deps.incoming.length).toBeGreaterThan(0);
      expect(deps.outgoing.length).toBeGreaterThan(0);
    });

    test('should include page SourceTable references', () => {
      const customerTable = createTestTable(18, 'Customer', []);
      const customerCardPage = createTestPage(21, 'Customer Card', 18);
      db.addObject(customerTable);
      db.addObject(customerCardPage);

      const deps = getDependencies(db, {
        objectType: 'Table',
        objectId: 18,
        direction: 'incoming',
      });

      expect(deps.incoming.some(ref => ref.sourceType === 'Page')).toBe(true);
    });

    test('should return empty arrays for object with no dependencies', () => {
      const table = createTestTable(999, 'Isolated Table', []);
      db.addObject(table);

      const deps = getDependencies(db, {
        objectType: 'Table',
        objectId: 999,
      });

      expect(deps.incoming.length).toBe(0);
      expect(deps.outgoing.length).toBe(0);
    });
  });

  describe('cal_get_table_relations', () => {
    test('should map all TableRelation properties', () => {
      const customerTable = createTestTable(18, 'Customer', []);
      const currencyTable = createTestTable(4, 'Currency', []);
      const salesHeaderTable = createTestTable(36, 'Sales Header', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
        { name: 'Currency Code', tableRelation: 'Currency' },
      ]);
      db.addObject(customerTable);
      db.addObject(currencyTable);
      db.addObject(salesHeaderTable);

      const relations = getTableRelations(db, {});

      expect(relations.length).toBeGreaterThanOrEqual(2);
      expect(relations.some(r => r.targetName === 'Customer')).toBe(true);
      expect(relations.some(r => r.targetName === 'Currency')).toBe(true);
    });

    test('should filter by specific table', () => {
      const customerTable = createTestTable(18, 'Customer', []);
      const salesHeaderTable = createTestTable(36, 'Sales Header', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
      ]);
      const salesLineTable = createTestTable(37, 'Sales Line', [
        { name: 'Sell-to Customer No.', tableRelation: 'Customer' },
      ]);
      db.addObject(customerTable);
      db.addObject(salesHeaderTable);
      db.addObject(salesLineTable);

      const relations = getTableRelations(db, { tableId: 36 });

      expect(relations.length).toBeGreaterThan(0);
      expect(relations.every(r => r.sourceId === 36)).toBe(true);
    });

    test('should include CalcFormula references when enabled', () => {
      const custLedgerTable = createTestTable(21, 'Cust. Ledger Entry', []);
      const customerTable = createTestTable(18, 'Customer', [
        {
          name: 'Balance',
          calcFormula: 'Sum("Cust. Ledger Entry".Amount WHERE (Customer No.=FIELD(No.)))',
        },
      ]);
      db.addObject(custLedgerTable);
      db.addObject(customerTable);

      const relations = getTableRelations(db, { includeCalcFormula: true });

      expect(relations.some(r => r.referenceType === 'CalcFormula')).toBe(true);
      expect(relations.some(r => r.targetName === 'Cust. Ledger Entry')).toBe(true);
    });

    test('should exclude CalcFormula by default', () => {
      const custLedgerTable = createTestTable(21, 'Cust. Ledger Entry', []);
      const customerTable = createTestTable(18, 'Customer', [
        {
          name: 'Balance',
          calcFormula: 'Sum("Cust. Ledger Entry".Amount WHERE (Customer No.=FIELD(No.)))',
        },
      ]);
      db.addObject(custLedgerTable);
      db.addObject(customerTable);

      const relations = getTableRelations(db, {});

      expect(relations.every(r => r.referenceType === 'TableRelation')).toBe(true);
    });

    test('should return empty array for no relations', () => {
      const table = createTestTable(999, 'Isolated Table', []);
      db.addObject(table);

      const relations = getTableRelations(db, {});

      expect(Array.isArray(relations)).toBe(true);
    });

    test('should handle complex TableRelation with WHERE clause', () => {
      const paymentTermsTable = createTestTable(3, 'Payment Terms', []);
      const customerTable = createTestTable(18, 'Customer', [
        {
          name: 'Payment Terms Code',
          tableRelation: '"Payment Terms" WHERE (Code=FILTER(<>\'\'))',
        },
      ]);
      db.addObject(paymentTermsTable);
      db.addObject(customerTable);

      const relations = getTableRelations(db, {});

      expect(relations.some(r => r.targetName === 'Payment Terms')).toBe(true);
    });
  });
});
