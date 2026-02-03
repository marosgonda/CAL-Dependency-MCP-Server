/**
 * Parser for C/AL Report DATASET section
 * Handles parsing of DATAITEM declarations and columns
 */

import { CALDataItem, CALColumn } from '../types/cal-types';

/**
 * Parsed report dataset result
 */
export interface ReportDatasetResult {
  dataItems: CALDataItem[];
  columns: CALColumn[];
}

/**
 * Parses a C/AL Report DATASET section
 * 
 * @param content - The report content containing DATASET section
 * @returns Parsed dataItems and columns
 * @throws Error if DATASET section is not found
 * 
 * @example
 * parseReportDataset(reportContent)
 * // Returns: { dataItems: [...], columns: [...] }
 */
export function parseReportDataset(content: string): ReportDatasetResult {
  // Find DATASET section using more robust matching
  const datasetStart = content.indexOf('DATASET');
  if (datasetStart === -1) {
    throw new Error('DATASET section not found in report content');
  }
  
  // Find the matching closing brace for DATASET
  // We need to track brace depth to find the correct closing brace
  let braceDepth = 0;
  let inDataset = false;
  let datasetEnd = -1;
  
  for (let i = datasetStart; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceDepth++;
      inDataset = true;
    } else if (char === '}') {
      braceDepth--;
      if (inDataset && braceDepth === 0) {
        datasetEnd = i;
        break;
      }
    }
  }
  
  if (datasetEnd === -1) {
    throw new Error('Could not find end of DATASET section');
  }
  
  const datasetSection = content.substring(datasetStart, datasetEnd + 1);
  const dataItems: CALDataItem[] = [];
  const allColumns: CALColumn[] = [];
  
  const lines = datasetSection.split('\n');
  let currentDataItem: CALDataItem | null = null;
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
    
    // Parse properties (lines with = but not column/trigger)
    if (currentDataItem && !line.includes('column(') && !line.includes('trigger ') && line.includes('=')) {
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
    // Format: column(name;sourceExpr)
    const columnMatch = line.match(/column\(([^;]+);([^)]+)\)/);
    if (columnMatch && currentDataItem) {
      const [, name, sourceExpr] = columnMatch;
      
      const column: CALColumn = {
        id: columnIdCounter++,
        name: name.trim(),
        sourceExpr: sourceExpr.trim(),
        properties: [],
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
