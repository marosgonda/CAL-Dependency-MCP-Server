/**
 * Parser for C/AL Table objects
 * Handles parsing of FIELDS, KEYS, FIELDGROUPS, and CODE sections
 */

import { CALTable, CALField, CALKey, CALFieldGroup, CALProcedure, CALParameter, CALVariable, CALProperty, CALObjectType } from '../types/cal-types';
import { parseObjectDeclaration, parseObjectProperties } from './object-parser';

/**
 * Parses a complete C/AL Table object from source text
 * 
 * @param content - Full C/AL table source code
 * @returns Parsed CALTable object with fields, keys, procedures, etc.
 * @throws Error if required sections are missing or format is invalid
 * 
 * @example
 * const tableSource = readFileSync('table-simple.txt', 'utf-8');
 * const table = parseTable(tableSource);
 * // Returns: CALTable with id, name, fields, keys, fieldGroups, procedures
 */
export function parseTable(content: string): CALTable {
  const lines = content.split('\n');
  
  // Parse OBJECT declaration (first line)
  const objectHeader = parseObjectDeclaration(lines[0]);
  
  if (objectHeader.type !== CALObjectType.Table) {
    throw new Error(`Expected Table object, got ${objectHeader.type}`);
  }
  
  // Find section boundaries
  const objectPropsStart = content.indexOf('OBJECT-PROPERTIES');
  const objectPropsEnd = objectPropsStart >= 0 ? findMatchingBrace(content, objectPropsStart) : -1;
  const propsStart = content.indexOf('\n  PROPERTIES\n');
  const propsEnd = propsStart >= 0 ? findMatchingBrace(content, propsStart) : -1;
  const fieldsStart = content.indexOf('\n  FIELDS\n');
  const fieldsEnd = fieldsStart >= 0 ? findMatchingBrace(content, fieldsStart) : -1;
  const keysStart = content.indexOf('\n  KEYS\n');
  const keysEnd = keysStart >= 0 ? findMatchingBrace(content, keysStart) : -1;
  const fieldGroupsStart = content.indexOf('\n  FIELDGROUPS\n');
  const fieldGroupsEnd = fieldGroupsStart >= 0 ? findMatchingBrace(content, fieldGroupsStart) : -1;
  const codeStart = content.indexOf('\n  CODE\n');
  const codeEnd = codeStart >= 0 ? findMatchingBrace(content, codeStart) : -1;
  
  // Validate required sections
  if (fieldsStart < 0) {
    throw new Error('Missing FIELDS section in table');
  }
  if (keysStart < 0) {
    throw new Error('Missing KEYS section in table');
  }
  
  // Parse OBJECT-PROPERTIES
  let objectProperties = undefined;
  if (objectPropsStart >= 0 && objectPropsEnd > objectPropsStart) {
    const objectPropsSection = content.substring(objectPropsStart, objectPropsEnd + 1);
    objectProperties = parseObjectProperties(objectPropsSection);
  }
  
  // Parse table PROPERTIES
  let properties: CALProperty[] = [];
  let captionML: Record<string, string> | undefined = undefined;
  let lookupPageId: number | undefined = undefined;
  let drillDownPageId: number | undefined = undefined;
  let permissions: string | undefined = undefined;
  
  if (propsStart >= 0 && propsEnd > propsStart) {
    const propsSection = content.substring(propsStart, propsEnd + 1);
    const propsResult = parseProperties(propsSection);
    properties = propsResult.properties;
    captionML = propsResult.captionML;
    lookupPageId = propsResult.lookupPageId;
    drillDownPageId = propsResult.drillDownPageId;
    permissions = propsResult.permissions;
  }
  
  // Parse FIELDS
  const fieldsSection = content.substring(fieldsStart, fieldsEnd + 1);
  const fields = parseFields(fieldsSection);
  
  // Parse KEYS
  const keysSection = content.substring(keysStart, keysEnd + 1);
  const keys = parseKeys(keysSection);
  
  // Parse FIELDGROUPS
  let fieldGroups: CALFieldGroup[] = [];
  if (fieldGroupsStart >= 0 && fieldGroupsEnd > fieldGroupsStart) {
    const fieldGroupsSection = content.substring(fieldGroupsStart, fieldGroupsEnd + 1);
    fieldGroups = parseFieldGroups(fieldGroupsSection);
  }
  
  // Parse CODE
  let procedures: CALProcedure[] = [];
  if (codeStart >= 0 && codeEnd > codeStart) {
    const codeSection = content.substring(codeStart, codeEnd + 1);
    procedures = parseProcedures(codeSection);
  }
  
  return {
    type: CALObjectType.Table,
    id: objectHeader.id,
    name: objectHeader.name,
    objectProperties,
    properties,
    fields,
    keys,
    fieldGroups,
    procedures,
    captionML,
    lookupPageId,
    drillDownPageId,
    permissions,
  };
}

/**
 * Finds the matching closing brace for a section
 */
function findMatchingBrace(content: string, startPos: number): number {
  const openBrace = content.indexOf('{', startPos);
  if (openBrace < 0) return -1;
  
  let depth = 0;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parses table PROPERTIES section
 */
function parseProperties(propertiesSection: string): {
  properties: CALProperty[];
  captionML?: Record<string, string>;
  lookupPageId?: number;
  drillDownPageId?: number;
  permissions?: string;
} {
  const properties: CALProperty[] = [];
  let captionML: Record<string, string> | undefined = undefined;
  let lookupPageId: number | undefined = undefined;
  let drillDownPageId: number | undefined = undefined;
  let permissions: string | undefined = undefined;
  
  // Extract Permissions
  const permissionsMatch = propertiesSection.match(/Permissions=([^;]+);/);
  if (permissionsMatch) {
    permissions = permissionsMatch[1].trim();
    properties.push({ name: 'Permissions', value: permissions });
  }
  
  // Extract CaptionML
  const captionMLMatch = propertiesSection.match(/CaptionML=\[([^\]]+)\];/);
  if (captionMLMatch) {
    captionML = parseCaptionML(captionMLMatch[1]);
    properties.push({ name: 'CaptionML', value: captionMLMatch[1].trim() });
  }
  
  // Extract LookupPageID
  const lookupPageMatch = propertiesSection.match(/LookupPageID=Page(\d+)/);
  if (lookupPageMatch) {
    lookupPageId = parseInt(lookupPageMatch[1], 10);
    properties.push({ name: 'LookupPageID', value: `Page${lookupPageMatch[1]}` });
  }
  
  // Extract DrillDownPageID
  const drillDownPageMatch = propertiesSection.match(/DrillDownPageID=Page(\d+)/);
  if (drillDownPageMatch) {
    drillDownPageId = parseInt(drillDownPageMatch[1], 10);
    properties.push({ name: 'DrillDownPageID', value: `Page${drillDownPageMatch[1]}` });
  }
  
  // Extract DataCaptionFields
  const dataCaptionMatch = propertiesSection.match(/DataCaptionFields=([^;]+);/);
  if (dataCaptionMatch) {
    properties.push({ name: 'DataCaptionFields', value: dataCaptionMatch[1].trim() });
  }
  
  // Extract triggers (OnInsert, OnModify, OnDelete, OnRename)
  const triggerNames = ['OnInsert', 'OnModify', 'OnDelete', 'OnRename'];
  for (const triggerName of triggerNames) {
    const triggerMatch = extractTrigger(propertiesSection, triggerName);
    if (triggerMatch) {
      properties.push({ name: triggerName, value: triggerMatch });
    }
  }
  
  return { properties, captionML, lookupPageId, drillDownPageId, permissions };
}

/**
 * Extracts a trigger code block (OnInsert, OnModify, OnDelete, OnRename)
 */
function extractTrigger(content: string, triggerName: string): string | null {
  const regex = new RegExp(`${triggerName}=([\\s\\S]*?)(?=\\n\\s{5}[A-Z]|\\n\\s*})`, 'm');
  const match = content.match(regex);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Parses CaptionML property into language-caption map
 */
function parseCaptionML(captionMLContent: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Match pattern: ENU=Payment Terms;
  const regex = /([A-Z]{3})=([^;]+);?/g;
  let match;
  
  while ((match = regex.exec(captionMLContent)) !== null) {
    const lang = match[1].trim();
    const caption = match[2].trim();
    result[lang] = caption;
  }
  
  return result;
}

/**
 * Parses FIELDS section
 */
function parseFields(fieldsSection: string): CALField[] {
  const fields: CALField[] = [];
  
  // Extract field blocks using regex
  // Pattern: { ID ; Indentation ; Name ; Type ; Properties }
  // Properties can span multiple lines until closing }
  const fieldRegex = /\{\s*(\d+)\s*;\s*;\s*([^;]+?)\s*;([^;]+?)(?:\s*;([\s\S]*?))?\}/g;
  
  let match;
  while ((match = fieldRegex.exec(fieldsSection)) !== null) {
    const id = parseInt(match[1].trim(), 10);
    const name = match[2].trim();
    const dataType = match[3].trim();
    const propertiesText = match[4] ? match[4].trim() : '';
    
    const field = parseField(id, name, dataType, propertiesText);
    fields.push(field);
  }
  
  return fields;
}

/**
 * Parses individual field with properties
 */
function parseField(id: number, name: string, dataType: string, propertiesText: string): CALField {
  const properties: CALProperty[] = [];
  let captionML: Record<string, string> | undefined = undefined;
  let tableRelation: string | undefined = undefined;
  let calcFormula: string | undefined = undefined;
  let fieldClass: 'Normal' | 'FlowField' | 'FlowFilter' | undefined = undefined;
  let onValidate: string | undefined = undefined;
  let onLookup: string | undefined = undefined;
  
  if (propertiesText) {
    // Extract CaptionML
    const captionMLMatch = propertiesText.match(/CaptionML=\[([^\]]+)\];?/);
    if (captionMLMatch) {
      captionML = parseCaptionML(captionMLMatch[1]);
      properties.push({ name: 'CaptionML', value: captionMLMatch[1].trim() });
    }
    
    // Extract FieldClass
    const fieldClassMatch = propertiesText.match(/FieldClass=(\w+)/);
    if (fieldClassMatch) {
      fieldClass = fieldClassMatch[1] as 'Normal' | 'FlowField' | 'FlowFilter';
      properties.push({ name: 'FieldClass', value: fieldClass });
    }
    
    // Extract CalcFormula (can span multiple lines)
    const calcFormulaMatch = propertiesText.match(/CalcFormula=([\s\S]*?)(?=;\s*[A-Z]|$)/);
    if (calcFormulaMatch) {
      calcFormula = calcFormulaMatch[1].trim().replace(/\s+/g, ' ');
      properties.push({ name: 'CalcFormula', value: calcFormula });
    }
    
    // Extract TableRelation
    const tableRelationMatch = propertiesText.match(/TableRelation=([\s\S]*?)(?=;\s*[A-Z]|$)/);
    if (tableRelationMatch) {
      tableRelation = tableRelationMatch[1].trim();
      properties.push({ name: 'TableRelation', value: tableRelation });
    }
    
    // Extract OnValidate trigger (matches BEGIN...END; block)
    const onValidateMatch = propertiesText.match(/OnValidate=(BEGIN[\s\S]*?END;)/);
    if (onValidateMatch) {
      onValidate = onValidateMatch[1].trim();
      properties.push({ name: 'OnValidate', value: onValidate });
    }
    
    // Extract OnLookup trigger (matches BEGIN...END; block)
    const onLookupMatch = propertiesText.match(/OnLookup=(BEGIN[\s\S]*?END;)/);
    if (onLookupMatch) {
      onLookup = onLookupMatch[1].trim();
      properties.push({ name: 'OnLookup', value: onLookup });
    }
    
    // Extract other simple properties
    const simpleProps = [
      'NotBlank', 'Editable', 'Enabled', 'Visible', 'Description',
      'DecimalPlaces', 'MinValue', 'MaxValue', 'BlankZero',
      'AutoFormatType', 'AutoFormatExpr', 'InitValue'
    ];
    
    for (const propName of simpleProps) {
      const propMatch = propertiesText.match(new RegExp(`${propName}=([^;\\n]+)`));
      if (propMatch) {
        properties.push({ name: propName, value: propMatch[1].trim() });
      }
    }
  }
  
  return {
    id,
    name,
    dataType,
    properties,
    captionML,
    tableRelation: tableRelation ? { 
      objectId: 0, // Would need more parsing to extract
      objectName: tableRelation,
      objectType: CALObjectType.Table,
      referenceType: 'TableRelation'
    } : undefined,
    calcFormula,
    fieldClass,
    onValidate,
    onLookup,
  };
}

/**
 * Parses KEYS section
 */
function parseKeys(keysSection: string): CALKey[] {
  const keys: CALKey[] = [];
  
  // Pattern: { ; Fields ; Properties }
  const keyRegex = /\{\s*;\s*([^;]+?)(?:\s*;([\s\S]*?))?\}/g;
  
  let match;
  while ((match = keyRegex.exec(keysSection)) !== null) {
    const fieldsText = match[1].trim();
    const propertiesText = match[2] ? match[2].trim() : '';
    
    const fields = fieldsText.split(',').map(f => f.trim());
    
    const key: CALKey = {
      fields,
      clustered: propertiesText.includes('Clustered=Yes'),
      unique: propertiesText.includes('Unique=Yes'),
      enabled: !propertiesText.includes('Enabled=No'),
    };
    
    keys.push(key);
  }
  
  return keys;
}

/**
 * Parses FIELDGROUPS section
 */
function parseFieldGroups(fieldGroupsSection: string): CALFieldGroup[] {
  const fieldGroups: CALFieldGroup[] = [];
  
  // Pattern: { ID ; Name ; FieldList }
  const fieldGroupRegex = /\{\s*(\d+)\s*;\s*([^;]+?)\s*;([\s\S]*?)\}/g;
  
  let match;
  while ((match = fieldGroupRegex.exec(fieldGroupsSection)) !== null) {
    const id = parseInt(match[1].trim(), 10);
    const name = match[2].trim();
    const fieldsText = match[3].trim();
    
    const fields = fieldsText.split(',').map(f => f.trim());
    
    fieldGroups.push({ id, name, fields });
  }
  
  return fieldGroups;
}

/**
 * Parses CODE section for procedures
 */
function parseProcedures(codeSection: string): CALProcedure[] {
  const procedures: CALProcedure[] = [];
  
  // Pattern: PROCEDURE Name@ID(parameters);
  // Can have LOCAL keyword before PROCEDURE
  const procedureRegex = /(?:LOCAL\s+)?PROCEDURE\s+(\w+)@(\d+)\(([\s\S]*?)\);/g;
  
  let match;
  while ((match = procedureRegex.exec(codeSection)) !== null) {
    const isLocal = match[0].trim().startsWith('LOCAL');
    const name = match[1];
    const id = parseInt(match[2], 10);
    const paramsText = match[3];
    
    // Find the procedure body (from parameters closing to next PROCEDURE or END.)
    const procStart = match.index;
    const procBodyStart = codeSection.indexOf(';', procStart) + 1;
    
    // Find next PROCEDURE or final END.
    let procBodyEnd = codeSection.indexOf('PROCEDURE', procBodyStart);
    if (procBodyEnd < 0) {
      procBodyEnd = codeSection.lastIndexOf('END.');
    }
    
    const procBody = codeSection.substring(procBodyStart, procBodyEnd).trim();
    
    const parameters = parseParameters(paramsText);
    const localVariables = parseLocalVariables(procBody);
    
    // Extract procedure body (after VAR section if exists, after BEGIN)
    const beginIndex = procBody.indexOf('BEGIN');
    const body = beginIndex >= 0 ? procBody.substring(beginIndex) : procBody;
    
    procedures.push({
      id,
      name,
      parameters,
      returnType: undefined, // C/AL procedures don't have explicit return types in declaration
      localVariables,
      body,
      isLocal,
    });
  }
  
  return procedures;
}

/**
 * Parses procedure parameters
 */
function parseParameters(paramsText: string): CALParameter[] {
  const parameters: CALParameter[] = [];
  
  if (!paramsText.trim()) return parameters;
  
  // Split by semicolon (parameter separator)
  const paramParts = paramsText.split(';');
  
  for (const part of paramParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    // Pattern: VAR Name@ID : Type
    // or: Name@ID : Type
    const paramMatch = trimmed.match(/(VAR\s+)?(\w+)@(\d+)\s*:\s*(.+)/);
    if (paramMatch) {
      const byRef = !!paramMatch[1];
      const name = paramMatch[2];
      const type = paramMatch[4].trim();
      
      parameters.push({
        name,
        type,
        byRef,
      });
    }
  }
  
  return parameters;
}

/**
 * Parses local variables from procedure body
 */
function parseLocalVariables(procBody: string): CALVariable[] {
  const variables: CALVariable[] = [];
  
  // Find VAR section
  const varMatch = procBody.match(/VAR\s+([\s\S]*?)BEGIN/);
  if (!varMatch) return variables;
  
  const varSection = varMatch[1];
  
  // Pattern: Name@ID : Type;
  // Can have TEMPORARY keyword
  const varRegex = /(\w+)@(\d+)\s*:\s*([^;]+);/g;
  
  let match;
  while ((match = varRegex.exec(varSection)) !== null) {
    const name = match[1];
    const type = match[3].trim();
    const temporary = type.includes('TEMPORARY');
    
    variables.push({
      name,
      type: type.replace(/TEMPORARY\s+/, '').trim(),
      temporary,
    });
  }
  
  return variables;
}
