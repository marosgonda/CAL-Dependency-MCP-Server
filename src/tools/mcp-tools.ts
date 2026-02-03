/**
 * MCP Tool Implementations for C/AL Symbol Access
 * Provides 6 core tools for analyzing C/AL objects
 */

import { SymbolDatabase } from '../core/symbol-database';
import { extractReferences, CALReference } from '../core/reference-extractor';
import { loadFile, loadDirectory, LoadResult } from '../core/file-loader';
import { CALObject, CALObjectType, CALField, CALProcedure, CALTable, CALPage } from '../types/cal-types';
import { existsSync, statSync } from 'fs';

/**
 * Global file registry to track loaded files and their parsed objects
 */
export class FileRegistry {
  private static db: SymbolDatabase = new SymbolDatabase();
  private static loadedFiles: Set<string> = new Set();
  private static allReferences: CALReference[] = [];

  static getDatabase(): SymbolDatabase {
    return this.db;
  }

  static addObject(obj: CALObject): void {
    this.db.addObject(obj);
    
    // Extract and store references
    const refs = extractReferences(obj as any);
    this.allReferences.push(...refs);
  }

  static addLoadedFile(path: string): void {
    this.loadedFiles.add(path);
  }

  static getLoadedFiles(): string[] {
    return Array.from(this.loadedFiles);
  }

  static getReferences(): CALReference[] {
    return this.allReferences;
  }

  static clear(): void {
    this.db = new SymbolDatabase();
    this.loadedFiles.clear();
    this.allReferences = [];
  }

  static getStats() {
    return {
      totalFiles: this.loadedFiles.size,
      totalObjects: this.getLoadedFiles().length,
      totalReferences: this.allReferences.length
    };
  }
}

/**
 * Tool 1: cal_search_objects
 * Search objects by pattern/type/domain with pagination
 */
export interface SearchObjectsParams {
  pattern?: string;
  objectType?: string;
  domain?: string;
  limit?: number;
  offset?: number;
  summaryMode?: boolean;
  includeFields?: boolean;
  includeProcedures?: boolean;
}

export interface SearchObjectsResult {
  objects: any[];
  summary?: {
    total: number;
    returned: number;
    offset: number;
    limit: number;
  };
}

export async function searchObjects(params: SearchObjectsParams): Promise<SearchObjectsResult> {
  const {
    pattern = '*',
    objectType,
    limit = 20,
    offset = 0,
    summaryMode = true,
    includeFields = false,
    includeProcedures = false
  } = params;

  const db = FileRegistry.getDatabase();
  
  // Convert string objectType to enum if provided
  const typeFilter = objectType ? (CALObjectType[objectType as keyof typeof CALObjectType] || undefined) : undefined;
  
  // Search objects
  const allMatches = db.searchObjects(pattern, typeFilter, undefined, 0);
  const paginatedMatches = db.searchObjects(pattern, typeFilter, limit, offset);
  
  // Format results
  const objects = paginatedMatches.map(obj => {
    if (summaryMode) {
      return {
        id: obj.id,
        name: obj.name,
        type: obj.type,
        properties: obj.properties,
        objectProperties: obj.objectProperties,
        fieldCount: (obj as any).fields?.length || 0,
        procedureCount: (obj as any).procedures?.length || 0
      };
    } else {
      const result: any = {
        id: obj.id,
        name: obj.name,
        type: obj.type,
        properties: obj.properties,
        objectProperties: obj.objectProperties
      };
      
      if (includeFields && (obj as any).fields) {
        result.fields = (obj as any).fields;
      }
      
      if (includeProcedures && (obj as any).procedures) {
        result.procedures = (obj as any).procedures;
      }
      
      return result;
    }
  });

  return {
    objects,
    summary: {
      total: allMatches.length,
      returned: objects.length,
      offset,
      limit
    }
  };
}

/**
 * Tool 2: cal_get_object_definition
 * Get full object by ID or name
 */
export interface GetObjectDefinitionParams {
  objectType: string;
  objectId?: number;
  objectName?: string;
  summaryMode?: boolean;
  fieldLimit?: number;
  procedureLimit?: number;
  includeFields?: boolean;
  includeProcedures?: boolean;
}

export interface GetObjectDefinitionResult {
  object?: any;
  error?: string;
}

export async function getObjectDefinition(params: GetObjectDefinitionParams): Promise<GetObjectDefinitionResult> {
  const {
    objectType,
    objectId,
    objectName,
    summaryMode = true,
    fieldLimit = summaryMode ? 10 : 100,
    procedureLimit = summaryMode ? 10 : 50,
    includeFields = true,
    includeProcedures = true
  } = params;

  // Validate that either objectId or objectName is provided
  if (!objectId && !objectName) {
    return {
      error: 'Either objectId or objectName must be provided'
    };
  }

  const db = FileRegistry.getDatabase();
  const type = CALObjectType[objectType as keyof typeof CALObjectType];
  
  if (!type) {
    return {
      error: `Invalid object type: ${objectType}`
    };
  }

  // Get object by ID or name
  const obj = objectId !== undefined 
    ? db.getObject(type, objectId)
    : db.getObject(type, objectName!);

  if (!obj) {
    return {
      error: `Object not found: ${objectType} ${objectId || objectName}`
    };
  }

  // Format result
  const result: any = {
    id: obj.id,
    name: obj.name,
    type: obj.type,
    properties: obj.properties,
    objectProperties: obj.objectProperties
  };

  // Add fields if applicable
  if (includeFields && (obj as any).fields) {
    const fields = (obj as any).fields as CALField[];
    result.fields = summaryMode ? fields.slice(0, fieldLimit) : fields;
    result.totalFields = fields.length;
  }

  // Add procedures if applicable
  if (includeProcedures && (obj as any).procedures) {
    const procedures = (obj as any).procedures as CALProcedure[];
    result.procedures = summaryMode ? procedures.slice(0, procedureLimit) : procedures;
    result.totalProcedures = procedures.length;
  }

  // Add other object-specific properties
  if (obj.type === CALObjectType.Table) {
    result.keys = (obj as any).keys;
    result.fieldGroups = (obj as any).fieldGroups;
  } else if (obj.type === CALObjectType.Page) {
    result.sourceTable = (obj as any).sourceTable;
    result.controls = (obj as any).controls;
    result.actions = (obj as any).actions;
  } else if (obj.type === CALObjectType.Codeunit) {
    result.variables = (obj as any).variables;
  }

  return { object: result };
}

/**
 * Tool 3: cal_find_references
 * Find what references an object/field
 */
export interface FindReferencesParams {
  targetName: string;
  fieldName?: string;
  referenceType?: string;
  sourceType?: string;
  includeContext?: boolean;
}

export interface FindReferencesResult {
  references: CALReference[];
  summary?: {
    total: number;
    byType: Record<string, number>;
  };
}

export async function findReferences(params: FindReferencesParams): Promise<FindReferencesResult> {
  const {
    targetName,
    fieldName,
    referenceType,
    sourceType,
    // includeContext could be used for future enhancement to add more details
  } = params;

  const allReferences = FileRegistry.getReferences();
  
  // Filter references
  let filtered = allReferences.filter(ref => {
    // Match target name (case-insensitive)
    if (ref.targetName.toLowerCase() !== targetName.toLowerCase()) {
      return false;
    }
    
    // Match field name if provided
    if (fieldName && ref.sourceLocation.toLowerCase() !== `field:${fieldName.toLowerCase()}`) {
      return false;
    }
    
    // Match reference type if provided
    if (referenceType && ref.referenceType !== referenceType) {
      return false;
    }
    
    // Match source type if provided
    if (sourceType && ref.sourceType !== sourceType) {
      return false;
    }
    
    return true;
  });

  // Calculate summary
  const byType: Record<string, number> = {};
  filtered.forEach(ref => {
    byType[ref.referenceType] = (byType[ref.referenceType] || 0) + 1;
  });

  return {
    references: filtered,
    summary: {
      total: filtered.length,
      byType
    }
  };
}

/**
 * Tool 4: cal_search_object_members
 * Search procedures/fields within objects
 */
export interface SearchObjectMembersParams {
  objectName: string;
  objectType?: string;
  memberType: 'procedures' | 'fields' | 'controls' | 'dataitems';
  pattern?: string;
  limit?: number;
  offset?: number;
  includeDetails?: boolean;
}

export interface SearchObjectMembersResult {
  members: any[];
  summary?: {
    total: number;
    returned: number;
  };
}

export async function searchObjectMembers(params: SearchObjectMembersParams): Promise<SearchObjectMembersResult> {
  const {
    objectName,
    objectType,
    memberType,
    pattern = '*',
    limit = 20,
    offset = 0,
    includeDetails = true
  } = params;

  const db = FileRegistry.getDatabase();
  
  // Find the object first
  let obj: CALObject | undefined;
  
  if (objectType) {
    const type = CALObjectType[objectType as keyof typeof CALObjectType];
    obj = db.getObject(type, objectName);
  } else {
    // Try all types
    for (const type of Object.values(CALObjectType)) {
      obj = db.getObject(type, objectName);
      if (obj) break;
    }
  }

  if (!obj) {
    return {
      members: [],
      summary: {
        total: 0,
        returned: 0
      }
    };
  }

  // Get members based on type
  let allMembers: any[] = [];
  
  switch (memberType) {
    case 'procedures':
      allMembers = (obj as any).procedures || [];
      break;
    case 'fields':
      allMembers = (obj as any).fields || [];
      break;
    case 'controls':
      allMembers = (obj as any).controls || [];
      break;
    case 'dataitems':
      allMembers = (obj as any).dataItems || [];
      break;
  }

  // Filter by pattern
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  
  const filtered = allMembers.filter(member => regex.test(member.name));
  
  // Apply pagination
  const paginated = filtered.slice(offset, offset + limit);
  
  // Format results
  const members = includeDetails 
    ? paginated 
    : paginated.map(m => ({
        id: m.id,
        name: m.name,
        type: m.dataType || m.type
      }));

  return {
    members,
    summary: {
      total: filtered.length,
      returned: members.length
    }
  };
}

/**
 * Tool 5: cal_get_object_summary
 * Token-efficient categorized overview
 */
export interface GetObjectSummaryParams {
  objectName: string;
  objectType?: string;
}

export interface GetObjectSummaryResult {
  summary?: any;
  error?: string;
}

export async function getObjectSummary(params: GetObjectSummaryParams): Promise<GetObjectSummaryResult> {
  const { objectName, objectType } = params;

  const db = FileRegistry.getDatabase();
  
  // Find the object
  let obj: CALObject | undefined;
  
  if (objectType) {
    const type = CALObjectType[objectType as keyof typeof CALObjectType];
    obj = db.getObject(type, objectName);
  } else {
    // Try all types
    for (const type of Object.values(CALObjectType)) {
      obj = db.getObject(type, objectName);
      if (obj) break;
    }
  }

  if (!obj) {
    return {
      error: `Object not found: ${objectName}`
    };
  }

  // Get summary from database
  const dbSummary = db.getObjectSummary(obj.type, obj.id);
  
  if (!dbSummary) {
    return {
      error: `Could not generate summary for: ${objectName}`
    };
  }

  // Categorize procedures if present
  const categorizedProcedures: Record<string, string[]> = {};
  
  if (dbSummary.procedures) {
    dbSummary.procedures.forEach(proc => {
      const category = categorizeProcedure(proc.name);
      if (!categorizedProcedures[category]) {
        categorizedProcedures[category] = [];
      }
      categorizedProcedures[category].push(proc.name);
    });
  }

  return {
    summary: {
      id: dbSummary.id,
      name: dbSummary.name,
      type: dbSummary.type,
      properties: dbSummary.properties,
      objectProperties: dbSummary.objectProperties,
      fields: dbSummary.fields,
      totalFields: dbSummary.totalFields,
      procedureCategories: categorizedProcedures,
      totalProcedures: dbSummary.totalProcedures
    }
  };
}

/**
 * Helper: Categorize procedures by name pattern
 */
function categorizeProcedure(name: string): string {
  const nameLower = name.toLowerCase();
  
  if (nameLower.startsWith('init') || nameLower.includes('initialize')) {
    return 'Initialization';
  }
  if (nameLower.startsWith('validate') || nameLower.includes('check')) {
    return 'Validation';
  }
  if (nameLower.startsWith('calc') || nameLower.includes('calculate')) {
    return 'Calculation';
  }
  if (nameLower.startsWith('get') || nameLower.startsWith('find')) {
    return 'Retrieval';
  }
  if (nameLower.startsWith('set') || nameLower.startsWith('update')) {
    return 'Modification';
  }
  if (nameLower.startsWith('on')) {
    return 'Events';
  }
  if (nameLower.includes('test') || nameLower.startsWith('test')) {
    return 'Testing';
  }
  
  return 'General';
}

/**
 * Tool 6: cal_files
 * Load files, list loaded, get stats
 */
export interface ManageFilesParams {
  action: 'load' | 'list' | 'stats';
  path?: string;
  autoDiscover?: boolean;
  forceReload?: boolean;
}

export interface ManageFilesResult {
  success?: boolean;
  files?: string[];
  stats?: {
    totalFiles: number;
    totalObjects: number;
    totalBytes: number;
    duration?: number;
  };
  errors?: string[];
  error?: string;
}

export async function manageFiles(params: ManageFilesParams): Promise<ManageFilesResult> {
  const { action, path, autoDiscover = true, forceReload = false } = params;

  switch (action) {
    case 'load':
      return await loadFiles(path, autoDiscover, forceReload);
    
    case 'list':
      return {
        success: true,
        files: FileRegistry.getLoadedFiles()
      };
    
    case 'stats':
      return {
        success: true,
        stats: {
          totalFiles: FileRegistry.getLoadedFiles().length,
          totalObjects: FileRegistry.getDatabase().getObjectsByType(CALObjectType.Table).length +
                        FileRegistry.getDatabase().getObjectsByType(CALObjectType.Page).length +
                        FileRegistry.getDatabase().getObjectsByType(CALObjectType.Codeunit).length +
                        FileRegistry.getDatabase().getObjectsByType(CALObjectType.Report).length +
                        FileRegistry.getDatabase().getObjectsByType(CALObjectType.Query).length +
                        FileRegistry.getDatabase().getObjectsByType(CALObjectType.XMLport).length,
          totalBytes: 0 // Would need to track this during loading
        }
      };
    
    default:
      return {
        success: false,
        error: `Invalid action: ${action}`
    };
  }
}

// ============================================
// EXTENDED MCP TOOLS (Task 13)
// ============================================

export interface CodeSearchResult {
  objectType: string;
  objectId: number;
  objectName: string;
  procedureName: string;
  match: string;
  lineNumber: number;
}

export interface CodeSearchParams {
  pattern: string;
  objectType?: string;
  limit?: number;
}

export function searchCode(db: SymbolDatabase, params: CodeSearchParams): CodeSearchResult[] {
  const { pattern, objectType, limit = 20 } = params;
  const results: CodeSearchResult[] = [];
  const regex = new RegExp(pattern, 'gi');

  const objects = objectType
    ? db.getObjectsByType(objectType as CALObjectType)
    : [
        ...db.getObjectsByType(CALObjectType.Table),
        ...db.getObjectsByType(CALObjectType.Codeunit),
        ...db.getObjectsByType(CALObjectType.Page),
        ...db.getObjectsByType(CALObjectType.Report),
      ];

  for (const obj of objects) {
    if (results.length >= limit) break;
    const procedures = db.getProceduresByObject(obj.type, obj.id);
    for (const proc of procedures) {
      if (results.length >= limit) break;
      if (!proc.body) continue;
      const lines = proc.body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= limit) break;
        const line = lines[i];
        if (regex.test(line)) {
          results.push({
            objectType: obj.type,
            objectId: obj.id,
            objectName: obj.name,
            procedureName: proc.name,
            match: line.trim(),
            lineNumber: i + 1,
          });
          regex.lastIndex = 0;
        }
      }
    }
  }
  return results;
}

export interface DependencyParams {
  objectType: string;
  objectId: number;
  direction?: 'incoming' | 'outgoing' | 'both';
}

export interface DependencyGraph {
  incoming: CALReference[];
  outgoing: CALReference[];
}

export function getDependencies(db: SymbolDatabase, params: DependencyParams): DependencyGraph {
  const { objectType, objectId, direction = 'both' } = params;
  const result: DependencyGraph = { incoming: [], outgoing: [] };
  const allRefs = FileRegistry.getReferences();
  const targetObj = db.getObject(objectType as CALObjectType, objectId);
  const targetName = targetObj?.name || '';

  if (direction === 'incoming' || direction === 'both') {
    result.incoming = allRefs.filter(ref => {
      return (ref.targetId === objectId && ref.targetType === 'Table') ||
        ref.targetName.toLowerCase() === targetName.toLowerCase();
    });
    
    // Also check database objects for table relations and source table references
    const allObjects = [
      ...db.getObjectsByType(CALObjectType.Table),
      ...db.getObjectsByType(CALObjectType.Page),
      ...db.getObjectsByType(CALObjectType.Codeunit),
      ...db.getObjectsByType(CALObjectType.Report),
    ];
    
    for (const obj of allObjects) {
      if (obj.type === CALObjectType.Table) {
        const table = obj as CALTable;
        for (const field of table.fields || []) {
           for (const prop of field.properties || []) {
             if (prop.name === 'TableRelation' && typeof prop.value === 'string' && prop.value?.toLowerCase().includes(targetName.toLowerCase())) {
              const ref: CALReference = {
                sourceType: CALObjectType.Table,
                sourceId: table.id,
                sourceName: table.name,
                sourceLocation: `Field:${field.name}`,
                targetType: 'Table',
                targetId: objectId,
                targetName: targetName,
                referenceType: 'TableRelation',
              };
              if (!result.incoming.some(r => r.sourceId === ref.sourceId && r.targetId === ref.targetId)) {
                result.incoming.push(ref);
              }
            }
          }
        }
      } else if (obj.type === CALObjectType.Page) {
        const page = obj as CALPage;
        if (page.sourceTable === objectId) {
          const ref: CALReference = {
            sourceType: CALObjectType.Page,
            sourceId: page.id,
            sourceName: page.name,
            sourceLocation: 'SourceTable',
            targetType: 'Table',
            targetId: objectId,
            targetName: targetName,
            referenceType: 'SourceTable',
          };
          if (!result.incoming.some(r => r.sourceId === ref.sourceId && r.targetId === ref.targetId)) {
            result.incoming.push(ref);
          }
        }
      }
    }
  }

  if (direction === 'outgoing' || direction === 'both') {
    result.outgoing = allRefs.filter(ref => {
      return ref.sourceType === objectType && ref.sourceId === objectId;
    });
    
    // Also check database objects for outgoing references
    const sourceObj = db.getObject(objectType as CALObjectType, objectId);
    if (sourceObj && sourceObj.type === CALObjectType.Table) {
      const table = sourceObj as CALTable;
      for (const field of table.fields || []) {
        for (const prop of field.properties || []) {
          if (prop.name === 'TableRelation' && typeof prop.value === 'string' && prop.value) {
            // Extract table name from TableRelation
            // Format: "Table Name" or Table.Field or "Table Name" WHERE ...
            let targetTableName = '';
            const quotedMatch = prop.value.match(/^"([^"]+)"/);
            if (quotedMatch) {
              targetTableName = quotedMatch[1].trim();
            } else {
              targetTableName = prop.value.split('.')[0].split(' ')[0].trim();
            }
            
            const targetTable = db.getObject(CALObjectType.Table, targetTableName);
            if (targetTable) {
              const ref: CALReference = {
                sourceType: CALObjectType.Table,
                sourceId: table.id,
                sourceName: table.name,
                sourceLocation: `Field:${field.name}`,
                targetType: 'Table',
                targetId: targetTable.id,
                targetName: targetTable.name,
                referenceType: 'TableRelation',
              };
              if (!result.outgoing.some(r => r.sourceId === ref.sourceId && r.targetId === ref.targetId)) {
                result.outgoing.push(ref);
              }
            }
          }
        }
      }
    }
  }

  return result;
}

export interface TableRelationsParams {
  tableId?: number;
  includeCalcFormula?: boolean;
}

export function getTableRelations(db: SymbolDatabase, params: TableRelationsParams): CALReference[] {
  const { tableId, includeCalcFormula = false } = params;
  const allRefs = FileRegistry.getReferences();
  const results: CALReference[] = [];
  
  // Get references from FileRegistry
  let filtered = allRefs.filter(ref => {
    if (includeCalcFormula) {
      return ref.referenceType === 'TableRelation' || ref.referenceType === 'CalcFormula';
    }
    return ref.referenceType === 'TableRelation';
  });

  if (tableId !== undefined) {
    filtered = filtered.filter(ref => 
      ref.sourceType === CALObjectType.Table && ref.sourceId === tableId
    );
  }
  
  results.push(...filtered);
  
  // Also extract from database objects
  const tables = db.getObjectsByType(CALObjectType.Table) as CALTable[];
  for (const table of tables) {
    if (tableId !== undefined && table.id !== tableId) continue;
    
    for (const field of table.fields || []) {
      for (const prop of field.properties || []) {
        if (prop.name === 'TableRelation' && typeof prop.value === 'string' && prop.value) {
          // Extract table name from TableRelation
          // Format: "Table Name" or Table.Field or "Table Name" WHERE ...
          let targetTableName = '';
          const quotedMatch = prop.value.match(/^"([^"]+)"/);
          if (quotedMatch) {
            targetTableName = quotedMatch[1].trim();
          } else {
            targetTableName = prop.value.split('.')[0].split(' ')[0].trim();
          }
          
          const targetTable = db.getObject(CALObjectType.Table, targetTableName);
          if (targetTable) {
            const ref: CALReference = {
              sourceType: CALObjectType.Table,
              sourceId: table.id,
              sourceName: table.name,
              sourceLocation: `Field:${field.name}`,
              targetType: 'Table',
              targetId: targetTable.id,
              targetName: targetTable.name,
              referenceType: 'TableRelation',
            };
            if (!results.some(r => r.sourceId === ref.sourceId && r.targetId === ref.targetId)) {
              results.push(ref);
            }
          }
        }
      }
      
      if (includeCalcFormula && field.calcFormula) {
        // Parse CalcFormula to extract table reference
        // Format: Sum("Table Name".Field WHERE ...)
        const calcFormulaMatch = field.calcFormula.match(/(?:Sum|Count|Min|Max|Avg)\s*\(\s*"([^"]+)"/);
        if (calcFormulaMatch) {
          const targetTableName = calcFormulaMatch[1].trim();
          const targetTable = db.getObject(CALObjectType.Table, targetTableName);
          if (targetTable) {
            const ref: CALReference = {
              sourceType: CALObjectType.Table,
              sourceId: table.id,
              sourceName: table.name,
              sourceLocation: `Field:${field.name}`,
              targetType: 'Table',
              targetId: targetTable.id,
              targetName: targetTable.name,
              referenceType: 'CalcFormula',
            };
            if (!results.some(r => r.sourceId === ref.sourceId && r.targetId === ref.targetId && r.referenceType === 'CalcFormula')) {
              results.push(ref);
            }
          }
        }
      }
    }
  }

  return results;
}


/**
 * Helper: Load files from path
 */
async function loadFiles(path: string | undefined, autoDiscover: boolean, _forceReload: boolean): Promise<ManageFilesResult> {
  if (!path) {
    return {
      success: false,
      error: 'Path is required for load action'
    };
  }

  try {
    // Check if path exists
    if (!existsSync(path)) {
      return {
        success: false,
        error: `Path does not exist: ${path}`
      };
    }

    const stats = statSync(path);
    let result: LoadResult;

    if (stats.isDirectory()) {
      // Load directory
      if (autoDiscover) {
        // Auto-discover .txt files
        result = await loadDirectory(path, '*.txt');
      } else {
        result = await loadDirectory(path, '*.txt');
      }
    } else {
      // Load single file
      result = await loadFile(path);
    }

    // Add objects to registry
    result.objects.forEach(obj => {
      FileRegistry.addObject(obj);
    });

    // Track loaded file(s)
    if (stats.isDirectory()) {
      FileRegistry.addLoadedFile(path);
    } else {
      FileRegistry.addLoadedFile(path);
    }

    // Format errors
    const errors = result.errors.map(err => 
      `${err.filePath}: ${err.error}`
    );

    return {
      success: true,
      stats: result.stats,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
