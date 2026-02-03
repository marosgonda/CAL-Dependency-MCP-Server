/**
 * Unit tests for C/AL Page Parser
 * Tests parsing of page objects with control hierarchies
 */

import { describe, test, expect } from 'bun:test';
import { parsePage } from '../parser/page-parser';
import { CALObjectType } from '../types/cal-types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('parsePage', () => {
  test('should parse simple page declaration', () => {
    const content = `OBJECT Page 100 Test Page
{
  OBJECT-PROPERTIES
  {
    Date=01.01.20;
    Time=12:00:00;
  }
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
  }
}`;

    const page = parsePage(content);
    expect(page.type).toBe(CALObjectType.Page);
    expect(page.id).toBe(100);
    expect(page.name).toBe('Test Page');
  });

  test('should parse page properties (CaptionML, PageType, SourceTable)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    CaptionML=[ENU=Test Page;SKY=Testovacia stranka];
    PageType=Card;
    SourceTable=Table3;
  }
  CONTROLS
  {
  }
}`;

    const page = parsePage(content);
    expect(page.pageType).toBe('Card');
    expect(page.sourceTable).toBe(3);
    expect(page.captionML).toEqual({ ENU: 'Test Page', SKY: 'Testovacia stranka' });
  });

  test('should parse single control', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container ;
                ContainerType=ContentArea }
  }
}`;

    const page = parsePage(content);
    expect(page.controls).toHaveLength(1);
    expect(page.controls[0].id).toBe(1);
    expect(page.controls[0].indentation).toBe(0);
    expect(page.controls[0].type).toBe('Container');
  });

  test('should parse control properties (Name, SourceExpr, etc.)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Group     ;
                Name=MainGroup;
                GroupType=Group;
                CaptionML=ENU=General }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.name).toBe('MainGroup');
    expect(control.properties).toContainEqual({ name: 'GroupType', value: 'Group' });
    expect(control.captionML).toEqual({ ENU: 'General' });
  });

  test('should parse quoted SourceExpr', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Field     ;
                SourceExpr="Column No." }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.sourceExpr).toBe('Column No.');
  });

  test('should parse unquoted SourceExpr', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Field     ;
                SourceExpr=Code }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.sourceExpr).toBe('Code');
  });

  test('should parse control hierarchy (2 levels)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container ;
                ContainerType=ContentArea }
    { 2   ;1   ;Group     ;
                Name=MainGroup }
  }
}`;

    const page = parsePage(content);
    expect(page.controls).toHaveLength(1); // Only root level
    expect(page.controls[0].id).toBe(1);
    expect(page.controls[0].controls).toHaveLength(1); // One child
    expect(page.controls[0].controls![0].id).toBe(2);
    expect(page.controls[0].controls![0].indentation).toBe(1);
  });

  test('should parse control hierarchy (4+ levels)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
    { 2   ;1   ;Group }
    { 3   ;2   ;Field }
    { 4   ;3   ;Group }
    { 5   ;4   ;Field }
  }
}`;

    const page = parsePage(content);
    
    // Root level should have 1 control (Container at indentation 0)
    expect(page.controls).toHaveLength(1);
    
    // Level 0: Container (id=1)
    const level0 = page.controls[0];
    expect(level0.id).toBe(1);
    expect(level0.indentation).toBe(0);
    expect(level0.controls).toHaveLength(1);
    
    // Level 1: Group (id=2)
    const level1 = level0.controls![0];
    expect(level1.id).toBe(2);
    expect(level1.indentation).toBe(1);
    expect(level1.controls).toHaveLength(1);
    
    // Level 2: Field (id=3)
    const level2 = level1.controls![0];
    expect(level2.id).toBe(3);
    expect(level2.indentation).toBe(2);
    expect(level2.controls).toHaveLength(1);
    
    // Level 3: Group (id=4)
    const level3 = level2.controls![0];
    expect(level3.id).toBe(4);
    expect(level3.indentation).toBe(3);
    expect(level3.controls).toHaveLength(1);
    
    // Level 4: Field (id=5)
    const level4 = level3.controls![0];
    expect(level4.id).toBe(5);
    expect(level4.indentation).toBe(4);
  });

  test('should handle siblings at same indentation level', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
    { 2   ;1   ;Group }
    { 3   ;1   ;Group }
    { 4   ;1   ;Field }
  }
}`;

    const page = parsePage(content);
    
    // Root should have 1 control (Container)
    expect(page.controls).toHaveLength(1);
    
    // Container should have 3 children (all at indentation 1)
    const container = page.controls[0];
    expect(container.controls).toHaveLength(3);
    expect(container.controls![0].id).toBe(2);
    expect(container.controls![1].id).toBe(3);
    expect(container.controls![2].id).toBe(4);
  });

  test('should handle indentation jumps down (closing nested groups)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
    { 2   ;1   ;Group }
    { 3   ;2   ;Field }
    { 4   ;3   ;Field }
    { 5   ;1   ;Group }
  }
}`;

    const page = parsePage(content);
    
    // Root should have 1 control
    expect(page.controls).toHaveLength(1);
    
    // Container should have 2 children at level 1 (ids 2 and 5)
    const container = page.controls[0];
    expect(container.controls).toHaveLength(2);
    expect(container.controls![0].id).toBe(2);
    expect(container.controls![1].id).toBe(5);
    
    // First group (id=2) should have nested structure
    const firstGroup = container.controls![0];
    expect(firstGroup.controls).toHaveLength(1);
    expect(firstGroup.controls![0].id).toBe(3); // Field at level 2
  });

  test('should parse Container control type', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container ;
                ContainerType=ContentArea }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.type).toBe('Container');
    expect(control.properties).toContainEqual({ name: 'ContainerType', value: 'ContentArea' });
  });

  test('should parse Group control type', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Group     ;
                Name=MainGroup;
                GroupType=Group }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.type).toBe('Group');
    expect(control.name).toBe('MainGroup');
  });

  test('should parse Field control type', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Field     ;
                SourceExpr=Code }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.type).toBe('Field');
    expect(control.sourceExpr).toBe('Code');
  });

  test('should parse complete page from fixture', () => {
    const fixturePath = join(process.cwd(), 'fixtures', 'page-controls.txt');
    const content = readFileSync(fixturePath, 'utf-8');
    
    const page = parsePage(content);
    
    // Verify object header
    expect(page.type).toBe(CALObjectType.Page);
    expect(page.id).toBe(100);
    expect(page.name).toBe('Nested Controls Example');
    
    // Verify page properties
    expect(page.pageType).toBe('Card');
    expect(page.sourceTable).toBe(3);
    expect(page.captionML).toEqual({ 
      ENU: 'Nested Controls',
      SKY: 'Vnorenk� ovl�dacie prvky'
    });
    
    // Verify control hierarchy (should have 1 root Container)
    expect(page.controls).toHaveLength(1);
    
    // Verify deep nesting (6 levels: 0-5)
    const verifyNesting = (control: any, expectedId: number, expectedIndentation: number) => {
      expect(control.id).toBe(expectedId);
      expect(control.indentation).toBe(expectedIndentation);
    };
    
    // Level 0: Container (id=1)
    verifyNesting(page.controls[0], 1, 0);
    
    // Level 1: MainGroup (id=2)
    expect(page.controls[0].controls).toHaveLength(1);
    verifyNesting(page.controls[0].controls![0], 2, 1);
    
    // Level 2: Should have 2 children (Field id=3 and Group id=4)
    const mainGroup = page.controls[0].controls![0];
    expect(mainGroup.controls).toHaveLength(2);
    expect(mainGroup.controls![0].id).toBe(3); // Field: Code
    expect(mainGroup.controls![1].id).toBe(4); // Group: NestedGroup1
    
    // Verify deepest nesting by checking max indentation level
    const getMaxDepth = (controls: any[]): number => {
      let maxDepth = 0;
      for (const control of controls) {
        maxDepth = Math.max(maxDepth, control.indentation);
        if (control.controls && control.controls.length > 0) {
          maxDepth = Math.max(maxDepth, getMaxDepth(control.controls));
        }
      }
      return maxDepth;
    };
    
    const maxDepth = getMaxDepth(page.controls);
    expect(maxDepth).toBeGreaterThanOrEqual(5); // Fixture has indentation up to level 6
  });

  test('should handle Form object (legacy Page variant)', () => {
    const content = `OBJECT Form 100 Test Form
{
  PROPERTIES
  {
    CaptionML=ENU=Test Form;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
  }
}`;

    const page = parsePage(content);
    expect(page.type).toBe(CALObjectType.Form);
    expect(page.id).toBe(100);
    expect(page.name).toBe('Test Form');
  });

  test('should handle edge case - deep nesting (6 levels from fixture)', () => {
    const content = `OBJECT Page 100 Deep Nest
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
    { 2   ;1   ;Group }
    { 3   ;2   ;Field }
    { 4   ;3   ;Group }
    { 5   ;4   ;Field }
    { 6   ;5   ;Group }
    { 7   ;6   ;Field }
  }
}`;

    const page = parsePage(content);
    
    // Navigate through 6 levels
    let currentLevel = page.controls[0];
    let depth = 0;
    
    while (currentLevel.controls && currentLevel.controls.length > 0) {
      depth++;
      currentLevel = currentLevel.controls[0];
    }
    
    expect(depth).toBe(6);
    expect(currentLevel.id).toBe(7); // Last field at level 6
    expect(currentLevel.indentation).toBe(6);
  });

  test('should parse ACTIONS section', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
  }
  ACTIONS
  {
    { 1   ;0   ;ActionContainer;
                ActionContainerType=ActionItems }
    { 2   ;1   ;Action    ;
                Name=PostAction;
                CaptionML=ENU=Post;
                Image=Post }
  }
}`;

    const page = parsePage(content);
    expect(page.actions).toHaveLength(2);
    expect(page.actions[0].id).toBe(1);
    expect(page.actions[0].type).toBe('ActionContainer');
    expect(page.actions[1].id).toBe(2);
    expect(page.actions[1].type).toBe('Action');
    expect(page.actions[1].name).toBe('PostAction');
    expect(page.actions[1].captionML).toEqual({ ENU: 'Post' });
    expect(page.actions[1].image).toBe('Post');
  });

  test('should handle page without ACTIONS section', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
  }
}`;

    const page = parsePage(content);
    expect(page.actions).toEqual([]);
  });

  test('should parse boolean properties (Visible, Editable, Enabled)', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Field     ;
                SourceExpr=Code;
                Visible=No;
                Editable=Yes;
                Enabled=Yes }
  }
}`;

    const page = parsePage(content);
    const control = page.controls[0];
    expect(control.visible).toBe(false);
    expect(control.editable).toBe(true);
    expect(control.enabled).toBe(true);
  });

  test('should throw error for missing CONTROLS section', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
}`;

    expect(() => parsePage(content)).toThrow('CONTROLS section not found');
  });

  test('should parse multiple root-level containers', () => {
    const content = `OBJECT Page 100 Test Page
{
  PROPERTIES
  {
    PageType=Card;
  }
  CONTROLS
  {
    { 1   ;0   ;Container }
    { 2   ;0   ;Container }
  }
}`;

    const page = parsePage(content);
    expect(page.controls).toHaveLength(2);
    expect(page.controls[0].id).toBe(1);
    expect(page.controls[1].id).toBe(2);
  });
});
