#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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
        name: "analyze_dependencies",
        description: "Analyze dependencies in CAL (Business Central AL) code files",
        inputSchema: {
          type: "object" as const,
          properties: {
            filePath: {
              type: "string",
              description: "Path to the AL file to analyze",
            },
          },
          required: ["filePath"],
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

  if (name === "analyze_dependencies") {
    const filePath = (args as Record<string, unknown>).filePath as string;
    
    // Placeholder implementation
    return {
      content: [
        {
          type: "text",
          text: `Analyzing dependencies for: ${filePath}\n\nThis is a placeholder. Full implementation coming soon.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
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
