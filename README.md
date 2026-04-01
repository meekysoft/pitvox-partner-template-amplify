# PitVox Partner Template (Amplify)

A full-featured website template for PitVox partner communities with **Steam authentication**, **user dashboards**, and a **serverless AWS backend**. Built with React, Vite, Tailwind CSS, and [AWS Amplify Gen 2](https://docs.amplify.aws/).

Uses the [`@pitvox/partner-react`](https://github.com/meekysoft/pitvox-partner-react) SDK for leaderboards and competitions.

> Looking for a simpler static site with no backend? See the [Static Partner Template](https://github.com/meekysoft/pitvox-partner-template).

## What's included

| Page | Route | Auth required? |
|------|-------|----------------|
| Home | `/` | No |
| Competitions | `/competitions` | No |
| Leaderboards | `/leaderboards` | No |
| Dashboard | `/dashboard` | Yes |
| Auth complete | `/auth/complete` | — (callback) |
| Auth error | `/auth/error` | — (error display) |

**Backend infrastructure** (deployed automatically by Amplify):
- Cognito user pool with Steam OpenID authentication
- Steam auth Lambda with rate limiting (DynamoDB)
- Pre-token generation trigger for access token customization

## Prerequisites

- [Node.js](https://nodejs.org/) **22.x** (see important note below)
- An [AWS account](https://aws.amazon.com/) with Amplify access
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)
- Your PitVox partner slug (from your PitVox partner dashboard)

> **Important: Node version must match Amplify CI.** This template includes an `.nvmrc` file that pins Node 22, matching the Amplify build environment. Always use [nvm](https://github.com/nvm-sh/nvm) to ensure the correct version:
>
> ```bash
> nvm install 22   # first time only
> nvm use          # reads .nvmrc automatically
> ```
>
> If you generate `package-lock.json` with a different Node/npm version (e.g. Node 24 with npm 11), production deployments will fail with `npm ci` errors about mismatched lock files. Fix: delete `package-lock.json`, run `nvm use`, then `npm install` to regenerate it.

## Getting started

### 1. Create your repo

Click **"Use this template"** on GitHub, or clone manually:

```bash
git clone https://github.com/meekysoft/pitvox-partner-template-amplify.git my-community
cd my-community
rm -rf .git && git init
```

### 2. Install dependencies (use Node 22)

```bash
nvm use       # uses Node 22 from .nvmrc
npm install
```

### 3. Configure your partner slug

Open `src/App.jsx` and replace `"your-slug"` with your PitVox partner slug:

```jsx
<PitVoxPartnerProvider
  partnerSlug="my-community"
  getSteamId={() => user?.steamId || null}
>
```

### 4. Set up your Steam API key

Store your Steam Web API key as an Amplify secret:

```bash
npx ampx sandbox secret set STEAM_API_KEY
# Paste your key when prompted
```

### 5. Set your PitVox Partner API key

Your partner API key authenticates requests to the PitVox API. You can find it in your [PitVox partner dashboard](https://pitvox.com/partner/manage). Set it as an environment variable before starting the sandbox:

```bash
export PARTNER_API_KEY="your-partner-api-key"
```

### 6. Set your admin Steam IDs (optional)

Users whose Steam IDs are listed here will be added to the Cognito `admins` group on sign-in. The template doesn't include admin-specific UI out of the box, but the group is available for you to build admin features on top of (e.g. content management, moderation tools).

```bash
export ADMIN_STEAM_IDS="76561198012345678"
```

### 7. Start the Amplify sandbox

```bash
npx ampx sandbox
```

This deploys the backend (Cognito, Lambda, DynamoDB) to your AWS account and generates `amplify_outputs.json`. First run takes a few minutes.

### 8. Start the frontend

In a separate terminal:

```bash
npm run dev
```

### 9. Customise

- **Site name** — update `index.html` title, `Layout.jsx` navbar, and `Home.jsx` heading
- **Branding** — replace `public/favicon.svg` with your logo
- **Theme** — override SDK CSS variables in `src/index.css`:

```css
@import "tailwindcss";

:root {
  --pvx-accent: #e11d48;      /* your brand colour */
  --pvx-bg-card: #1a1a2e;     /* card background */
}
```

## Deploying to production

### Amplify Hosting (recommended)

1. Push your repo to GitHub
2. Go to the [Amplify Console](https://console.aws.amazon.com/amplify/)
3. Click **"New app"** → **"Host web app"** → connect your repo
4. Amplify auto-detects the framework and deploys both frontend and backend
5. Set environment variables in the Amplify console:
   - `PARTNER_API_KEY` — your PitVox partner API key
   - `SITE_URL` — your production URL (e.g. `https://my-community.com`)
   - `ADMIN_STEAM_IDS` — comma-separated admin Steam IDs (optional, for custom admin features)
6. Set the Steam API key secret:
   ```bash
   npx ampx sandbox secret set STEAM_API_KEY --branch main
   ```

### Other hosting

The backend always deploys via Amplify (it provisions AWS resources). The frontend can be hosted elsewhere:

1. Run `npx ampx pipeline-deploy` to deploy the backend
2. Run `npm run build` to build the frontend
3. Serve the `dist/` directory from any static host
4. Ensure `amplify_outputs.json` is included in the build

## Architecture

```
src/                           React frontend
├── components/Layout.jsx      Navbar with auth state
├── providers/AuthProvider.jsx Token management + session state
├── hooks/useAuth.js           Auth context hook
├── pages/
│   ├── Home.jsx               Landing page with Steam sign-in CTA
│   ├── Competitions.jsx       SDK CompetitionExplorer
│   ├── Leaderboards.jsx       SDK LeaderboardExplorer
│   ├── Dashboard.jsx          Authenticated user dashboard
│   └── auth/
│       ├── Complete.jsx       Token extraction from callback
│       └── Error.jsx          Auth error display
amplify/                       AWS Amplify Gen 2 backend
├── auth/resource.js           Cognito user pool definition
├── backend.js                 Infrastructure wiring (CDK)
└── functions/
    ├── steam-auth/            Steam OpenID → Cognito flow + rate limiting
    └── pre-token-generation/  Access token customization
```

## Steam authentication flow

1. User clicks "Sign in" → redirected to Steam login page
2. Steam redirects back to the Lambda function URL with OpenID assertion
3. Lambda validates the assertion, creates/updates Cognito user with Steam profile
4. Lambda redirects to `/auth/complete` with Cognito tokens in URL params
5. Frontend stores tokens in localStorage and syncs to Amplify's format
6. `getSteamId` prop on `PitVoxPartnerProvider` wires the authenticated Steam ID to the SDK

## Stack

- [Vite](https://vite.dev/) 7 — build tool
- [React](https://react.dev/) 19 — UI framework
- [Tailwind CSS](https://tailwindcss.com/) 4 — utility-first styling
- [React Router](https://reactrouter.com/) 7 — client-side routing
- [TanStack Query](https://tanstack.com/query) 5 — data fetching (used by the SDK)
- [AWS Amplify](https://docs.amplify.aws/) Gen 2 — serverless backend
- [`@pitvox/partner-react`](https://github.com/meekysoft/pitvox-partner-react) — PitVox SDK

## License

MIT
