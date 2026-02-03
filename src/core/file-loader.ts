/**
 * Streaming File Loader for C/AL Objects
 * Handles loading .txt files with object boundary detection, BOM detection, and parser routing
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { CALObject, CALObjectType, CALCodeunit, CALReport, CALQuery, CALXMLport, CALMenuSuite } from '../types/cal-types';
import { parseObjectDeclaration, parseObjectProperties } from '../parser/object-parser';
import { parseTable } from '../parser/table-parser';
import { parsePage } from '../parser/page-parser';
import { parseCodeunit } from '../parser/codeunit-parser';
import { parseReportDataset } from '../parser/report-parser';
import { parseQueryElements } from '../parser/query-parser';
import { parseXMLportElements } from '../parser/xmlport-parser';
import { parseMenuItems } from '../parser/menusuite-parser';

/**
 * Error encountered during loading
 */
export interface LoadError {
  filePath: string;
  objectIndex?: number;
  error: string;
  severity: 'warning' | 'error';
}

/**
 * Statistics for loading operation
 */
export interface LoadStats {
  totalFiles: number;
  totalObjects: number;
  totalBytes: number;
  duration: number;
}

/**
 * Result of loading operation
 */
export interface LoadResult {
  objects: CALObject[];
  errors: LoadError[];
  stats: LoadStats;
}

/**
 * Options for loading files
 */
export interface LoadOptions {
  encoding?: BufferEncoding;
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Detects and strips UTF-8 BOM (0xEF 0xBB 0xBF) from content
 * @param content - File content as string
 * @returns Content with BOM stripped if present
 */
function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Splits file content into individual object contents by detecting OBJECT boundaries
 * Pattern: ^OBJECT (Table|Page|...) \d+ .+$
 * @param content - Full file content
 * @returns Array of object content strings
 */
function splitObjects(content: string): string[] {
  const objectPattern = /^OBJECT\s+(Table|Page|Form|Codeunit|Report|XMLport|Query|MenuSuite)\s+\d+\s+.+$/gm;
  const matches = Array.from(content.matchAll(objectPattern));
  
  if (matches.length === 0) {
    return [];
  }
  
  const objects: string[] = [];
  
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index!;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
    const objectContent = content.substring(startIndex, endIndex).trim();
    objects.push(objectContent);
  }
  
  return objects;
}

/**
 * Routes object content to appropriate parser based on object type
 * @param content - Single object content
 * @returns Parsed CAL object
 * @throws Error if parsing fails or object type is unknown
 */
function routeToParser(content: string): CALObject {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  switch (header.type) {
    case CALObjectType.Table:
      return parseTable(content);
      
    case CALObjectType.Page:
    case CALObjectType.Form:
      return parsePage(content);
      
    case CALObjectType.Codeunit:
      return parseCodeunitFull(content);
      
    case CALObjectType.Report:
      return parseReportFull(content);
      
    case CALObjectType.Query:
      return parseQueryFull(content);
      
    case CALObjectType.XMLport:
      return parseXMLportFull(content);
      
    case CALObjectType.MenuSuite:
      return parseMenuSuiteFull(content);
      
    default:
      throw new Error(`Unknown object type: ${header.type}`);
  }
}

/**
 * Full parser for Codeunit objects
 * Wraps parseCodeunit to return CALCodeunit
 */
function parseCodeunitFull(content: string): CALCodeunit {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  // Parse OBJECT-PROPERTIES
  const objectPropsMatch = content.match(/OBJECT-PROPERTIES\s*\{[\s\S]*?\}/);
  const objectProperties = objectPropsMatch ? parseObjectProperties(objectPropsMatch[0]) : undefined;
  
  // Parse PROPERTIES section
  const propsMatch = content.match(/^\s*PROPERTIES\s*\{[\s\S]*?\}/m);
  const properties = propsMatch ? parsePropertiesSimple(propsMatch[0]) : [];
  
  // Parse CODE section
  const parsed = parseCodeunit(content);
  
  return {
    type: CALObjectType.Codeunit,
    id: header.id,
    name: header.name,
    objectProperties,
    properties,
    procedures: parsed.procedures,
    variables: parsed.variables,
  };
}

/**
 * Full parser for Report objects
 * Wraps parseReportDataset to return CALReport
 */
function parseReportFull(content: string): CALReport {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  // Parse OBJECT-PROPERTIES
  const objectPropsMatch = content.match(/OBJECT-PROPERTIES\s*\{[\s\S]*?\}/);
  const objectProperties = objectPropsMatch ? parseObjectProperties(objectPropsMatch[0]) : undefined;
  
  // Parse PROPERTIES section
  const propsMatch = content.match(/^\s*PROPERTIES\s*\{[\s\S]*?\}/m);
  const properties = propsMatch ? parsePropertiesSimple(propsMatch[0]) : [];
  
  // Parse DATASET
  const dataset = parseReportDataset(content);
  
  return {
    type: CALObjectType.Report,
    id: header.id,
    name: header.name,
    objectProperties,
    properties,
    dataItems: dataset.dataItems,
    columns: dataset.columns,
    procedures: [],
    variables: [],
  };
}

/**
 * Full parser for Query objects
 * Wraps parseQueryElements to return CALQuery
 */
function parseQueryFull(content: string): CALQuery {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  // Parse OBJECT-PROPERTIES
  const objectPropsMatch = content.match(/OBJECT-PROPERTIES\s*\{[\s\S]*?\}/);
  const objectProperties = objectPropsMatch ? parseObjectProperties(objectPropsMatch[0]) : undefined;
  
  // Parse PROPERTIES section
  const propsMatch = content.match(/^\s*PROPERTIES\s*\{[\s\S]*?\}/m);
  const properties = propsMatch ? parsePropertiesSimple(propsMatch[0]) : [];
  
  // Parse ELEMENTS
  const elements = parseQueryElements(content);
  
  return {
    type: CALObjectType.Query,
    id: header.id,
    name: header.name,
    objectProperties,
    properties,
    dataItems: elements.dataItems,
    columns: elements.columns,
  };
}

/**
 * Full parser for XMLport objects
 * Wraps parseXMLportElements to return CALXMLport
 */
function parseXMLportFull(content: string): CALXMLport {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  // Parse OBJECT-PROPERTIES
  const objectPropsMatch = content.match(/OBJECT-PROPERTIES\s*\{[\s\S]*?\}/);
  const objectProperties = objectPropsMatch ? parseObjectProperties(objectPropsMatch[0]) : undefined;
  
  // Parse PROPERTIES section
  const propsMatch = content.match(/^\s*PROPERTIES\s*\{[\s\S]*?\}/m);
  const properties = propsMatch ? parsePropertiesSimple(propsMatch[0]) : [];
  
  // Parse ELEMENTS
  const elements = parseXMLportElements(content);
  
  return {
    type: CALObjectType.XMLport,
    id: header.id,
    name: header.name,
    objectProperties,
    properties,
    nodes: elements.nodes,
    direction: 'Both', // Default value
    format: 'Xml', // Default value
    procedures: [],
    variables: [],
  };
}

/**
 * Full parser for MenuSuite objects
 * Wraps parseMenuItems to return CALMenuSuite
 */
function parseMenuSuiteFull(content: string): CALMenuSuite {
  const firstLine = content.split('\n')[0];
  const header = parseObjectDeclaration(firstLine);
  
  // Parse OBJECT-PROPERTIES
  const objectPropsMatch = content.match(/OBJECT-PROPERTIES\s*\{[\s\S]*?\}/);
  const objectProperties = objectPropsMatch ? parseObjectProperties(objectPropsMatch[0]) : undefined;
  
  // Parse PROPERTIES section
  const propsMatch = content.match(/^\s*PROPERTIES\s*\{[\s\S]*?\}/m);
  const properties = propsMatch ? parsePropertiesSimple(propsMatch[0]) : [];
  
  // Parse MENUITEMS
  const menuItems = parseMenuItems(content);
  
  return {
    type: CALObjectType.MenuSuite,
    id: header.id,
    name: header.name,
    objectProperties,
    properties,
    menuItems: menuItems.menuItems,
  };
}

/**
 * Simple properties parser (for objects without full parsers)
 */
function parsePropertiesSimple(_propertiesSection: string): any[] {
  // Minimal implementation - just return empty array for now
  // Full implementation would parse all properties
  return [];
}

/**
 * Loads a single file and parses all objects within it
 * @param filePath - Path to the .txt file
 * @param options - Loading options
 * @returns LoadResult with parsed objects, errors, and stats
 */
export async function loadFile(filePath: string, options?: LoadOptions): Promise<LoadResult> {
  const startTime = Date.now();
  const encoding = options?.encoding || 'utf-8';
  const objects: CALObject[] = [];
  const errors: LoadError[] = [];
  let totalBytes = 0;
  
  try {
    // Read file
    const content = readFileSync(filePath, encoding);
    totalBytes = Buffer.byteLength(content, encoding);
    
    // Strip BOM
    const cleanContent = stripBOM(content);
    
    // Split into objects
    const objectContents = splitObjects(cleanContent);
    
    if (objectContents.length === 0) {
      errors.push({
        filePath,
        error: 'No valid OBJECT declarations found in file',
        severity: 'warning'
      });
    }
    
    // Parse each object
    for (let i = 0; i < objectContents.length; i++) {
      try {
        const obj = routeToParser(objectContents[i]);
        objects.push(obj);
        
        // Report progress
        if (options?.onProgress) {
          options.onProgress(i + 1, objectContents.length);
        }
      } catch (error) {
        errors.push({
          filePath,
          objectIndex: i,
          error: error instanceof Error ? error.message : String(error),
          severity: 'warning'
        });
      }
    }
  } catch (error) {
    errors.push({
      filePath,
      error: error instanceof Error ? error.message : String(error),
      severity: 'error'
    });
  }
  
  const duration = Date.now() - startTime;
  
  return {
    objects,
    errors,
    stats: {
      totalFiles: 1,
      totalObjects: objects.length,
      totalBytes,
      duration
    }
  };
}

/**
 * Loads all files from a directory matching a pattern
 * @param dirPath - Path to directory
 * @param pattern - Glob pattern (e.g., "*.txt", "table-*.txt")
 * @returns LoadResult with all parsed objects, errors, and stats
 */
export async function loadDirectory(dirPath: string, pattern: string = '*.txt'): Promise<LoadResult> {
  const startTime = Date.now();
  const allObjects: CALObject[] = [];
  const allErrors: LoadError[] = [];
  let totalBytes = 0;
  let totalFiles = 0;
  
  try {
    // Read directory
    const files = readdirSync(dirPath);
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Filter files by pattern
    const matchingFiles = files.filter(f => regex.test(f));
    
    // Load each file
    for (const file of matchingFiles) {
      const filePath = join(dirPath, file);
      
      // Skip directories
      try {
        const stats = statSync(filePath);
        if (stats.isDirectory()) continue;
      } catch {
        continue;
      }
      
      const result = await loadFile(filePath);
      allObjects.push(...result.objects);
      allErrors.push(...result.errors);
      totalBytes += result.stats.totalBytes;
      totalFiles++;
    }
  } catch (error) {
    allErrors.push({
      filePath: dirPath,
      error: error instanceof Error ? error.message : String(error),
      severity: 'error'
    });
  }
  
  const duration = Date.now() - startTime;
  
  return {
    objects: allObjects,
    errors: allErrors,
    stats: {
      totalFiles,
      totalObjects: allObjects.length,
      totalBytes,
      duration
    }
  };
}

/**
 * Streams objects from a file one at a time
 * @param filePath - Path to the .txt file
 * @yields CALObject instances
 * @throws Error if file cannot be read
 */
export async function* streamObjects(filePath: string): AsyncGenerator<CALObject> {
  // Read file
  const content = readFileSync(filePath, 'utf-8');
  
  // Strip BOM
  const cleanContent = stripBOM(content);
  
  // Split into objects
  const objectContents = splitObjects(cleanContent);
  
  // Yield each parsed object
  for (const objectContent of objectContents) {
    const obj = routeToParser(objectContent);
    yield obj;
  }
}
