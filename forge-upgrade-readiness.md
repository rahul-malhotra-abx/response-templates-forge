# Forge upgrade readiness (paid, in-place upgrade of existing Connect installs)

Scope: existing customers of the Connect app `com.appbox.ai.response.templates` upgrade in
place to the Forge app. Paid only. All data must survive. No code changes in this PR — this is
the checklist and the evidence behind each item.

Baseline for comparison: `../response-templates` (Connect source) and
`../response-templates/src/assets/response-templates-atlassian-connect.json` (descriptor).

## What already carries over — no work needed

Connect `StorageService` and Forge `StorageService` build byte-identical property keys
(`com.appbox.ai.response.templates-<thing>_<n>`), and Connect wrote through `AP.request`, which
runs as the signed-in user — the same context Forge `asUser()` gives us. So project templates,
personal templates, issue properties and user signatures all read back unchanged, with the same
permissions as before. No regression, no migration step.

The one exception is global templates. See item 3.

---

## 1. Drop `manage:jira-project` — BLOCKER for a silent upgrade

`manage:jira-project` maps to the Connect scope `PROJECT_ADMIN`, which the Connect descriptor
never declared (it has `READ`, `WRITE`, `DELETE`). Requesting it is a privilege escalation, which
makes the update ineligible for bulk/auto upgrade: every customer's Jira admin has to approve
manually, and until they do they stay on Connect.

It is not needed. The production Connect app performs every operation this app performs —
project property GET/PUT, `project/search?properties=`, `mypermissions`, issue properties, issue
PUT, comment POST, user properties, `jql/match`, `field`, `user/picker` — under
`READ`/`WRITE`/`DELETE` alone. If any of them required `PROJECT_ADMIN`, the Connect app would
already be failing in production. The only endpoint Forge adds is `/rest/forge/1/app/properties`,
which is Forge-native and takes no Jira scope.

`read:jira-user` and `read:avatar:jira` both map to Connect `READ` — keep them.

- [ ] Remove `manage:jira-project` from `manifest.yml`, `manifest.paid.yml`, `manifest.free.yml`
- [ ] Confirm the resulting scope set is a subset of Connect `READ`/`WRITE`/`DELETE`
- [ ] Confirm with `forge lint` / a test install that the upgrade no longer prompts for consent

## 2. Licensing: `ALLOW_UNLICENSED` should be `false`, and the manifest must agree

Intent is that unlicensed users cannot use the app.

- [ ] Set `ALLOW_UNLICENSED: false` in `environment.base.ts` for both variants
- [ ] Leave `unlicensedAccess` out of the manifest — Forge's default already hides modules from
      unlicensed and anonymous users, which is the behaviour we want
- [ ] Note the behaviour change for support: in Connect these users saw the module and hit a
      wall inside it; in Forge the module is simply absent

Blocker on the rollout, not on the code: **installs with a suspended licence cannot update to
Forge at all** until the customer resubscribes. Pull that list before release and handle it as a
separate comms track.

## 3. Global templates — the only real data-loss risk

Connect stored them in the Connect add-on property store
(`/rest/atlassian-connect/1/addons/com.appbox.ai.response.templates/properties/...`). Forge
writes to `/rest/forge/1/app/properties/`. Same key names, different store.

There is **no bulk export anywhere in the product** to fall back on. The global templates admin
screen has per-template "Clone" only (duplicates within the same list). "Import Templates" on
the project screen imports from *another project*, not from global. So if the read-across fails,
there is no customer-side recovery path.

`getAppProperties` in `src/index.js` reads the legacy store when the Forge key 404s, but this is
unproven against a real migrated instance and has two defects:

- It only guards `status !== 404`. A `401`/`403` from the legacy endpoint throws out of
  `parseJsonResponse` and takes the whole Global Templates screen down, rather than degrading to
  an empty list.
- It is a permanent read-through, not a migration. Every read hits both stores forever, until an
  admin happens to save.

- [ ] Run `probeAppPropertyMigration` on a **migrated** sandbox — not a fresh Forge install — and
      record whether the legacy read succeeds. Everything below depends on the answer.
- [ ] If it succeeds: replace the read-through with a one-time copy-forward (read legacy → write
      Forge → stop looking), and make a non-404 legacy failure degrade instead of throw
- [ ] If it fails: we need a fallback plan before release — most likely an export/import path in
      the Connect app shipped ahead of the Forge cutover
- [ ] Either way: make the legacy read non-fatal

The chunk merge itself is safe. `mergeJiraDataKeys` reads `totalSize` off `_0`, and after the
first Forge save `_0` is always the Forge copy, so leftover legacy chunks are skipped.

## 4. `entityPropertyEqualTo` against a boolean — test before release

`responseTemplatesEnabled` is stored as a JSON boolean (`true`/`false`). Both the Connect
descriptor and the Forge manifest compare it to the *string* `"true"`. Connect's condition
evaluator coerced the two; Forge's is a different implementation and may not.

If Forge does not coerce, the comparison never matches, and the app falls back to the other half
of the `or` — "no settings property exists". Projects that were explicitly enabled *or*
explicitly disabled both have the property, so both fail the `or` entirely and lose the module.
Projects never touched keep it.

- [ ] Test three projects on a migrated instance: `responseTemplatesEnabled: true` (module must
      show), `false` (must stay hidden), and never configured (must show)
- [ ] If the string comparison fails, switch the manifest to `value: true`

## 5. Remove the dead analytics code

Analytics cannot work in Forge: no GTM tag in `index.html`, so `window.dataLayer` is never an
array and `isAnalyticsEnabled()` is permanently false. Loading GTM would need a CSP declaration
we do not have, and `getParentDomain()` now returns the Forge CDN origin instead of the customer
site, so the `customer` dimension would be wrong anyway.

- [ ] Delete `services/analytical.service.ts` and every `AnalyticalService` call site
- [ ] Delete `UtilsService.getParentDomain()` (only caller) and the `window['AP']` reference in it
- [ ] Drop `ANALYTICS_ENABLED` from `environment.base.ts`
- [ ] Also dead: `JiraService.getDashboardProperties` / `saveDashboardProperties` and
      `StorageContext.DASHBOARD` — there is no dashboard gadget module in the manifest

## 6. License enforcement — nothing exists to copy

There is no license enforcement in this app, and none in `test-management-for-jira-forge` either
(that manifest has no `licensing` block at all). It has to be written from scratch.

With item 2 done, Forge hides the modules from unlicensed users, so the remaining gap is the
in-app state: trial expiry, grace periods, and anything that should read `context.license`.

- [ ] Decide whether module-level hiding is sufficient for v1
- [ ] If not, read the license from the Forge context in the resolver and gate writes

## 7–9. Confirmed non-issues

- **appbox.ai infrastructure stays.** The template editor iframe (`jira-editor.appbox.ai`) and
  the module icons (`response-templates.appbox.ai`) remain external. Accepted. Consequence to
  record: no "Runs on Atlassian" badge, and the data-security self-assessment still declares
  template content leaving Atlassian.
- **Lifecycle hooks.** Connect `/api/installed` and `/api/uninstalled` stop firing after
  registration. Nothing was being done in them. No action. Worth telling support that the upgrade
  appears in customer audit logs as a *new installation*, not an update.
- **Round-trip amplification.** Correction to the earlier estimate: the legacy fallback is
  conditional, but the Forge reads are not. `getAppProperties` always issues 15 sequential calls
  and adds up to 15 more only for keys that 404 — which today is all of them, so 30 until the
  first save. `getUserProperties` always issues 15; Connect listed the keys first and fetched only
  the ones that existed. Both are on the ticket-panel load path.
  - [ ] Short-circuit both on `totalSize` from `_0` — typical payloads are one chunk

## 10. Release notes

- Issue panel moved: Connect rendered in the left context area of the issue view; Forge renders
  as an issue panel. The "Add Response" button is now an issue action menu item.
- The two admin pages (Project Enablement, Global Templates) are one page with tabs. Deliberate.
  Old deep links break.
- No free variant ships. `manifest.free.yml` and the `*:free` scripts stay unused; the hardcoded
  paid `addonKey` default in `getAppProperties`/`probeAppPropertyMigration` is therefore fine as
  written.
