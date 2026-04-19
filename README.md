# DevHaven Studio (Portfolio + Academy)

Static HTML/CSS/JS portfolio site with:
- Academy directory (`/academy/`) with add-to-cart
- Checkout page with Paystack (via Netlify Functions)
- AI chatbot (via Netlify Function calling OpenAI)

## Deploy (Netlify + GitHub)

1. Push this repo to GitHub
2. In Netlify: Add new site -> Import an existing project -> GitHub
3. Set environment variables in Netlify:
   - `PAYSTACK_SECRET_KEY` (secret)
   - `OPENAI_API_KEY` (secret)

Netlify will read `netlify.toml` for `publish` + `functions`.
