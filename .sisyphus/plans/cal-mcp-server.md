# C/AL Dependency MCP Server

## TL;DR

> **Quick Summary**: Build a TypeScript MCP server that parses C/AL text files from Dynamics NAV (2009-2018) and exposes symbol information to AI assistants via 9 MCP tools, mirroring and extending the AL-Dependency-MCP-Server architecture.
> 
> **Deliverables**:
> - Regex-based C/AL parser supporting all 7 object types
> - 6 core MCP tools (mirroring AL version) + 3 extended tools
> - In-memory symbol database with Map-based indices
> - Streaming support for large files (2000+ objects)
> - Comprehensive test suite (TDD approach)
> 
> **Estimated Effort**: Large (40-60 hours)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Project Setup → Core Parser → Symbol Database → MCP Tools

---

## Context

### Original Request
Create an MCP server for C/AL development similar to https://github.com/StefanMaron/AL-Dependency-MCP-Server, parsing objects from text files instead of compiled .app packages.

### Interview Summary
**Key Discussions**:
- Object Types: ALL 7 C/AL types (Table, Page, Codeunit, Report, XMLport, Query, MenuSuite)
- MCP Tools: Mirror AL version + 3 extended tools (code search, dependency graph, table relations)
- Technology: TypeScript/Node.js with @modelcontextprotocol/sdk
- Parser: Regex-based (not grammar-based) for simplicity
- File Loading: Both single consolidated file AND directory scanning
- Scale: Very large (2000+ objects) requiring streaming
- Testing: TDD with bun test

**Research Findings**:
- AL-MCP-Server architecture is well-documented with clear separation (parser, database, tools)
- C/AL text format is predictable with OBJECT declarations, typed sections (FIELDS, CODE, PROPERTIES)
- Example file shows NAV 2009-2018 syntax patterns

### Metis Review
**Identified Gaps** (addressed):
- Page controls use numeric indentation hierarchy, not curly-brace nesting
- DotNet types have complex assembly references with quoted paths
- TextConst has `@@@=` metadata comment syntax
- CODE sections must end with `END.` (period required)
- Field format has double-semicolons for empty positions
- Need encoding handling (UTF-8 with potential BOM, legacy encodings)
- Need error handling philosophy (fail-fast vs graceful degradation)
- Need response size limits for large objects

---

## Work Objectives

### Core Objective
Build a production-ready MCP server that enables AI assistants to understand, search, and navigate C/AL codebases from Dynamics NAV 2009-2018.

### Concrete Deliverables
1. `src/index.ts` - Main MCP server entry point
2. `src/parser/` - C/AL text parser with streaming support
3. `src/core/symbol-database.ts` - In-memory index with Map-based lookups
4. `src/tools/` - 9 MCP tool implementations
5. `src/types/cal-types.ts` - TypeScript type definitions for all C/AL objects
6. `package.json` - Project configuration with dependencies
7. `src/__tests__/` - Comprehensive test suite

### Definition of Done
- [ ] `bun test` passes with 100% of parser tests green
- [ ] All 9 MCP tools respond correctly to test queries
- [ ] Can parse the example file (all_objects_example.txt) without errors
- [ ] Memory usage stays under 500MB for 2000+ objects
- [ ] Response time < 100ms for search queries

### Must Have
- All 7 C/AL object type parsers
- 6 core MCP tools (matching AL version API)
- 3 extended tools (code search, dependencies, relations)
- Streaming parser for large files
- Both single-file and directory loading
- TDD test coverage for parser
- Token-efficient summary modes

### Must NOT Have (Guardrails)
- NO C/AL to AL conversion features (separate project)
- NO .fob file support (text only)
- NO real-time file watching (manual reload)
- NO database persistence (in-memory only)
- NO GUI or visualization (MCP tools only)
- NO NAV version auto-detection (explicit config)
- NO code execution/evaluation
- NO modification of source files (read-only)
- NO "smart" features beyond spec (AI suggestions, auto-fix)
- Parser limits: max 50 fields, 50 procedures per response

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (new project)
- **User wants tests**: TDD
- **Framework**: bun test

### TDD Structure
Each parser and tool follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test with expected output
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Test Fixtures Required
- `fixtures/table-simple.txt` - Basic table with fields, keys
- `fixtures/table-complex.txt` - Table with triggers, procedures, FlowFields
- `fixtures/page-controls.txt` - Page with 4+ levels of nested controls
- `fixtures/codeunit-dotnet.txt` - Codeunit with DotNet variable declarations
- `fixtures/report-dataitem.txt` - Report with dataitems and columns
- `fixtures/xmlport.txt` - XMLport with schema elements
- `fixtures/query.txt` - Query with dataitems
- `fixtures/menusuite.txt` - MenuSuite structure
- `fixtures/textconst-metadata.txt` - TextConst with `@@@=` metadata
- `fixtures/malformed.txt` - Missing `END.` for error handling test

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Project setup & infrastructure
├── Task 2: Type definitions (cal-types.ts)
└── Task 3: Test fixtures creation

Wave 2 (After Wave 1):
├── Task 4: Object declaration parser
├── Task 5: Table parser (fields, keys, triggers)
├── Task 6: Page parser (controls hierarchy)
├── Task 7: Codeunit parser (procedures, variables)
└── Task 8: Report/XMLport/Query/MenuSuite parsers

Wave 3 (After Wave 2):
├── Task 9: Symbol database with indices
├── Task 10: Reference extractor (TableRelation, etc.)
└── Task 11: Streaming file loader

Wave 4 (After Wave 3):
├── Task 12: Core MCP tools (search, definition, references)
├── Task 13: Extended MCP tools (code search, dependencies, relations)
└── Task 14: Integration & performance testing

Critical Path: Task 1 → Task 4 → Task 5 → Task 9 → Task 12
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4+ | None |
| 2 | 1 | 4-8 | 3 |
| 3 | 1 | 4-8 (tests) | 2 |
| 4 | 2, 3 | 5-8, 9 | None |
| 5 | 4 | 9, 10 | 6, 7, 8 |
| 6 | 4 | 9 | 5, 7, 8 |
| 7 | 4 | 9 | 5, 6, 8 |
| 8 | 4 | 9 | 5, 6, 7 |
| 9 | 5, 6, 7, 8 | 12, 13 | 10, 11 |
| 10 | 5 | 13 | 9, 11 |
| 11 | 4 | 12 | 9, 10 |
| 12 | 9, 11 | 14 | 13 |
| 13 | 9, 10 | 14 | 12 |
| 14 | 12, 13 | None | None |

---

## TODOs

### Wave 1: Foundation

- [x] 1. Project Setup & Infrastructure

  **What to do**:
  - Initialize npm project with `package.json`
  - Install dependencies: `@modelcontextprotocol/sdk`, `stream-json`, `fast-glob`
  - Configure TypeScript with `tsconfig.json`
  - Set up bun test configuration
  - Create directory structure: `src/`, `src/parser/`, `src/core/`, `src/tools/`, `src/types/`, `src/__tests__/`, `fixtures/`
  - Add `.gitignore` for node_modules, dist, etc.
  - Create initial `src/index.ts` with MCP server boilerplate

  **Must NOT do**:
  - Do not implement any parsing logic yet
  - Do not add unnecessary dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward project scaffolding with well-known patterns
  - **Skills**: [`git-master`]
    - `git-master`: For proper git initialization and commit practices

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (first task)
  - **Blocks**: Tasks 2, 3, 4+
  - **Blocked By**: None

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/package.json` - Dependencies and scripts pattern
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/tsconfig.json` - TypeScript config
  - `https://modelcontextprotocol.io/docs/concepts/servers` - MCP server basics

  **Acceptance Criteria**:
  ```bash
  # Verify package.json exists with required deps
  bun pm ls | grep -E "@modelcontextprotocol/sdk|stream-json|fast-glob"
  # Assert: All three packages listed
  
  # Verify TypeScript compiles
  bun run tsc --noEmit
  # Assert: Exit code 0, no errors
  
  # Verify test framework works
  bun test --help
  # Assert: Shows bun test help
  
  # Verify directory structure
  ls src/parser src/core src/tools src/types src/__tests__ fixtures
  # Assert: All directories exist
  ```

  **Commit**: YES
  - Message: `feat(setup): initialize CAL MCP Server project structure`
  - Files: `package.json`, `tsconfig.json`, `.gitignore`, `src/index.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 2. Type Definitions (cal-types.ts)

  **What to do**:
  - Create comprehensive TypeScript interfaces for all C/AL objects
  - `CALObject` base interface with Id, Name, Type, Properties
  - `CALTable` extends with Fields, Keys, FieldGroups, Procedures
  - `CALField` with Id, Name, DataType, Properties (TableRelation, CalcFormula, etc.)
  - `CALPage` with Controls, Actions, SourceTable
  - `CALControl` with Id, Indentation, Type, Properties (hierarchy via indentation)
  - `CALCodeunit` with Procedures, Variables
  - `CALProcedure` with Name, Id, Parameters, ReturnType, LocalVariables, Body
  - `CALVariable` with Name, Type (including DotNet assembly references)
  - `CALReport` with DataItems, Columns
  - `CALXMLport`, `CALQuery`, `CALMenuSuite` interfaces
  - `CALProperty` for name-value pairs
  - `CALFieldReference` for tracking references between objects
  - Enum for `CALObjectType`

  **Must NOT do**:
  - Do not implement parsing logic in this file
  - Do not add runtime validation (types only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no complex logic
  - **Skills**: []
    - No special skills needed for type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 4-8
  - **Blocked By**: Task 1

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/types/al-types.ts` - AL type definitions pattern
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:1-100` - Table structure example
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:455-600` - CODE section with procedures

  **Acceptance Criteria**:
  ```bash
  # Verify types compile without errors
  bun run tsc --noEmit src/types/cal-types.ts
  # Assert: Exit code 0
  
  # Verify key interfaces exist
  grep -E "interface CAL(Object|Table|Field|Page|Codeunit|Report)" src/types/cal-types.ts | wc -l
  # Assert: At least 6 interfaces found
  
  # Verify CALObjectType enum exists
  grep "enum CALObjectType" src/types/cal-types.ts
  # Assert: Found
  ```

  **Commit**: YES
  - Message: `feat(types): add TypeScript interfaces for all C/AL object types`
  - Files: `src/types/cal-types.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 3. Test Fixtures Creation

  **What to do**:
  - Create realistic test fixtures from the example file format
  - Extract representative samples for each object type
  - Include edge cases identified by Metis:
    - Table with FlowFields and CalcFormula
    - Page with 4+ levels of control nesting (numeric indentation)
    - Codeunit with DotNet variable declarations
    - TextConst with `@@@=` metadata comments
    - Variables with complex types (Record, TEMPORARY)
    - Procedures with @ID annotations
    - Malformed file missing final `END.` for error handling
  - Each fixture should be minimal but complete (parseable standalone)

  **Must NOT do**:
  - Do not include the entire example file as a fixture
  - Do not include sensitive/proprietary code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File creation with copy/extract from example
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 4-8 (test execution)
  - **Blocked By**: Task 1

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:1-76` - Table 3 Payment Terms (simple table)
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:78-605` - Table 4 Currency (complex with procedures)
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:456-465` - VAR section with TextConst

  **Acceptance Criteria**:
  ```bash
  # Verify all fixture files exist
  ls fixtures/*.txt | wc -l
  # Assert: At least 8 fixture files
  
  # Verify fixtures contain OBJECT declarations
  grep -l "OBJECT Table\|OBJECT Page\|OBJECT Codeunit" fixtures/*.txt | wc -l
  # Assert: At least 3 different object types
  
  # Verify edge case fixtures exist
  ls fixtures/textconst-metadata.txt fixtures/malformed.txt
  # Assert: Both files exist
  ```

  **Commit**: YES
  - Message: `test(fixtures): add C/AL test fixtures for all object types`
  - Files: `fixtures/*.txt`
  - Pre-commit: None

---

### Wave 2: Parser Implementation

- [x] 4. Object Declaration Parser

  **What to do**:
  - Create `src/parser/object-parser.ts`
  - Parse object declaration line: `OBJECT Table 3 Payment Terms`
  - Extract: ObjectType, ObjectId, ObjectName
  - Handle all 7 object types: Table, Page, Form, Codeunit, Report, XMLport, Query, MenuSuite
  - Parse OBJECT-PROPERTIES section (Date, Time, Version List)
  - Return structured `CALObjectHeader` with metadata
  - Write tests FIRST (TDD):
    - Test parsing Table declaration
    - Test parsing Codeunit declaration
    - Test extracting OBJECT-PROPERTIES
    - Test handling object names with special characters

  **Must NOT do**:
  - Do not parse object body yet (fields, code, etc.)
  - Do not handle file-level concerns (streaming)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core parser logic requiring careful regex design
  - **Skills**: []
    - No special skills, but needs careful attention to regex patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (blocks other parsers)
  - **Blocks**: Tasks 5, 6, 7, 8, 9
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:1-8` - OBJECT declaration and OBJECT-PROPERTIES
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/parser/streaming-parser.ts:58-96` - AL parser structure

  **Acceptance Criteria**:
  ```bash
  # Run parser tests
  bun test src/__tests__/object-parser.test.ts
  # Assert: All tests pass
  
  # Test specific parsing via script
  bun -e "
    import { parseObjectDeclaration } from './src/parser/object-parser';
    const result = parseObjectDeclaration('OBJECT Table 3 Payment Terms');
    console.log(JSON.stringify(result));
  "
  # Assert: Output contains {"type":"Table","id":3,"name":"Payment Terms"}
  ```

  **Commit**: YES
  - Message: `feat(parser): implement C/AL object declaration parser`
  - Files: `src/parser/object-parser.ts`, `src/__tests__/object-parser.test.ts`
  - Pre-commit: `bun test src/__tests__/object-parser.test.ts`

---

- [x] 5. Table Parser (Fields, Keys, Triggers)

  **What to do**:
  - Create `src/parser/table-parser.ts`
  - Parse FIELDS section with format: `{ ID ; Indentation ; Name ; Type ; Properties }`
  - Handle field properties: CaptionML, TableRelation, CalcFormula, FieldClass, OnValidate triggers
  - Parse KEYS section with primary/secondary keys
  - Parse FIELDGROUPS section
  - Parse table-level PROPERTIES (OnInsert, OnModify, OnDelete, OnRename, Permissions)
  - Parse CODE section for table procedures
  - Handle edge cases:
    - Double-semicolon empty indentation: `{ 1 ; ; Code ; Code10 }`
    - FlowField with CalcFormula
    - TableRelation with WHERE clause
    - TextConst with `@@@=` metadata
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not parse procedure bodies in detail (separate task)
  - Do not validate field references (done in symbol database)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex parsing with many edge cases
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Task 4

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:26-61` - FIELDS and KEYS sections
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:123-446` - Complex table with many field types
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:243-256` - FlowField with CalcFormula

  **Acceptance Criteria**:
  ```bash
  # Run table parser tests
  bun test src/__tests__/table-parser.test.ts
  # Assert: All tests pass
  
  # Parse fixture and verify field count
  bun -e "
    import { parseTable } from './src/parser/table-parser';
    import { readFileSync } from 'fs';
    const content = readFileSync('fixtures/table-simple.txt', 'utf-8');
    const table = parseTable(content);
    console.log('Fields:', table.fields?.length);
    console.log('Keys:', table.keys?.length);
  "
  # Assert: Fields count > 0, Keys count > 0
  ```

  **Commit**: YES
  - Message: `feat(parser): implement C/AL table parser with fields, keys, triggers`
  - Files: `src/parser/table-parser.ts`, `src/__tests__/table-parser.test.ts`
  - Pre-commit: `bun test src/__tests__/table-parser.test.ts`

---

- [x] 6. Page Parser (Controls Hierarchy)

  **What to do**:
  - Create `src/parser/page-parser.ts`
  - Parse CONTROLS section with numeric indentation hierarchy
  - Build control tree from flat list using indentation levels
  - Handle control types: Container, Group, Field, Part, Action
  - Parse control properties: SourceExpr, Name, CaptionML, Visible, Editable
  - Parse page-level PROPERTIES: SourceTable, PageType, CardPageID
  - Parse ACTIONS section
  - Handle Form objects (legacy variant of Page)
  - Edge case: 4+ levels of nesting with numeric indentation
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not validate SourceExpr field references yet
  - Do not handle page extensions (C/AL doesn't have them)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex hierarchy parsing from numeric indentation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Task 4

  **References**:
  - Page control format (from Metis research):
    ```
    { 1   ;0   ;Container ;ContainerType=ContentArea }
    { 2   ;1   ;Group     ;Name=Group }
    { 3   ;2   ;Field     ;SourceExpr="Column No." }
    ```

  **Acceptance Criteria**:
  ```bash
  # Run page parser tests
  bun test src/__tests__/page-parser.test.ts
  # Assert: All tests pass
  
  # Verify hierarchy parsing
  bun -e "
    import { parsePage } from './src/parser/page-parser';
    import { readFileSync } from 'fs';
    const content = readFileSync('fixtures/page-controls.txt', 'utf-8');
    const page = parsePage(content);
    console.log('Controls:', page.controls?.length);
    // Check nesting
    const hasNested = page.controls?.some(c => c.children?.length > 0);
    console.log('Has nested:', hasNested);
  "
  # Assert: Controls count > 0, Has nested: true
  ```

  **Commit**: YES
  - Message: `feat(parser): implement C/AL page parser with control hierarchy`
  - Files: `src/parser/page-parser.ts`, `src/__tests__/page-parser.test.ts`
  - Pre-commit: `bun test src/__tests__/page-parser.test.ts`

---

- [x] 7. Codeunit Parser (Procedures, Variables)

  **What to do**:
  - Create `src/parser/codeunit-parser.ts`
  - Parse VAR section with variables and their types
  - Handle complex variable types:
    - Record types: `Customer@1000 : Record 18`
    - TEMPORARY modifier: `TempBuffer@1001 : TEMPORARY Record 379`
    - DotNet with assembly: `DotNet "'mscorlib...'.System.Globalization.CultureInfo"`
    - TextConst with `@@@=` metadata
  - Parse PROCEDURE declarations: `PROCEDURE Name@ID(Params) : ReturnType`
  - Extract procedure signature, local variables, parameters
  - Handle procedure body as raw text (for code search feature)
  - Parse triggers (OnRun)
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not fully parse procedure body AST (regex only)
  - Do not execute or validate code logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex variable type parsing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Task 4

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:62-75` - CODE section structure
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:456-464` - VAR section with TextConst
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:466-481` - Procedure with local vars

  **Acceptance Criteria**:
  ```bash
  # Run codeunit parser tests
  bun test src/__tests__/codeunit-parser.test.ts
  # Assert: All tests pass
  
  # Parse fixture with DotNet
  bun -e "
    import { parseCodeunit } from './src/parser/codeunit-parser';
    import { readFileSync } from 'fs';
    const content = readFileSync('fixtures/codeunit-dotnet.txt', 'utf-8');
    const cu = parseCodeunit(content);
    console.log('Procedures:', cu.procedures?.length);
    console.log('Variables:', cu.variables?.length);
  "
  # Assert: Procedures > 0, Variables > 0
  ```

  **Commit**: YES
  - Message: `feat(parser): implement C/AL codeunit parser with procedures and variables`
  - Files: `src/parser/codeunit-parser.ts`, `src/__tests__/codeunit-parser.test.ts`
  - Pre-commit: `bun test src/__tests__/codeunit-parser.test.ts`

---

- [x] 8. Report/XMLport/Query/MenuSuite Parsers

  **What to do**:
  - Create `src/parser/report-parser.ts`:
    - Parse DATASET with DataItems
    - Parse columns and their SourceExpr
    - Handle nested DataItems (parent-child relationships)
  - Create `src/parser/xmlport-parser.ts`:
    - Parse SCHEMA section with elements
    - Handle TableElement, FieldElement, TextElement
  - Create `src/parser/query-parser.ts`:
    - Parse ELEMENTS with DataItems
    - Parse columns and filters
  - Create `src/parser/menusuite-parser.ts`:
    - Parse menu structure
  - Write tests for each parser

  **Must NOT do**:
  - Do not parse report layout (RDLC)
  - Do not handle binary sections

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple parsers, moderate complexity each
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 4

  **References**:
  - AL-MCP-Server report handling: `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/parser/streaming-parser.ts:300-350`

  **Acceptance Criteria**:
  ```bash
  # Run all minor parser tests
  bun test src/__tests__/report-parser.test.ts
  bun test src/__tests__/xmlport-parser.test.ts
  bun test src/__tests__/query-parser.test.ts
  bun test src/__tests__/menusuite-parser.test.ts
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(parser): implement Report, XMLport, Query, MenuSuite parsers`
  - Files: `src/parser/report-parser.ts`, `src/parser/xmlport-parser.ts`, `src/parser/query-parser.ts`, `src/parser/menusuite-parser.ts`, `src/__tests__/*.test.ts`
  - Pre-commit: `bun test`

---

### Wave 3: Database & Loading

- [x] 9. Symbol Database with Indices

  **What to do**:
  - Create `src/core/symbol-database.ts`
  - Implement in-memory indices using Maps:
    - `objectsByName: Map<string, CALObject[]>` (lowercase name -> objects)
    - `objectsByType: Map<CALObjectType, CALObject[]>`
    - `objectsById: Map<string, CALObject>` (e.g., "Table:18")
    - `fieldsByTable: Map<string, CALField[]>`
    - `proceduresByObject: Map<string, CALProcedure[]>`
  - Implement search methods:
    - `searchObjects(pattern, type?, limit?)` - wildcard search
    - `getObject(type, idOrName)` - exact lookup
    - `getObjectsByType(type)` - all of a type
  - Support summary mode (limit fields/procedures in response)
  - Implement domain classification (Sales, Purchasing, Finance, etc.)
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not persist to disk
  - Do not implement file loading (Task 11)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core data structure, performance critical
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Tasks 5, 6, 7, 8

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/core/symbol-database.ts:17-70` - Index structure

  **Acceptance Criteria**:
  ```bash
  # Run database tests
  bun test src/__tests__/symbol-database.test.ts
  # Assert: All tests pass
  
  # Verify O(1) lookup works
  bun -e "
    import { SymbolDatabase } from './src/core/symbol-database';
    const db = new SymbolDatabase();
    // Add test object and verify lookup
    db.addObject({ type: 'Table', id: 18, name: 'Customer' });
    const result = db.getObject('Table', 18);
    console.log('Found:', result?.name);
  "
  # Assert: Found: Customer
  ```

  **Commit**: YES
  - Message: `feat(core): implement symbol database with Map-based indices`
  - Files: `src/core/symbol-database.ts`, `src/__tests__/symbol-database.test.ts`
  - Pre-commit: `bun test src/__tests__/symbol-database.test.ts`

---

- [x] 10. Reference Extractor

  **What to do**:
  - Create `src/core/reference-extractor.ts`
  - Extract references from parsed objects:
    - TableRelation properties -> table/field references
    - CalcFormula expressions -> table/field references
    - Variable declarations -> Record type references
    - Page SourceTable -> table reference
    - Page SourceExpr -> field references
    - Report DataItem SourceTable -> table reference
  - Build reference indices:
    - `referencesByTarget: Map<string, CALReference[]>` (what references Table 18?)
    - `referencesBySource: Map<string, CALReference[]>` (what does Table 18 reference?)
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not parse code bodies for references (only declarations/properties)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex relationship extraction
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 11)
  - **Blocks**: Task 13
  - **Blocked By**: Task 5

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:139-166` - TableRelation examples
  - `C:\Repos\CAL-Dependency-MCP-Server\all_objects_example.txt:243-256` - CalcFormula example

  **Acceptance Criteria**:
  ```bash
  # Run reference extractor tests
  bun test src/__tests__/reference-extractor.test.ts
  # Assert: All tests pass
  
  # Verify TableRelation extraction
  bun -e "
    import { extractReferences } from './src/core/reference-extractor';
    const refs = extractReferences({
      type: 'Table',
      fields: [{ name: 'Account', properties: { TableRelation: 'G/L Account' }}]
    });
    console.log('References:', refs.length);
  "
  # Assert: References > 0
  ```

  **Commit**: YES
  - Message: `feat(core): implement reference extractor for cross-object relationships`
  - Files: `src/core/reference-extractor.ts`, `src/__tests__/reference-extractor.test.ts`
  - Pre-commit: `bun test src/__tests__/reference-extractor.test.ts`

---

- [x] 11. Streaming File Loader

  **What to do**:
  - Create `src/core/file-loader.ts`
  - Implement two loading modes:
    - Single file: Parse consolidated .txt with multiple objects
    - Directory: Scan directory for .txt files, parse each
  - Use streaming for large files:
    - Read file in chunks
    - Detect OBJECT boundaries
    - Parse each object individually
    - Yield objects to database
  - Handle encoding:
    - UTF-8 with BOM detection
    - Legacy Windows-1252 fallback
  - Report loading progress (object count)
  - Handle malformed files gracefully (log warning, continue)
  - Write tests FIRST (TDD)

  **Must NOT do**:
  - Do not watch for file changes
  - Do not load .fob files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Streaming logic, encoding handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10)
  - **Blocks**: Task 12
  - **Blocked By**: Task 4

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/core/package-manager.ts:131-200` - Loading pattern

  **Acceptance Criteria**:
  ```bash
  # Run file loader tests
  bun test src/__tests__/file-loader.test.ts
  # Assert: All tests pass
  
  # Load example file and count objects
  bun -e "
    import { loadFile } from './src/core/file-loader';
    const objects = await loadFile('all_objects_example.txt');
    console.log('Objects loaded:', objects.length);
  "
  # Assert: Objects loaded > 100
  ```

  **Commit**: YES
  - Message: `feat(core): implement streaming file loader with encoding detection`
  - Files: `src/core/file-loader.ts`, `src/__tests__/file-loader.test.ts`
  - Pre-commit: `bun test src/__tests__/file-loader.test.ts`

---

### Wave 4: MCP Tools & Integration

- [x] 12. Core MCP Tools (search, definition, references, members, summary, files)

  **What to do**:
  - Create `src/tools/mcp-tools.ts`
  - Implement 6 core MCP tools:
    1. `cal_search_objects`: Search by pattern/type/domain, pagination, summary mode
    2. `cal_get_object_definition`: Get full object metadata by ID or name
    3. `cal_find_references`: Find what references an object/field
    4. `cal_search_object_members`: Search procedures/fields within objects
    5. `cal_get_object_summary`: Token-efficient categorized overview
    6. `cal_files`: Load files, list loaded, get stats
  - Implement response formatting:
    - Summary mode limits (max 10 fields, 10 procedures)
    - Full mode with pagination
    - Consistent JSON structure
  - Implement tool schemas for MCP SDK
  - Wire tools into `src/index.ts` MCP server
  - Write integration tests

  **Must NOT do**:
  - Do not implement extended tools (Task 13)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: MCP integration, multiple tool implementations
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 9, 11

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/tools/mcp-tools.ts` - Tool implementations
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/src/index.ts:54-284` - Tool registration

  **Acceptance Criteria**:
  ```bash
  # Run MCP tools tests
  bun test src/__tests__/mcp-tools.test.ts
  # Assert: All tests pass
  
  # Verify tool registration
  bun -e "
    import { CALMCPServer } from './src/index';
    const server = new CALMCPServer();
    const tools = server.listTools();
    console.log('Tools:', tools.map(t => t.name).join(', '));
  "
  # Assert: Contains cal_search_objects, cal_get_object_definition, etc.
  ```

  **Commit**: YES
  - Message: `feat(tools): implement 6 core MCP tools for C/AL symbol access`
  - Files: `src/tools/mcp-tools.ts`, `src/index.ts`, `src/__tests__/mcp-tools.test.ts`
  - Pre-commit: `bun test`

---

- [x] 13. Extended MCP Tools (code search, dependencies, relations)

  **What to do**:
  - Add 3 extended tools to `src/tools/mcp-tools.ts`:
    1. `cal_search_code`: Search within procedure bodies
       - Regex pattern matching in procedure code
       - Return matches with context (procedure name, surrounding lines)
       - Limit results to prevent overwhelming responses
    2. `cal_get_dependencies`: Get dependency graph for an object
       - What tables does this codeunit use?
       - What pages display this table?
       - Return as structured dependency tree
    3. `cal_get_table_relations`: Map TableRelation across all tables
       - Build relation graph from all TableRelation properties
       - Support filtering by table
  - Wire into MCP server
  - Write tests

  **Must NOT do**:
  - Do not implement visualization (text output only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Graph traversal, complex queries
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 12)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 9, 10

  **References**:
  - `C:\Repos\CAL-Dependency-MCP-Server\.sisyphus\drafts\cal-mcp-server.md` - Feature requirements

  **Acceptance Criteria**:
  ```bash
  # Run extended tools tests
  bun test src/__tests__/extended-tools.test.ts
  # Assert: All tests pass
  
  # Verify code search works
  bun -e "
    import { CALMCPServer } from './src/index';
    const server = new CALMCPServer();
    await server.loadFile('all_objects_example.txt');
    const results = await server.callTool('cal_search_code', { pattern: 'TESTFIELD' });
    console.log('Matches:', results.matches?.length || 0);
  "
  # Assert: Matches > 0
  ```

  **Commit**: YES
  - Message: `feat(tools): implement extended MCP tools (code search, dependencies, relations)`
  - Files: `src/tools/mcp-tools.ts`, `src/__tests__/extended-tools.test.ts`
  - Pre-commit: `bun test`

---

- [x] 14. Integration & Performance Testing

  **What to do**:
  - Create `src/__tests__/integration.test.ts`
  - Test full workflow:
    - Load example file
    - Search for objects
    - Get definitions
    - Find references
    - Search code
  - Performance testing:
    - Measure load time for full example file
    - Measure query response times
    - Verify memory usage
  - Create performance benchmarks
  - Document any performance issues found
  - Final cleanup and documentation

  **Must NOT do**:
  - Do not optimize prematurely
  - Do not add features beyond spec

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration testing, performance measurement
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final task
  - **Blocks**: None
  - **Blocked By**: Tasks 12, 13

  **References**:
  - `https://github.com/StefanMaron/AL-Dependency-MCP-Server/blob/main/PERFORMANCE_STRATEGY.md` - Performance targets

  **Acceptance Criteria**:
  ```bash
  # Run all tests
  bun test
  # Assert: All tests pass
  
  # Run integration test with full file
  bun test src/__tests__/integration.test.ts
  # Assert: Passes
  
  # Measure performance
  bun -e "
    import { CALMCPServer } from './src/index';
    const start = Date.now();
    const server = new CALMCPServer();
    await server.loadFile('all_objects_example.txt');
    const loadTime = Date.now() - start;
    console.log('Load time (ms):', loadTime);
    
    const searchStart = Date.now();
    await server.callTool('cal_search_objects', { pattern: 'Customer' });
    const searchTime = Date.now() - searchStart;
    console.log('Search time (ms):', searchTime);
  "
  # Assert: Load time < 10000ms (10s), Search time < 100ms
  ```

  **Commit**: YES
  - Message: `test(integration): add integration tests and performance benchmarks`
  - Files: `src/__tests__/integration.test.ts`
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message | Key Files | Verification |
|------------|---------|-----------|--------------|
| 1 | `feat(setup): initialize CAL MCP Server project structure` | package.json, tsconfig.json | tsc --noEmit |
| 2 | `feat(types): add TypeScript interfaces for all C/AL object types` | src/types/cal-types.ts | tsc --noEmit |
| 3 | `test(fixtures): add C/AL test fixtures for all object types` | fixtures/*.txt | ls fixtures |
| 4 | `feat(parser): implement C/AL object declaration parser` | src/parser/object-parser.ts | bun test |
| 5 | `feat(parser): implement C/AL table parser with fields, keys, triggers` | src/parser/table-parser.ts | bun test |
| 6 | `feat(parser): implement C/AL page parser with control hierarchy` | src/parser/page-parser.ts | bun test |
| 7 | `feat(parser): implement C/AL codeunit parser with procedures and variables` | src/parser/codeunit-parser.ts | bun test |
| 8 | `feat(parser): implement Report, XMLport, Query, MenuSuite parsers` | src/parser/*.ts | bun test |
| 9 | `feat(core): implement symbol database with Map-based indices` | src/core/symbol-database.ts | bun test |
| 10 | `feat(core): implement reference extractor for cross-object relationships` | src/core/reference-extractor.ts | bun test |
| 11 | `feat(core): implement streaming file loader with encoding detection` | src/core/file-loader.ts | bun test |
| 12 | `feat(tools): implement 6 core MCP tools for C/AL symbol access` | src/tools/mcp-tools.ts | bun test |
| 13 | `feat(tools): implement extended MCP tools (code search, dependencies, relations)` | src/tools/mcp-tools.ts | bun test |
| 14 | `test(integration): add integration tests and performance benchmarks` | src/__tests__/integration.test.ts | bun test |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun test
# Expected: 0 failures

# TypeScript compiles
bun run tsc --noEmit
# Expected: Exit code 0

# Can parse example file
bun -e "import { CALMCPServer } from './src/index'; const s = new CALMCPServer(); await s.loadFile('all_objects_example.txt'); console.log('Loaded');"
# Expected: "Loaded" output

# Performance targets met
bun -e "..." (see Task 14)
# Expected: Load < 10s, Search < 100ms
```

### Final Checklist
- [ ] All 14 tasks completed
- [ ] All tests pass (`bun test`)
- [ ] All 7 C/AL object types parseable
- [ ] All 9 MCP tools functional
- [ ] Example file loads without errors
- [ ] Memory < 500MB for 2000+ objects
- [ ] Search response < 100ms
- [ ] README.md with usage instructions
