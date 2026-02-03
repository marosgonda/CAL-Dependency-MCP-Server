/**
 * Parser for C/AL object declarations and properties
 * Handles parsing of OBJECT declaration lines and OBJECT-PROPERTIES sections
 */

import { CALObjectType } from '../types/cal-types';

/**
 * Parsed C/AL object header from OBJECT declaration line
 */
export interface CALObjectHeader {
  type: CALObjectType;
  id: number;
  name: string;
}

/**
 * Parsed C/AL object properties from OBJECT-PROPERTIES section
 */
export interface CALObjectProperties {
  date?: string;
  time?: string;
  versionList?: string;
}

/**
 * Parses a C/AL object declaration line
 * Format: OBJECT <Type> <ID> <Name>
 * 
 * @param line - The OBJECT declaration line (e.g., "OBJECT Table 3 Payment Terms")
 * @returns Parsed object header with type, id, and name
 * @throws Error if the line format is invalid or object type is unknown
 * 
 * @example
 * parseObjectDeclaration("OBJECT Table 3 Payment Terms")
 * // Returns: { type: CALObjectType.Table, id: 3, name: "Payment Terms" }
 */
export function parseObjectDeclaration(line: string): CALObjectHeader {
  // Regex to match: OBJECT <Type> <ID> <Name>
  // Captures: type, id, name (name can contain spaces and special characters)
  const regex = /^OBJECT\s+(Table|Page|Form|Codeunit|Report|XMLport|Query|MenuSuite)\s+(\d+)\s+(.+)$/;
  
  const match = line.match(regex);
  
  if (!match) {
    throw new Error(`Invalid OBJECT declaration format: ${line}`);
  }
  
  const [, typeStr, idStr, name] = match;
  
  // Validate object type
  const type = typeStr as keyof typeof CALObjectType;
  if (!(type in CALObjectType)) {
    throw new Error(`Unknown object type: ${typeStr}`);
  }
  
  const id = parseInt(idStr, 10);
  
  if (isNaN(id)) {
    throw new Error(`Invalid object ID: ${idStr}`);
  }
  
  if (!name || name.trim() === '') {
    throw new Error(`Missing object name in declaration: ${line}`);
  }
  
  return {
    type: CALObjectType[type],
    id,
    name: name.trim(),
  };
}

/**
 * Parses a C/AL OBJECT-PROPERTIES section
 * Extracts Date, Time, and Version List properties
 * 
 * @param propertiesSection - The OBJECT-PROPERTIES section as a string
 * @returns Parsed object properties with date, time, and versionList
 * 
 * @example
 * parseObjectProperties(`
 *   OBJECT-PROPERTIES
 *   {
 *     Date=15.09.15;
 *     Time=12:00:00;
 *     Version List=NAVW19.00;
 *   }
 * `)
 * // Returns: { date: "15.09.15", time: "12:00:00", versionList: "NAVW19.00" }
 */
export function parseObjectProperties(propertiesSection: string): CALObjectProperties {
  const result: CALObjectProperties = {
    date: undefined,
    time: undefined,
    versionList: undefined,
  };
  
  // Extract Date property: Date=15.09.15;
  const dateMatch = propertiesSection.match(/Date=([^;]+);/);
  if (dateMatch) {
    result.date = dateMatch[1].trim();
  }
  
  // Extract Time property: Time=12:00:00; or Time=[ 0:00:00];
  // Handle optional brackets and spaces
  const timeMatch = propertiesSection.match(/Time=\[?\s*([^\];]+)\s*\]?;/);
  if (timeMatch) {
    result.time = timeMatch[1].trim();
  }
  
  // Extract Version List property: Version List=NAVW19.00,CUSTOM1.00;
  const versionMatch = propertiesSection.match(/Version List=([^;]+);/);
  if (versionMatch) {
    result.versionList = versionMatch[1].trim();
  }
  
  return result;
}
