
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

function createMcpServer() {
  const server = new McpServer({
    name: "Digital Products Assistant",
    version: "2.0.0"
  });

  // 1. Generate detailed product ideas
  server.tool(
    "product_idea",
    "Generate detailed digital product ideas, target customers, problems solved, pricing, competition checks and creation steps.",
    {
      niche: z.string().describe("Topic or market, for example fitness, education or business"),
      audience: z.string().optional().describe("Target customers"),
      budget: z.string().optional().describe("Available budget"),
      skills: z.string().optional().describe("Creator's skills"),
      count: z.number().int().min(1).max(10).optional()
    },
    async ({ niche, audience, budget, skills, count }) => {
      const total = count || 3;
      const ideas = Array.from({ length: total }, (_, i) => {
        const formats = [
          "Practical PDF guide with examples and checklists",
          "Editable template pack for Canva, Notion or Excel",
          "Workbook with exercises, trackers and action plans",
          "Beginner mini-course with worksheets",
          "Specialized prompt and workflow pack"
        ];
        const format = formats[i % formats.length];
        return `${i + 1}. ${format}\n` +
          `- Target audience: ${audience || `Beginners interested in ${niche}`}\n` +
          `- Problem to solve: help customers achieve one specific result in ${niche}\n` +
          `- Suggested test price: €${i % 2 === 0 ? "9–19" : "19–39"}\n` +
          `- Creation difficulty: ${i % 2 === 0 ? "Beginner" : "Beginner to intermediate"}\n` +
          `- Validation: interview 5 potential buyers and check existing offers before creating it\n` +
          `- First steps: define the promise, create a small sample, test it with users, improve it and publish it`;
      });

      return {
        content: [{
          type: "text",
          text: `DIGITAL PRODUCT IDEAS\n\nMarket: ${niche}\nAudience: ${audience || "To be refined"}\nBudget: ${budget || "Not specified"}\nSkills: ${skills || "Not specified"}\n\n${ideas.join("\n\n")}\n\nIMPORTANT: These are starting hypotheses, not verified demand or guaranteed earnings. Validate demand before investing time or money.`
        }]
      };
    }
  );

  // 2. Validate a product idea
  server.tool(
    "validate_product",
    "Create a practical market-validation plan for a digital product idea. Do not claim market demand has been verified without evidence.",
    {
      idea: z.string().describe("The product idea"),
      audience: z.string().describe("Intended customers"),
      platform: z.string().optional().describe("Potential sales platform")
    },
    async ({ idea, audience, platform }) => ({
      content: [{
        type: "text",
        text: `PRODUCT VALIDATION PLAN\n\nIdea: ${idea}\nAudience: ${audience}\nPlatform to investigate: ${platform || "Compare suitable platforms"}\n\n1. CUSTOMER PROBLEM\nWrite down the exact problem the product solves and what customers currently do instead.\n\n2. RESEARCH\n- Find 10 discussions where the target audience describes this problem.\n- Review 5 competing offers, their prices, promises and customer feedback.\n- Record repeated complaints and missing features.\n\n3. TALK TO CUSTOMERS\nAsk at least 5 people in the target audience how they currently solve the problem, what frustrates them and whether they would pay for a proposed solution.\n\n4. TEST A SMALL OFFER\nCreate a sample, preview or landing page. Measure genuine sign-ups or purchase intent. Do not treat likes alone as proof of demand.\n\n5. DECISION\nProceed if you see consistent evidence of the problem and meaningful interest. Otherwise, revise the audience, promise or format.\n\nNo research has been performed automatically by this tool. Complete these checks before concluding that demand exists.`
      }]
    })
  );

  // 3. Build a product outline
  server.tool(
    "create_product_outline",
    "Create a detailed, actionable structure for an ebook, guide, template pack or mini-course.",
    {
      product: z.string().describe("Product format and subject"),
      audience: z.string().describe("Target audience"),
      outcome: z.string().describe("What the customer should achieve"),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional()
    },
    async ({ product, audience, outcome, level }) => ({
      content: [{
        type: "text",
        text: `PRODUCT BLUEPRINT\n\nProduct: ${product}\nAudience: ${audience}\nDesired outcome: ${outcome}\nLevel: ${level || "beginner"}\n\nPRODUCT PROMISE\nHelp ${audience} work toward this result: ${outcome}. Keep the promise realistic and specific.\n\nSTRUCTURE\n1. Introduction: who the product is for, the problem and the expected result.\n2. Starting point: common mistakes, obstacles and preparation.\n3. Step one: explain the first action, with an example.\n4. Step two: provide a practical method and a worked example.\n5. Step three: give an exercise or implementation task.\n6. Troubleshooting: common difficulties and how to respond.\n7. Action plan: a sequence of small tasks to apply what was learned.\n8. Checklist: a concise review of the essential steps.\n9. Conclusion: recap, next steps and limitations.\n\nFOR EACH SECTION\nInclude a clear objective, simple explanation, practical example and action for the reader.\n\nQUALITY CHECK\nVerify accuracy, originality, readability, accessibility and any relevant legal or professional requirements before selling. Adapt this outline to the actual subject rather than filling it with generic material.`
      }]
    })
  );

  // 4. Create sales copy
  server.tool(
    "create_sales_page",
    "Write honest, persuasive sales copy for a digital product, including headline, benefits, deliverables, objections and call to action.",
    {
      product: z.string(),
      audience: z.string(),
      benefits: z.string(),
      price: z.string().optional(),
      tone: z.enum(["friendly", "professional", "energetic"]).optional()
    },
    async ({ product, audience, benefits, price, tone }) => ({
      content: [{
        type: "text",
        text: `SALES PAGE DRAFT\n\nHEADLINE\nA practical way for ${audience} to make progress with less guesswork.\n\nSUBHEADLINE\nDiscover ${product}, designed to help you take clear, manageable steps.\n\nTHE PROBLEM\nIf you are struggling to know where to start, this product gives you a structured approach rather than leaving you to piece everything together alone.\n\nWHAT YOU CAN GAIN\n${benefits}\n\nWHAT IS INCLUDED\n- The main digital product: ${product}\n- Practical examples and actionable guidance\n- A checklist or action plan, where relevant\n\nWHO IT IS FOR\nPeople in this audience: ${audience}.\n\nWHO IT MAY NOT SUIT\nAnyone expecting guaranteed results without applying the material, or anyone whose needs fall outside the product's stated scope.\n\nPRICE\n${price || "Set a price after comparing alternatives and estimating costs."}\n\nCALL TO ACTION\nReview the contents and decide whether this product fits your needs.\n\nSTYLE\n${tone || "friendly"}\n\nBefore publishing, replace generic statements with verified product details. Do not invent testimonials, customer numbers, qualifications or guarantees.`
      }]
    })
  );

  // 5. Plan a launch
  server.tool(
    "create_launch_plan",
    "Create a realistic launch checklist and timeline for a digital product.",
    {
      product: z.string(),
      platform: z.string().optional(),
      timeframe: z.string().optional(),
      hoursPerWeek: z.number().positive().optional()
    },
    async ({ product, platform, timeframe, hoursPerWeek }) => ({
      content: [{
        type: "text",
        text: `PRODUCT LAUNCH PLAN\n\nProduct: ${product}\nPlatform: ${platform || "Choose after comparing fees and audience fit"}\nTimeframe: ${timeframe || "4 weeks"}\nAvailable time: ${hoursPerWeek ? `${hoursPerWeek} hours/week` : "Not specified"}\n\nWEEK 1 — RESEARCH\n- Define the customer and problem.\n- Review competing products and their prices.\n- Speak to potential customers.\n- Decide what the first version must include.\n\nWEEK 2 — BUILD\n- Create the smallest useful version.\n- Proofread and test all files and links.\n- Ask a few suitable testers for feedback.\n\nWEEK 3 — PREPARE SALES\n- Choose a suitable platform and check its fees and rules.\n- Write the product description and set a test price.\n- Prepare preview images, instructions and customer support details.\n- Check applicable tax, consumer-rights and privacy obligations.\n\nWEEK 4 — LAUNCH AND LEARN\n- Publish the offer and test the purchase and delivery process.\n- Share useful content where promotion is permitted.\n- Track visits, purchases, refunds and customer questions.\n- Improve the product based on real feedback.\n\nMEASURE\nTrack actual costs, conversion rate, net revenue and customer satisfaction. Sales are not guaranteed; adapt the timeline to your available time and evidence of demand.`
      }]
    })
  );

  // 6. Estimate pricing
  server.tool(
    "pricing_strategy",
    "Develop a pricing hypothesis for a digital product using customer value, competitor research and costs. Do not present estimates as verified market prices.",
    {
      product: z.string(),
      audience: z.string(),
      costs: z.string().optional(),
      competitorPrices: z.string().optional()
    },
    async ({ product, audience, costs, competitorPrices }) => ({
      content: [{
        type: "text",
        text: `PRICING STRATEGY\n\nProduct: ${product}\nAudience: ${audience}\nKnown costs: ${costs || "Not supplied"}\nCompetitor prices: ${competitorPrices || "Not researched"}\n\n1. DEFINE VALUE\nWhat time, effort or difficulty does the product help the customer save? Avoid promising outcomes you cannot substantiate.\n\n2. TEST A STARTING RANGE\n- Simple checklist or small resource: consider testing €5–15.\n- Detailed guide or useful template pack: consider testing €9–39.\n- Substantial course or professional resource: consider testing €39–149 or more if the value supports it.\nThese are broad starting hypotheses, not verified market averages.\n\n3. CALCULATE YOUR NET\nFor each sale, subtract platform and payment fees, applicable taxes, refunds and other variable costs from the price. Check your own tax obligations.\n\n4. COMPARE ALTERNATIVES\nResearch at least 5 similar products aimed at a comparable audience. Compare quality, scope, support and pricing, not just the headline price.\n\n5. TEST AND REVIEW\nStart with one clear price, collect feedback and assess actual conversion and net revenue before changing it.\n\nRECOMMENDATION\nChoose a price that fits the product's real usefulness, the audience's budget and your costs. Do not assume a higher price automatically means higher profit.`
      }]
    })
  );

  return server;
}

app.get("/", (_req, res) => {
  res.status(200).send("Digital Products MCP is running");
});

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).send("Use POST for MCP requests.");
});

app.listen(PORT, () => {
  console.log(`Digital Products MCP listening on port ${PORT}`);
});
