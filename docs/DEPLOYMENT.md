# Deployment

Target: https://gtowncity.github.io/horizon-sunrise-analyzer/ . The public GitHub repository has Pages configured to build_type=workflow. The relative Vite base supports repository subpaths. Do not deploy the source root or private audit; only dist is uploaded.

The workflow runs npm ci, lint, typecheck, unit tests, production build, Chromium desktop/mobile E2E and npm audit before deploying. Pull requests validate without deploying. Verified official action majors on 2026-09-16: checkout v6, setup-node v7, configure-pages v5, upload-pages-artifact v4, deploy-pages v4.

To reproduce elsewhere: create a public repository, push main, and select GitHub Actions as Pages source (or use the repository Pages API). No access token belongs in frontend code. The app needs no backend, credentials or analytics service. CORS or ZIP-service availability can change independently of deployment.
