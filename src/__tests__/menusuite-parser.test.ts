/**
 * Tests for C/AL MenuSuite parser
 * Following TDD approach: Write tests FIRST (RED phase), then implement (GREEN phase)
 */

import { describe, it, expect } from 'bun:test';
import { parseMenuItems } from '../parser/menusuite-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parseMenuItems', () => {
  const fixturesPath = join(process.cwd(), 'fixtures');
  
  it('should parse basic MENUITEMS section', () => {
    const menusuiteContent = readFileSync(join(fixturesPath, 'menusuite.txt'), 'utf-8');
    const result = parseMenuItems(menusuiteContent);
    
    expect(result).toBeDefined();
    expect(result.menuItems).toBeDefined();
    expect(result.menuItems.length).toBeGreaterThan(0);
  });

  it('should extract menuitem with Text and RunObject properties', () => {
    const menusuiteContent = readFileSync(join(fixturesPath, 'menusuite.txt'), 'utf-8');
    const result = parseMenuItems(menusuiteContent);
    
    const paymentTermsItem = result.menuItems.find(item => 
      item.properties.some(p => p.name === 'Text' && p.value === 'Payment Terms')
    );
    expect(paymentTermsItem).toBeDefined();
    
    const runObjectProp = paymentTermsItem?.properties.find(p => p.name === 'RunObject');
    expect(runObjectProp).toBeDefined();
    expect(runObjectProp?.value).toContain('Page 4');
  });

  it('should parse menuitem Action property', () => {
    const menusuiteContent = readFileSync(join(fixturesPath, 'menusuite.txt'), 'utf-8');
    const result = parseMenuItems(menusuiteContent);
    
    const item = result.menuItems[0];
    const actionProp = item.properties.find(p => p.name === 'Action');
    expect(actionProp).toBeDefined();
  });

  it('should handle SEPARATOR items', () => {
    const menuWithSeparator = `
      MENUITEMS
      {
        MENUITEM(Text=Item 1;
                 Action=Page 1;
                 RunObject=Page 1)
        SEPARATOR
        MENUITEM(Text=Item 2;
                 Action=Page 2;
                 RunObject=Page 2)
      }
    `;
    
    const result = parseMenuItems(menuWithSeparator);
    expect(result.menuItems.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle nested menu items (folders)', () => {
    const menusuiteContent = readFileSync(join(fixturesPath, 'menusuite.txt'), 'utf-8');
    const result = parseMenuItems(menusuiteContent);
    
    // Should have a folder item
    const folderItem = result.menuItems.find(item =>
      item.properties.some(p => p.name === 'IsFolder' && p.value === 'Yes')
    );
    expect(folderItem).toBeDefined();
  });

  it('should parse nested menu items inside folders', () => {
    const nestedMenu = `
      MENUITEMS
      {
        MENUITEM(Text=Setup;
                 IsFolder=Yes)
        {
          MENUITEM(Text=General Setup;
                   Action=Page 10;
                   RunObject=Page 10)
          MENUITEM(Text=Company Information;
                   Action=Page 1;
                   RunObject=Page 1)
        }
      }
    `;
    
    const result = parseMenuItems(nestedMenu);
    expect(result.menuItems.length).toBeGreaterThanOrEqual(3);
    
    const folderItem = result.menuItems.find(item =>
      item.properties.some(p => p.name === 'Text' && p.value === 'Setup')
    );
    expect(folderItem).toBeDefined();
  });

  it('should handle empty MENUITEMS section', () => {
    const emptyMenuItems = `
      MENUITEMS
      {
      }
    `;
    
    const result = parseMenuItems(emptyMenuItems);
    expect(result.menuItems).toBeDefined();
    expect(result.menuItems.length).toBe(0);
  });

  it('should throw error for missing MENUITEMS section', () => {
    const invalidContent = `
      PROPERTIES
      {
        CaptionML=[ENU=Sample Menu];
      }
    `;
    
    expect(() => parseMenuItems(invalidContent)).toThrow();
  });

  it('should parse multiple menuitems with different properties', () => {
    const menusuiteContent = readFileSync(join(fixturesPath, 'menusuite.txt'), 'utf-8');
    const result = parseMenuItems(menusuiteContent);
    
    expect(result.menuItems.length).toBeGreaterThanOrEqual(3);
    
    // Each item should have properties
    result.menuItems.forEach(item => {
      expect(item.properties).toBeDefined();
      expect(item.properties.length).toBeGreaterThan(0);
    });
  });

  it('should handle RunObjectType and RunObjectID extraction', () => {
    const menuWithRunObject = `
      MENUITEMS
      {
        MENUITEM(Text=Payment Terms;
                 Action=Page 4;
                 RunObject=Page 4)
      }
    `;
    
    const result = parseMenuItems(menuWithRunObject);
    const item = result.menuItems[0];
    
    // Should extract RunObject property
    const runObjectProp = item.properties.find(p => p.name === 'RunObject');
    expect(runObjectProp).toBeDefined();
    expect(runObjectProp?.value).toBe('Page 4');
  });

  it('should parse menuitem with multiple properties on separate lines', () => {
    const multilineMenuItem = `
      MENUITEMS
      {
        MENUITEM(Text=Payment Terms;
                 Action=Page 4;
                 RunObject=Page 4;
                 Image=PaymentTerms;
                 Visible=Yes)
      }
    `;
    
    const result = parseMenuItems(multilineMenuItem);
    const item = result.menuItems[0];
    
    expect(item.properties.length).toBeGreaterThanOrEqual(3);
    expect(item.properties.some(p => p.name === 'Text')).toBe(true);
    expect(item.properties.some(p => p.name === 'Action')).toBe(true);
    expect(item.properties.some(p => p.name === 'RunObject')).toBe(true);
  });
});
