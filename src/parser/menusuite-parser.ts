/**
 * Parser for C/AL MenuSuite MENUITEMS section
 * Handles parsing of MENUITEM declarations and SEPARATOR items
 */

import { CALMenuItem, CALProperty } from '../types/cal-types';

/**
 * Parsed MenuSuite items result
 */
export interface MenuItemsResult {
  menuItems: CALMenuItem[];
}

/**
 * Parses a C/AL MenuSuite MENUITEMS section
 * 
 * @param content - The MenuSuite content containing MENUITEMS section
 * @returns Parsed menuItems
 * @throws Error if MENUITEMS section is not found
 * 
 * @example
 * parseMenuItems(menusuiteContent)
 * // Returns: { menuItems: [...] }
 */
export function parseMenuItems(content: string): MenuItemsResult {
  // Find MENUITEMS section using more robust matching
  const menuItemsStart = content.indexOf('MENUITEMS');
  if (menuItemsStart === -1) {
    throw new Error('MENUITEMS section not found in MenuSuite content');
  }
  
  // Find the matching closing brace for MENUITEMS
  let braceDepth = 0;
  let inMenuItems = false;
  let menuItemsEnd = -1;
  
  for (let i = menuItemsStart; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceDepth++;
      inMenuItems = true;
    } else if (char === '}') {
      braceDepth--;
      if (inMenuItems && braceDepth === 0) {
        menuItemsEnd = i;
        break;
      }
    }
  }
  
  if (menuItemsEnd === -1) {
    throw new Error('Could not find end of MENUITEMS section');
  }
  
  const menuItemsSection = content.substring(menuItemsStart, menuItemsEnd + 1);
  const menuItems: CALMenuItem[] = [];
  
  // Parse menu items using regex
  // Format: MENUITEM(prop=value;prop=value;...)
  const lines = menuItemsSection.split('\n');
  let menuItemIdCounter = 1;
  let collectingProperties = false;
  let propertyBuffer = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and braces
    if (!line || line === '{' || line === '}') {
      continue;
    }
    
    // Handle SEPARATOR
    if (line === 'SEPARATOR') {
      menuItems.push({
        id: menuItemIdCounter++,
        name: 'SEPARATOR',
        properties: [{ name: 'Type', value: 'Separator' }],
      });
      continue;
    }
    
    // Check for MENUITEM start
    if (line.startsWith('MENUITEM(')) {
      collectingProperties = true;
      propertyBuffer = line;
      
      // Check if MENUITEM is complete on one line
      if (line.includes(')')) {
        collectingProperties = false;
        // Parse the complete MENUITEM
        const menuItem = parseMenuItem(propertyBuffer, menuItemIdCounter++);
        if (menuItem) {
          menuItems.push(menuItem);
        }
        propertyBuffer = '';
      }
      continue;
    }
    
    // Continue collecting properties for multi-line MENUITEM
    if (collectingProperties) {
      propertyBuffer += ' ' + line;
      
      if (line.includes(')')) {
        collectingProperties = false;
        // Parse the complete MENUITEM
        const menuItem = parseMenuItem(propertyBuffer, menuItemIdCounter++);
        if (menuItem) {
          menuItems.push(menuItem);
        }
        propertyBuffer = '';
      }
    }
  }
  
  return {
    menuItems,
  };
}

/**
 * Parses a single MENUITEM declaration
 * 
 * @param menuItemText - The MENUITEM text (e.g., "MENUITEM(Text=Value;Action=Page 1)")
 * @param id - The menu item ID
 * @returns Parsed CALMenuItem or null if parsing fails
 */
function parseMenuItem(menuItemText: string, id: number): CALMenuItem | null {
  // Extract properties from MENUITEM(...)
  const propsMatch = menuItemText.match(/MENUITEM\((.*)\)/s);
  if (!propsMatch) {
    return null;
  }
  
  const propsText = propsMatch[1];
  const properties: CALProperty[] = [];
  let name = '';
  
  // Parse properties separated by semicolons
  // Handle properties like: Text=Payment Terms;Action=Page 4;RunObject=Page 4
  const propPairs = propsText.split(';').filter(p => p.trim());
  
  for (const propPair of propPairs) {
    const eqIndex = propPair.indexOf('=');
    if (eqIndex > 0) {
      const propName = propPair.substring(0, eqIndex).trim();
      const propValue = propPair.substring(eqIndex + 1).trim();
      
      properties.push({
        name: propName,
        value: propValue,
      });
      
      // Use Text property as the name
      if (propName === 'Text') {
        name = propValue;
      }
    }
  }
  
  return {
    id,
    name: name || `MenuItem_${id}`,
    properties,
  };
}
