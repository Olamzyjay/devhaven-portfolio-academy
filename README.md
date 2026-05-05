# DevHaven Studio (Portfolio + Academy)

Static HTML/CSS/JS portfolio site with:
- Academy directory (`/academy/`) with add-to-cart
- Checkout page with Paystack (via Vercel API routes)
- AI chatbot (via Vercel API route calling OpenAI)

## Deploy (Vercel + GitHub)

1. Push this repo to GitHub
2. In Vercel: Add New Project -> Import the GitHub repository
3. Set environment variables in Vercel:
   - `PAYSTACK_SECRET_KEY` (secret)
   - `OPENAI_API_KEY` (secret)
   - `OPENAI_MODEL` (optional, default: `gpt-4.1-mini`)

Vercel will serve the static pages and the `api/` folder automatically.
