/**
 * Test suite for Reference Extractor
 * TDD RED phase: Write tests first before implementing extractor
 */

import { describe, test, expect } from 'bun:test';
import { extractReferences, extractTableRelationRef, extractCalcFormulaRefs, extractRecordVariableRef } from '../core/reference-extractor';
import { CALObjectType, CALTable, CALCodeunit, CALPage, CALReport, CALField, CALVariable } from '../types/cal-types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Reference Extractor', () => {
  // Helper to read fixture files
  const readFixture = (filename: string): string => {
    return readFileSync(join(process.cwd(), 'fixtures', filename), 'utf-8');
  };

  describe('extractTableRelationRef - TableRelation extraction', () => {
    test('should extract simple TableRelation reference', () => {
      const field: CALField = {
        id: 1,
        name: 'Customer No.',
        dataType: 'Code20',
        properties: [
          { name: 'TableRelation', value: 'Customer' }
        ],
      };
      
      const table: CALTable = {
        id: 37,
        name: 'Sales Line',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const result = extractTableRelationRef(field, table);
      
      expect(result).toBeDefined();
      expect(result?.sourceType).toBe(CALObjectType.Table);
      expect(result?.sourceId).toBe(37);
      expect(result?.sourceName).toBe('Sales Line');
      expect(result?.sourceLocation).toBe('Field:Customer No.');
      expect(result?.targetType).toBe('Table');
      expect(result?.targetName).toBe('Customer');
      expect(result?.referenceType).toBe('TableRelation');
    });

    test('should extract TableRelation with WHERE clause', () => {
      const field: CALField = {
        id: 3,
        name: 'Payment Terms Code',
        dataType: 'Code10',
        properties: [
          { name: 'TableRelation', value: '"Payment Terms" WHERE (Type=CONST(Customer))' }
        ],
      };
      
      const table: CALTable = {
        id: 18,
        name: 'Customer',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const result = extractTableRelationRef(field, table);
      
      expect(result).toBeDefined();
      expect(result?.targetName).toBe('Payment Terms');
      expect(result?.referenceType).toBe('TableRelation');
    });

    test('should extract TableRelation with complex quoted table name', () => {
      const field: CALField = {
        id: 10,
        name: 'Account No.',
        dataType: 'Code20',
        properties: [
          { name: 'TableRelation', value: '"G/L Account" WHERE (Type=FILTER(Posting))' }
        ],
      };
      
      const table: CALTable = {
        id: 81,
        name: 'Gen. Journal Line',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const result = extractTableRelationRef(field, table);
      
      expect(result).toBeDefined();
      expect(result?.targetName).toBe('G/L Account');
    });

    test('should return undefined for field without TableRelation', () => {
      const field: CALField = {
        id: 1,
        name: 'Description',
        dataType: 'Text50',
        properties: [],
      };
      
      const table: CALTable = {
        id: 27,
        name: 'Item',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const result = extractTableRelationRef(field, table);
      expect(result).toBeUndefined();
    });
  });

  describe('extractCalcFormulaRefs - CalcFormula extraction', () => {
    test('should extract Sum CalcFormula reference', () => {
      const field: CALField = {
        id: 25,
        name: 'Customer Balance',
        dataType: 'Decimal',
        fieldClass: 'FlowField',
        calcFormula: 'Sum("Detailed Cust. Ledg. Entry".Amount WHERE (Customer No.=FIELD(Customer Filter)))',
        properties: [
          { name: 'FieldClass', value: 'FlowField' },
          { name: 'CalcFormula', value: 'Sum("Detailed Cust. Ledg. Entry".Amount WHERE (Customer No.=FIELD(Customer Filter)))' }
        ],
      };
      
      const table: CALTable = {
        id: 4,
        name: 'Currency',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      
      expect(results).toHaveLength(1);
      expect(results[0].sourceType).toBe(CALObjectType.Table);
      expect(results[0].sourceId).toBe(4);
      expect(results[0].sourceName).toBe('Currency');
      expect(results[0].sourceLocation).toBe('Field:Customer Balance');
      expect(results[0].targetType).toBe('Table');
      expect(results[0].targetName).toBe('Detailed Cust. Ledg. Entry');
      expect(results[0].referenceType).toBe('CalcFormula');
    });

    test('should extract Exist CalcFormula reference', () => {
      const field: CALField = {
        id: 24,
        name: 'Cust. Ledg. Entries in Filter',
        dataType: 'Boolean',
        fieldClass: 'FlowField',
        calcFormula: 'Exist("Cust. Ledger Entry" WHERE (Customer No.=FIELD(Customer Filter)))',
        properties: [
          { name: 'FieldClass', value: 'FlowField' },
          { name: 'CalcFormula', value: 'Exist("Cust. Ledger Entry" WHERE (Customer No.=FIELD(Customer Filter)))' }
        ],
      };
      
      const table: CALTable = {
        id: 4,
        name: 'Currency',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      
      expect(results).toHaveLength(1);
      expect(results[0].targetName).toBe('Cust. Ledger Entry');
      expect(results[0].referenceType).toBe('CalcFormula');
    });

    test('should extract Count CalcFormula reference', () => {
      const field: CALField = {
        id: 50,
        name: 'No. of Items',
        dataType: 'Integer',
        fieldClass: 'FlowField',
        calcFormula: 'Count("Sales Line" WHERE (Document Type=FIELD(Document Type),Document No.=FIELD(No.)))',
        properties: [
          { name: 'FieldClass', value: 'FlowField' },
          { name: 'CalcFormula', value: 'Count("Sales Line" WHERE (Document Type=FIELD(Document Type),Document No.=FIELD(No.)))' }
        ],
      };
      
      const table: CALTable = {
        id: 36,
        name: 'Sales Header',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      
      expect(results).toHaveLength(1);
      expect(results[0].targetName).toBe('Sales Line');
      expect(results[0].referenceType).toBe('CalcFormula');
    });

    test('should extract field reference from CalcFormula', () => {
      const field: CALField = {
        id: 25,
        name: 'Balance',
        dataType: 'Decimal',
        fieldClass: 'FlowField',
        calcFormula: 'Sum("Detailed Cust. Ledg. Entry".Amount WHERE (Customer No.=FIELD(Customer Filter)))',
        properties: [
          { name: 'CalcFormula', value: 'Sum("Detailed Cust. Ledg. Entry".Amount WHERE (Customer No.=FIELD(Customer Filter)))' }
        ],
      };
      
      const table: CALTable = {
        id: 18,
        name: 'Customer',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      
      expect(results).toHaveLength(1);
      // Should extract both table and field reference
      expect(results[0].targetName).toBe('Detailed Cust. Ledg. Entry');
    });

    test('should return empty array for field without CalcFormula', () => {
      const field: CALField = {
        id: 1,
        name: 'Description',
        dataType: 'Text50',
        properties: [],
      };
      
      const table: CALTable = {
        id: 27,
        name: 'Item',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      expect(results).toHaveLength(0);
    });
  });

  describe('extractRecordVariableRef - Record variable extraction', () => {
    test('should extract Record variable reference', () => {
      const variable: CALVariable = {
        name: 'Customer',
        type: 'Record 18',
      };
      
      const codeunit: CALCodeunit = {
        id: 80,
        name: 'Sales-Post',
        type: CALObjectType.Codeunit,
        procedures: [],
        variables: [variable],
        properties: [],
      };

      const result = extractRecordVariableRef(variable, codeunit);
      
      expect(result).toBeDefined();
      expect(result?.sourceType).toBe(CALObjectType.Codeunit);
      expect(result?.sourceId).toBe(80);
      expect(result?.sourceName).toBe('Sales-Post');
      expect(result?.sourceLocation).toBe('Variable:Customer');
      expect(result?.targetType).toBe('Table');
      expect(result?.targetId).toBe(18);
      expect(result?.targetName).toBe('18');
      expect(result?.referenceType).toBe('RecordVariable');
    });

    test('should extract Record variable with quoted table name', () => {
      const variable: CALVariable = {
        name: 'GLAcc',
        type: 'Record "G/L Account"',
      };
      
      const codeunit: CALCodeunit = {
        id: 12,
        name: 'Gen. Jnl.-Post Line',
        type: CALObjectType.Codeunit,
        procedures: [],
        variables: [variable],
        properties: [],
      };

      const result = extractRecordVariableRef(variable, codeunit);
      
      expect(result).toBeDefined();
      expect(result?.targetName).toBe('G/L Account');
      expect(result?.referenceType).toBe('RecordVariable');
    });

    test('should return undefined for non-Record variable', () => {
      const variable: CALVariable = {
        name: 'Counter',
        type: 'Integer',
      };
      
      const codeunit: CALCodeunit = {
        id: 80,
        name: 'Sales-Post',
        type: CALObjectType.Codeunit,
        procedures: [],
        variables: [variable],
        properties: [],
      };

      const result = extractRecordVariableRef(variable, codeunit);
      expect(result).toBeUndefined();
    });
  });

  describe('extractReferences - Full object extraction', () => {
    test('should extract all references from Table object', () => {
      const table: CALTable = {
        id: 37,
        name: 'Sales Line',
        type: CALObjectType.Table,
        fields: [
          {
            id: 1,
            name: 'Document Type',
            dataType: 'Option',
            properties: [],
          },
          {
            id: 3,
            name: 'Sell-to Customer No.',
            dataType: 'Code20',
            properties: [
              { name: 'TableRelation', value: 'Customer' }
            ],
          },
          {
            id: 10,
            name: 'Amount',
            dataType: 'Decimal',
            fieldClass: 'FlowField',
            calcFormula: 'Sum("Sales Line".Amount WHERE (Document Type=FIELD(Document Type)))',
            properties: [
              { name: 'CalcFormula', value: 'Sum("Sales Line".Amount WHERE (Document Type=FIELD(Document Type)))' }
            ],
          },
        ],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractReferences(table);
      
      // Should extract: 1 TableRelation + 1 CalcFormula = 2 references
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      const tableRelationRef = results.find(r => r.referenceType === 'TableRelation');
      expect(tableRelationRef).toBeDefined();
      expect(tableRelationRef?.targetName).toBe('Customer');
      
      const calcFormulaRef = results.find(r => r.referenceType === 'CalcFormula');
      expect(calcFormulaRef).toBeDefined();
    });

    test('should extract SourceTable reference from Page object', () => {
      const page: CALPage = {
        id: 21,
        name: 'Customer Card',
        type: CALObjectType.Page,
        sourceTable: 18,
        controls: [],
        actions: [],
        procedures: [],
        properties: [
          { name: 'SourceTable', value: '18' }
        ],
      };

      const results = extractReferences(page);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      const sourceTableRef = results.find(r => r.referenceType === 'SourceTable');
      expect(sourceTableRef).toBeDefined();
      expect(sourceTableRef?.sourceType).toBe(CALObjectType.Page);
      expect(sourceTableRef?.targetType).toBe('Table');
      expect(sourceTableRef?.targetId).toBe(18);
      expect(sourceTableRef?.referenceType).toBe('SourceTable');
    });

    test('should extract DataItemTable reference from Report object', () => {
      const report: CALReport = {
        id: 111,
        name: 'Customer - Balance to Date',
        type: CALObjectType.Report,
        dataItems: [
          {
            id: 1,
            name: 'Customer',
            sourceTable: 18,
            indentation: 0,
            columns: [],
            properties: [],
          },
        ],
        columns: [],
        procedures: [],
        variables: [],
        properties: [],
      };

      const results = extractReferences(report);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      const dataItemRef = results.find(r => r.referenceType === 'DataItemTable');
      expect(dataItemRef).toBeDefined();
      expect(dataItemRef?.sourceType).toBe(CALObjectType.Report);
      expect(dataItemRef?.targetType).toBe('Table');
      expect(dataItemRef?.targetId).toBe(18);
    });

    test('should extract Record variables from Codeunit object', () => {
      const codeunit: CALCodeunit = {
        id: 80,
        name: 'Sales-Post',
        type: CALObjectType.Codeunit,
        procedures: [],
        variables: [
          {
            name: 'SalesHeader',
            type: 'Record 36',
          },
          {
            name: 'SalesLine',
            type: 'Record 37',
          },
          {
            name: 'Counter',
            type: 'Integer',
          },
        ],
        properties: [],
      };

      const results = extractReferences(codeunit);
      
      // Should extract 2 Record variables (not the Integer)
      expect(results.length).toBe(2);
      expect(results.every(r => r.referenceType === 'RecordVariable')).toBe(true);
    });

    test('should return empty array for object with no references', () => {
      const codeunit: CALCodeunit = {
        id: 1,
        name: 'Test Codeunit',
        type: CALObjectType.Codeunit,
        procedures: [],
        variables: [
          {
            name: 'Counter',
            type: 'Integer',
          },
          {
            name: 'Result',
            type: 'Boolean',
          },
        ],
        properties: [],
      };

      const results = extractReferences(codeunit);
      expect(results).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle malformed TableRelation gracefully', () => {
      const field: CALField = {
        id: 1,
        name: 'Test Field',
        dataType: 'Code20',
        properties: [
          { name: 'TableRelation', value: '' }
        ],
      };
      
      const table: CALTable = {
        id: 1,
        name: 'Test Table',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const result = extractTableRelationRef(field, table);
      expect(result).toBeUndefined();
    });

    test('should handle malformed CalcFormula gracefully', () => {
      const field: CALField = {
        id: 1,
        name: 'Test Field',
        dataType: 'Decimal',
        calcFormula: 'Invalid Formula',
        properties: [],
      };
      
      const table: CALTable = {
        id: 1,
        name: 'Test Table',
        type: CALObjectType.Table,
        fields: [field],
        keys: [],
        fieldGroups: [],
        procedures: [],
        properties: [],
      };

      const results = extractCalcFormulaRefs(field, table);
      expect(results).toHaveLength(0);
    });

    test('should handle Page without SourceTable', () => {
      const page: CALPage = {
        id: 100,
        name: 'Test Page',
        type: CALObjectType.Page,
        controls: [],
        actions: [],
        procedures: [],
        properties: [],
      };

      const results = extractReferences(page);
      expect(results).toHaveLength(0);
    });
  });
});
