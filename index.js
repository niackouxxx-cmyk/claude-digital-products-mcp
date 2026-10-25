
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "digital-products",
  version: "1.0.0"
});

server.registerTool("product_idea", {
  description: "Crée une idée de produit numérique adaptée au public cible.",
  inputSchema: {
    topic: z.string().describe("Sujet du produit"),
    audience: z.string().describe("Public cible")
  }
}, async ({ topic, audience }) => ({
  content: [{
    type: "text",
    text: `Idée de produit numérique sur ${topic} pour ${audience} : crée un guide pratique avec des étapes, des exemples et une checklist. Vérifie la demande avant de le vendre.`
  }]
}));

app.get("/", (_req, res) => {
  res.send("Digital Products MCP is running");
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => {
  res.status(405).send("Use an MCP-compatible client");
});

app.delete("/mcp", (_req, res) => {
  res.status(405).send("Sessionless MCP server");
});

app.listen(process.env.PORT || 10000, "0.0.0.0");
