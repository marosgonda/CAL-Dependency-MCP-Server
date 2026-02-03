/**
 * Tests for C/AL Query parser
 * Following TDD approach: Write tests FIRST (RED phase), then implement (GREEN phase)
 */

import { describe, it, expect } from 'bun:test';
import { parseQueryElements } from '../parser/query-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseQueryElements', () => {
  const fixturesPath = join(process.cwd(), 'fixtures');
  
  it('should parse basic ELEMENTS section with dataitems and columns', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    expect(result).toBeDefined();
    expect(result.dataItems).toBeDefined();
    expect(result.dataItems.length).toBeGreaterThan(0);
  });

  it('should extract dataitem properties correctly', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    const dataItem = result.dataItems[0];
    expect(dataItem).toBeDefined();
    expect(dataItem.name).toBe('Payment Terms');
    expect(dataItem.sourceTable).toBeDefined();
    expect(dataItem.indentation).toBe(0);
  });

  it('should extract columns from dataitem', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    const dataItem = result.dataItems[0];
    expect(dataItem.columns).toBeDefined();
    expect(dataItem.columns.length).toBeGreaterThanOrEqual(5);
    
    // Check first column
    const codeColumn = dataItem.columns.find(col => col.name === 'Code');
    expect(codeColumn).toBeDefined();
  });

  it('should parse DataItemReference property', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    const dataItem = result.dataItems[0];
    const dataItemRefProp = dataItem.properties.find(p => p.name === 'DataItemReference');
    expect(dataItemRefProp).toBeDefined();
    expect(dataItemRefProp?.value).toBe('"Payment Terms"');
  });

  it('should handle columns with special characters in sourceExpr', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    const dataItem = result.dataItems[0];
    const discountColumn = dataItem.columns.find(col => col.name === 'DiscountPercent');
    expect(discountColumn).toBeDefined();
    expect(discountColumn?.sourceField).toBe('"Discount %"');
  });

  it('should handle nested dataitems with indentation', () => {
    const nestedElements = `
      ELEMENTS
      {
        { DATAITEM "Customer";"Customer"
                    {
                      column(No;No)
                      {
                      }
                      { DATAITEM "Customer Ledger Entry";"Cust. Ledger Entry"
                                  {
                                    column(Entry_No;"Entry No.")
                                    {
                                    }
                                  }
                      }
                    }
        }
      }
    `;
    
    const result = parseQueryElements(nestedElements);
    expect(result.dataItems.length).toBeGreaterThanOrEqual(1);
    
    // Parent dataitem should have indentation 0
    const customerDataItem = result.dataItems.find(di => di.name === 'Customer');
    expect(customerDataItem).toBeDefined();
    expect(customerDataItem?.indentation).toBe(0);
    
    // Child dataitem should have indentation > 0
    const ledgerDataItem = result.dataItems.find(di => di.name === 'Customer Ledger Entry');
    expect(ledgerDataItem).toBeDefined();
    expect(ledgerDataItem?.indentation).toBeGreaterThan(0);
  });

  it('should handle empty ELEMENTS section', () => {
    const emptyElements = `
      ELEMENTS
      {
      }
    `;
    
    const result = parseQueryElements(emptyElements);
    expect(result.dataItems).toBeDefined();
    expect(result.dataItems.length).toBe(0);
    expect(result.columns.length).toBe(0);
  });

  it('should throw error for missing ELEMENTS section', () => {
    const invalidContent = `
      PROPERTIES
      {
        CaptionML=[ENU=Sample Query];
      }
    `;
    
    expect(() => parseQueryElements(invalidContent)).toThrow();
  });

  it('should parse multiple dataitems at same level', () => {
    const multipleDataItems = `
      ELEMENTS
      {
        { DATAITEM "Payment Terms";"Payment Terms"
                    {
                      column(Code;Code)
                      {
                      }
                    }
        }
        { DATAITEM "Currency";"Currency"
                    {
                      column(Code;Code)
                      {
                      }
                    }
        }
      }
    `;
    
    const result = parseQueryElements(multipleDataItems);
    expect(result.dataItems.length).toBe(2);
    expect(result.dataItems[0].name).toBe('Payment Terms');
    expect(result.dataItems[1].name).toBe('Currency');
  });

  it('should extract all columns at query level', () => {
    const queryContent = readFileSync(join(fixturesPath, 'query.txt'), 'utf-8');
    const result = parseQueryElements(queryContent);
    
    // All columns from all dataitems should be collected
    expect(result.columns).toBeDefined();
    expect(result.columns.length).toBeGreaterThanOrEqual(5);
  });

  it('should handle filters in dataitems', () => {
    const queryWithFilters = `
      ELEMENTS
      {
        { DATAITEM "Customer";"Customer"
                    {
                      column(No;No)
                      {
                      }
                      filter(Balance_Filter;"Balance (LCY)")
                      {
                      }
                    }
        }
      }
    `;
    
    const result = parseQueryElements(queryWithFilters);
    const dataItem = result.dataItems[0];
    expect(dataItem).toBeDefined();
    expect(dataItem.columns.length).toBeGreaterThanOrEqual(1);
  });
});
