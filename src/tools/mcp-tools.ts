/**
 * Extended MCP Tools for CAL Dependency Analysis
 * Provides advanced search and dependency mapping capabilities
 */

import { SymbolDatabase } from '../core/symbol-database';
import { extractReferences, CALReference } from '../core/reference-extractor';
import { CALObjectType, CALObject, CALObjectUnion } from '../types/cal-types';

/**
 * Search result for code search within procedure bodies
 */
export interface CodeSearchResult {
  objectType: string;
  objectId: number;
  objectName: string;
  procedureName: string;
  match: string;
  lineNumber?: number;
}

/**
 * Parameters for code search
 */
export interface CodeSearchParams {
  pattern: string;
  objectType?: string;
  limit?: number;
}

/**
 * Dependency graph result
 */
export interface DependencyGraph {
  incoming: CALReference[];
  outgoing: CALReference[];
}

/**
 * Parameters for dependency graph
 */
export interface DependencyParams {
  objectType: string;
  objectId: number;
  direction?: 'incoming' | 'outgoing' | 'both';
}

/**
 * Parameters for table relations mapping
 */
export interface TableRelationsParams {
  tableId?: number;
  includeCalcFormula?: boolean;
}

/**
 * Search within procedure bodies using regex patterns
 * 
 * @param db - Symbol database containing CAL objects
 * @param params - Search parameters (pattern, objectType, limit)
 * @returns Array of code search results
 * 
 * @example
 * const results = searchCode(db, { pattern: 'ERROR', objectType: 'Codeunit', limit: 20 });
 * // Returns matches in procedure bodies across all codeunits
 */
export function searchCode(db: SymbolDatabase, params: CodeSearchParams): CodeSearchResult[] {
  const { pattern, objectType, limit } = params;
  const results: CodeSearchResult[] = [];
  
  // Create regex from pattern
  const regex = new RegExp(pattern, 'gi');
  
  // Get objects to search
  let objectsToSearch: CALObject[];
  if (objectType) {
    const calType = CALObjectType[objectType as keyof typeof CALObjectType];
    objectsToSearch = db.getObjectsByType(calType);
  } else {
    // Search all object types that can have procedures
    objectsToSearch = [
      ...db.getObjectsByType(CALObjectType.Table),
      ...db.getObjectsByType(CALObjectType.Page),
      ...db.getObjectsByType(CALObjectType.Codeunit),
      ...db.getObjectsByType(CALObjectType.Report),
      ...db.getObjectsByType(CALObjectType.XMLport),
    ];
  }
  
  // Search through procedure bodies
  for (const obj of objectsToSearch) {
    const procedures = db.getProceduresByObject(obj.type, obj.id);
    
    for (const proc of procedures) {
      if (!proc.body) continue;
      
      // Search for pattern in procedure body
      const matches = proc.body.match(regex);
      if (matches) {
        // Get line number if possible
        const lines = proc.body.split('\n');
        let lineNumber: number | undefined;
        let matchedLine = '';
        
        for (let i = 0; i < lines.length; i++) {
          if (new RegExp(pattern, 'i').test(lines[i])) {
            lineNumber = i + 1;
            matchedLine = lines[i].trim();
            break;
          }
        }
        
        results.push({
          objectType: obj.type,
          objectId: obj.id,
          objectName: obj.name,
          procedureName: proc.name,
          match: matchedLine || matches[0],
          lineNumber,
        });
        
        // Check limit
        if (limit && results.length >= limit) {
          return results;
        }
      }
    }
  }
  
  return results;
}

/**
 * Get dependency graph for a CAL object
 * Shows incoming (who references this object) and outgoing (what this object references)
 * 
 * @param db - Symbol database containing CAL objects
 * @param params - Dependency parameters (objectType, objectId, direction)
 * @returns Dependency graph with incoming and outgoing references
 * 
 * @example
 * const deps = getDependencies(db, { objectType: 'Table', objectId: 18, direction: 'both' });
 * // Returns: { incoming: [...references to Customer table], outgoing: [...references from Customer table] }
 */
export function getDependencies(db: SymbolDatabase, params: DependencyParams): DependencyGraph {
  const { objectType, objectId, direction = 'both' } = params;
  const result: DependencyGraph = {
    incoming: [],
    outgoing: [],
  };
  
  const calType = CALObjectType[objectType as keyof typeof CALObjectType];
  const targetObject = db.getObject(calType, objectId);
  
  if (!targetObject) {
    return result;
  }
  
  // Get all objects to check for references
  const allObjects: CALObject[] = [
    ...db.getObjectsByType(CALObjectType.Table),
    ...db.getObjectsByType(CALObjectType.Page),
    ...db.getObjectsByType(CALObjectType.Codeunit),
    ...db.getObjectsByType(CALObjectType.Report),
    ...db.getObjectsByType(CALObjectType.XMLport),
  ];
  
  // Extract outgoing references from target object
  if (direction === 'outgoing' || direction === 'both') {
    const outgoingRefs = extractReferences(targetObject as CALObjectUnion);
    result.outgoing = outgoingRefs;
  }
  
  // Find incoming references from all other objects
  if (direction === 'incoming' || direction === 'both') {
    for (const obj of allObjects) {
      // Skip the target object itself
      if (obj.type === targetObject.type && obj.id === targetObject.id) {
        continue;
      }
      
      const refs = extractReferences(obj as CALObjectUnion);
      
      // Filter references that point to the target object
      const incomingRefs = refs.filter(ref => {
        // Match by name (case-insensitive)
        if (ref.targetName.toLowerCase() === targetObject.name.toLowerCase()) {
          return true;
        }
        // Match by ID if available
        if (ref.targetId === targetObject.id && ref.targetType === targetObject.type) {
          return true;
        }
        return false;
      });
      
      result.incoming.push(...incomingRefs);
    }
  }
  
  return result;
}

/**
 * Map TableRelation properties across all tables
 * Optionally includes CalcFormula references
 * 
 * @param db - Symbol database containing CAL objects
 * @param params - Parameters (tableId to filter, includeCalcFormula flag)
 * @returns Array of table relation references
 * 
 * @example
 * const relations = getTableRelations(db, { tableId: 36, includeCalcFormula: true });
 * // Returns all TableRelation and CalcFormula references from Sales Header table
 */
export function getTableRelations(db: SymbolDatabase, params: TableRelationsParams): CALReference[] {
  const { tableId, includeCalcFormula = false } = params;
  const relations: CALReference[] = [];
  
  // Get tables to process
  const tables = tableId
    ? [db.getObject(CALObjectType.Table, tableId)].filter(t => t !== undefined)
    : db.getObjectsByType(CALObjectType.Table);
  
  // Extract references from each table
  for (const table of tables) {
    if (!table) continue;
    
    const refs = extractReferences(table as CALObjectUnion);
    
    // Filter by reference type
    const filteredRefs = refs.filter(ref => {
      if (ref.referenceType === 'TableRelation') {
        return true;
      }
      if (includeCalcFormula && ref.referenceType === 'CalcFormula') {
        return true;
      }
      return false;
    });
    
    relations.push(...filteredRefs);
  }
  
  return relations;
}
