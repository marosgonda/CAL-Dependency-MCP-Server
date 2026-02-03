/**
 * Reference Extractor for C/AL Objects
 * Extracts cross-object references from TableRelation, CalcFormula, Record variables, etc.
 */

import {
  CALObjectType,
  CALObject,
  CALTable,
  CALPage,
  CALCodeunit,
  CALReport,
  CALField,
  CALVariable,
  CALObjectUnion,
} from '../types/cal-types';

/**
 * Represents a reference from one C/AL object/field to another
 */
export interface CALReference {
  sourceType: CALObjectType;
  sourceId: number;
  sourceName: string;
  sourceLocation: string; // "Field:Customer No." | "Variable:CustRec" | "DataItem:Customer"
  targetType: 'Table' | 'Field' | 'Page' | 'Codeunit';
  targetId?: number;
  targetName: string;
  referenceType: 'TableRelation' | 'CalcFormula' | 'RecordVariable' | 'SourceTable' | 'SourceExpr' | 'DataItemTable';
}

/**
 * Extracts all references from a C/AL object
 * 
 * @param obj - CAL object (Table, Page, Codeunit, Report, etc.)
 * @returns Array of references found in the object
 * 
 * @example
 * const table = parseTable(tableSource);
 * const refs = extractReferences(table);
 * // Returns: [{ sourceType: 'Table', targetType: 'Table', referenceType: 'TableRelation', ... }]
 */
export function extractReferences(obj: CALObjectUnion): CALReference[] {
  const references: CALReference[] = [];

  switch (obj.type) {
    case CALObjectType.Table:
      references.push(...extractTableReferences(obj as CALTable));
      break;
    
    case CALObjectType.Page:
      references.push(...extractPageReferences(obj as CALPage));
      break;
    
    case CALObjectType.Codeunit:
      references.push(...extractCodeunitReferences(obj as CALCodeunit));
      break;
    
    case CALObjectType.Report:
      references.push(...extractReportReferences(obj as CALReport));
      break;
  }

  return references;
}

/**
 * Extracts references from a Table object
 */
function extractTableReferences(table: CALTable): CALReference[] {
  const references: CALReference[] = [];

  for (const field of table.fields) {
    // Extract TableRelation references
    const tableRelationRef = extractTableRelationRef(field, table);
    if (tableRelationRef) {
      references.push(tableRelationRef);
    }

    // Extract CalcFormula references
    const calcFormulaRefs = extractCalcFormulaRefs(field, table);
    references.push(...calcFormulaRefs);
  }

  return references;
}

/**
 * Extracts references from a Page object
 */
function extractPageReferences(page: CALPage): CALReference[] {
  const references: CALReference[] = [];

  // Extract SourceTable reference
  if (page.sourceTable) {
    references.push({
      sourceType: page.type,
      sourceId: page.id,
      sourceName: page.name,
      sourceLocation: 'Property:SourceTable',
      targetType: 'Table',
      targetId: page.sourceTable,
      targetName: page.sourceTable.toString(),
      referenceType: 'SourceTable',
    });
  }

  return references;
}

/**
 * Extracts references from a Codeunit object
 */
function extractCodeunitReferences(codeunit: CALCodeunit): CALReference[] {
  const references: CALReference[] = [];

  // Extract Record variable references
  for (const variable of codeunit.variables) {
    const recordVarRef = extractRecordVariableRef(variable, codeunit);
    if (recordVarRef) {
      references.push(recordVarRef);
    }
  }

  return references;
}

/**
 * Extracts references from a Report object
 */
function extractReportReferences(report: CALReport): CALReference[] {
  const references: CALReference[] = [];

  // Extract DataItem SourceTable references
  for (const dataItem of report.dataItems) {
    if (dataItem.sourceTable) {
      references.push({
        sourceType: report.type,
        sourceId: report.id,
        sourceName: report.name,
        sourceLocation: `DataItem:${dataItem.name}`,
        targetType: 'Table',
        targetId: dataItem.sourceTable,
        targetName: dataItem.sourceTable.toString(),
        referenceType: 'DataItemTable',
      });
    }
  }

  // Extract Record variable references from report variables
  for (const variable of report.variables) {
    const recordVarRef = extractRecordVariableRef(variable, report);
    if (recordVarRef) {
      references.push(recordVarRef);
    }
  }

  return references;
}

/**
 * Extracts TableRelation reference from a field
 * 
 * @param field - Field with potential TableRelation property
 * @param table - Parent table containing the field
 * @returns Reference or undefined if no TableRelation found
 * 
 * @example
 * const ref = extractTableRelationRef(field, table);
 * // Returns: { targetName: "Customer", referenceType: "TableRelation", ... }
 */
export function extractTableRelationRef(
  field: CALField,
  table: CALTable
): CALReference | undefined {
  const tableRelationProp = field.properties.find(p => p.name === 'TableRelation');
  if (!tableRelationProp || !tableRelationProp.value) {
    return undefined;
  }

  const tableRelationValue = tableRelationProp.value.toString();
  if (!tableRelationValue.trim()) {
    return undefined;
  }

  // Parse TableRelation value
  // Formats:
  // - "Customer"
  // - Customer
  // - "Payment Terms" WHERE (...)
  // - "G/L Account" WHERE (Type=FILTER(Posting))
  
  let targetTableName = '';
  
  // Match quoted table name: "Table Name"
  const quotedMatch = tableRelationValue.match(/^"([^"]+)"/);
  if (quotedMatch) {
    targetTableName = quotedMatch[1];
  } else {
    // Match unquoted table name (up to WHERE or end)
    const unquotedMatch = tableRelationValue.match(/^(\w+)/);
    if (unquotedMatch) {
      targetTableName = unquotedMatch[1];
    }
  }

  if (!targetTableName) {
    return undefined;
  }

  return {
    sourceType: table.type,
    sourceId: table.id,
    sourceName: table.name,
    sourceLocation: `Field:${field.name}`,
    targetType: 'Table',
    targetName: targetTableName,
    referenceType: 'TableRelation',
  };
}

/**
 * Extracts CalcFormula references from a field
 * 
 * @param field - Field with potential CalcFormula property
 * @param table - Parent table containing the field
 * @returns Array of references (can be multiple for complex formulas)
 * 
 * @example
 * const refs = extractCalcFormulaRefs(field, table);
 * // Returns: [{ targetName: "Cust. Ledger Entry", referenceType: "CalcFormula", ... }]
 */
export function extractCalcFormulaRefs(
  field: CALField,
  table: CALTable
): CALReference[] {
  const references: CALReference[] = [];

  if (!field.calcFormula) {
    return references;
  }

  const calcFormula = field.calcFormula.toString();
  
  // Parse CalcFormula
  // Formats:
  // - Sum("Table Name".Field WHERE (...))
  // - Count("Table Name" WHERE (...))
  // - Exist("Table Name" WHERE (...))
  // - Lookup("Table Name".Field WHERE (...))
  
  // Match patterns: Sum/Count/Exist/Lookup("Table Name"...)
  const formulaMatch = calcFormula.match(/(Sum|Count|Exist|Lookup)\s*\(\s*"([^"]+)"/i);
  if (!formulaMatch) {
    return references;
  }

  const targetTableName = formulaMatch[2];

  references.push({
    sourceType: table.type,
    sourceId: table.id,
    sourceName: table.name,
    sourceLocation: `Field:${field.name}`,
    targetType: 'Table',
    targetName: targetTableName,
    referenceType: 'CalcFormula',
  });

  return references;
}

/**
 * Extracts Record variable reference
 * 
 * @param variable - Variable with potential Record type
 * @param obj - Parent object (Codeunit, Table, Report) containing the variable
 * @returns Reference or undefined if not a Record variable
 * 
 * @example
 * const ref = extractRecordVariableRef(variable, codeunit);
 * // Returns: { targetType: "Table", targetId: 18, referenceType: "RecordVariable", ... }
 */
export function extractRecordVariableRef(
  variable: CALVariable,
  obj: CALObject
): CALReference | undefined {
  // Check if variable is a Record type
  // Formats:
  // - "Record 18" (table by ID)
  // - "Record Customer" (table by name)
  // - 'Record "G/L Account"' (table by quoted name)
  
  if (!variable.type) {
    return undefined;
  }

  const recordMatch = variable.type.match(/^Record\s+(.+)$/i);
  if (!recordMatch) {
    return undefined;
  }

  const tableRef = recordMatch[1].trim();
  let targetTableId: number | undefined;
  let targetTableName: string;

  // Check if it's a numeric table ID
  const numericMatch = tableRef.match(/^(\d+)$/);
  if (numericMatch) {
    targetTableId = parseInt(numericMatch[1], 10);
    targetTableName = numericMatch[1];
  } else {
    // It's a table name (quoted or unquoted)
    const quotedMatch = tableRef.match(/^"([^"]+)"$/);
    if (quotedMatch) {
      targetTableName = quotedMatch[1];
    } else {
      targetTableName = tableRef;
    }
  }

  return {
    sourceType: obj.type,
    sourceId: obj.id,
    sourceName: obj.name,
    sourceLocation: `Variable:${variable.name}`,
    targetType: 'Table',
    targetId: targetTableId,
    targetName: targetTableName,
    referenceType: 'RecordVariable',
  };
}
