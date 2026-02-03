/**
 * Parser for C/AL Page and Form objects
 * Handles parsing of page controls with hierarchical structure based on numeric indentation
 */

import { CALPage, CALControl, CALAction, CALObjectType, CALProperty } from '../types/cal-types';
import { parseObjectDeclaration, parseObjectProperties } from './object-parser';

/**
 * Parses a C/AL Page or Form object from source text
 * 
 * @param content - The complete page/form object source text
 * @returns Parsed CALPage object with controls hierarchy
 * @throws Error if content is invalid or CONTROLS section is missing
 * 
 * @example
 * const page = parsePage(pageSourceText);
 * console.log(page.controls); // Hierarchical control tree
 */
export function parsePage(content: string): CALPage {
  const lines = content.split('\n');
  
  // Parse object declaration (first line)
  const firstLine = lines[0].trim();
  const header = parseObjectDeclaration(firstLine);
  
  // Validate object type
  if (header.type !== CALObjectType.Page && header.type !== CALObjectType.Form) {
    throw new Error(`Expected Page or Form object, got ${header.type}`);
  }
  
  // Extract sections
  const objectPropertiesSection = extractSection(content, 'OBJECT-PROPERTIES');
  const propertiesSection = extractSectionExact(content, 'PROPERTIES');
  const controlsSection = extractSection(content, 'CONTROLS');
  const actionsSection = extractSection(content, 'ACTIONS');
  
  if (!controlsSection) {
    throw new Error('CONTROLS section not found');
  }
  
  // Parse object properties
  const objectProps = objectPropertiesSection 
    ? parseObjectProperties(objectPropertiesSection)
    : {};
  
  // Parse page-level properties
  const pageProps = parsePageProperties(propertiesSection || '');
  
  // Parse controls and build hierarchy
  const controls = parseControls(controlsSection);
  
  // Parse actions (flat list, no hierarchy)
  const actions = actionsSection ? parseActions(actionsSection) : [];
  
  // Build CALPage object
  const page: CALPage = {
    type: header.type as CALObjectType.Page,
    id: header.id,
    name: header.name,
    sourceTable: pageProps.sourceTable,
    sourceTableView: pageProps.sourceTableView,
    controls,
    actions,
    procedures: [], // Not parsed yet (future task)
    properties: pageProps.properties,
    captionML: pageProps.captionML,
    pageType: pageProps.pageType,
    layout: pageProps.layout,
    objectProperties: {
      date: objectProps.date,
      time: objectProps.time,
      versionList: objectProps.versionList,
    },
  };
  
  return page;
}

/**
 * Extracts a named section from C/AL content
 * Handles nested braces and returns content between outer braces
 */
function extractSection(content: string, sectionName: string): string | null {
  // Use word boundary to avoid matching OBJECT-PROPERTIES when looking for PROPERTIES
  const regex = new RegExp(`\\b${sectionName}\\s*\\{`, 'i');
  const match = content.match(regex);
  
  if (!match) {
    return null;
  }
  
  const startIndex = match.index! + match[0].length;
  let braceCount = 1;
  let endIndex = startIndex;
  
  while (endIndex < content.length && braceCount > 0) {
    if (content[endIndex] === '{') {
      braceCount++;
    } else if (content[endIndex] === '}') {
      braceCount--;
    }
    endIndex++;
  }
  
  return content.substring(startIndex, endIndex - 1);
}

/**
 * Extracts PROPERTIES section specifically (not OBJECT-PROPERTIES)
 * Uses newline/whitespace prefix to ensure exact match
 */
function extractSectionExact(content: string, sectionName: string): string | null {
  // Look for PROPERTIES at start of line (with optional leading whitespace)
  const regex = new RegExp(`^\\s*${sectionName}\\s*\\{`, 'im');
  const match = content.match(regex);
  
  if (!match) {
    return null;
  }
  
  const startIndex = match.index! + match[0].length;
  let braceCount = 1;
  let endIndex = startIndex;
  
  while (endIndex < content.length && braceCount > 0) {
    if (content[endIndex] === '{') {
      braceCount++;
    } else if (content[endIndex] === '}') {
      braceCount--;
    }
    endIndex++;
  }
  
  return content.substring(startIndex, endIndex - 1);
}

/**
 * Parses page-level PROPERTIES section
 */
function parsePageProperties(propertiesSection: string): {
  sourceTable?: number;
  sourceTableView?: string;
  properties: CALProperty[];
  captionML?: Record<string, string>;
  pageType?: string;
  layout?: string;
} {
  const properties: CALProperty[] = [];
  let sourceTable: number | undefined;
  let sourceTableView: string | undefined;
  let captionML: Record<string, string> | undefined;
  let pageType: string | undefined;
  let layout: string | undefined;
  
  // Parse SourceTable property
  const sourceTableMatch = propertiesSection.match(/SourceTable\s*=\s*(?:Table)?(\d+)\s*;/i);
  if (sourceTableMatch) {
    sourceTable = parseInt(sourceTableMatch[1], 10);
    properties.push({ name: 'SourceTable', value: sourceTable });
  }
  
  // Parse SourceTableView property
  const sourceTableViewMatch = propertiesSection.match(/SourceTableView\s*=\s*([^;]+)\s*;/i);
  if (sourceTableViewMatch) {
    sourceTableView = sourceTableViewMatch[1].trim();
    properties.push({ name: 'SourceTableView', value: sourceTableView });
  }
  
  // Parse PageType property
  const pageTypeMatch = propertiesSection.match(/PageType\s*=\s*([^;\s]+)\s*;/i);
  if (pageTypeMatch) {
    pageType = pageTypeMatch[1].trim();
    properties.push({ name: 'PageType', value: pageType });
  }
  
  // Parse CaptionML property
  const captionMLMatch = propertiesSection.match(/CaptionML\s*=\s*\[([^\]]+)\]\s*;/i);
  if (captionMLMatch) {
    captionML = parseCaptionML(captionMLMatch[1]);
    properties.push({ name: 'CaptionML', value: captionMLMatch[1] });
  }
  
  // Parse other properties (InsertAllowed, DeleteAllowed, etc.)
  // Use a more careful regex that handles properties with brackets
  const lines = propertiesSection.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    const propMatch = trimmedLine.match(/^(\w+)\s*=\s*(.+?)\s*;?\s*$/);
    if (propMatch) {
      const [, name, value] = propMatch;
      if (!['SourceTable', 'SourceTableView', 'PageType', 'CaptionML'].includes(name)) {
        properties.push({ name: name.trim(), value: value.trim().replace(/;$/, '') });
      }
    }
  }
  
  return {
    sourceTable,
    sourceTableView,
    properties,
    captionML,
    pageType,
    layout,
  };
}

/**
 * Parses CaptionML format: [ENU=English;SKY=Slovak]
 */
function parseCaptionML(captionMLStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairs = captionMLStr.split(';');
  
  for (const pair of pairs) {
    const [lang, caption] = pair.split('=');
    if (lang && caption) {
      result[lang.trim()] = caption.trim();
    }
  }
  
  return result;
}

/**
 * Parses CONTROLS section and builds hierarchical control tree
 */
function parseControls(controlsSection: string): CALControl[] {
  const flatControls = parseControlsFlat(controlsSection);
  return buildControlHierarchy(flatControls);
}

/**
 * Parses controls into flat list (no hierarchy yet)
 * Format: { ID ; Indentation ; Type ; Properties }
 */
function parseControlsFlat(controlsSection: string): CALControl[] {
  const controls: CALControl[] = [];
  const lines = controlsSection.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Match control declaration: { ID ; Indentation ; Type ; Properties }
    const controlMatch = line.match(/^\{\s*(\d+)\s*;\s*(\d+)\s*;\s*(\w+)\s*;?\s*(.*)?$/);
    
    if (controlMatch) {
      const [, idStr, indentationStr, type, propertiesStart] = controlMatch;
      const id = parseInt(idStr, 10);
      const indentation = parseInt(indentationStr, 10);
      
      // Collect continuation lines (properties on following lines)
      let propertiesStr = propertiesStart || '';
      i++;
      
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        
        // Check if this is a continuation line (starts with property name or ends with })
        if (nextLine && !nextLine.startsWith('{') && !nextLine.startsWith('CODE') && !nextLine.startsWith('ACTIONS')) {
          propertiesStr += ' ' + nextLine;
          i++;
          
          // If line ends with }, we're done with this control
          if (nextLine.endsWith('}')) {
            break;
          }
        } else {
          break;
        }
      }
      
      // Remove trailing }
      propertiesStr = propertiesStr.replace(/\}$/, '').trim();
      
      // Parse control properties
      const { name, sourceExpr, properties, captionML, visible, editable, enabled } = 
        parseControlProperties(propertiesStr);
      
      const control: CALControl = {
        id,
        name: name || '',
        type,
        indentation,
        sourceExpr,
        properties,
        captionML,
        visible,
        editable,
        enabled,
      };
      
      controls.push(control);
    } else {
      i++;
    }
  }
  
  return controls;
}

/**
 * Parses control properties from property string
 */
function parseControlProperties(propertiesStr: string): {
  name?: string;
  sourceExpr?: string;
  properties: CALProperty[];
  captionML?: Record<string, string>;
  visible?: boolean;
  editable?: boolean;
  enabled?: boolean;
} {
  const properties: CALProperty[] = [];
  let name: string | undefined;
  let sourceExpr: string | undefined;
  let captionML: Record<string, string> | undefined;
  let visible: boolean | undefined;
  let editable: boolean | undefined;
  let enabled: boolean | undefined;
  
  if (!propertiesStr) {
    return { properties };
  }
  
  // Parse SourceExpr (can be quoted or unquoted)
  const sourceExprMatch = propertiesStr.match(/SourceExpr=(?:"([^"]+)"|(\w+(?:\s+\w+)*))/);
  if (sourceExprMatch) {
    sourceExpr = sourceExprMatch[1] || sourceExprMatch[2];
    sourceExpr = sourceExpr?.trim();
  }
  
  // Parse Name property
  const nameMatch = propertiesStr.match(/Name=([^;]+)/);
  if (nameMatch) {
    name = nameMatch[1].trim();
    properties.push({ name: 'Name', value: name });
  }
  
  // Parse CaptionML
  const captionMLMatch = propertiesStr.match(/CaptionML=(?:\[([^\]]+)\]|([^;]+))/);
  if (captionMLMatch) {
    const captionStr = captionMLMatch[1] || captionMLMatch[2];
    captionML = parseCaptionML(captionStr);
  }
  
  // Parse boolean properties
  const visibleMatch = propertiesStr.match(/Visible=(Yes|No)/i);
  if (visibleMatch) {
    visible = visibleMatch[1].toLowerCase() === 'yes';
    properties.push({ name: 'Visible', value: visible });
  }
  
  const editableMatch = propertiesStr.match(/Editable=(Yes|No)/i);
  if (editableMatch) {
    editable = editableMatch[1].toLowerCase() === 'yes';
    properties.push({ name: 'Editable', value: editable });
  }
  
  const enabledMatch = propertiesStr.match(/Enabled=(Yes|No)/i);
  if (enabledMatch) {
    enabled = enabledMatch[1].toLowerCase() === 'yes';
    properties.push({ name: 'Enabled', value: enabled });
  }
  
  // Parse other properties
  const propertyRegex = /(\w+)=([^;]+)/g;
  let match;
  const excludedProps = ['SourceExpr', 'Name', 'CaptionML', 'Visible', 'Editable', 'Enabled'];
  
  while ((match = propertyRegex.exec(propertiesStr)) !== null) {
    const [, propName, propValue] = match;
    if (!excludedProps.includes(propName)) {
      properties.push({ name: propName.trim(), value: propValue.trim() });
    }
  }
  
  return { name, sourceExpr, properties, captionML, visible, editable, enabled };
}

/**
 * Builds hierarchical control tree from flat list using indentation levels
 * 
 * Algorithm:
 * - Maintain a stack of parent controls at each indentation level
 * - When indentation increases: current becomes child of previous
 * - When indentation decreases: pop stack to find correct parent
 * - When indentation same: sibling of previous
 */
function buildControlHierarchy(flatControls: CALControl[]): CALControl[] {
  if (flatControls.length === 0) {
    return [];
  }
  
  const rootControls: CALControl[] = [];
  const stack: CALControl[] = []; // Stack of parent controls at each indentation level
  
  for (const control of flatControls) {
    const indentation = control.indentation;
    
    // Remove controls from stack that are at same or higher indentation
    while (stack.length > 0 && stack[stack.length - 1].indentation >= indentation) {
      stack.pop();
    }
    
    if (indentation === 0) {
      // Root level control
      rootControls.push(control);
      stack.push(control);
    } else {
      // Child control - add to parent's controls array
      const parent = stack[stack.length - 1];
      
      if (!parent) {
        throw new Error(`Invalid control hierarchy: control ${control.id} at indentation ${indentation} has no parent`);
      }
      
      if (!parent.controls) {
        parent.controls = [];
      }
      
      parent.controls.push(control);
      stack.push(control);
    }
  }
  
  return rootControls;
}

/**
 * Parses ACTIONS section (flat list, no hierarchy for now)
 */
function parseActions(actionsSection: string): CALAction[] {
  const actions: CALAction[] = [];
  const lines = actionsSection.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Match action declaration: { ID ; Indentation ; Type ; Properties }
    const actionMatch = line.match(/^\{\s*(\d+)\s*;\s*(\d+)\s*;\s*(\w+)\s*;?\s*(.*)?$/);
    
    if (actionMatch) {
      const [, idStr, , type, propertiesStart] = actionMatch;
      const id = parseInt(idStr, 10);
      
      // Collect continuation lines
      let propertiesStr = propertiesStart || '';
      i++;
      
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        
        if (nextLine && !nextLine.startsWith('{') && !nextLine.startsWith('CODE')) {
          propertiesStr += ' ' + nextLine;
          i++;
          
          if (nextLine.endsWith('}')) {
            break;
          }
        } else {
          break;
        }
      }
      
      // Remove trailing }
      propertiesStr = propertiesStr.replace(/\}$/, '').trim();
      
      // Parse action properties
      const { name, properties, captionML, image, promoted, promotedCategory } = 
        parseActionProperties(propertiesStr);
      
      const action: CALAction = {
        id,
        name: name || '',
        type,
        properties,
        captionML,
        image,
        promoted,
        promotedCategory,
      };
      
      actions.push(action);
    } else {
      i++;
    }
  }
  
  return actions;
}

/**
 * Parses action properties
 */
function parseActionProperties(propertiesStr: string): {
  name?: string;
  properties: CALProperty[];
  captionML?: Record<string, string>;
  image?: string;
  promoted?: boolean;
  promotedCategory?: string;
} {
  const properties: CALProperty[] = [];
  let name: string | undefined;
  let captionML: Record<string, string> | undefined;
  let image: string | undefined;
  let promoted: boolean | undefined;
  let promotedCategory: string | undefined;
  
  if (!propertiesStr) {
    return { properties };
  }
  
  // Parse Name property
  const nameMatch = propertiesStr.match(/Name=([^;]+)/);
  if (nameMatch) {
    name = nameMatch[1].trim();
    properties.push({ name: 'Name', value: name });
  }
  
  // Parse CaptionML
  const captionMLMatch = propertiesStr.match(/CaptionML=(?:\[([^\]]+)\]|([^;]+))/);
  if (captionMLMatch) {
    const captionStr = captionMLMatch[1] || captionMLMatch[2];
    captionML = parseCaptionML(captionStr);
  }
  
  // Parse Image
  const imageMatch = propertiesStr.match(/Image=([^;]+)/);
  if (imageMatch) {
    image = imageMatch[1].trim();
    properties.push({ name: 'Image', value: image });
  }
  
  // Parse Promoted
  const promotedMatch = propertiesStr.match(/Promoted=(Yes|No)/i);
  if (promotedMatch) {
    promoted = promotedMatch[1].toLowerCase() === 'yes';
    properties.push({ name: 'Promoted', value: promoted });
  }
  
  // Parse PromotedCategory
  const promotedCategoryMatch = propertiesStr.match(/PromotedCategory=([^;]+)/);
  if (promotedCategoryMatch) {
    promotedCategory = promotedCategoryMatch[1].trim();
    properties.push({ name: 'PromotedCategory', value: promotedCategory });
  }
  
  // Parse other properties
  const propertyRegex = /(\w+)=([^;]+)/g;
  let match;
  const excludedProps = ['Name', 'CaptionML', 'Image', 'Promoted', 'PromotedCategory'];
  
  while ((match = propertyRegex.exec(propertiesStr)) !== null) {
    const [, propName, propValue] = match;
    if (!excludedProps.includes(propName)) {
      properties.push({ name: propName.trim(), value: propValue.trim() });
    }
  }
  
  return { name, properties, captionML, image, promoted, promotedCategory };
}
