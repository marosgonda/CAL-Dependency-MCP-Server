/**
 * Parser for C/AL Query ELEMENTS section
 * Handles parsing of DATAITEM declarations and columns for queries
 */

import { CALQueryDataItem, CALQueryColumn } from '../types/cal-types';

/**
 * Parsed query elements result
 */
export interface QueryElementsResult {
  dataItems: CALQueryDataItem[];
  columns: CALQueryColumn[];
}

/**
 * Parses a C/AL Query ELEMENTS section
 * 
 * @param content - The query content containing ELEMENTS section
 * @returns Parsed dataItems and columns
 * @throws Error if ELEMENTS section is not found
 * 
 * @example
 * parseQueryElements(queryContent)
 * // Returns: { dataItems: [...], columns: [...] }
 */
export function parseQueryElements(content: string): QueryElementsResult {
  // Find ELEMENTS section using more robust matching
  const elementsStart = content.indexOf('ELEMENTS');
  if (elementsStart === -1) {
    throw new Error('ELEMENTS section not found in query content');
  }
  
  // Find the matching closing brace for ELEMENTS
  let braceDepth = 0;
  let inElements = false;
  let elementsEnd = -1;
  
  for (let i = elementsStart; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceDepth++;
      inElements = true;
    } else if (char === '}') {
      braceDepth--;
      if (inElements && braceDepth === 0) {
        elementsEnd = i;
        break;
      }
    }
  }
  
  if (elementsEnd === -1) {
    throw new Error('Could not find end of ELEMENTS section');
  }
  
  const elementsSection = content.substring(elementsStart, elementsEnd + 1);
  const dataItems: CALQueryDataItem[] = [];
  const allColumns: CALQueryColumn[] = [];
  
  const lines = elementsSection.split('\n');
  let currentDataItem: CALQueryDataItem | null = null;
  let columnIdCounter = 1;
  let baseIndentation: number | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for DATAITEM declaration
    const dataItemMatch = line.match(/\{\s*DATAITEM\s+"([^"]+)";"([^"]+)"/);
    if (dataItemMatch) {
      const [, name] = dataItemMatch;
      
      // Calculate indentation based on leading whitespace before the opening brace
      const leadingSpaces = line.match(/^(\s*)\{/)?.[1].length || 0;
      
      // Set base indentation from first DATAITEM
      if (baseIndentation === null) {
        baseIndentation = leadingSpaces;
      }
      
      // Calculate relative indentation (each nesting level adds ~14 spaces)
      const indentation = Math.floor((leadingSpaces - baseIndentation) / 14);
      
      currentDataItem = {
        id: dataItems.length + 1,
        name: name.trim(),
        sourceTable: 0, // Will be resolved later if needed
        indentation,
        columns: [],
        properties: [],
      };
      
      dataItems.push(currentDataItem);
      continue;
    }
    
    // Parse properties (lines with = but not column/filter)
    if (currentDataItem && !line.includes('column(') && !line.includes('filter(') && line.includes('=')) {
      const propMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);\s*$/);
      if (propMatch) {
        const [, propName, propValue] = propMatch;
        currentDataItem.properties.push({
          name: propName.trim(),
          value: propValue.trim(),
        });
      }
    }
    
    // Parse columns
    // Format: column(name;sourceField)
    const columnMatch = line.match(/column\(([^;]+);([^)]+)\)/);
    if (columnMatch && currentDataItem) {
      const [, name, sourceField] = columnMatch;
      
      const column: CALQueryColumn = {
        id: columnIdCounter++,
        name: name.trim(),
        sourceField: sourceField.trim(),
        properties: [],
      };
      
      currentDataItem.columns.push(column);
      allColumns.push(column);
    }
    
    // Parse filters (similar to columns, but we'll add them to columns with a filter property)
    // Format: filter(name;sourceField)
    const filterMatch = line.match(/filter\(([^;]+);([^)]+)\)/);
    if (filterMatch && currentDataItem) {
      const [, name, sourceField] = filterMatch;
      
      const column: CALQueryColumn = {
        id: columnIdCounter++,
        name: name.trim(),
        sourceField: sourceField.trim(),
        properties: [{ name: 'Filter', value: 'Yes' }],
      };
      
      currentDataItem.columns.push(column);
      allColumns.push(column);
    }
  }
  
  return {
    dataItems,
    columns: allColumns,
  };
}
