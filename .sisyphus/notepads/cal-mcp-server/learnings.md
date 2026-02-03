# Learnings - CAL MCP Server

## Conventions & Patterns


## Project Setup (Task 1)

### Successful Patterns
- Used npm instead of bun for dependency installation (Windows permission issues with bun)
- MCP SDK requires Server constructor with 2 arguments: config object + capabilities object
- Request handlers access params via `request.params` not direct destructuring
- TypeScript strict mode enabled for type safety
- All 3 required dependencies installed successfully:
  - @modelcontextprotocol/sdk@0.5.0
  - stream-json@1.9.1
  - fast-glob@3.3.3

### Directory Structure
Created complete structure:
- src/parser/ - For AL code parsing logic
- src/core/ - Core dependency analysis
- src/tools/ - MCP tool implementations
- src/types/ - TypeScript type definitions
- src/__tests__/ - Test files
- fixtures/ - Test fixtures and sample AL files

### Build Configuration
- TypeScript targets ES2020 with ESNext modules
- Strict mode enabled (noImplicitAny, strictNullChecks, etc.)
- Output to dist/ directory
- Source maps enabled for debugging

### Commit Strategy
- Single atomic commit for project initialization
- Message: "feat(setup): initialize CAL MCP Server project structure"
- Includes Sisyphus attribution in commit body

## Type Definitions (Task 2)

### Comprehensive Interface Design
- Created 20+ interfaces covering all C/AL object types
- Base CALObject interface with id, name, type, properties
- Specialized interfaces for each object type: Table, Page, Codeunit, Report, XMLport, Query, MenuSuite
- Support interfaces: CALField, CALProcedure, CALVariable, CALParameter, CALControl, CALAction, etc.

### Key Design Decisions
- CALProperty as generic name-value pair for flexible property storage
- CALControl includes indentation field (numeric) for hierarchy representation
- CALVariable supports DotNet assembly references (dotNetAssembly, dotNetType)
- CALField includes TableRelation, CalcFormula, FieldClass properties
- CALProcedure has id (@ID annotation), Parameters, ReturnType, LocalVariables, Body (string)
- CALObjectType enum includes all 8 types: Table, Page, Form, Codeunit, Report, XMLport, Query, MenuSuite

### Type Safety Features
- Union type CALObjectUnion for type-safe object handling
- CALFieldReference for tracking dependencies between objects
- Proper typing for multilingual captions (captionML as Record<string, string>)
- Optional properties for flexibility (e.g., tableRelation, calcFormula)

### Verification Results
- TypeScript compilation: ✓ No errors
- Interface count: 8 key interfaces found (CALObject, CALTable, CALField, CALPage, CALCodeunit, CALReport, CALXMLport, CALQuery)
- CALObjectType enum: ✓ Present with all 8 types
- Commit: feat(types): add TypeScript interfaces for all C/AL object types

### Patterns for Future Parsers
- All objects extend CALObject base interface
- Properties stored as CALProperty[] for flexibility
- Hierarchical structures use indentation field (controls, data items, port nodes)
- Procedures always include body as string for later parsing
- Variables support complex types (DotNet, arrays, etc.)

## Test Fixtures Creation (Task 3)

### Fixture Files Created (10 total)
1. **table-simple.txt** - Table 3 Payment Terms (basic table with fields, keys, simple procedures)
2. **table-complex.txt** - Table 4 Currency (complex with FlowFields, CalcFormula, multiple procedures)
3. **page-controls.txt** - Page with 4+ levels of nested controls (numeric indentation hierarchy)
4. **codeunit-dotnet.txt** - Codeunit with DotNet variable declarations (4 DotNet types)
5. **report-dataitem.txt** - Report with dataitems and columns
6. **xmlport.txt** - XMLport with schema elements and field mappings
7. **query.txt** - Query with dataitems and columns
8. **menusuite.txt** - MenuSuite with menu items and separators
9. **textconst-metadata.txt** - TextConst with @@@= metadata for translators
10. **malformed.txt** - Intentionally missing END. for error handling tests

### Key Features Included
- **FlowFields & CalcFormula**: table-complex.txt has 2 FlowField examples with Sum/Exist calculations
- **Nested Controls**: page-controls.txt demonstrates 6 levels of indentation (0-5 numeric levels)
- **DotNet Variables**: codeunit-dotnet.txt includes 4 DotNet variable declarations with full assembly references
- **TextConst Metadata**: textconst-metadata.txt includes @@@= comments for translator context
- **TEMPORARY Records**: codeunit-dotnet.txt uses TEMPORARY keyword in variable declaration
- **Procedures with @ID**: All procedures include @ID annotations (e.g., @1, @2, @8)
- **Malformed File**: Missing END. at end of CODE section for parser error handling tests

### Extraction Strategy
- Extracted actual C/AL code from all_objects_example.txt (not synthetic)
- Table 3 Payment Terms: Lines 1-76 (simple baseline)
- Table 4 Currency: Lines 78-605 (complex with triggers, FlowFields, procedures)
- TextConst metadata: Line 462 pattern with @@@= comments
- Each fixture is minimal but complete (parseable standalone)

### Verification Results
- File count: 10 fixtures created ✓
- Object types: 10 different types represented ✓
- Edge cases: textconst-metadata.txt and malformed.txt both exist ✓
- FlowFields: 2 instances in table-complex.txt ✓
- CalcFormula: 2 instances in table-complex.txt ✓
- DotNet variables: 4 instances in codeunit-dotnet.txt ✓
- Nested controls: 6 indentation levels in page-controls.txt ✓
- TextConst @@@=: 3 instances in textconst-metadata.txt ✓
- Malformed: Missing END. confirmed in malformed.txt ✓

### Parser Readiness
- All fixtures are valid C/AL syntax (except intentional malformed.txt)
- Each fixture can be parsed independently
- Covers all major object types and edge cases
- Ready for unit tests in Tasks 4-8

## Object Declaration Parser (Task 4)

### Implementation Strategy
- **TDD Approach**: Wrote 25 tests first (RED phase), then implemented (GREEN phase)
- Created two core functions:
  - `parseObjectDeclaration(line: string): CALObjectHeader` - Parses "OBJECT <Type> <ID> <Name>"
  - `parseObjectProperties(propertiesSection: string): CALObjectProperties` - Parses OBJECT-PROPERTIES section

### Regex Patterns Used

#### Object Declaration Pattern
```regex
/^OBJECT\s+(Table|Page|Form|Codeunit|Report|XMLport|Query|MenuSuite)\s+(\d+)\s+(.+)$/
```
- Captures: type (literal enum values), id (digits), name (everything after ID including spaces)
- Handles object names with spaces, hyphens, dots, and special characters
- Examples:
  - "OBJECT Table 3 Payment Terms" → {type: Table, id: 3, name: "Payment Terms"}
  - "OBJECT XMLport 1230 SEPA CT pain.001.001.03" → {type: XMLport, id: 1230, name: "SEPA CT pain.001.001.03"}

#### OBJECT-PROPERTIES Patterns
```regex
Date=([^;]+);              // Matches: Date=15.09.15;
Time=\[?\s*([^\];]+)\s*\]?;  // Matches: Time=12:00:00; OR Time=[ 0:00:00];
Version List=([^;]+);      // Matches: Version List=NAVW19.00;
```

### Key Design Decisions

1. **Type Safety**: Return CALObjectHeader and CALObjectProperties interfaces
2. **Error Handling**: Throw descriptive errors for invalid formats
3. **Time Format Flexibility**: Handle both `Time=12:00:00;` and `Time=[ 0:00:00];` (with brackets and spaces)
4. **Optional Properties**: date, time, versionList are all optional (undefined if not present)
5. **Trim Whitespace**: Always trim extracted values for consistency

### Edge Cases Handled

1. **Object names with spaces**: "Payment Terms", "Customer Card"
2. **Object names with hyphens**: "Customer - List", "Customer - Top 10 List"
3. **Object names with dots**: "SEPA CT pain.001.001.03"
4. **Time with brackets**: `Time=[ 0:00:00];` → Extract "0:00:00"
5. **Time without seconds**: `Time=12:00;` → Extract "12:00"
6. **Multiple version components**: "NAVW110.0,NAVSK7.00,TLGP1.00" → Keep as single string
7. **Empty OBJECT-PROPERTIES**: Return {date: undefined, time: undefined, versionList: undefined}

### Test Coverage (25 tests)

**parseObjectDeclaration tests (16 tests):**
- All 8 object types: Table, Page, Form, Codeunit, Report, XMLport, Query, MenuSuite
- Object names: with spaces, special characters, dots, no spaces
- Error cases: invalid format, unknown type, missing ID, missing name

**parseObjectProperties tests (9 tests):**
- Full properties: Date, Time, Version List
- Partial properties: only Date, only Version List
- Empty properties section
- Time format variations: with/without brackets, with/without seconds
- Multiline Version List

### Verification Results
- Tests: 25 pass / 0 fail ✓
- TypeScript compilation: No errors ✓
- Acceptance criteria: JSON output correct ✓
  ```json
  {"type":"Table","id":3,"name":"Payment Terms"}
  ```

### Gotchas & Lessons Learned

1. **Time brackets are optional**: Some C/AL exports use `Time=[ 0:00:00];` with brackets and spaces
2. **Object names capture everything**: After ID, everything is the name (no max length in regex)
3. **Version List is comma-separated**: Store as single string, don't parse into array yet
4. **OBJECT-PROPERTIES is optional**: Some objects may not have this section
5. **Enum type validation**: Must validate type string against CALObjectType enum

### Future Considerations
- This parser only handles declaration line and properties section
- Does NOT parse object body (fields, code, controls) - that's for later tasks
- CALObjectHeader can be extended with additional metadata if needed
- Error messages are descriptive enough for debugging parser issues

### Files Created
- `src/parser/object-parser.ts` - Main parser implementation (120 lines)
- `src/__tests__/object-parser.test.ts` - TDD test suite (25 tests)

### Commit
- Message: `feat(parser): implement C/AL object declaration parser`
- Files: src/parser/object-parser.ts, src/__tests__/object-parser.test.ts
- Pre-commit check: All tests pass ✓


## Table Parser (Task 5)

### Implementation Strategy
- **TDD Approach**: Wrote 26 tests first (RED phase), then implemented parser (GREEN phase)
- Created two core files:
  - `src/parser/table-parser.ts` - Main parser implementation (490 lines)
  - `src/__tests__/table-parser.test.ts` - Comprehensive test suite (26 tests)
- Reused existing functions: `parseObjectDeclaration()` and `parseObjectProperties()` from object-parser.ts

### Regex Patterns Developed

#### Field Parsing
```regex
/\{\s*(\d+)\s*;\s*;\s*([^;]+?)\s*;([^;]+?)(?:\s*;([\s\S]*?))?\}/g
```
- Captures: ID, (empty indentation), Name, Type, Properties (optional)
- Pattern: `{ ID ; ; Name ; Type ; Properties }`
- Handles double-semicolon empty indentation correctly
- Properties section can span multiple lines until closing `}`

#### Key Parsing
```regex
/\{\s*;\s*([^;]+?)(?:\s*;([\s\S]*?))?\}/g
```
- Captures: Fields (comma-separated), Properties (optional)
- Pattern: `{ ; Fields ; Properties }`
- Note: Keys have no ID field, just semicolon prefix

#### FieldGroup Parsing
```regex
/\{\s*(\d+)\s*;\s*([^;]+?)\s*;([\s\S]*?)\}/g
```
- Captures: ID, Name, FieldList (comma-separated)
- Pattern: `{ ID ; Name ; FieldList }`

#### Procedure Parsing
```regex
/(?:LOCAL\s+)?PROCEDURE\s+(\w+)@(\d+)\(([\s\S]*?)\);/g
```
- Captures: LOCAL keyword (optional), Name, ID, Parameters
- Pattern: `[LOCAL] PROCEDURE Name@ID(parameters);`

#### Trigger Parsing (OnValidate, OnLookup)
```regex
/OnValidate=(BEGIN[\s\S]*?END;)/
```
- Matches complete BEGIN...END; block (can span multiple lines)
- Initially tried `OnValidate=([\s\S]*?)(?=\n\s+[A-Z]|\n\s*$)` but it failed on multi-line triggers
- Solution: Match explicit BEGIN...END; pattern for triggers

### Key Design Decisions

1. **Section Boundary Detection**: Use `findMatchingBrace()` helper to find closing `}` for each section
2. **Field Properties**: Extract 15+ property types (CaptionML, FieldClass, CalcFormula, TableRelation, OnValidate, etc.)
3. **CaptionML Parsing**: Separate function `parseCaptionML()` extracts language-caption pairs into Record<string, string>
4. **FlowFields**: Detected via `FieldClass=FlowField` property, CalcFormula stored as string for later parsing
5. **Procedure Bodies**: Stored as raw text strings (detailed parsing deferred to later task)
6. **Local Variables**: Parsed from VAR section within procedure bodies
7. **Global VAR Section**: Not yet parsed (appears before PROCEDURE declarations in CODE section)

### Edge Cases Handled

1. **Double-semicolon Empty Indentation**: `{ 1 ; ; Code ; Code10 }` - Middle section is indentation (empty = root level)
2. **FlowField CalcFormula**: `CalcFormula=Sum("Table".Field WHERE (...))` - Spans multiple lines, stored as string
3. **TableRelation**: `TableRelation="G/L Account" WHERE (...)` - Stored as CALFieldReference
4. **Multi-line OnValidate Triggers**: 
   ```cal
   OnValidate=BEGIN
                IF Symbol = '' THEN
                  Symbol := ResolveCurrencySymbol(Code);
              END;
   ```
5. **TextConst with @@@= Metadata**: Located in global VAR section (not yet parsed separately)
6. **UTF-8 Encoding**: Fixtures contain characters like "Kód" stored as "K�d" - tests match actual encoding
7. **Time Brackets**: `Time=[ 0:00:00];` - Handled by object-parser.ts (brackets stripped)
8. **Permissions Property**: `Permissions=TableData 52019938=rd;` - Extracted as string

### Test Coverage (26 tests)

**Basic Table Parsing (11 tests):**
- Object declaration and properties
- 6 fields from table-simple.txt
- Field properties (CaptionML, NotBlank, DecimalPlaces, MinValue/MaxValue)
- KEYS section with clustered key
- FIELDGROUPS section (2 fieldgroups)
- Table-level PROPERTIES (DataCaptionFields, CaptionML, LookupPageID)
- OnDelete trigger
- Procedure with parameters

**Complex Table Parsing (8 tests):**
- Time in brackets format
- FlowFields (2 fields with FieldClass=FlowField)
- CalcFormula for FlowFields (Exist and Sum formulas)
- OnValidate trigger in field
- Permissions property
- OnModify trigger
- LOCAL procedures
- TextConst variables (global VAR section)

**Edge Cases (5 tests):**
- Double-semicolon empty indentation
- Field names with spaces
- Multiline field properties
- AutoFormatType and AutoFormatExpr
- Empty FIELDGROUPS section

**Error Handling (3 tests):**
- Invalid table format
- Missing FIELDS section
- Missing KEYS section

### Verification Results
- Tests: 26 pass / 0 fail ✓
- TypeScript compilation: No errors ✓
- Test coverage: All major features + edge cases ✓

### Gotchas & Lessons Learned

1. **Regex Flag Compatibility**: Initially used `/s` flag (dotAll) but it caused TypeScript errors even with ES2020 target. Removed `/s` flags as they weren't necessary (patterns work without them).
2. **Multi-line Trigger Matching**: Lookahead `(?=\n\s+[A-Z])` failed for multi-line triggers. Solution: Match explicit `BEGIN...END;` pattern.
3. **Global vs Local VAR Sections**: CODE section has global VAR before procedures, and procedures have their own VAR sections. Current implementation only parses procedure-local VARs.
4. **Field Properties Span Multiple Lines**: Properties section can contain BEGIN...END blocks spanning many lines. Use `[\s\S]*?` (non-greedy) until closing `}`.
5. **Key Format Quirk**: Keys don't have IDs like fields/fieldgroups - just empty first position: `{ ; Fields ; Properties }`
6. **CaptionML Inside Field Properties**: Must extract from properties text, not just top-level PROPERTIES section
7. **TableRelation Complexity**: Full parsing requires extracting table name, field name, WHERE conditions - stored as string for now
8. **Procedure Body Extraction**: Finding end of procedure body is tricky (next PROCEDURE or final END.) - current implementation works but could be more robust

### Future Improvements

1. **Global VAR Section Parsing**: Parse global variables (TextConst, Records) before PROCEDURE declarations
2. **CalcFormula Deep Parsing**: Extract table name, field name, method (Sum/Count/Exist), WHERE conditions
3. **TableRelation Deep Parsing**: Extract referenced table ID, field names, WHERE conditions
4. **Procedure Return Types**: C/AL procedures don't have explicit return types in declaration, but could infer from EXIT statements
5. **More Trigger Types**: Currently only OnValidate and OnLookup in fields; could add OnAfterValidate, OnBeforeValidate, etc.
6. **Field Indentation**: Currently ignored (always empty in tables), but parser captures it if needed
7. **Error Recovery**: Currently throws on missing sections; could return partial results with warnings

### Files Created
- `src/parser/table-parser.ts` - Main parser implementation (490 lines)
- `src/__tests__/table-parser.test.ts` - TDD test suite (26 tests, 340 lines)

### Commit Requirements
- Message: `feat(parser): implement C/AL table parser with fields, keys, triggers`
- Files: src/parser/table-parser.ts, src/__tests__/table-parser.test.ts
- Pre-commit: `bun test src/__tests__/table-parser.test.ts` passed (26/26 tests)


## Codeunit Parser (Task 7)

### Implementation Success
- **TDD Approach**: Wrote 20 tests first (RED phase), then implemented parser (GREEN phase)
- **First-Try Success**: All 20 tests passed on first implementation attempt
- **Zero LSP Errors**: TypeScript compilation clean (npx tsc --noEmit)

### Variable Parsing Patterns

#### DotNet Variables
```regex
^DotNet\s+"'([^']+)'\.(.+)"$
```
- Captures: assembly reference (group 1), .NET type path (group 2)
- Example: DotNet "'mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089'.System.String"
- Stores: dotNetAssembly (full assembly info), dotNetType (System.String)

#### TextConst Variables
```regex
^TextConst\s+'(.+)'$
```
- Captures: full TextConst value including all language codes and metadata
- Example: TextConst '@@@=This is a comment for translators;ENU=Text with metadata;SKY=Text s metadátami'
- Stores: entire value in subtype field (includes @@@= translator comments)
- Edge case: @@@= metadata at beginning or middle of value (both supported)

#### TEMPORARY Records
- Pattern: TEMPORARY keyword before Record type
- Example: TempBuffer@1002 : TEMPORARY Record 379;
- Implementation: Check for 'TEMPORARY ' prefix, strip it, then parse Record normally
- Store: temporary: true in CALVariable interface

### Procedure Parsing Strategy

#### Procedure Declaration Regex
```regex
PROCEDURE\s+(\w+)@(\d+)\((.*?)\)(?:\s*:\s*(\w+))?;
```
- Captures: name, id (@ID), parameters string, optional return type
- Examples:
  - PROCEDURE TestDotNetVariables@1(); → No params, no return
  - PROCEDURE ProcessString@2(InputString@1000 : Text) : Text; → 1 param, Text return
  - PROCEDURE GetComplexMetadata@3(CustomerName@1000 : Text;InvoiceNo@1001 : Text;Amount@1002 : Decimal) : Text; → 3 params

#### Parameter Parsing
- Split by semicolon (;) to separate parameters
- Check for VAR prefix (pass by reference / byRef: true)
- Parse each parameter: Name@ID : Type
- Example: VAR Param2@1001 : Integer → {name: 'Param2', type: 'Integer', byRef: true}

#### Procedure Body Extraction
- Pattern: BEGIN([\s\S]*?)END;
- Store as raw text (no AST parsing)
- Trim whitespace for consistency
- Use case: Code search feature (search procedure bodies)

### Multi-Line Variable Parsing

**Key Challenge**: Variable declarations can span multiple lines (especially DotNet and TextConst)

**Solution Strategy**:
1. Process VAR section line by line
2. Detect new variable by @ID pattern: ^\w+@\d+
3. If @ID found, parse previous accumulated variable
4. If no @ID, append line to current variable (continuation)
5. Parse last variable at end of loop

**Why This Works**: @ID pattern is unique to variable declarations (never appears in continuation lines)

### Edge Cases Handled

1. **DotNet with full assembly paths**: Version, Culture, PublicKeyToken all preserved
2. **TextConst with @@@= at beginning**: Pattern handles metadata-first format
3. **TextConst with multiple languages**: Entire string preserved in subtype
4. **TEMPORARY Records**: Modifier correctly stripped and stored as temporary: true
5. **Procedures with no parameters**: Empty parameter string handled (returns empty array)
6. **Procedures with no return type**: returnType field undefined (not null)
7. **Empty VAR sections**: Returns empty array (no crash)
8. **Local variables within procedures**: Separate parsing from global VAR section

### Test Coverage (20 tests)

**Test Groups**:
- Basic Codeunit Parsing (2 tests): Structure validation for both fixtures
- Variable Parsing (6 tests): DotNet (2 tests), TextConst (4 tests)
- Procedure Parsing (4 tests): No params, with params, multiple params, body extraction
- Edge Cases (4 tests): OnRun trigger, invalid CODE, empty VAR, minimal procedure
- Complex Scenarios (4 tests): ID extraction, assembly paths, parameter IDs

**Key Assertions**:
- All 4 DotNet variables parsed correctly with assembly references
- All 4 TextConst variables parsed with @@@= metadata preserved
- Procedure IDs extracted from @ID notation
- Parameters parsed with correct types and byRef flags
- Procedure bodies extracted as raw text (searchable)

### Files Created
- `src/parser/codeunit-parser.ts` - Main parser implementation (380+ lines)
  - parseCodeunit() - Entry point function
  - extractCodeSection() - Extracts CODE{...} block
  - parseVariables() - Parses global VAR section
  - parseProcedures() - Parses all PROCEDURE declarations
  - parseParameters() - Parses procedure parameters
  - parseLocalVariables() - Parses VAR within procedures
  - parseDotNetVariable() - Specialized DotNet parser
  - parseTextConstVariable() - Specialized TextConst parser
- `src/__tests__/codeunit-parser.test.ts` - TDD test suite (20 tests, 69 expect() calls)

### Gotchas & Lessons Learned

1. **Multi-line declarations are common**: DotNet and TextConst almost always span multiple lines
2. **@ID pattern is the delimiter**: Most reliable way to detect new variable/parameter declarations
3. **Don't parse procedure body AST**: Store as raw text for search feature (future enhancement)
4. **TEMPORARY is a modifier, not a type**: Must strip before type parsing
5. **TextConst format varies**: @@@= can be at beginning or interspersed with language codes
6. **DotNet assembly format is complex**: Quoted assembly path with single quotes inside double quotes
7. **VAR keyword appears twice**: Once for global variables, once for local (within procedures)
8. **BEGIN-END nesting**: Must match correctly for procedure body extraction

### Verification Results
- Tests: 20 pass / 0 fail ✓
- Expect calls: 69 assertions ✓
- TypeScript compilation: No errors (npx tsc --noEmit) ✓
- Fixtures tested: codeunit-dotnet.txt (4 DotNet vars, 2 procedures) ✓
- Fixtures tested: textconst-metadata.txt (4 TextConst vars, 3 procedures) ✓



## Page Parser Implementation (Task 6)

### Implementation Strategy
- **TDD Approach**: Wrote 23 tests first (RED phase), then implemented (GREEN phase)
- Created core `parsePage(content: string): CALPage` function
- Modular design with helper functions for each parsing concern

### Core Functions Created

1. **Main Parser**:
   - `parsePage()` - Orchestrates parsing of entire page object
   
2. **Section Extraction**:
   - `extractSection()` - Generic section extractor with brace counting
   - `extractSectionExact()` - Specific extractor for PROPERTIES (avoids OBJECT-PROPERTIES)
   
3. **Property Parsing**:
   - `parsePageProperties()` - Parses page-level properties (SourceTable, PageType, CaptionML)
   - `parseCaptionML()` - Parses multilingual captions format: [ENU=English;SKY=Slovak]
   - `parseControlProperties()` - Parses control properties including boolean conversions
   - `parseActionProperties()` - Parses action properties
   
4. **Control Hierarchy**:
   - `parseControls()` - Orchestrates control parsing
   - `parseControlsFlat()` - Parses controls into flat list
   - `buildControlHierarchy()` - Builds tree from flat list using stack algorithm
   
5. **Actions**:
   - `parseActions()` - Parses ACTIONS section (flat list, no hierarchy)

### Control Format Patterns

**Control Declaration**:
```
{ ID ; Indentation ; Type ; Properties }
{ 1   ;0   ;Container ;ContainerType=ContentArea }
```

**Multi-line Properties** (continuation lines):
```
{ 2   ;1   ;Group     ;
            Name=MainGroup;
            GroupType=Group }
```

**Quoted SourceExpr**:
```
SourceExpr="Due Date Calculation"  // Quoted (with spaces)
SourceExpr=Code                    // Unquoted (no spaces)
```

### Hierarchy Building Algorithm

**Stack-based approach**:
1. Parse all controls into flat list first
2. Maintain stack of parent controls at each indentation level
3. For each control:
   - Pop stack while stack top indentation >= current indentation
   - If indentation = 0: add to root controls
   - Else: add to last stack item's controls array
   - Push current control to stack

**Example**:
```
Control 1 (indent 0)
  Control 2 (indent 1)
    Control 3 (indent 2)
    Control 4 (indent 2) <- Sibling of 3
      Control 5 (indent 3)
```

### Key Regex Patterns

**Control Declaration**:
```typescript
/^\{\s*(\d+)\s*;\s*(\d+)\s*;\s*(\w+)\s*;?\s*(.*)?$/
// Captures: ID, Indentation, Type, Properties
```

**SourceExpr (quoted or unquoted)**:
```typescript
/SourceExpr=(?:"([^"]+)"|(\w+(?:\s+\w+)*))/
// Captures: quoted value OR unquoted value (may have spaces)
```

**CaptionML**:
```typescript
/CaptionML\s*=\s*\[([^\]]+)\]\s*;/i
// Captures: ENU=Text;SKY=Text
```

**Boolean Properties**:
```typescript
/Visible=(Yes|No)/i  // Convert Yes -> true, No -> false
```

**Page Properties**:
```typescript
/SourceTable\s*=\s*(?:Table)?(\d+)\s*;/i  // Handles "Table3" or "3"
/PageType\s*=\s*([^;\s]+)\s*;/i           // Captures: Card, List, etc.
```

### Critical Gotchas

1. **OBJECT-PROPERTIES vs PROPERTIES**:
   - Problem: `\bPROPERTIES\s*\{` matches "OBJECT-PROPERTIES"
   - Solution: Created `extractSectionExact()` with `^\s*${sectionName}\s*\{` (start of line)
   - Must search for exact section name to avoid substring matches

2. **Control Hierarchy - Siblings**:
   - Controls at same indentation level are SIBLINGS (not nested)
   - Must pop stack correctly when indentation decreases or stays same
   - Example: Control 3 (indent 2) and Control 4 (indent 2) are siblings under Control 2 (indent 1)

3. **Continuation Lines**:
   - Control properties can span multiple lines
   - Must collect all lines until next `{` or `}` or section keyword
   - Example:
     ```
     { 2   ;1   ;Group     ;
                 Name=MainGroup;
                 GroupType=Group }
     ```

4. **Boolean Property Conversion**:
   - C/AL uses `Yes`/`No` strings
   - Must convert to TypeScript `true`/`false` booleans
   - Case-insensitive matching required

5. **CaptionML with Semicolons**:
   - CaptionML can contain semicolons inside brackets: `[ENU=Text;SKY=Text]`
   - Naive regex `/Property=([^;]+);/` fails
   - Must handle brackets specially or parse line-by-line

6. **SourceTable Format Variations**:
   - Can be `SourceTable=Table3;` or `SourceTable=3;`
   - Regex must handle optional "Table" prefix: `(?:Table)?(\d+)`

### Edge Cases Handled

1. **Deep Nesting**: 6+ indentation levels (tested up to level 6)
2. **Multiple Siblings**: Controls at same indentation
3. **Indentation Jumps**: From level 3 back to level 1 (skipping level 2)
4. **Quoted SourceExpr**: With spaces and special characters
5. **Form Objects**: Legacy variant of Page (same structure)
6. **Empty ACTIONS**: Pages without ACTIONS section
7. **Multiple Root Controls**: Multiple containers at indentation 0
8. **Encoding Issues**: Special characters in CaptionML (Slovak characters)

### Test Coverage (23 tests)

**Basic Parsing** (5 tests):
- Simple page declaration
- Page properties (CaptionML, PageType, SourceTable)
- Single control
- Control properties
- Quoted vs unquoted SourceExpr

**Hierarchy** (5 tests):
- 2-level hierarchy
- 4+ level hierarchy
- Siblings at same level
- Indentation jumps (closing nested groups)
- Deep nesting (6+ levels)

**Control Types** (3 tests):
- Container
- Group
- Field

**Advanced** (6 tests):
- Complete page from fixture
- Form object (legacy)
- Boolean properties (Visible, Editable, Enabled)
- ACTIONS section
- Missing ACTIONS section
- Multiple root controls

**Error Handling** (1 test):
- Missing CONTROLS section

### Verification Results

- Tests: 23 pass / 0 fail ✓
- TypeScript compilation: No errors in page-parser.ts ✓
- Fixture parsing: All 11 controls parsed correctly with proper hierarchy ✓
- Max nesting depth: 6 levels verified ✓

### Files Created

- `src/parser/page-parser.ts` - Page parser implementation (550+ lines)
- `src/__tests__/page-parser.test.ts` - Comprehensive test suite (23 tests)

### Performance Considerations

- Section extraction uses brace counting (O(n) where n = content length)
- Control hierarchy building uses single pass with stack (O(m) where m = number of controls)
- Regex-based property parsing is efficient for small property sets
- No backtracking regexes used (all are deterministic)

### Future Improvements

- Could optimize multi-line property collection (currently line-by-line)
- Could cache section extraction results to avoid re-parsing
- Could add validation for control hierarchy (e.g., Field controls can't have children)
- Could parse RunObject in actions to extract object references
- Could support TableRelation parsing in Field controls (for dependency tracking)

### Patterns for Future Parsers

1. **Section Extraction**: Use `extractSectionExact()` pattern for exact matches
2. **Flat-to-Hierarchy**: Stack-based algorithm works well for indentation-based structures
3. **Multi-line Properties**: Collect continuation lines until delimiter or section boundary
4. **Boolean Conversion**: Always convert Yes/No to true/false for type safety
5. **Flexible Regex**: Add `\s*` around `=` and `;` to handle formatting variations
6. **Encoding**: Be aware of special character encoding in test fixtures

## Report/XMLport/Query/MenuSuite Parsers (Task 8)

### Implementation Strategy
- **TDD Approach Validated**: Wrote 44 tests first (11 per parser), then implemented all 4 parsers
- All 44 tests passing on first complete run after bug fixes
- Test breakdown: 11 report-parser, 11 xmlport-parser, 11 query-parser, 11 menusuite-parser

### Parser Files Created
1. **src/parser/report-parser.ts** - DATASET section parser
2. **src/parser/xmlport-parser.ts** - ELEMENTS section parser  
3. **src/parser/query-parser.ts** - ELEMENTS section parser (query variant)
4. **src/parser/menusuite-parser.ts** - MENUITEMS section parser

### Key Parsing Patterns

#### Brace-Matching Section Extraction
Replaced fragile regex matching with robust brace-depth tracking:
```typescript
// Find section start
const sectionStart = content.indexOf('DATASET');

// Track brace depth to find matching closing brace
let braceDepth = 0;
let inSection = false;
let sectionEnd = -1;

for (let i = sectionStart; i < content.length; i++) {
  const char = content[i];
  if (char === '{') {
    braceDepth++;
    inSection = true;
  } else if (char === '}') {
    braceDepth--;
    if (inSection && braceDepth === 0) {
      sectionEnd = i;
      break;
    }
  }
}

const section = content.substring(sectionStart, sectionEnd + 1);
```

**Why this works better than regex:**
- Handles nested braces correctly
- Doesn't fail on multi-line formatting variations
- No need to escape special characters in section content

#### Relative Indentation Calculation
Challenge: Indentation values are absolute in file, but should be relative within section.

**Solution: Baseline indentation normalization**
```typescript
let baseIndentation: number | null = null;

// For each DATAITEM/ELEMENT
const leadingSpaces = line.match(/^(\s*)\{/)?.[1].length || 0;

// Set baseline from first item
if (baseIndentation === null) {
  baseIndentation = leadingSpaces;
}

// Calculate relative indentation
const indentation = Math.floor((leadingSpaces - baseIndentation) / divisor);
```

**Indentation divisors discovered:**
- Report DATASET: 14 spaces per nesting level
- Query ELEMENTS: 14 spaces per nesting level
- XMLport ELEMENTS: 10 spaces per nesting level (different!)
- MenuSuite: No nesting levels (flat structure)

**Why different divisors?**
- C/AL export format has inconsistent indentation between object types
- XMLport uses tighter indentation (10 spaces) vs Report/Query (14 spaces)
- Empirically determined from actual fixture files

### Report Parser Specifics

**DATASET Structure:**
```
DATASET
{
  { DATAITEM "name";"source table"
              {
                DataItemTableView=SORTING(field);
                column(name;sourceExpr)
                {
                }
              }
  }
}
```

**Parsing logic:**
1. Extract DATASET section with brace-matching
2. Parse DATAITEM declarations: `{ DATAITEM "name";"source"`
3. Parse properties: lines with `=` but not `column(` or `trigger`
4. Parse columns: `column(name;sourceExpr)`
5. Track indentation for nested dataitems

**Edge cases handled:**
- Multi-line column declarations
- Properties with semicolons in values
- Nested dataitems (parent-child via indentation)
- Empty DATASET section

### XMLport Parser Specifics

**ELEMENTS Structure:**
```
ELEMENTS
{
  { ELEMENT;name;nodeType ;
              SourceTable="table";
              { ELEMENT;child;Field ;
                        SourceField="table".field }
  }
}
```

**Node types supported:**
- Element (table element)
- Field (field element)
- Text (text element)
- Attribute (attribute element)

**Key differences from Report:**
- Uses `{ ELEMENT;name;type ;` instead of `{ DATAITEM`
- NodeType is part of declaration (Element, Field, Text, Attribute)
- Properties include SourceTable, SourceField, XmlName, MinOccurs, MaxOccurs
- Tighter indentation (10 spaces vs 14)

### Query Parser Specifics

**ELEMENTS Structure (similar to Report DATASET):**
```
ELEMENTS
{
  { DATAITEM "name";"source table"
              {
                DataItemReference="name";
                column(name;sourceField)
                {
                }
                filter(name;sourceField)
                {
                }
              }
  }
}
```

**Key differences from Report:**
- Uses ELEMENTS section instead of DATASET
- Has DataItemReference property
- Supports both `column()` and `filter()` declarations
- Filter columns have `Filter=Yes` property automatically added

### MenuSuite Parser Specifics

**MENUITEMS Structure:**
```
MENUITEMS
{
  MENUITEM(Text=name;
           Action=Page 4;
           RunObject=Page 4)
  SEPARATOR
  MENUITEM(Text=folder;
           IsFolder=Yes)
  {
    MENUITEM(nested item...)
  }
}
```

**Unique challenges:**
1. Multi-line property collection (MENUITEM can span multiple lines)
2. SEPARATOR keyword (special menu item type)
3. Nested menu items (folders)
4. Property parsing from `prop=value;` format

**Solution: State machine approach**
```typescript
let collectingProperties = false;
let propertyBuffer = '';

// Start collecting on MENUITEM(
if (line.startsWith('MENUITEM(')) {
  collectingProperties = true;
  propertyBuffer = line;
}

// Continue collecting until )
if (collectingProperties && !line.includes(')')) {
  propertyBuffer += ' ' + line;
}

// Parse when complete
if (line.includes(')')) {
  collectingProperties = false;
  parseMenuItem(propertyBuffer);
}
```

### Common Parser Patterns

**All 4 parsers share:**
1. Section extraction via brace-depth tracking
2. Line-by-line processing with state tracking
3. Regex for declaration matching
4. Property extraction from `name=value;` format
5. Indentation calculation (except MenuSuite)
6. Error throwing for missing sections

**Regex patterns used:**

| Parser | Declaration Pattern |
|--------|---------------------|
| Report | `/\{\s*DATAITEM\s+"([^"]+)";"([^"]+)"/` |
| XMLport | `/\{\s*ELEMENT;([^;]+);(Element\|Field\|Text\|Attribute)\s*;/` |
| Query | `/\{\s*DATAITEM\s+"([^"]+)";"([^"]+)"/` |
| MenuSuite | `/MENUITEM\((.*)\)/s` |

**Property extraction:**
```typescript
const propMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);\s*$/);
if (propMatch) {
  const [, propName, propValue] = propMatch;
  properties.push({ name: propName.trim(), value: propValue.trim() });
}
```

### Verification Results
- **Tests:** 44 pass / 0 fail ✓
- **TypeScript compilation:** No errors ✓
- **Test coverage:**
  - Basic section parsing
  - Property extraction
  - Column/element parsing
  - Nested structures
  - Empty sections
  - Error handling (missing sections)
  - Special characters in names
  - Multi-line declarations

### Gotchas & Lessons Learned

1. **Indentation is not uniform across object types**
   - Report/Query: 14 spaces per level
   - XMLport: 10 spaces per level
   - Don't assume consistent indentation!

2. **Brace-matching is more robust than regex**
   - Initial regex approach failed on complex nesting
   - Brace-depth tracking handles all cases correctly

3. **Baseline indentation normalization is critical**
   - First item sets the "zero" indentation level
   - All subsequent items are relative to this baseline
   - Without this, top-level items get non-zero indentation

4. **Multi-line property collection needs state machine**
   - MenuSuite MENUITEM can span many lines
   - Simple line-by-line parsing won't work
   - Need to buffer lines until complete

5. **Property regex must handle semicolons carefully**
   - Pattern: `/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?);\s*$/`
   - Non-greedy `.+?` prevents matching multiple properties
   - Trailing `;\s*$` ensures we match the complete property

6. **Column/element parsing is simple once section is extracted**
   - Column pattern: `column(name;sourceExpr)`
   - Element pattern: `{ ELEMENT;name;type ;`
   - Always trim captured values!

7. **TypeScript strict mode catches unused variables**
   - All imports should be used
   - All captured regex groups should be used (or use `_` prefix)
   - Clean up unused variables before commit

### Files Created (8 total)
**Parser implementations:**
- src/parser/report-parser.ts (12

## Report/XMLport/Query/MenuSuite Parsers (Task 8)

### Implementation Strategy
- **TDD Approach Validated**: Wrote 44 tests first (11 per parser), then implemented all 4 parsers
- All 44 tests passing on first complete run after bug fixes
- Test breakdown: 11 report-parser, 11 xmlport-parser, 11 query-parser, 11 menusuite-parser

### Parser Files Created
1. **src/parser/report-parser.ts** - DATASET section parser
2. **src/parser/xmlport-parser.ts** - ELEMENTS section parser  
3. **src/parser/query-parser.ts** - ELEMENTS section parser (query variant)
4. **src/parser/menusuite-parser.ts** - MENUITEMS section parser

### Key Parsing Patterns

#### Brace-Matching Section Extraction
Replaced fragile regex matching with robust brace-depth tracking. This approach handles nested braces correctly and doesn't fail on multi-line formatting variations.

#### Relative Indentation Calculation
Challenge: Indentation values are absolute in file, but should be relative within section.

**Indentation divisors discovered:**
- Report DATASET: 14 spaces per nesting level
- Query ELEMENTS: 14 spaces per nesting level
- XMLport ELEMENTS: 10 spaces per nesting level (different!)
- MenuSuite: No nesting levels (flat structure)

### Verification Results
- **Tests:** 44 pass / 0 fail
- **TypeScript compilation:** No errors
- **Test coverage:** Basic parsing, properties, columns/elements, nesting, empty sections, errors, special chars, multi-line

### Files Created (8 total)
**Parser implementations:**
- src/parser/report-parser.ts (126 lines)
- src/parser/xmlport-parser.ts (93 lines)
- src/parser/query-parser.ts (126 lines)
- src/parser/menusuite-parser.ts (147 lines)

**Test files:**
- src/__tests__/report-parser.test.ts (11 tests)
- src/__tests__/xmlport-parser.test.ts (11 tests)
- src/__tests__/query-parser.test.ts (11 tests)
- src/__tests__/menusuite-parser.test.ts (11 tests)

