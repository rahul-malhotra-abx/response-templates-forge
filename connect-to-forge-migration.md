# Connect → Forge Migration Playbook (Angular Apps)

> Purpose: A repeatable migration strategy usable for any Appbox.ai Atlassian Connect app when converting to Forge.
> This document is written for automated assistance (Copilot) and human developers.

---

# 0. Migration Philosophy (VERY IMPORTANT)

We are NOT rewriting the product.
We are progressively transforming architecture in 3 stages:

1. Connect → Forge Remote (bridge compatibility stage)
2. Hybrid (remove server responsibilities)
3. Pure Forge (final state)

This allows large Connect apps to migrate safely without breaking customers.

---

# 1. Workspace Structure

VS Code workspace contains 3 folders (USER MUST FILL NAMES):

```
workspace/
  <FORGE_REFERENCE_APP>/          -> existing Forge app used as architecture reference
  <CONNECT_SOURCE_APP>/           -> Connect app being migrated
  <MIGRATION_CONTROL_FOLDER>/
      connect-to-forge-migration.md
      manifest.yml (temporary remote connect manifest)
```

Fill these placeholders before starting migration:

| Placeholder                | Example                     | Purpose                        |
| -------------------------- | --------------------------- | ------------------------------ |
| <FORGE_REFERENCE_APP>      | GPT-for-Jira                | Shows correct Forge patterns   |
| <CONNECT_SOURCE_APP>       | response-templates-for-jira | Source behavior reference      |
| <MIGRATION_CONTROL_FOLDER> | migration-control           | Where Copilot evolves manifest |

Rules for Copilot:

- <FORGE_REFERENCE_APP> is the architecture reference
- <CONNECT_SOURCE_APP> is legacy behavior reference
- <MIGRATION_CONTROL_FOLDER>/manifest.yml evolves toward full Forge
- Never introduce new backend servers

---

# 2. The Connect → Forge Utility Output (Remote Connect Mode)

The Atlassian conversion utility generates a Forge manifest that still uses **Connect Remote**.

This is NOT the final architecture.
It is only a compatibility bridge so the app can install as Forge while still behaving like Connect.

Meaning:

```
Forge app
   ↳ proxies to existing Connect server
      ↳ Angular served remotely
```

Goal: eliminate the remote dependency step‑by‑step.

Copilot must gradually:

1. Move UI into Forge Custom UI
2. Move backend endpoints into resolvers
3. Replace JWT/session logic
4. Remove connect remote block entirely

Final manifest must contain ZERO connect modules.

---

# 3. Core Architecture Difference

## Connect

Jira loads YOUR website inside iframe
Routing handled by server
Descriptor controls navigation

## Forge

Jira loads STATIC bundle from Atlassian CDN
App routes internally
Manifest controls entry points only

Therefore:

**Connect URL routing becomes Angular runtime routing**

---

# 4. Angular Routing Migration

## Connect behavior

```
/index.html?projectKey=${project.key}#/project/${project.id}/templates
```

## Forge behavior

Jira loads bundle → Angular reads context → Angular navigates

Install bridge:

```
npm install @forge/bridge
```

Read context:

```ts
import { view } from "@forge/bridge";

export async function getContext() {
  return await view.getContext();
}
```

Bootstrap routing:

```ts
const ctx = await getContext();
router.navigate([`/project/${ctx.extension.project.id}/templates`]);
```

Rule: Jira never decides Angular routes anymore.

---

# 5. Multiple Sidebar Pages Strategy

In Connect: many modules → many URLs

In Forge: many modules → SAME bundle → internal routing

```
const ctx = await view.getContext();
switch(ctx.extension.moduleKey) {
  case 'templates': router.navigate(['/templates']); break;
  case 'reports': router.navigate(['/reports']); break;
}
```

Never create separate Angular builds per module.

---

# 6. Backend Migration (Server → Resolver)

Connect flow:

Frontend → Express → Jira REST

Forge flow:

Frontend → Resolver → Jira REST

Example resolver:

```ts
import Resolver from "@forge/resolver";
import api, { route } from "@forge/api";

const resolver = new Resolver();

resolver.define("searchIssues", async ({ context }) => {
  const res = await api
    .asApp()
    .requestJira(
      route`/rest/api/3/search?jql=project=${context.extension.project.key}`,
    );
  return await res.json();
});

export const run = resolver.getDefinitions();
```

Frontend call:

```ts
import { invoke } from "@forge/bridge";
await invoke("searchIssues");
```

Remove Express endpoints after migration.

---

# 7. Entity Properties (CRITICAL — DO NOT CHANGE DATA MODEL)

All Appbox apps already store data using Jira Entity Properties.
This architecture MUST remain identical in Forge.

We are only changing authentication layer, not persistence model.

Supported entities:

- issue properties
- project properties
- user properties
- app properties

---

## Connect Implementation (reference)

Server used JWT to call REST API.

## Forge Implementation (replacement)

Use Forge API directly.

### Issue Property

```ts
await api
  .asApp()
  .requestJira(route`/rest/api/3/issue/${issueKey}/properties/myKey`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
```

### Project Property

```ts
await api
  .asApp()
  .requestJira(route`/rest/api/3/project/${projectKey}/properties/myKey`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
```

### User Property

```ts
await api.asUser().requestJira(route`/rest/api/3/user/properties/myKey`, {
  method: "PUT",
  body: JSON.stringify(data),
});
```

### App Property

```ts
await api.asApp().requestJira(route`/rest/forge/1/app/properties/myKey`, {
  method: "PUT",
  body: JSON.stringify(data),
});
```

RULES:

- Never introduce database
- Never migrate stored data
- Keep property keys unchanged
- Only replace authentication mechanism

---

# 8. Authentication Removal

Delete from codebase:

- JWT validation
- shared secret handling
- qsh validation
- session cookies
- user impersonation headers

Forge automatically authenticates using:

```
asApp()
asUser()
```

---

# 9. Angular Code Placement & Static Build Strategy

## Target Structure (MANDATORY)

The Forge app WILL contain the Angular project itself.
We keep source and build output together inside static so Forge owns the UI.

```
forge-app/
  manifest.yml
  src/                         -> resolvers only
  static/
    forge-angular-app/
      src/                     -> full Angular source code
      dist/                    -> compiled build output (served by Forge)
      angular.json
      package.json
```

Important:

- Forge serves ONLY files from `dist/`
- `src/` exists for development convenience
- Angular is built locally inside the Forge repo
- No external UI hosting remains in final state

Copilot rules:

- Never put Angular code inside resolver src/
- Never reference files outside static/ at runtime
- Only dist/ is referenced by manifest resources

---

## Manifest Resource Example

```
resources:
  - key: main
    path: static/forge-angular-app/dist
```

---

## Build Command Requirements

Angular must be iframe safe.

```
npm install
ng build --configuration production --base-href ./ --deploy-url ./
```

Why:

- Forge serves from relative path
- No root domain access
- Absolute paths break inside Jira iframe

---

## Router Requirement

Strongly recommended:

```ts
RouterModule.forRoot(routes, { useHash: true });
```

Reason:
Forge does not control browser path rewriting.
Hash routing prevents 404 issues.

---

## Development Workflow During Migration

Stage 1 (Remote Mode):
Angular served from Connect server.

Stage 2 (Hybrid):
Angular copied into static/forge-angular-app and built locally.
Some backend still remote.

Stage 3 (Pure Forge):
Angular fully served from Forge dist/.
All backend logic in resolvers.
No external hosting.

---

## Recommended Scripts

Inside forge-app package.json:

```
"scripts": {
  "ui:install": "cd static/forge-angular-app && npm install",
  "ui:build": "cd static/forge-angular-app && ng build --configuration production --base-href ./ --deploy-url ./"
}
```

---

# 10. Migration Procedure (Algorithm for Copilot)

For each Connect module:

1. Keep behavior
2. Move UI to Custom UI
3. Replace API calls with invoke()
4. Replace server endpoint with resolver
5. Replace JWT calls with Forge API
6. Verify entity properties still work
7. Delete old endpoint

After all modules migrated:

Remove connect remote section from manifest.

---

# 11. Final Mental Model

Connect = hosted website embedded in Jira
Forge = distributed extension running inside Jira

We are transforming a SaaS integration into a platform extension.

UI moves to Atlassian
Logic moves to resolvers
Data stays in Jira entity properties
