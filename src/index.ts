#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  searchObjects,
  getObjectDefinition,
  findReferences,
  searchObjectMembers,
  getObjectSummary,
  manageFiles,
} from "./tools/mcp-tools.js";

/**
 * CAL Dependency MCP Server
 * 
 * This server provides tools for analyzing Business Central AL code dependencies.
 * It uses the Model Context Protocol to expose dependency analysis capabilities.
 */

const server = new Server(
  {
    name: "cal-dependency-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "cal_search_objects",
        description: "Search CAL objects by pattern, type, and domain with pagination support",
        inputSchema: {
          type: "object" as const,
          properties: {
            pattern: {
              type: "string",
              description: "Wildcard search pattern (e.g., 'Cust*', '*Post')",
            },
            objectType: {
              type: "string",
              description: "Filter by object type (Table, Page, Codeunit, Report, etc.)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 20)",
            },
            offset: {
              type: "number",
              description: "Number of results to skip for pagination (default: 0)",
            },
            summaryMode: {
              type: "boolean",
              description: "Return summary view with counts instead of full objects (default: true)",
            },
          },
        },
      },
      {
        name: "cal_get_object_definition",
        description: "Get complete definition of a CAL object by ID or name",
        inputSchema: {
          type: "object" as const,
          properties: {
            objectType: {
              type: "string",
              description: "Object type (Table, Page, Codeunit, Report, etc.)",
            },
            objectId: {
              type: "number",
              description: "Object ID to retrieve",
            },
            objectName: {
              type: "string",
              description: "Object name to retrieve (alternative to objectId)",
            },
            summaryMode: {
              type: "boolean",
              description: "Return truncated fields/procedures (default: true)",
            },
          },
          required: ["objectType"],
        },
      },
      {
        name: "cal_find_references",
        description: "Find all references to a CAL object or field across the codebase",
        inputSchema: {
          type: "object" as const,
          properties: {
            targetName: {
              type: "string",
              description: "Name of the object or table to find references to",
            },
            fieldName: {
              type: "string",
              description: "Optional field name to filter references to a specific field",
            },
            referenceType: {
              type: "string",
              description: "Filter by reference type (TableRelation, CalcFormula, RecordVariable, etc.)",
            },
            includeContext: {
              type: "boolean",
              description: "Include additional context in results (default: false)",
            },
          },
          required: ["targetName"],
        },
      },
      {
        name: "cal_search_object_members",
        description: "Search procedures, fields, or controls within a specific CAL object",
        inputSchema: {
          type: "object" as const,
          properties: {
            objectName: {
              type: "string",
              description: "Name of the object to search within",
            },
            objectType: {
              type: "string",
              description: "Optional object type filter",
            },
            memberType: {
              type: "string",
              description: "Type of member to search (procedures, fields, controls, dataitems)",
            },
            pattern: {
              type: "string",
              description: "Wildcard pattern to filter members",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 20)",
            },
            offset: {
              type: "number",
              description: "Pagination offset (default: 0)",
            },
          },
          required: ["objectName", "memberType"],
        },
      },
      {
        name: "cal_get_object_summary",
        description: "Get token-efficient categorized overview of a CAL object with grouped procedures",
        inputSchema: {
          type: "object" as const,
          properties: {
            objectName: {
              type: "string",
              description: "Name of the object to summarize",
            },
            objectType: {
              type: "string",
              description: "Optional object type filter",
            },
          },
          required: ["objectName"],
        },
      },
      {
        name: "cal_files",
        description: "Manage CAL file loading: load files, list loaded files, or get statistics",
        inputSchema: {
          type: "object" as const,
          properties: {
            action: {
              type: "string",
              description: "Action to perform (load, list, stats)",
            },
            path: {
              type: "string",
              description: "File or directory path (required for 'load' action)",
            },
            autoDiscover: {
              type: "boolean",
              description: "Auto-discover .txt files in directory (default: true)",
            },
          },
          required: ["action"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { params } = request;
  const { name, arguments: args } = params;

  try {
    switch (name) {
      case "cal_search_objects": {
        const result = await searchObjects(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cal_get_object_definition": {
        const result = await getObjectDefinition(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cal_find_references": {
        const result = await findReferences(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cal_search_object_members": {
        const result = await searchObjectMembers(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cal_get_object_summary": {
        const result = await getObjectSummary(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "cal_files": {
        const result = await manageFiles(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [],
  };
});

/**
 * Read resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: "Resource not found",
      },
    ],
  };
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CAL Dependency MCP Server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
