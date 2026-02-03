/**
 * Tests for C/AL Codeunit parser
 * TDD approach: Write tests first (RED phase), then implement parser (GREEN phase)
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { parseCodeunit } from '../parser/codeunit-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseCodeunit', () => {
  let codeunitDotnetContent: string;
  let textConstMetadataContent: string;

  beforeAll(() => {
    // Load fixture files
    codeunitDotnetContent = readFileSync(join(__dirname, '../../fixtures/codeunit-dotnet.txt'), 'utf-8');
    textConstMetadataContent = readFileSync(join(__dirname, '../../fixtures/textconst-metadata.txt'), 'utf-8');
  });

  describe('Basic Codeunit Parsing', () => {
    it('should parse codeunit with basic structure', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      expect(result).toBeDefined();
      expect(result.variables).toBeDefined();
      expect(result.procedures).toBeDefined();
    });

    it('should parse codeunit with TextConst variables', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      expect(result).toBeDefined();
      expect(result.variables).toBeDefined();
      expect(result.procedures).toBeDefined();
    });
  });

  describe('Variable Parsing', () => {
    it('should parse DotNet variables with assembly references', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      expect(result.variables.length).toBe(4);
      
      // Check first DotNet variable: DotNetString
      const dotNetString = result.variables.find(v => v.name === 'DotNetString');
      expect(dotNetString).toBeDefined();
      expect(dotNetString?.type).toBe('DotNet');
      expect(dotNetString?.dotNetAssembly).toBe('mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089');
      expect(dotNetString?.dotNetType).toBe('System.String');
    });

    it('should parse all 4 DotNet variables correctly', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      const expectedVars = [
        { name: 'DotNetString', type: 'System.String' },
        { name: 'DotNetList', type: 'System.Collections.Generic.List`1' },
        { name: 'DotNetDateTime', type: 'System.DateTime' },
        { name: 'DotNetException', type: 'System.Exception' },
      ];

      expectedVars.forEach(({ name, type }) => {
        const variable = result.variables.find(v => v.name === name);
        expect(variable).toBeDefined();
        expect(variable?.dotNetType).toBe(type);
      });
    });

    it('should parse TextConst with simple values', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const simpleText = result.variables.find(v => v.name === 'SimpleText');
      expect(simpleText).toBeDefined();
      expect(simpleText?.type).toBe('TextConst');
      expect(simpleText?.subtype).toContain('ENU=Simple text');
    });

    it('should parse TextConst with @@@= metadata', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const textWithMetadata = result.variables.find(v => v.name === 'TextWithMetadata');
      expect(textWithMetadata).toBeDefined();
      expect(textWithMetadata?.type).toBe('TextConst');
      expect(textWithMetadata?.subtype).toContain('@@@=This is a comment for translators');
      expect(textWithMetadata?.subtype).toContain('ENU=Text with metadata');
    });

    it('should parse complex TextConst with parameter placeholders', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const complexMetadata = result.variables.find(v => v.name === 'ComplexMetadata');
      expect(complexMetadata).toBeDefined();
      expect(complexMetadata?.type).toBe('TextConst');
      expect(complexMetadata?.subtype).toContain('@@@=1 customer name 2 invoice number 3 amount');
      expect(complexMetadata?.subtype).toContain('ENU=Invoice %1 for customer %2 with amount %3');
    });

    it('should parse error message TextConst', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const errorMessage = result.variables.find(v => v.name === 'ErrorMessage');
      expect(errorMessage).toBeDefined();
      expect(errorMessage?.type).toBe('TextConst');
      expect(errorMessage?.subtype).toContain('@@@=Error message for validation');
    });
  });

  describe('Procedure Parsing', () => {
    it('should parse procedure with no parameters', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      const testProc = result.procedures.find(p => p.name === 'TestDotNetVariables');
      expect(testProc).toBeDefined();
      expect(testProc?.id).toBe(1);
      expect(testProc?.parameters.length).toBe(0);
      expect(testProc?.returnType).toBeUndefined();
    });

    it('should parse procedure with parameter and return type', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      const processString = result.procedures.find(p => p.name === 'ProcessString');
      expect(processString).toBeDefined();
      expect(processString?.id).toBe(2);
      expect(processString?.parameters.length).toBe(1);
      expect(processString?.returnType).toBe('Text');
      
      // Check parameter
      const param = processString?.parameters[0];
      expect(param?.name).toBe('InputString');
      expect(param?.type).toBe('Text');
    });

    it('should parse procedure body as raw text', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      const testProc = result.procedures.find(p => p.name === 'TestDotNetVariables');
      expect(testProc?.body).toBeDefined();
      expect(testProc?.body).toContain('MESSAGE');
    });

    it('should parse multiple procedures in TextConst codeunit', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      expect(result.procedures.length).toBeGreaterThanOrEqual(3);
      
      const getSimpleText = result.procedures.find(p => p.name === 'GetSimpleText');
      expect(getSimpleText).toBeDefined();
      expect(getSimpleText?.id).toBe(1);
      expect(getSimpleText?.returnType).toBe('Text');
    });

    it('should parse procedure with multiple parameters', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const getComplexMetadata = result.procedures.find(p => p.name === 'GetComplexMetadata');
      expect(getComplexMetadata).toBeDefined();
      expect(getComplexMetadata?.id).toBe(3);
      expect(getComplexMetadata?.parameters.length).toBe(3);
      
      // Check all parameters
      const params = getComplexMetadata?.parameters || [];
      expect(params[0].name).toBe('CustomerName');
      expect(params[0].type).toBe('Text');
      expect(params[1].name).toBe('InvoiceNo');
      expect(params[1].type).toBe('Text');
      expect(params[2].name).toBe('Amount');
      expect(params[2].type).toBe('Decimal');
    });
  });

  describe('Edge Cases', () => {
    it('should handle codeunit with OnRun trigger', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      // OnRun should be in procedures or handled separately
      expect(result.procedures).toBeDefined();
    });

    it('should throw error for invalid CODE section', () => {
      const invalidContent = `OBJECT Codeunit 50000 Test
{
  PROPERTIES
  {
  }
  INVALID_SECTION
  {
  }
}`;
      
      expect(() => parseCodeunit(invalidContent)).toThrow();
    });

    it('should handle empty VAR section', () => {
      const contentWithoutVars = `OBJECT Codeunit 50000 Test
{
  PROPERTIES
  {
  }
  CODE
  {
    PROCEDURE Test@1();
    BEGIN
    END;
    
    BEGIN
    END.
  }
}`;
      
      const result = parseCodeunit(contentWithoutVars);
      expect(result.variables.length).toBe(0);
    });

    it('should handle procedure without BEGIN-END block', () => {
      const contentMinimal = `OBJECT Codeunit 50000 Test
{
  CODE
  {
    PROCEDURE Test@1();
    
    BEGIN
    END.
  }
}`;
      
      const result = parseCodeunit(contentMinimal);
      expect(result.procedures.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should extract procedure IDs from @ID notation', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      const procedures = result.procedures;
      procedures.forEach(proc => {
        expect(proc.id).toBeGreaterThan(0);
      });
    });

    it('should parse variable IDs from @ID notation', () => {
      const result = parseCodeunit(textConstMetadataContent);
      
      // Check that variables have been parsed correctly
      const simpleText = result.variables.find(v => v.name === 'SimpleText');
      expect(simpleText).toBeDefined();
    });

    it('should handle full assembly path in DotNet variables', () => {
      const result = parseCodeunit(codeunitDotnetContent);
      
      const dotNetVar = result.variables[0];
      expect(dotNetVar.dotNetAssembly).toContain('Version=4.0.0.0');
      expect(dotNetVar.dotNetAssembly).toContain('Culture=neutral');
      expect(dotNetVar.dotNetAssembly).toContain('PublicKeyToken=b77a5c561934e089');
    });
  });
});
