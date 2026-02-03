/**
 * Parser for C/AL XMLport ELEMENTS section
 * Handles parsing of ELEMENT declarations (Element, Field, Text nodes)
 */

import { CALPortNode } from '../types/cal-types';

/**
 * Parsed XMLport elements result
 */
export interface XMLportElementsResult {
  nodes: CALPortNode[];
}

/**
 * Parses a C/AL XMLport ELEMENTS section
 * 
 * @param content - The XMLport content containing ELEMENTS section
 * @returns Parsed nodes (Element, Field, Text)
 * @throws Error if ELEMENTS section is not found
 * 
 * @example
 * parseXMLportElements(xmlportContent)
 * // Returns: { nodes: [...] }
 */
export function parseXMLportElements(content: string): XMLportElementsResult {
  // Find ELEMENTS section using more robust matching
  const elementsStart = content.indexOf('ELEMENTS');
  if (elementsStart === -1) {
    throw new Error('ELEMENTS section not found in XMLport content');
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
  const nodes: CALPortNode[] = [];
  
  const lines = elementsSection.split('\n');
  let currentNode: CALPortNode | null = null;
  let nodeIdCounter = 1;
  let baseIndentation: number | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for ELEMENT declaration
    // Format: { ELEMENT;name;nodeType ;
    const elementMatch = line.match(/\{\s*ELEMENT;([^;]+);(Element|Field|Text|Attribute)\s*;/);
    if (elementMatch) {
      const [, name, nodeType] = elementMatch;
      
      // Calculate indentation based on leading whitespace before the opening brace
      const leadingSpaces = line.match(/^(\s*)\{/)?.[1].length || 0;
      
      // Set base indentation from first ELEMENT
      if (baseIndentation === null) {
        baseIndentation = leadingSpaces;
      }
      
      // Calculate relative indentation (each nesting level adds ~10 spaces in XMLport)
      const indentation = Math.floor((leadingSpaces - baseIndentation) / 10);
      
      currentNode = {
        id: nodeIdCounter++,
        name: name.trim(),
        nodeType: nodeType.trim() as 'Element' | 'Attribute' | 'Text',
        indentation,
        fields: [],
        properties: [],
      };
      
      nodes.push(currentNode);
      continue;
    }
    
    // Parse properties (lines with = but not nested ELEMENT)
    if (currentNode && !line.includes('{ ELEMENT') && line.includes('=')) {
      const propMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);?\s*$/);
      if (propMatch) {
        const [, propName, propValue] = propMatch;
        currentNode.properties.push({
          name: propName.trim(),
          value: propValue.trim().replace(/;$/, ''),
        });
      }
    }
  }
  
  return {
    nodes,
  };
}
