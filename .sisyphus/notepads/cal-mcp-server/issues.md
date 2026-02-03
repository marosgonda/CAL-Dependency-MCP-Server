# Issues & Gotchas - CAL MCP Server

## Known Edge Cases
- Page controls use numeric indentation hierarchy (not curly braces)
- DotNet types have complex assembly references with quoted paths
- TextConst has `@@@=` metadata comment syntax
- CODE sections must end with `END.` (period required)
- Field format has double-semicolons for empty positions

