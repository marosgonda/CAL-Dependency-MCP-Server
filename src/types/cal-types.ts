/**
 * TypeScript interface definitions for C/AL object types
 * Represents the structure of Dynamics NAV/Business Central AL objects
 */

/**
 * Enum for all C/AL object types
 */
export enum CALObjectType {
  Table = 'Table',
  Page = 'Page',
  Form = 'Form',
  Codeunit = 'Codeunit',
  Report = 'Report',
  XMLport = 'XMLport',
  Query = 'Query',
  MenuSuite = 'MenuSuite',
}

/**
 * Generic property interface for name-value pairs
 */
export interface CALProperty {
  name: string;
  value: string | number | boolean | string[];
}

/**
 * Base interface for all C/AL objects
 */
export interface CALObject {
  id: number;
  name: string;
  type: CALObjectType;
  properties: CALProperty[];
  objectProperties?: {
    date?: string;
    time?: string;
    versionList?: string;
  };
}

/**
 * Field reference interface for tracking dependencies between objects
 */
export interface CALFieldReference {
  objectId: number;
  objectName: string;
  objectType: CALObjectType;
  fieldId?: number;
  fieldName?: string;
  referenceType: 'TableRelation' | 'CalcFormula' | 'FieldClass' | 'Usage';
}

/**
 * C/AL Field interface
 */
export interface CALField {
  id: number;
  name: string;
  dataType: string;
  length?: number;
  properties: CALProperty[];
  tableRelation?: CALFieldReference;
  calcFormula?: string;
  fieldClass?: 'Normal' | 'FlowField' | 'FlowFilter';
  onValidate?: string;
  onLookup?: string;
  captionML?: Record<string, string>;
  description?: string;
}

/**
 * Key interface for table keys
 */
export interface CALKey {
  fields: string[];
  clustered?: boolean;
  unique?: boolean;
  enabled?: boolean;
}

/**
 * Field group interface for table field groups
 */
export interface CALFieldGroup {
  id: number;
  name: string;
  fields: string[];
}

/**
 * Variable interface for local variables and parameters
 */
export interface CALVariable {
  name: string;
  type: string;
  subtype?: string;
  length?: number;
  temporary?: boolean;
  dotNetAssembly?: string;
  dotNetType?: string;
  dimensions?: number;
  properties?: CALProperty[];
}

/**
 * Parameter interface for procedure parameters
 */
export interface CALParameter extends CALVariable {
  byRef?: boolean;
}

/**
 * Procedure interface for methods/functions
 */
export interface CALProcedure {
  id: number;
  name: string;
  parameters: CALParameter[];
  returnType?: string;
  localVariables: CALVariable[];
  body: string;
  isLocal?: boolean;
  isEvent?: boolean;
  eventPublisher?: boolean;
  eventSubscriber?: boolean;
  properties?: CALProperty[];
}

/**
 * C/AL Table interface
 */
export interface CALTable extends CALObject {
  type: CALObjectType.Table;
  fields: CALField[];
  keys: CALKey[];
  fieldGroups: CALFieldGroup[];
  procedures: CALProcedure[];
  permissions?: string;
  dataClassification?: string;
  captionML?: Record<string, string>;
  lookupPageId?: number;
  drillDownPageId?: number;
}

/**
 * Control interface for page controls
 */
export interface CALControl {
  id: number;
  name: string;
  type: string;
  indentation: number;
  sourceExpr?: string;
  properties: CALProperty[];
  controls?: CALControl[];
  captionML?: Record<string, string>;
  visible?: boolean;
  enabled?: boolean;
  editable?: boolean;
}

/**
 * Action interface for page actions
 */
export interface CALAction {
  id: number;
  name: string;
  type: string;
  properties: CALProperty[];
  captionML?: Record<string, string>;
  image?: string;
  promoted?: boolean;
  promotedCategory?: string;
  runObject?: {
    objectType: CALObjectType;
    objectId: number;
  };
}

/**
 * C/AL Page interface
 */
export interface CALPage extends CALObject {
  type: CALObjectType.Page;
  sourceTable?: number;
  sourceTableView?: string;
  controls: CALControl[];
  actions: CALAction[];
  procedures: CALProcedure[];
  properties: CALProperty[];
  captionML?: Record<string, string>;
  pageType?: string;
  layout?: string;
}

/**
 * C/AL Codeunit interface
 */
export interface CALCodeunit extends CALObject {
  type: CALObjectType.Codeunit;
  procedures: CALProcedure[];
  variables: CALVariable[];
  properties: CALProperty[];
  subtype?: string;
  eventPublisher?: boolean;
}

/**
 * Column interface for report columns
 */
export interface CALColumn {
  id: number;
  name: string;
  sourceExpr?: string;
  dataType?: string;
  properties: CALProperty[];
  captionML?: Record<string, string>;
}

/**
 * Data item interface for report data items
 */
export interface CALDataItem {
  id: number;
  name: string;
  sourceTable: number;
  sourceTableView?: string;
  indentation: number;
  columns: CALColumn[];
  properties: CALProperty[];
}

/**
 * C/AL Report interface
 */
export interface CALReport extends CALObject {
  type: CALObjectType.Report;
  dataItems: CALDataItem[];
  columns: CALColumn[];
  procedures: CALProcedure[];
  variables: CALVariable[];
  properties: CALProperty[];
  captionML?: Record<string, string>;
  processingOnly?: boolean;
  useRequestPage?: boolean;
}

/**
 * Port field interface for XMLport fields
 */
export interface CALPortField {
  id: number;
  name: string;
  sourceExpr?: string;
  dataType?: string;
  properties: CALProperty[];
}

/**
 * Port node interface for XMLport structure
 */
export interface CALPortNode {
  id: number;
  name: string;
  nodeType: 'Element' | 'Attribute' | 'Text';
  sourceTable?: number;
  indentation: number;
  fields: CALPortField[];
  properties: CALProperty[];
}

/**
 * C/AL XMLport interface
 */
export interface CALXMLport extends CALObject {
  type: CALObjectType.XMLport;
  direction: 'Import' | 'Export' | 'Both';
  format: 'Xml' | 'VariableText' | 'FixedText' | 'Json';
  nodes: CALPortNode[];
  procedures: CALProcedure[];
  variables: CALVariable[];
  properties: CALProperty[];
  captionML?: Record<string, string>;
}

/**
 * Query column interface
 */
export interface CALQueryColumn {
  id: number;
  name: string;
  method?: 'Sum' | 'Count' | 'Min' | 'Max' | 'Average';
  sourceTable?: number;
  sourceField?: string;
  properties: CALProperty[];
}

/**
 * Query data item interface
 */
export interface CALQueryDataItem {
  id: number;
  name: string;
  sourceTable: number;
  sourceTableView?: string;
  indentation: number;
  columns: CALQueryColumn[];
  properties: CALProperty[];
}

/**
 * C/AL Query interface
 */
export interface CALQuery extends CALObject {
  type: CALObjectType.Query;
  dataItems: CALQueryDataItem[];
  columns: CALQueryColumn[];
  properties: CALProperty[];
  captionML?: Record<string, string>;
  orderBy?: string;
}

/**
 * Menu item interface for MenuSuite
 */
export interface CALMenuItem {
  id: number;
  name: string;
  captionML?: Record<string, string>;
  runObject?: {
    objectType: CALObjectType;
    objectId: number;
  };
  properties: CALProperty[];
}

/**
 * C/AL MenuSuite interface
 */
export interface CALMenuSuite extends CALObject {
  type: CALObjectType.MenuSuite;
  menuItems: CALMenuItem[];
  properties: CALProperty[];
}

/**
 * Union type for all C/AL objects
 */
export type CALObjectUnion =
  | CALTable
  | CALPage
  | CALCodeunit
  | CALReport
  | CALXMLport
  | CALQuery
  | CALMenuSuite;

/**
 * Parsed AL file interface
 */
export interface CALFile {
  filePath: string;
  objects: CALObjectUnion[];
  parseErrors?: string[];
}
