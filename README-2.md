# Serveur MCP distant pour Claude — produits numériques

Ce projet est conçu pour être hébergé comme service web Node.js. Il expose un endpoint MCP Streamable HTTP à `/mcp`.

## Outils
- `market_research_plan`
- `digital_product_outline`
- `pricing_calculator`
- `sales_copy_framework`
- `seo_keyword_plan`
- `social_content_calendar`
- `email_sequence`
- `licensing_compliance_checklist`

Ces outils produisent des plans et modèles. Ils ne font pas de recherche web en direct, ne publient pas de contenu et n'envoient pas d'e-mails.

## Déploiement sur Render
1. Crée un dépôt GitHub et ajoute `package.json` et `index.js` à la racine.
2. Sur Render, crée un **Web Service** à partir de ce dépôt.
3. Build Command : `npm install`
4. Start Command : `npm start`
5. Une fois le déploiement réussi, copie l'URL fournie par Render et ajoute `/mcp` à la fin. Exemple fictif : `https://mon-serveur.onrender.com/mcp` (ne pas utiliser cette URL d'exemple).
6. Dans Claude : Customize / Connectors / Add custom connector, saisis un nom et cette URL.

Le service n'a pas d'authentification intégrée. Pour un usage privé ou commercial, ajoute une authentification avant d'y mettre des données sensibles. Ne place jamais de secrets ou clés API dans le dépôt.
