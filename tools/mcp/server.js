#!/usr/bin/env node
/**
 * VideoForge MCP Server — entry point.
 *
 * Wires together the service layer, all tool definitions, and MCP
 * resource handlers into a single server that speaks the Model Context
 * Protocol over stdio.
 *
 * Architecture
 * ─────────────
 * server.js
 *   └── services/   (business logic, VideoForge API usage)
 *         └── tools/    (thin MCP shims — input validation + service call)
 *         └── resources/ (read-only URI access to live state)
 *
 * The MCP SDK is only referenced in this file and resources/index.js.
 * Services and tools have no dependency on the MCP SDK, which keeps them
 * portable and independently testable.
 */

import { Server }              from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ── Services ──────────────────────────────────────────────────────────────────

import { StorageService }    from './services/StorageService.js';
import { ProjectService }    from './services/ProjectService.js';
import { InspectionService } from './services/InspectionService.js';
import { ExportService }     from './services/ExportService.js';
import { ValidationService } from './services/ValidationService.js';
import { RegressionService } from './services/RegressionService.js';

// ── Parsers ───────────────────────────────────────────────────────────────────

import { ExportParser } from './parsers/ExportParser.js';

// ── Tools ─────────────────────────────────────────────────────────────────────

import * as createProject    from './tools/create_project.js';
import * as loadProject      from './tools/load_project.js';
import * as inspectProject   from './tools/inspect_project.js';
import * as exportPremiere   from './tools/export_premiere.js';
import * as exportFcpxml     from './tools/export_fcpxml.js';
import * as exportEdl        from './tools/export_edl.js';
import * as inspectExport    from './tools/inspect_export.js';
import * as validateExport   from './tools/validate_export.js';
import * as runRegression    from './tools/run_regression_test.js';

// ── Resources ─────────────────────────────────────────────────────────────────

import { registerResources } from './resources/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Service graph (pure dependency injection — no singletons leaked out)
// ─────────────────────────────────────────────────────────────────────────────

const storage         = new StorageService();
const projectService  = new ProjectService(storage);
const inspectionService = new InspectionService(projectService);
const exportService   = new ExportService(projectService, storage);
const validationService = new ValidationService(projectService, storage);
const regressionService = new RegressionService(
  projectService,
  exportService,
  validationService,
  inspectionService,
);
const exportParser    = new ExportParser();

/** Services bag passed into every tool handler. */
const services = {
  storage,
  projectService,
  inspectionService,
  exportService,
  validationService,
  regressionService,
  exportParser,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TOOLS = [
  createProject,
  loadProject,
  inspectProject,
  exportPremiere,
  exportFcpxml,
  exportEdl,
  inspectExport,
  validateExport,
  runRegression,
];

/** @type {Map<string, Function>} */
const toolHandlers = new Map(
  ALL_TOOLS.map((t) => [t.definition.name, t.handler]),
);

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'videoforge-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } },
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS.map((t) => t.definition),
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = toolHandlers.get(name);
  if (!handler) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: "${name}"` }) }],
      isError: true,
    };
  }

  try {
    const result = await handler(args ?? {}, services);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      isError: true,
    };
  }
});

// Resources
registerResources(server, { inspectionService, exportService });

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[VideoForge MCP] Server running on stdio');
