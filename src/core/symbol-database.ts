/**
 * Symbol Database with Map-based indices for fast lookups
 * Provides efficient search and retrieval of CAL objects, fields, and procedures
 */

import {
  CALObject,
  CALObjectType,
  CALField,
  CALProcedure,
  CALTable,
  CALPage,
  CALCodeunit,
  CALReport,
  CALXMLport,
  CALQuery,
} from '../types/cal-types';

/**
 * Summary representation of a CAL object with truncated collections
 */
export interface CALObjectSummary {
  id: number;
  name: string;
  type: CALObjectType;
  properties: CALObject['properties'];
  objectProperties?: CALObject['objectProperties'];
  fields?: CALField[];
  totalFields?: number;
  procedures?: CALProcedure[];
  totalProcedures?: number;
}

/**
 * Symbol database for storing and indexing CAL objects
 * Uses Map-based indices for O(1) lookups
 */
export class SymbolDatabase {
  // Indices for fast lookups
  private objectsByName: Map<string, CALObject[]>;
  private objectsByType: Map<CALObjectType, CALObject[]>;
  private objectsById: Map<string, CALObject>; // key: "Table:18"
  private fieldsByTable: Map<string, CALField[]>; // key: table ID as string
  private proceduresByObject: Map<string, CALProcedure[]>; // key: "Table:18"

  constructor() {
    this.objectsByName = new Map();
    this.objectsByType = new Map();
    this.objectsById = new Map();
    this.fieldsByTable = new Map();
    this.proceduresByObject = new Map();
  }

  /**
   * Add a CAL object to the database and update all indices
   */
  addObject(obj: CALObject): void {
    const key = this.makeKey(obj.type, obj.id);

    // Update objectsById index
    this.objectsById.set(key, obj);

    // Update objectsByName index (support multiple objects with same name)
    const nameLower = obj.name.toLowerCase();
    const existingByName = this.objectsByName.get(nameLower) || [];
    // Remove any existing object with same type and id
    const filtered = existingByName.filter(
      (existing) => !(existing.type === obj.type && existing.id === obj.id)
    );
    this.objectsByName.set(nameLower, [...filtered, obj]);

    // Update objectsByType index
    const existingByType = this.objectsByType.get(obj.type) || [];
    const filteredByType = existingByType.filter((existing) => existing.id !== obj.id);
    this.objectsByType.set(obj.type, [...filteredByType, obj]);

    // Update fieldsByTable index (only for tables)
    if (obj.type === CALObjectType.Table) {
      const table = obj as CALTable;
      this.fieldsByTable.set(obj.id.toString(), table.fields || []);
    }

    // Update proceduresByObject index (for objects that have procedures)
    const procedures = this.extractProcedures(obj);
    if (procedures.length > 0) {
      this.proceduresByObject.set(key, procedures);
    }
  }

  /**
   * Search objects by pattern with optional type filter and pagination
   * Supports wildcard patterns: "Cust*", "*Post", "Sales*Header"
   */
  searchObjects(
    pattern: string,
    type?: CALObjectType,
    limit?: number,
    offset: number = 0
  ): CALObject[] {
    // Convert pattern to regex (case-insensitive)
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`, 'i');

    // Get objects to search
    let objectsToSearch: CALObject[];
    if (type) {
      objectsToSearch = this.objectsByType.get(type) || [];
    } else {
      objectsToSearch = Array.from(this.objectsById.values());
    }

    // Filter by pattern
    const matches = objectsToSearch.filter((obj) => regex.test(obj.name));

    // Apply pagination
    const start = offset;
    const end = limit !== undefined ? start + limit : undefined;
    return matches.slice(start, end);
  }

  /**
   * Get object by type and ID or name
   */
  getObject(type: CALObjectType, idOrName: number | string): CALObject | undefined {
    if (typeof idOrName === 'number') {
      // Search by ID
      const key = this.makeKey(type, idOrName);
      return this.objectsById.get(key);
    } else {
      // Search by name
      const nameLower = idOrName.toLowerCase();
      const candidates = this.objectsByName.get(nameLower) || [];
      return candidates.find((obj) => obj.type === type);
    }
  }

  /**
   * Get all objects of a specific type
   */
  getObjectsByType(type: CALObjectType): CALObject[] {
    return this.objectsByType.get(type) || [];
  }

  /**
   * Get all fields for a table by table ID
   */
  getFieldsByTable(tableId: number): CALField[] {
    return this.fieldsByTable.get(tableId.toString()) || [];
  }

  /**
   * Get all procedures for an object by type and ID
   */
  getProceduresByObject(type: CALObjectType, id: number): CALProcedure[] {
    const key = this.makeKey(type, id);
    return this.proceduresByObject.get(key) || [];
  }

  /**
   * Get object summary with truncated fields and procedures (max 10 each)
   */
  getObjectSummary(type: CALObjectType, id: number): CALObjectSummary | undefined {
    const obj = this.getObject(type, id);
    if (!obj) {
      return undefined;
    }

    const summary: CALObjectSummary = {
      id: obj.id,
      name: obj.name,
      type: obj.type,
      properties: obj.properties,
      objectProperties: obj.objectProperties,
    };

    // Add fields if object is a table
    if (obj.type === CALObjectType.Table) {
      const table = obj as CALTable;
      const allFields = table.fields || [];
      summary.fields = allFields.slice(0, 10);
      summary.totalFields = allFields.length;
    }

    // Add procedures if object has them
    const allProcedures = this.extractProcedures(obj);
    if (allProcedures.length > 0) {
      summary.procedures = allProcedures.slice(0, 10);
      summary.totalProcedures = allProcedures.length;
    }

    return summary;
  }

  /**
   * Helper: Create a unique key for type:id combinations
   */
  private makeKey(type: CALObjectType, id: number): string {
    return `${type}:${id}`;
  }

  /**
   * Helper: Extract procedures from any object type that supports them
   */
  private extractProcedures(obj: CALObject): CALProcedure[] {
    switch (obj.type) {
      case CALObjectType.Table:
        return (obj as CALTable).procedures || [];
      case CALObjectType.Page:
        return (obj as CALPage).procedures || [];
      case CALObjectType.Codeunit:
        return (obj as CALCodeunit).procedures || [];
      case CALObjectType.Report:
        return (obj as CALReport).procedures || [];
      case CALObjectType.XMLport:
        return (obj as CALXMLport).procedures || [];
      default:
        return [];
    }
  }
}
