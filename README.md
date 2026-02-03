# CAL Dependency MCP Server

[![npm version](https://img.shields.io/npm/v/cal-dependency-mcp-server.svg)](https://www.npmjs.com/package/cal-dependency-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-290%20passing-brightgreen.svg)](#development)

A Model Context Protocol (MCP) server for analyzing **C/AL (Microsoft Dynamics NAV 2009-2018)** text files. This server enables AI assistants to search, explore, and map dependencies within NAV codebases.

## Features

- **Object Search** - Wildcard search across all C/AL object types with pagination
- **Dependency Mapping** - Analyze incoming and outgoing references between objects
- **Reference Tracking** - Find where fields/objects are used (TableRelation, CalcFormula, Record variables)
- **Code Search** - Regex-based search within procedure bodies
- **Table Relations** - Map complex TableRelation and CalcFormula links
- **Token Efficient** - Summary modes for LLM context optimization

## Supported Object Types

- Table
- Page
- Form (Legacy)
- Codeunit
- Report
- XMLport
- Query
- MenuSuite

## Installation

### Option 1: Install from npm (Recommended)

```bash
# Global installation
npm install -g cal-dependency-mcp-server

# Or with Bun
bun install -g cal-dependency-mcp-server
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/marosgonda/CAL-Dependency-MCP-Server.git
cd CAL-Dependency-MCP-Server

# Install dependencies
bun install

# Build
bun run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

**If installed globally via npm:**
```json
{
  "mcpServers": {
    "cal-analyzer": {
      "command": "cal-mcp-server"
    }
  }
}
```

**If installed from source (Windows):**
```json
{
  "mcpServers": {
    "cal-analyzer": {
      "command": "bun",
      "args": ["run", "C:/path/to/CAL-Dependency-MCP-Server/dist/index.js"]
    }
  }
}
```

**If installed from source (macOS/Linux):**
```json
{
  "mcpServers": {
    "cal-analyzer": {
      "command": "bun",
      "args": ["run", "/path/to/CAL-Dependency-MCP-Server/dist/index.js"]
    }
  }
}
```

### Other MCP Clients

Use stdio transport with command:
```bash
cal-mcp-server
# or
bun run /path/to/dist/index.js
```

## Available Tools

### Core Tools

#### `cal_files` - Load and manage C/AL files
```json
{
  "action": "load",
  "path": "C:/NAV/Objects/",
  "autoDiscover": true
}
```
Actions: `load`, `list`, `stats`

#### `cal_search_objects` - Search objects by pattern
```json
{
  "pattern": "Cust*",
  "objectType": "Table",
  "limit": 20,
  "offset": 0,
  "summaryMode": true
}
```

#### `cal_get_object_definition` - Get full object definition
```json
{
  "objectType": "Table",
  "objectId": 18,
  "summaryMode": false
}
```

#### `cal_find_references` - Find cross-object references
```json
{
  "targetName": "Customer",
  "fieldName": "No.",
  "referenceType": "TableRelation"
}
```

#### `cal_search_object_members` - Search fields/procedures
```json
{
  "objectName": "Customer",
  "memberType": "fields",
  "pattern": "*No*"
}
```

#### `cal_get_object_summary` - Token-efficient overview
```json
{
  "objectName": "Sales-Post",
  "objectType": "Codeunit"
}
```

### Extended Tools

#### `cal_search_code` - Search in procedure bodies
```json
{
  "pattern": "ERROR\(.*\)",
  "objectType": "Codeunit",
  "limit": 20
}
```

#### `cal_get_dependencies` - Get dependency graph
```json
{
  "objectType": "Table",
  "objectId": 18,
  "direction": "both"
}
```
Directions: `incoming`, `outgoing`, `both`

#### `cal_get_table_relations` - Map table relationships
```json
{
  "tableId": 36,
  "includeCalcFormula": true
}
```

## Usage Example

1. **Load your C/AL files:**
   ```
   Use cal_files to load C:/NAV/AllObjects.txt
   ```

2. **Search for objects:**
   ```
   Search for all tables starting with "Sales"
   ```

3. **Analyze dependencies:**
   ```
   What references the Customer table?
   ```

4. **Find code patterns:**
   ```
   Find all ERROR calls in codeunits
   ```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests with watch
bun test --watch

# Type check
bun run type-check

# Build
bun run build

# Development mode (auto-rebuild)
bun run dev
```

## Project Structure

```
src/
├── index.ts              # MCP server entry point
├── types/                # TypeScript interfaces
├── parser/               # C/AL parsers (8 object types)
├── core/
│   ├── symbol-database.ts    # In-memory symbol storage
│   ├── reference-extractor.ts # Cross-reference analysis
│   └── file-loader.ts        # File loading with streaming
└── tools/
    └── mcp-tools.ts      # MCP tool implementations
```

## Test Coverage

- **290 tests** passing
- **923 assertions**
- All parsers, database, reference extraction, and MCP tools covered

## Publishing

```bash
# Login to npm
npm login

# Publish
npm publish
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Created by [marosgonda](https://github.com/marosgonda)
