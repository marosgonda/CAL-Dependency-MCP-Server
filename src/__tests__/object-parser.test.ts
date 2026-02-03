import { describe, expect, test } from 'bun:test';
import { parseObjectDeclaration, parseObjectProperties } from '../parser/object-parser';
import { CALObjectType } from '../types/cal-types';

describe('parseObjectDeclaration', () => {
  test('parses Table declaration', () => {
    const result = parseObjectDeclaration('OBJECT Table 3 Payment Terms');
    expect(result).toEqual({
      type: CALObjectType.Table,
      id: 3,
      name: 'Payment Terms',
    });
  });

  test('parses Codeunit declaration', () => {
    const result = parseObjectDeclaration('OBJECT Codeunit 1 ApplicationManagement');
    expect(result).toEqual({
      type: CALObjectType.Codeunit,
      id: 1,
      name: 'ApplicationManagement',
    });
  });

  test('parses Page declaration', () => {
    const result = parseObjectDeclaration('OBJECT Page 21 Customer Card');
    expect(result).toEqual({
      type: CALObjectType.Page,
      id: 21,
      name: 'Customer Card',
    });
  });

  test('parses Form declaration', () => {
    const result = parseObjectDeclaration('OBJECT Form 1 Chart of Accounts');
    expect(result).toEqual({
      type: CALObjectType.Form,
      id: 1,
      name: 'Chart of Accounts',
    });
  });

  test('parses Report declaration', () => {
    const result = parseObjectDeclaration('OBJECT Report 101 Customer - List');
    expect(result).toEqual({
      type: CALObjectType.Report,
      id: 101,
      name: 'Customer - List',
    });
  });

  test('parses XMLport declaration', () => {
    const result = parseObjectDeclaration('OBJECT XMLport 1230 SEPA CT pain.001.001.03');
    expect(result).toEqual({
      type: CALObjectType.XMLport,
      id: 1230,
      name: 'SEPA CT pain.001.001.03',
    });
  });

  test('parses Query declaration', () => {
    const result = parseObjectDeclaration('OBJECT Query 100 Item Sales');
    expect(result).toEqual({
      type: CALObjectType.Query,
      id: 100,
      name: 'Item Sales',
    });
  });

  test('parses MenuSuite declaration', () => {
    const result = parseObjectDeclaration('OBJECT MenuSuite 1 Main Menu');
    expect(result).toEqual({
      type: CALObjectType.MenuSuite,
      id: 1,
      name: 'Main Menu',
    });
  });

  test('handles object names with spaces', () => {
    const result = parseObjectDeclaration('OBJECT Table 18 Customer');
    expect(result.name).toBe('Customer');
  });

  test('handles object names with special characters', () => {
    const result = parseObjectDeclaration('OBJECT Report 101 Customer - Top 10 List');
    expect(result.name).toBe('Customer - Top 10 List');
  });

  test('handles object names with dots', () => {
    const result = parseObjectDeclaration('OBJECT XMLport 1230 SEPA CT pain.001.001.03');
    expect(result.name).toBe('SEPA CT pain.001.001.03');
  });

  test('handles object names with no spaces', () => {
    const result = parseObjectDeclaration('OBJECT Codeunit 1 ApplicationManagement');
    expect(result.name).toBe('ApplicationManagement');
  });

  test('throws error for invalid declaration format', () => {
    expect(() => parseObjectDeclaration('INVALID FORMAT')).toThrow();
  });

  test('throws error for unknown object type', () => {
    expect(() => parseObjectDeclaration('OBJECT Unknown 1 Test')).toThrow();
  });

  test('throws error for missing object ID', () => {
    expect(() => parseObjectDeclaration('OBJECT Table Name')).toThrow();
  });

  test('throws error for missing object name', () => {
    expect(() => parseObjectDeclaration('OBJECT Table 3')).toThrow();
  });
});

describe('parseObjectProperties', () => {
  test('parses OBJECT-PROPERTIES with Date, Time, and Version List', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=15.09.15;
    Time=12:00:00;
    Version List=NAVW19.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result).toEqual({
      date: '15.09.15',
      time: '12:00:00',
      versionList: 'NAVW19.00',
    });
  });

  test('parses OBJECT-PROPERTIES with bracketed time', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=01.04.15;
    Time=[ 0:00:00];
    Version List=NAVW110.0,NAVSK7.00,TLGP1.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result).toEqual({
      date: '01.04.15',
      time: '0:00:00',
      versionList: 'NAVW110.0,NAVSK7.00,TLGP1.00',
    });
  });

  test('parses OBJECT-PROPERTIES with only Date', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=15.09.15;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result).toEqual({
      date: '15.09.15',
      time: undefined,
      versionList: undefined,
    });
  });

  test('parses OBJECT-PROPERTIES with only Version List', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Version List=NAVW19.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result).toEqual({
      date: undefined,
      time: undefined,
      versionList: 'NAVW19.00',
    });
  });

  test('parses empty OBJECT-PROPERTIES section', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result).toEqual({
      date: undefined,
      time: undefined,
      versionList: undefined,
    });
  });

  test('handles multiline Version List', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=15.09.15;
    Time=12:00:00;
    Version List=NAVW19.00,CUSTOM1.00,CUSTOM2.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result.versionList).toBe('NAVW19.00,CUSTOM1.00,CUSTOM2.00');
  });

  test('handles different date formats', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=01.04.15;
    Time=12:00:00;
    Version List=NAVW19.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result.date).toBe('01.04.15');
  });

  test('handles time without seconds', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=15.09.15;
    Time=12:00;
    Version List=NAVW19.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result.time).toBe('12:00');
  });

  test('handles time with brackets and spaces', () => {
    const propertiesSection = `  OBJECT-PROPERTIES
  {
    Date=01.04.15;
    Time=[ 0:00:00];
    Version List=NAVW19.00;
  }`;
    const result = parseObjectProperties(propertiesSection);
    expect(result.time).toBe('0:00:00');
  });
});
