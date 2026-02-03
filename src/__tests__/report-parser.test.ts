/**
 * Tests for C/AL Report parser
 * Following TDD approach: Write tests FIRST (RED phase), then implement (GREEN phase)
 */

import { describe, it, expect } from 'bun:test';
import { parseReportDataset } from '../parser/report-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseReportDataset', () => {
  const fixturesPath = join(process.cwd(), 'fixtures');
  
  it('should parse basic DATASET section with dataitems and columns', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    expect(result).toBeDefined();
    expect(result.dataItems).toBeDefined();
    expect(result.dataItems.length).toBeGreaterThan(0);
  });

  it('should extract dataitem properties correctly', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    const dataItem = result.dataItems[0];
    expect(dataItem).toBeDefined();
    expect(dataItem.name).toBe('Payment Terms');
    expect(dataItem.sourceTable).toBeDefined();
    expect(dataItem.indentation).toBe(0);
  });

  it('should extract columns from dataitem', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    const dataItem = result.dataItems[0];
    expect(dataItem.columns).toBeDefined();
    expect(dataItem.columns.length).toBeGreaterThanOrEqual(4);
    
    // Check first column
    const codeColumn = dataItem.columns.find(col => col.name === 'Code');
    expect(codeColumn).toBeDefined();
    expect(codeColumn?.sourceExpr).toBe('Code');
  });

  it('should parse column with sourceExpr containing field reference', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    const dataItem = result.dataItems[0];
    const discountColumn = dataItem.columns.find(col => col.name === 'Discount_Percent');
    expect(discountColumn).toBeDefined();
    expect(discountColumn?.sourceExpr).toBe('"Discount %"');
  });

  it('should handle dataitem properties like DataItemTableView', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    const dataItem = result.dataItems[0];
    const tableViewProp = dataItem.properties.find(p => p.name === 'DataItemTableView');
    expect(tableViewProp).toBeDefined();
    expect(tableViewProp?.value).toContain('SORTING');
  });

  it('should handle nested dataitems with indentation', () => {
    const nestedDataset = `
      DATASET
      {
        { DATAITEM "Customer";"Customer"
                    {
                      column(No;No)
                      {
                      }
                      { DATAITEM "Sales Line";"Sales Line"
                                  {
                                    column(Document_No;"Document No.")
                                    {
                                    }
                                  }
                      }
                    }
        }
      }
    `;
    
    const result = parseReportDataset(nestedDataset);
    expect(result.dataItems.length).toBeGreaterThanOrEqual(1);
    
    // Parent dataitem should have indentation 0
    const customerDataItem = result.dataItems.find(di => di.name === 'Customer');
    expect(customerDataItem).toBeDefined();
    expect(customerDataItem?.indentation).toBe(0);
    
    // Child dataitem should have indentation > 0
    const salesLineDataItem = result.dataItems.find(di => di.name === 'Sales Line');
    expect(salesLineDataItem).toBeDefined();
    expect(salesLineDataItem?.indentation).toBeGreaterThan(0);
  });

  it('should handle empty DATASET section', () => {
    const emptyDataset = `
      DATASET
      {
      }
    `;
    
    const result = parseReportDataset(emptyDataset);
    expect(result.dataItems).toBeDefined();
    expect(result.dataItems.length).toBe(0);
    expect(result.columns.length).toBe(0);
  });

  it('should throw error for missing DATASET section', () => {
    const invalidContent = `
      PROPERTIES
      {
        CaptionML=[ENU=Sample Report];
      }
    `;
    
    expect(() => parseReportDataset(invalidContent)).toThrow();
  });

  it('should parse multiple dataitems at same level', () => {
    const multipleDataItems = `
      DATASET
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
    
    const result = parseReportDataset(multipleDataItems);
    expect(result.dataItems.length).toBe(2);
    expect(result.dataItems[0].name).toBe('Payment Terms');
    expect(result.dataItems[1].name).toBe('Currency');
  });

  it('should handle columns with special characters in names', () => {
    const specialColumns = `
      DATASET
      {
        { DATAITEM "Payment Terms";"Payment Terms"
                    {
                      column(Due_Date_Calculation;"Due Date Calculation")
                      {
                      }
                      column(Discount_Percent;"Discount %")
                      {
                      }
                    }
        }
      }
    `;
    
    const result = parseReportDataset(specialColumns);
    const dataItem = result.dataItems[0];
    
    expect(dataItem.columns.length).toBe(2);
    expect(dataItem.columns[0].name).toBe('Due_Date_Calculation');
    expect(dataItem.columns[0].sourceExpr).toBe('"Due Date Calculation"');
    expect(dataItem.columns[1].name).toBe('Discount_Percent');
    expect(dataItem.columns[1].sourceExpr).toBe('"Discount %"');
  });

  it('should extract all columns at report level', () => {
    const reportContent = readFileSync(join(fixturesPath, 'report-dataitem.txt'), 'utf-8');
    const result = parseReportDataset(reportContent);
    
    // All columns from all dataitems should be collected
    expect(result.columns).toBeDefined();
    expect(result.columns.length).toBeGreaterThanOrEqual(4);
  });
});
