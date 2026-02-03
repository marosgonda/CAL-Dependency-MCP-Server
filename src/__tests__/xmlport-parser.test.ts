/**
 * Tests for C/AL XMLport parser
 * Following TDD approach: Write tests FIRST (RED phase), then implement (GREEN phase)
 */

import { describe, it, expect } from 'bun:test';
import { parseXMLportElements } from '../parser/xmlport-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseXMLportElements', () => {
  const fixturesPath = join(process.cwd(), 'fixtures');
  
  it('should parse basic ELEMENTS section with nodes', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    expect(result).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it('should extract root element with nodeType', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    const rootNode = result.nodes[0];
    expect(rootNode).toBeDefined();
    expect(rootNode.name).toBe('Root');
    expect(rootNode.nodeType).toBe('Element');
    expect(rootNode.indentation).toBe(0);
  });

  it('should parse element with SourceTable property', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    const rootNode = result.nodes[0];
    const sourceTableProp = rootNode.properties.find(p => p.name === 'SourceTable');
    expect(sourceTableProp).toBeDefined();
    expect(sourceTableProp?.value).toBe('"Payment Terms"');
  });

  it('should extract nested field elements', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    // Should have nested field elements
    const fieldNodes = result.nodes.filter(node => node.nodeType === 'Field');
    expect(fieldNodes.length).toBeGreaterThanOrEqual(3);
    
    const codeNode = fieldNodes.find(node => node.name === 'Code');
    expect(codeNode).toBeDefined();
    expect(codeNode?.indentation).toBeGreaterThan(0);
  });

  it('should parse SourceField property for Field elements', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    const fieldNode = result.nodes.find(node => node.name === 'Code' && node.nodeType === 'Field');
    expect(fieldNode).toBeDefined();
    
    const sourceFieldProp = fieldNode?.properties.find(p => p.name === 'SourceField');
    expect(sourceFieldProp).toBeDefined();
    expect(sourceFieldProp?.value).toContain('Code');
  });

  it('should handle nested elements with indentation hierarchy', () => {
    const nestedElements = `
      ELEMENTS
      {
        { ELEMENT;Root;Element ;
                    SourceTable="Customer";
                    { ELEMENT;CustomerGroup;Element ;
                              SourceTable="Customer Group";
                              { ELEMENT;Code;Field ;
                                        SourceField="Customer Group".Code }
                    }
        }
      }
    `;
    
    const result = parseXMLportElements(nestedElements);
    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
    
    const rootNode = result.nodes.find(n => n.name === 'Root');
    expect(rootNode?.indentation).toBe(0);
    
    const groupNode = result.nodes.find(n => n.name === 'CustomerGroup');
    expect(groupNode?.indentation).toBeGreaterThan(0);
    
    const codeNode = result.nodes.find(n => n.name === 'Code');
    expect(codeNode?.indentation).toBeGreaterThan(groupNode?.indentation || 0);
  });

  it('should handle empty ELEMENTS section', () => {
    const emptyElements = `
      ELEMENTS
      {
      }
    `;
    
    const result = parseXMLportElements(emptyElements);
    expect(result.nodes).toBeDefined();
    expect(result.nodes.length).toBe(0);
  });

  it('should throw error for missing ELEMENTS section', () => {
    const invalidContent = `
      PROPERTIES
      {
        CaptionML=[ENU=Sample XMLport];
      }
    `;
    
    expect(() => parseXMLportElements(invalidContent)).toThrow();
  });

  it('should parse XmlName property', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    const rootNode = result.nodes[0];
    const xmlNameProp = rootNode.properties.find(p => p.name === 'XmlName');
    expect(xmlNameProp).toBeDefined();
    expect(xmlNameProp?.value).toBe("'PaymentTerms'");
  });

  it('should handle Text nodeType elements', () => {
    const textElements = `
      ELEMENTS
      {
        { ELEMENT;Root;Element ;
                    { ELEMENT;Data;Text ;
                              TextType=Text }
        }
      }
    `;
    
    const result = parseXMLportElements(textElements);
    const textNode = result.nodes.find(n => n.name === 'Data');
    expect(textNode).toBeDefined();
    expect(textNode?.nodeType).toBe('Text');
  });

  it('should parse MinOccurs and MaxOccurs properties', () => {
    const xmlportContent = readFileSync(join(fixturesPath, 'xmlport.txt'), 'utf-8');
    const result = parseXMLportElements(xmlportContent);
    
    const rootNode = result.nodes[0];
    const minOccursProp = rootNode.properties.find(p => p.name === 'MinOccurs');
    const maxOccursProp = rootNode.properties.find(p => p.name === 'MaxOccurs');
    
    expect(minOccursProp).toBeDefined();
    expect(maxOccursProp).toBeDefined();
  });
});
