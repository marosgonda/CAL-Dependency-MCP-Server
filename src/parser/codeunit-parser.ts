/**
 * Parser for C/AL Codeunit CODE sections
 * Handles parsing of procedures, variables, and triggers
 */

import { CALVariable, CALProcedure, CALParameter } from '../types/cal-types';

/**
 * Parsed C/AL codeunit result
 */
export interface ParsedCodeunit {
  variables: CALVariable[];
  procedures: CALProcedure[];
}

/**
 * Parses a C/AL codeunit CODE section
 * Extracts global variables, procedures with parameters, and procedure bodies
 * 
 * @param content - The full codeunit content
 * @returns Parsed codeunit with variables and procedures
 * @throws Error if the CODE section is not found or parsing fails
 * 
 * @example
 * parseCodeunit(codeunitContent)
 * // Returns: { variables: [...], procedures: [...] }
 */
export function parseCodeunit(content: string): ParsedCodeunit {
  // Extract CODE section
  const codeSection = extractCodeSection(content);
  
  if (!codeSection) {
    throw new Error('CODE section not found in codeunit');
  }

  // Parse global variables
  const variables = parseVariables(codeSection);

  // Parse procedures
  const procedures = parseProcedures(codeSection);

  return {
    variables,
    procedures,
  };
}

/**
 * Extracts the CODE section from codeunit content
 */
function extractCodeSection(content: string): string | null {
  const codeMatch = content.match(/CODE\s*\{([\s\S]*)\}/);
  return codeMatch ? codeMatch[1] : null;
}

/**
 * Parses global VAR section from CODE section
 */
function parseVariables(codeSection: string): CALVariable[] {
  const variables: CALVariable[] = [];

  // Match VAR section at the beginning of CODE (before first PROCEDURE)
  const varMatch = codeSection.match(/VAR\s*([\s\S]*?)(?=PROCEDURE|BEGIN\s*END\.)/);
  
  if (!varMatch) {
    return variables;
  }

  const varSection = varMatch[1];
  
  // Parse each variable declaration
  // Format: Name@ID : Type "subtype";
  // Examples:
  // - DotNetString@1000 : DotNet "'mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089'.System.String";
  // - SimpleText@1000 : TextConst 'ENU=Simple text;SKY=Jednoduchý text';
  // - TempBuffer@1002 : TEMPORARY Record 379;
  
  const lines = varSection.split('\n');
  let currentVariable = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      continue;
    }
    
    // Check if this line starts a new variable declaration (has @ID pattern)
    if (trimmedLine.match(/^\w+@\d+/)) {
      // Parse previous variable if exists
      if (currentVariable) {
        const parsedVar = parseVariableLine(currentVariable);
        if (parsedVar) {
          variables.push(parsedVar);
        }
      }
      
      currentVariable = trimmedLine;
    } else {
      // Continue multi-line variable declaration
      currentVariable += ' ' + trimmedLine;
    }
  }
  
  // Parse last variable
  if (currentVariable) {
    const parsedVar = parseVariableLine(currentVariable);
    if (parsedVar) {
      variables.push(parsedVar);
    }
  }

  return variables;
}

/**
 * Parses a single variable declaration line
 */
function parseVariableLine(line: string): CALVariable | null {
  // Remove trailing semicolon and trim
  line = line.replace(/;$/, '').trim();

  // Pattern: Name@ID : [TEMPORARY] Type [Subtype]
  // Match name and ID
  const nameMatch = line.match(/^(\w+)@(\d+)\s*:\s*(.+)$/);
  
  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1];
  const typeSpec = nameMatch[3].trim();

  // Check for TEMPORARY modifier
  const isTemporary = typeSpec.startsWith('TEMPORARY ');
  const typeWithoutTemp = isTemporary ? typeSpec.substring('TEMPORARY '.length) : typeSpec;

  // Parse different variable types
  
  // DotNet type: DotNet "'assembly'.Type"
  if (typeWithoutTemp.startsWith('DotNet ')) {
    return parseDotNetVariable(name, typeWithoutTemp);
  }

  // TextConst type: TextConst 'content'
  if (typeWithoutTemp.startsWith('TextConst ')) {
    return parseTextConstVariable(name, typeWithoutTemp);
  }

  // Record type: Record TableID
  if (typeWithoutTemp.startsWith('Record ')) {
    const recordMatch = typeWithoutTemp.match(/^Record\s+(\d+)/);
    if (recordMatch) {
      return {
        name,
        type: 'Record',
        subtype: recordMatch[1],
        temporary: isTemporary,
      };
    }
  }

  // Simple type (Integer, Text, Code, etc.)
  const simpleTypeMatch = typeWithoutTemp.match(/^(\w+)(?:\[(\d+)\])?/);
  if (simpleTypeMatch) {
    const variable: CALVariable = {
      name,
      type: simpleTypeMatch[1],
    };
    
    if (simpleTypeMatch[2]) {
      variable.length = parseInt(simpleTypeMatch[2], 10);
    }
    
    return variable;
  }

  return null;
}

/**
 * Parses DotNet variable
 * Format: DotNet "'assembly info'.Namespace.Type"
 */
function parseDotNetVariable(name: string, typeSpec: string): CALVariable {
  // Extract DotNet assembly and type
  // Pattern: DotNet "'assembly info'.Type.Path"
  const dotNetMatch = typeSpec.match(/^DotNet\s+"'([^']+)'\.(.+)"$/);
  
  if (dotNetMatch) {
    return {
      name,
      type: 'DotNet',
      dotNetAssembly: dotNetMatch[1],
      dotNetType: dotNetMatch[2],
    };
  }

  // Fallback if pattern doesn't match exactly
  return {
    name,
    type: 'DotNet',
    subtype: typeSpec.replace(/^DotNet\s+/, ''),
  };
}

/**
 * Parses TextConst variable
 * Format: TextConst 'ENU=Text;@@@=Metadata'
 */
function parseTextConstVariable(name: string, typeSpec: string): CALVariable {
  // Extract TextConst value
  // Pattern: TextConst 'content'
  const textConstMatch = typeSpec.match(/^TextConst\s+'(.+)'$/);
  
  if (textConstMatch) {
    return {
      name,
      type: 'TextConst',
      subtype: textConstMatch[1],
    };
  }

  // Fallback
  return {
    name,
    type: 'TextConst',
    subtype: typeSpec.replace(/^TextConst\s+/, ''),
  };
}

/**
 * Parses all PROCEDURE declarations from CODE section
 */
function parseProcedures(codeSection: string): CALProcedure[] {
  const procedures: CALProcedure[] = [];

  // Match all PROCEDURE declarations
  // Pattern: PROCEDURE Name@ID(Params) : ReturnType;
  const procedureRegex = /PROCEDURE\s+(\w+)@(\d+)\((.*?)\)(?:\s*:\s*(\w+))?;/g;
  
  let match;
  const procedureMatches: Array<{
    name: string;
    id: number;
    paramsStr: string;
    returnType?: string;
    startIndex: number;
  }> = [];

  while ((match = procedureRegex.exec(codeSection)) !== null) {
    procedureMatches.push({
      name: match[1],
      id: parseInt(match[2], 10),
      paramsStr: match[3],
      returnType: match[4],
      startIndex: match.index,
    });
  }

  // Parse each procedure
  for (let i = 0; i < procedureMatches.length; i++) {
    const procMatch = procedureMatches[i];
    const nextProcIndex = i < procedureMatches.length - 1 
      ? procedureMatches[i + 1].startIndex 
      : codeSection.length;

    // Extract procedure body (from PROCEDURE to next PROCEDURE or end)
    const procedureContent = codeSection.substring(procMatch.startIndex, nextProcIndex);
    
    // Parse parameters
    const parameters = parseParameters(procMatch.paramsStr);

    // Parse local variables (VAR section within procedure)
    const localVariables = parseLocalVariables(procedureContent);

    // Extract procedure body (everything between BEGIN and END)
    const body = extractProcedureBody(procedureContent);

    procedures.push({
      id: procMatch.id,
      name: procMatch.name,
      parameters,
      returnType: procMatch.returnType,
      localVariables,
      body,
    });
  }

  return procedures;
}

/**
 * Parses procedure parameters
 * Format: Param1@ID1 : Type; VAR Param2@ID2 : Type
 */
function parseParameters(paramsStr: string): CALParameter[] {
  const parameters: CALParameter[] = [];

  if (!paramsStr || !paramsStr.trim()) {
    return parameters;
  }

  // Split by semicolon (parameter separator)
  const paramParts = paramsStr.split(';').map(p => p.trim()).filter(p => p);

  for (const part of paramParts) {
    // Check for VAR modifier (pass by reference)
    const isByRef = part.startsWith('VAR ');
    const paramStr = isByRef ? part.substring(4).trim() : part;

    // Parse: Name@ID : Type
    const paramMatch = paramStr.match(/^(\w+)@(\d+)\s*:\s*(.+)$/);
    
    if (paramMatch) {
      parameters.push({
        name: paramMatch[1],
        type: paramMatch[3].trim(),
        byRef: isByRef,
      });
    }
  }

  return parameters;
}

/**
 * Parses local variables within a procedure
 */
function parseLocalVariables(procedureContent: string): CALVariable[] {
  const variables: CALVariable[] = [];

  // Match VAR section within procedure (after PROCEDURE declaration, before BEGIN)
  const varMatch = procedureContent.match(/PROCEDURE[^;]+;\s*VAR\s*([\s\S]*?)BEGIN/);
  
  if (!varMatch) {
    return variables;
  }

  const varSection = varMatch[1];
  
  // Parse each variable (similar to global variables)
  const lines = varSection.split('\n');
  let currentVariable = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      continue;
    }
    
    if (trimmedLine.match(/^\w+@\d+/)) {
      if (currentVariable) {
        const parsedVar = parseVariableLine(currentVariable);
        if (parsedVar) {
          variables.push(parsedVar);
        }
      }
      
      currentVariable = trimmedLine;
    } else {
      currentVariable += ' ' + trimmedLine;
    }
  }
  
  if (currentVariable) {
    const parsedVar = parseVariableLine(currentVariable);
    if (parsedVar) {
      variables.push(parsedVar);
    }
  }

  return variables;
}

/**
 * Extracts procedure body (raw text between BEGIN and END)
 */
function extractProcedureBody(procedureContent: string): string {
  // Match BEGIN...END block
  const bodyMatch = procedureContent.match(/BEGIN([\s\S]*?)END;/);
  
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }

  return '';
}
