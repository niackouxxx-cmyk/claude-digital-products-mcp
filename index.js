
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 3000;
const SEARCH_TIMEOUT_MS = 8000;
const MAX_RESULTS = 8;

function result(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function cleanText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchWeb(query, count = 5) {
  const limit = Math.max(1, Math.min(Number(count) || 5, MAX_RESULTS));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" +
      encodeURIComponent(query);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DigitalProductsResearch/1.0)",
        Accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const results = [];
    const blocks = html.split(/class="result(?:\s|")/i).slice(1);

    for (const block of blocks) {
      const match = block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
      );

      if (!match) continue;

      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/[^>]+>/i
      );

      let link = match[1];

      try {
        const parsed = new URL(link, "https://html.duckduckgo.com");
        const redirect = parsed.searchParams.get("uddg");
        if (redirect) link = redirect;
        else link = parsed.href;
      } catch {
        continue;
      }

      try {
        link = decodeURIComponent(link);
      } catch {}

      const title = cleanText(match[2]);
      const snippet = cleanText(
        snippetMatch?.[1] || "Aucun extrait disponible."
      );

      if (!title || !/^https?:\/\//i.test(link)) continue;
      if (results.some(item => item.url === link)) continue;

      results.push({ title, url: link, snippet });
      if (results.length >= limit) break;
    }

    return {
      query,
      results,
      warning: results.length
        ? "Résultats issus d'extraits de recherche. Ouvrir les pages pour vérifier leur contenu, leur date et leur fiabilité."
        : "Aucun résultat exploitable. Le moteur peut avoir changé de format ou limité la requête. La recherche n'est pas considérée comme concluante."
    };
  } catch (error) {
    return {
      query,
      results: [],
      warning:
        "La recherche gratuite a échoué : " +
        (error.name === "AbortError"
          ? "délai d'attente dépassé."
          : error.message || "erreur inconnue.") +
        " Réessaie plus tard ou effectue une recherche manuelle. Aucune source n'a été vérifiée."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatSearch(data) {
  const sources = data.results.map((item, i) =>
    `${i + 1}. ${item.title}\nURL : ${item.url}\nExtrait : ${item.snippet}`
  );

  return [
    `RECHERCHE : ${data.query}`,
    "",
    sources.length ? sources.join("\n\n") : "Aucune source exploitable trouvée.",
    "",
    "FIABILITÉ : " + data.warning,
    "Date de recherche : " + new Date().toISOString()
  ].join("\n");
}

function createMcpServer() {
  const server = new McpServer({
    name: "Digital Products Assistant",
    version: "3.0.0"
  });

  // 1. Recherche web
  server.tool(
    "market_research",
    "Recherche sur le web des informations sur une niche, des besoins clients et des opportunités de produits numériques. Renvoie des liens réels si la recherche fonctionne.",
    {
      query: z.string().min(3).max(300),
      audience: z.string().max(200).optional(),
      count: z.number().int().min(1).max(MAX_RESULTS).optional()
    },
    async ({ query, audience, count }) => {
      const q = audience ? `${query} ${audience}` : query;
      return result(formatSearch(await searchWeb(q, count || 5)));
    }
  );

  // 2. Analyse de tendances
  server.tool(
    "trend_analysis",
    "Recherche des signaux de tendances en ligne. Ne présente jamais des extraits de recherche comme une preuve de ventes ou de croissance.",
    {
      niche: z.string().min(2).max(200),
      audience: z.string().max(200).optional(),
      region: z.string().max(100).optional()
    },
    async ({ niche, audience, region }) => {
      const q = `recent trends ${niche} ${audience || ""} ${region || ""} digital products`;
      const data = await searchWeb(q.trim(), 6);

      return result(
        `ANALYSE DE TENDANCES\nNiche : ${niche}\nPublic : ${audience || "À définir"}\nRégion : ${region || "Non précisée"}\n\n${formatSearch(data)}\n\nMÉTHODE\n- Comparer plusieurs sources indépendantes et leurs dates.\n- Chercher des problèmes clients récurrents.\n- Ne pas inventer de volumes de recherche, chiffres de vente ou taux de croissance.\n- Confirmer les tendances avec des données plus solides avant d'investir.`
      );
    }
  );

  // 3. Analyse des concurrents
  server.tool(
    "competitor_analysis",
    "Recherche des offres concurrentes et fournit une méthode de comparaison de leurs prix, contenus et positionnements.",
    {
      productType: z.string().min(2).max(200),
      audience: z.string().min(2).max(200),
      region: z.string().max(100).optional()
    },
    async ({ productType, audience, region }) => {
      const q = `${productType} for ${audience} price digital product ${region || ""}`;
      const data = await searchWeb(q.trim(), 6);

      return result(
        `ANALYSE DE LA CONCURRENCE\nProduit : ${productType}\nPublic : ${audience}\nRégion : ${region || "Non précisée"}\n\n${formatSearch(data)}\n\nÀ COMPARER POUR CHAQUE OFFRE\n- Prix affiché et devise.\n- Contenu réellement inclus.\n- Public ciblé et problème résolu.\n- Avis clients, dates et limites des avis disponibles.\n- Format, qualité, assistance et conditions de remboursement.\n- Différences possibles pour créer une offre plus utile.\n\nNe déduis pas le nombre de ventes ni la qualité réelle d'une offre à partir d'un simple extrait. Vérifie les pages sources.`
      );
    }
  );

  // 4. Idées de produits
  server.tool(
    "product_idea",
    "Propose des idées de produits numériques adaptées à une niche et réalise une première recherche web sur les problèmes potentiels.",
    {
      niche: z.string().min(2).max(200),
      audience: z.string().max(200).optional(),
      budget: z.string().max(200).optional(),
      skills: z.string().max(300).optional(),
      count: z.number().int().min(1).max(10).optional()
    },
    async ({ niche, audience, budget, skills, count }) => {
      const formats = [
        "Guide PDF pratique avec listes de contrôle",
        "Pack de modèles modifiables",
        "Cahier d'exercices et de suivi",
        "Mini-formation structurée",
        "Pack de méthodes et de procédures",
        "Kit pratique pour débutants",
        "Planner spécialisé",
        "Boîte à outils avec exemples",
        "Guide comparatif avec fiche de décision",
        "Pack de ressources pour une tâche précise"
      ];

      const ideas = Array.from(
        { length: count || 3 },
        (_, i) =>
          `${i + 1}. ${formats[i % formats.length]}\n` +
          `Public : ${audience || `Personnes intéressées par ${niche}`}\n` +
          `Problème à vérifier : aider le client à accomplir une tâche précise liée à ${niche}.\n` +
          `Prix de test hypothétique : ${i % 2 === 0 ? "7 à 19 €" : "15 à 35 €"}.\n` +
          `Version minimale : ressource utile, exemple concret et liste de contrôle.\n` +
          `Validation : interroger des clients potentiels et tester un aperçu avant de créer le produit complet.`
      );

      const research = await searchWeb(
        `${niche} common problems questions digital product`,
        4
      );

      return result(
        `IDÉES DE PRODUITS NUMÉRIQUES\nNiche : ${niche}\nPublic : ${audience || "À définir"}\nBudget : ${budget || "Non précisé"}\nCompétences : ${skills || "Non précisées"}\n\n${ideas.join("\n\n")}\n\nRECHERCHE INITIALE\n${formatSearch(research)}\n\nDÉCISION\nPrivilégier l'idée qui répond à un problème précis, que tu peux traiter correctement et pour laquelle des clients montrent un intérêt réel. Les prix proposés sont des hypothèses, pas des prix de marché vérifiés.`
      );
    }
  );

  // 5. Validation d'une idée
  server.tool(
    "validate_product",
    "Recherche des sources sur le problème client et les offres concurrentes, puis fournit un plan de validation. Les résultats web ne prouvent pas à eux seuls la demande.",
    {
      idea: z.string().min(3).max(500),
      audience: z.string().min(2).max(250),
      platform: z.string().max(150).optional(),
      region: z.string().max(100).optional()
    },
    async ({ idea, audience, platform, region }) => {
      const [problems, competitors] = await Promise.all([
        searchWeb(`${idea} problems questions discussion ${audience} ${region || ""}`, 4),
        searchWeb(`${idea} alternatives products price ${audience} ${region || ""}`, 4)
      ]);

      return result(
        `VALIDATION DU PRODUIT\nIdée : ${idea}\nPublic : ${audience}\nPlateforme envisagée : ${platform || "À comparer"}\nRégion : ${region || "Non précisée"}\n\nRECHERCHE DES PROBLÈMES CLIENTS\n${formatSearch(problems)}\n\nRECHERCHE DES CONCURRENTS\n${formatSearch(competitors)}\n\nPLAN DE VALIDATION\n1. Ouvrir les liens et vérifier les dates et le contenu.\n2. Comparer au moins cinq offres réellement similaires.\n3. Interroger au moins cinq personnes du public cible.\n4. Demander comment elles résolvent actuellement le problème et ce qui leur manque.\n5. Créer un aperçu et mesurer les inscriptions ou intentions d'achat.\n6. Décider à l'avance quels résultats justifieraient de continuer ou d'abandonner.\n\nCONCLUSION\nLa recherche fournit des pistes, pas une preuve de demande ou de volonté de payer. Confirmer avec des clients réels avant d'investir du temps ou de l'argent.`
      );
    }
  );

  // 6. Plan détaillé du produit
  server.tool(
    "create_product_outline",
    "Crée un plan détaillé et pratique pour un ebook, guide, cahier d'exercices, pack de modèles ou mini-formation.",
    {
      product: z.string().min(2).max(250),
      audience: z.string().min(2).max(250),
      outcome: z.string().min(3).max(400),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      constraints: z.string().max(500).optional()
    },
    async ({ product, audience, outcome, level, constraints }) =>
      result(
        `PLAN DE PRODUIT\nProduit : ${product}\nPublic : ${audience}\nRésultat visé : ${outcome}\nNiveau : ${level || "beginner"}\nContraintes : ${constraints || "Aucune précisée"}\n\nSTRUCTURE PROPOSÉE\n1. Introduction : public, problème, résultat attendu et limites.\n2. Point de départ : difficultés et erreurs fréquentes.\n3. Préparation : outils et informations nécessaires.\n4. Méthode étape par étape.\n5. Exemple complet et réaliste.\n6. Exercices ou fiches pratiques.\n7. Dépannage : difficultés et solutions.\n8. Adaptations selon le niveau et les besoins.\n9. Plan d'action progressif.\n10. Liste de contrôle finale et prochaines étapes.\n\nPour chaque partie, prévoir un objectif, une explication claire, un exemple et une action pratique.\n\nCONTRÔLE QUALITÉ\nVérifier l'exactitude, l'originalité, la lisibilité, l'accessibilité, les liens et les obligations professionnelles ou légales pertinentes avant la vente.`
      )
  );

  // 7. Création d'un produit numérique
  server.tool(
    "create_digital_product",
    "Prépare une première version structurée du contenu d'un produit numérique. Le contenu doit être complété et vérifié avant commercialisation.",
    {
      format: z.enum([
        "ebook",
        "guide",
        "workbook",
        "planner",
        "template_pack",
        "mini_course",
        "checklist"
      ]),
      topic: z.string().min(3).max(300),
      audience: z.string().min(2).max(250),
      outcome: z.string().min(3).max(400),
      length: z.enum(["short", "standard", "detailed"]).optional(),
      tone: z.enum(["friendly", "professional", "simple"]).optional()
    },
    async ({ format, topic, audience, outcome, length, tone }) =>
      result(
        `BRIEF DE CRÉATION\nFormat : ${format}\nSujet : ${topic}\nPublic : ${audience}\nRésultat visé : ${outcome}\nLongueur : ${length || "standard"}\nTon : ${tone || "simple"}\n\nCONTENU À PRODUIRE\n1. Titre et sous-titre précis.\n2. Introduction et mode d'emploi.\n3. Objectifs concrets.\n4. Sections détaillées, progressives et adaptées au public.\n5. Exemples concrets et exercices.\n6. Fiches pratiques ou modèles adaptés au format.\n7. Erreurs courantes et solutions.\n8. Plan d'action rapide.\n9. Résumé et prochaines étapes.\n10. Références pour les affirmations factuelles.\n\nEXIGENCES\nCréer un contenu original et utile, sans remplissage générique. Chaque partie doit contribuer au résultat visé. Pour un pack de modèles, décrire chaque modèle, ses champs et son mode d'emploi. Pour un cahier d'exercices, fournir des consignes claires.\n\nLIMITES\nCe brief n'est pas un fichier final prêt à vendre. Compléter le contenu, relire, tester les exercices et les liens, vérifier les faits et les droits d'utilisation avant publication.`
      )
  );

  // 8. Page de vente
  server.tool(
    "create_sales_page",
    "Rédige une page de vente honnête et persuasive sans inventer de témoignages, chiffres ou garanties.",
    {
      product: z.string().min(2).max(250),
      audience: z.string().min(2).max(250),
      benefits: z.string().min(3).max(1000),
      contents: z.string().max(1000).optional(),
      price: z.string().max(100).optional(),
      tone: z.enum(["friendly", "professional", "energetic"]).optional()
    },
    async ({ product, audience, benefits, contents, price, tone }) =>
      result(
        `PAGE DE VENTE\n\nTITRE\nUne ressource pratique pour les personnes qui souhaitent progresser.\n\nPRODUIT\n${product}\n\nPUBLIC CIBLE\n${audience}\n\nBÉNÉFICES\n${benefits}\n\nCONTENU INCLUS\n${contents || "Préciser les fichiers, sections, formats et bonus réellement inclus."}\n\nPOUR QUI ?\nCe produit s'adresse à : ${audience}.\n\nPRIX\n${price || "À fixer après comparaison des offres et calcul des coûts."}\n\nQUESTIONS FRÉQUENTES\n- Que reçoit exactement le client ? Décrire les fichiers réels.\n- Comment y accéder ? Expliquer la livraison et les prérequis.\n- Un support est-il inclus ? Indiquer la politique réelle.\n- Quelles sont les conditions de remboursement ? Décrire les conditions applicables.\n\nAPPEL À L'ACTION\nConsultez le contenu et vérifiez si cette ressource correspond à vos besoins.\n\nTon : ${tone || "friendly"}.\n\nAVANT PUBLICATION\nVérifier toutes les affirmations, les détails du produit, le prix et les conditions. Ne jamais inventer d'avis clients, de qualifications, de rareté ou de résultats garantis.`
      )
  );

  // 9. Stratégie de prix
  server.tool(
    "pricing_strategy",
    "Prépare une hypothèse de prix en tenant compte de la valeur client, de la concurrence et des coûts.",
    {
      product: z.string().min(2).max(250),
      audience: z.string().min(2).max(250),
      costs: z.string().max(500).optional(),
      competitorPrices: z.string().max(500).optional(),
      currency: z.string().max(10).optional()
    },
    async ({ product, audience, costs, competitorPrices, currency }) =>
      result(
        `STRATÉGIE DE PRIX\nProduit : ${product}\nPublic : ${audience}\nDevise : ${currency || "EUR"}\nCoûts connus : ${costs || "Non fournis"}\nPrix concurrents : ${competitorPrices || "Non vérifiés"}\n\n1. DÉFINIR LA VALEUR\nQuel problème précis le produit aide-t-il à résoudre ? Ne pas promettre de résultats non démontrés.\n\n2. COMPARER LES OFFRES\nÉtudier au moins cinq produits similaires : prix affiché, contenu, qualité, assistance et conditions de remboursement.\n\n3. CHOISIR UN PRIX DE TEST\nLe prix dépend du public, de la qualité, du contenu et de la concurrence. Ne pas considérer des fourchettes génériques comme des moyennes de marché vérifiées.\n\n4. CALCULER LA MARGE\nContribution par vente = prix − frais de plateforme − frais de paiement − coûts variables − taxes applicables.\n\n5. TESTER\nMesurer les visites qualifiées, les achats, les remboursements et les retours clients avant de modifier le prix.\n\nLes prix concurrents ne sont pas vérifiés par cet outil, sauf s'ils sont fournis en entrée. Toute recommandation reste une hypothèse jusqu'à validation.`
      )
  );

  // 10. Calculateur de rentabilité
  server.tool(
    "profit_calculator",
    "Calcule les revenus, les frais, la contribution nette et le seuil de rentabilité à partir des chiffres fournis.",
    {
      price: z.number().nonnegative(),
      sales: z.number().int().nonnegative(),
      platformFeePercent: z.number().min(0).max(100).default(0),
      paymentFeePercent: z.number().min(0).max(100).default(0),
      fixedCosts: z.number().nonnegative().default(0),
      variableCostPerSale: z.number().nonnegative().default(0),
      taxPerSale: z.number().nonnegative().default(0),
      currency: z.string().max(10).default("EUR")
    },
    async ({
      price,
      sales,
      platformFeePercent,
      paymentFeePercent,
      fixedCosts,
      variableCostPerSale,
      taxPerSale,
      currency
    }) => {
      const platformFee = price * platformFeePercent / 100;
      const paymentFee = price * paymentFeePercent / 100;
      const netPerSale =
        price - platformFee - paymentFee - variableCostPerSale - taxPerSale;
      const revenue = price * sales;
      const totalCosts =
        (platformFee + paymentFee + variableCostPerSale + taxPerSale) * sales +
        fixedCosts;
      const profit = revenue - totalCosts;
      const breakEven =
        netPerSale > 0 ? Math.ceil(fixedCosts / netPerSale) : null;
      const fmt = n => `${n.toFixed(2)} ${currency}`;

      return result(
        `ESTIMATION DE RENTABILITÉ\nPrix unitaire : ${fmt(price)}\nNombre de ventes : ${sales}\nChiffre d'affaires brut : ${fmt(revenue)}\nFrais de plateforme par vente : ${fmt(platformFee)}\nFrais de paiement par vente : ${fmt(paymentFee)}\nCoût variable par vente : ${fmt(variableCostPerSale)}\nTaxe saisie par vente : ${fmt(taxPerSale)}\nContribution nette par vente : ${fmt(netPerSale)}\nCoûts fixes : ${fmt(fixedCosts)}\nBénéfice estimé après les coûts renseignés : ${fmt(profit)}\nVentes nécessaires pour couvrir les coûts fixes : ${breakEven === null ? "Impossible avec ces données" : breakEven}\n\nLes pourcentages sont appliqués au prix unitaire. Les taxes ne sont pas calculées automatiquement. Les frais non renseignés sont exclus. Ce calcul n'est pas un conseil comptable ou fiscal.`
      );
    }
  );

  // 11. Plan de lancement
  server.tool(
    "create_launch_plan",
    "Prépare un plan de lancement réaliste avec validation, création, commercialisation et suivi des résultats.",
    {
      product: z.string().min(2).max(250),
      platform: z.string().max(150).optional(),
      timeframe: z.string().max(100).optional(),
      hoursPerWeek: z.number().positive().max(100).optional(),
      budget: z.string().max(150).optional()
    },
    async ({ product, platform, timeframe, hoursPerWeek, budget }) =>
      result(
        `PLAN DE LANCEMENT\nProduit : ${product}\nPlateforme : ${platform || "À comparer selon les frais et le public"}\nDurée : ${timeframe || "4 semaines"}\nTemps disponible : ${hoursPerWeek ? `${hoursPerWeek} heures/semaine` : "Non précisé"}\nBudget : ${budget || "Privilégier des méthodes gratuites"}\n\nPHASE 1 — VALIDATION\n- Définir le public et son problème précis.\n- Rechercher les offres concurrentes et noter les sources.\n- Interroger des clients potentiels et tester un aperçu.\n\nPHASE 2 — CRÉATION\n- Créer la version minimale réellement utile.\n- Relire et tester les fichiers, liens et instructions.\n- Recueillir des retours précis.\n\nPHASE 3 — VENTE\n- Comparer les frais et les règles des plateformes.\n- Préparer une page de vente exacte et des aperçus.\n- Tester l'achat et la livraison.\n- Vérifier les obligations fiscales, de confidentialité, de propriété intellectuelle et de consommation applicables.\n\nPHASE 4 — LANCEMENT\n- Publier du contenu utile là où la promotion est autorisée.\n- Montrer un exemple réel du produit.\n- Suivre les visites, ventes, remboursements et retours.\n- Améliorer l'offre à partir des données réelles.\n\nINDICATEURS\nSuivre le taux de conversion, le revenu net par vente, les remboursements, la satisfaction et le temps consacré. Les ventes ne sont pas garanties.`
      )
  );

  // 12. Contrôle qualité
  server.tool(
    "product_quality_check",
    "Vérifie une description ou un brouillon de produit numérique selon des critères de qualité, de clarté, de fiabilité et de préparation à la vente.",
    {
      productDescription: z.string().min(20).max(12000),
      audience: z.string().max(250).optional(),
      productType: z.string().max(100).optional()
    },
    async ({ productDescription, audience, productType }) =>
      result(
        `AUDIT QUALITÉ DU PRODUIT\nType : ${productType || "Non précisé"}\nPublic : ${audience || "Non précisé"}\n\nCONTENU À EXAMINER\n${productDescription}\n\nLISTE DE CONTRÔLE\n1. Le public cible est-il clairement défini ?\n2. Le produit répond-il à un problème précis ?\n3. La promesse est-elle réaliste ?\n4. Les livrables sont-ils décrits avec exactitude ?\n5. Les affirmations factuelles sont-elles appuyées par des sources fiables ?\n6. Le contenu est-il original et correctement autorisé ?\n7. L'orthographe, la lisibilité et l'accessibilité sont-elles satisfaisantes ?\n8. Les fichiers et les liens ont-ils été testés ?\n9. Les prix, conditions de remboursement et détails d'assistance sont-ils exacts ?\n10. Le produit final et son processus de livraison ont-ils été testés ?\n\nCette liste ne vérifie pas automatiquement tous les faits, fichiers, droits ou obligations légales. Une vérification humaine du produit final reste nécessaire.`
      )
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
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: req.body?.id ?? null
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
