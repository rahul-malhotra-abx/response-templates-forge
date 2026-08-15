import Resolver from "@forge/resolver";
import api, { assumeTrustedRoute, getAppContext, route } from "@forge/api";

const resolver = new Resolver();

/**
 * `context.license` is only populated for a paid app in production, so an absent licence means "not
 * production" far more often than it means "unlicensed" — reading absence as unlicensed would lock
 * every development install out of its own data. Present: trust it, which is also what
 * `forge install --license inactive` produces. Absent: only fatal in production.
 */
function isLicenseActive(license, environmentType) {
  if (license) {
    return license.active !== false;
  }

  return String(environmentType || "").toUpperCase() !== "PRODUCTION";
}

/**
 * Unlicensed is read-only rather than shut out: templates stay readable and only writes stop. The
 * modules are already hidden from unlicensed users by Forge itself, so this catches the licence
 * that lapses under someone mid-session.
 */
function assertLicensed(context) {
  let environmentType = "";
  try {
    environmentType = getAppContext()?.environmentType || "";
  } catch (_error) {
    environmentType = "";
  }

  if (!isLicenseActive(context?.license, environmentType)) {
    throw new Error(
      "Your Response Templates for Jira licence is not active, so changes cannot be saved.",
    );
  }
}

function truncateForLog(value, maxLength = 1200) {
  if (value === undefined || value === null) {
    return value;
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  if (stringValue.length <= maxLength) {
    return stringValue;
  }

  return `${stringValue.slice(0, maxLength)}...<truncated>`;
}

async function parseJiraErrorBody(response) {
  const text = await response.text();
  if (!text || !text.trim()) {
    return { text: "", parsed: null };
  }

  try {
    return { text, parsed: JSON.parse(text) };
  } catch (_error) {
    return { text, parsed: null };
  }
}

function buildJiraErrorMessage(status, parsed, text) {
  if (parsed && typeof parsed === "object") {
    const errorMessages = Array.isArray(parsed.errorMessages)
      ? parsed.errorMessages.filter(Boolean)
      : [];
    const fieldErrors =
      parsed.errors && typeof parsed.errors === "object"
        ? Object.entries(parsed.errors).map(([field, message]) => {
            return `${field}: ${String(message)}`;
          })
        : [];

    const combined = [...errorMessages, ...fieldErrors]
      .filter(Boolean)
      .join(" | ");
    if (combined) {
      return `Jira API error ${status}: ${combined}`;
    }
  }

  return `Jira API error ${status}: ${text || "Unknown Jira API error."}`;
}

function logJiraApiError(response, text, parsed, metadata = {}) {
  const { context = {}, operation, method, url } = metadata;
  const extension = context?.extension || {};

  console.error("Jira API request failed", {
    operation: operation || "resolver",
    status: response?.status,
    method: method || null,
    url: url || null,
    moduleKey: extension?.moduleKey ?? context?.moduleKey ?? null,
    extensionType: extension?.type ?? context?.type ?? null,
    projectId: extension?.project?.id ?? context?.project?.id ?? null,
    issueKey: extension?.issue?.key ?? context?.issue?.key ?? null,
    errorMessages: Array.isArray(parsed?.errorMessages)
      ? parsed.errorMessages
      : undefined,
    errors: parsed?.errors,
    responseBody: parsed ?? truncateForLog(text),
  });
}

async function parseJsonResponse(response, metadata = {}) {
  if (!response.ok) {
    const { text, parsed } = await parseJiraErrorBody(response);
    logJiraApiError(response, text, parsed, metadata);
    throw new Error(buildJiraErrorMessage(response.status, parsed, text));
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(
      `Jira API returned invalid JSON for status ${response.status}.`,
    );
  }
}

async function parseAnyResponse(response, metadata = {}) {
  if (!response.ok) {
    const { text, parsed } = await parseJiraErrorBody(response);
    logJiraApiError(response, text, parsed, metadata);
    throw new Error(buildJiraErrorMessage(response.status, parsed, text));
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new Error(
        `Jira API returned invalid JSON for status ${response.status}.`,
      );
    }
  }

  return text;
}

async function parseResponseWithoutThrow(response) {
  const text = await response.text();
  let parsed = null;
  if (text && text.trim()) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(text);
      } catch (_error) {
        parsed = text;
      }
    } else {
      parsed = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    value: parsed?.value,
    raw: parsed,
  };
}

resolver.define("healthCheck", async ({ context }) => {
  return {
    ok: true,
    moduleKey: context?.extension?.moduleKey ?? null,
    projectId: context?.extension?.project?.id ?? null,
    message: "Response Templates Forge resolver is running.",
  };
});

resolver.define("getForgeContext", async ({ context }) => {
  return context;
});

resolver.define("getCurrentJiraUser", async () => {
  const response = await api.asUser().requestJira(route`/rest/api/3/myself`);
  return await parseJsonResponse(response);
});

resolver.define("getUserPermissions", async ({ payload }) => {
  const permissions = Array.isArray(payload?.permissions)
    ? payload.permissions
    : [];
  const projectIdOrKey = payload?.projectIdOrKey;

  const queryParams = new URLSearchParams({
    permissions: permissions.join(","),
  });
  // Project permissions such as ADMINISTER_PROJECTS cannot be evaluated without a project to
  // evaluate them against; without this, administering any one project read as admin everywhere.
  if (projectIdOrKey) {
    const isNumericId = /^\d+$/.test(`${projectIdOrKey}`);
    queryParams.append(
      isNumericId ? "projectId" : "projectKey",
      `${projectIdOrKey}`,
    );
  }

  const response = await api
    .asUser()
    .requestJira(
      assumeTrustedRoute(`/rest/api/3/mypermissions?${queryParams.toString()}`),
    );
  return await parseJsonResponse(response);
});

resolver.define("getProjectSettings", async ({ payload }) => {
  const projectIdOrKey = payload?.projectIdOrKey;
  const storageKey = payload?.storageKey;

  const response = await api
    .asUser()
    .requestJira(
      route`/rest/api/3/project/${projectIdOrKey}/properties/${storageKey}`,
    );

  if (response.status === 404) {
    return undefined;
  }

  const data = await parseJsonResponse(response);
  return data?.value;
});

resolver.define("saveProjectSettings", async ({ payload, context }) => {
  assertLicensed(context);

  const projectIdOrKey = payload?.projectIdOrKey;
  const storageKey = payload?.storageKey;
  const projectSettings = payload?.projectSettings;

  const response = await api
    .asUser()
    .requestJira(
      route`/rest/api/3/project/${projectIdOrKey}/properties/${storageKey}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectSettings),
      },
    );

  await parseJsonResponse(response);
  return { ok: true };
});

resolver.define("getAllProjects", async ({ payload }) => {
  const projectQuery = payload?.projectQuery;
  const maxResults = payload?.maxResults || 50;
  const startAt = payload?.startAt || 0;
  const projectSettingsStorageKey = payload?.projectSettingsStorageKey;

  const queryParams = new URLSearchParams({
    maxResults: `${maxResults}`,
    startAt: `${startAt}`,
    expand: "lead",
    orderBy: "name",
    properties: projectSettingsStorageKey,
  });
  if (projectQuery) {
    queryParams.append("query", projectQuery);
  }

  const response = await api
    .asUser()
    .requestJira(
      assumeTrustedRoute(
        `/rest/api/3/project/search?${queryParams.toString()}`,
      ),
    );

  return await parseJsonResponse(response);
});

// Comments and description edits are issued from the UI with @forge/bridge `requestJira`, so
// Jira attributes them to the logged in user. Posting them here would run as the app instead.

resolver.define("jiraRequest", async ({ payload, context }) => {
  const originalUrl = payload?.url;
  const method = payload?.type || payload?.method || "GET";
  const contentType = payload?.contentType || "application/json";
  const data = payload?.data;

  if (!originalUrl || typeof originalUrl !== "string") {
    throw new Error("Invalid request: url is required.");
  }

  const url =
    originalUrl.startsWith("/rest/api/3/search") &&
    !originalUrl.startsWith("/rest/api/3/search/jql")
      ? originalUrl.replace("/rest/api/3/search", "/rest/api/3/search/jql")
      : originalUrl;

  // App property routes are deliberately absent: they have dedicated resolvers because the app's
  // own property store has no user context to act in.
  const allowedPrefixes = ["/rest/api/3/"];
  const isAllowed = allowedPrefixes.some((prefix) => url.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(`Unsupported Jira path: ${url}`);
  }

  // Always the user: acting as the app let a caller read any issue or project it named, whether or
  // not the person driving the UI could see it.
  const trustedRoute = assumeTrustedRoute(url);
  const response = await api.asUser().requestJira(trustedRoute, {
    method,
    headers: {
      "Content-Type": contentType,
    },
    body: data,
  });

  return await parseAnyResponse(response, {
    operation: "jiraRequest",
    method,
    url,
    context,
  });
});

resolver.define("getProjectProperties", async ({ payload }) => {
  const projectIdOrKey = payload?.projectIdOrKey;
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const responseProperties = {};

  for (let i = 0; i < properties.length; i += 5) {
    const chunk = properties.slice(i, i + 5);
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/project/${projectIdOrKey}?properties=${chunk.join(",")}`,
      );

    const data = await parseJsonResponse(response);
    Object.assign(responseProperties, data?.properties ?? {});
  }

  return responseProperties;
});

resolver.define("saveProjectProperties", async ({ payload, context }) => {
  assertLicensed(context);

  const projectIdOrKey = payload?.projectIdOrKey;
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];

  for (const property of properties) {
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/project/${projectIdOrKey}/properties/${property.key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(property.value),
        },
      );
    await parseJsonResponse(response);
  }

  return { ok: true };
});

resolver.define("getIssueProperties", async ({ payload }) => {
  const issueIdOrKey = payload?.issueIdOrKey;
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const responseProperties = {};

  for (let i = 0; i < properties.length; i += 5) {
    const chunk = properties.slice(i, i + 5);
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/issue/${issueIdOrKey}?properties=${chunk.join(",")}`,
      );

    const data = await parseJsonResponse(response);
    Object.assign(responseProperties, data?.properties ?? {});
  }

  return responseProperties;
});

resolver.define("saveIssueProperties", async ({ payload, context }) => {
  assertLicensed(context);

  const issueIdOrKey = payload?.issueIdOrKey;
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];

  for (const property of properties) {
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/issue/${issueIdOrKey}/properties/${property.key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(property.value),
        },
      );
    await parseJsonResponse(response);
  }

  return { ok: true };
});

resolver.define("getUserProperties", async ({ payload }) => {
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const accountId = payload?.accountId;
  const result = {};

  for (const propertyKey of properties) {
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/user/properties/${propertyKey}?accountId=${accountId}`,
      );

    if (response.status === 404) {
      continue;
    }

    const data = await parseJsonResponse(response);
    result[data.key] = data.value;
  }

  return result;
});

resolver.define("saveUserProperties", async ({ payload, context }) => {
  assertLicensed(context);

  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const accountId = payload?.accountId;

  for (const property of properties) {
    const response = await api
      .asUser()
      .requestJira(
        route`/rest/api/3/user/properties/${property.key}?accountId=${accountId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(property.value),
        },
      );
    await parseJsonResponse(response);
  }

  return { ok: true };
});

/**
 * Global templates live in the app's own property store, which has no user context to act in, so
 * `asApp()` is unavoidable for those writes and Jira cannot police them. This stands in for that:
 * the adminPage module being admin-only is a UI gate, not an authorization check.
 */
async function assertJiraAdmin(operation) {
  const response = await api
    .asUser()
    .requestJira(
      assumeTrustedRoute("/rest/api/3/mypermissions?permissions=ADMINISTER"),
    );
  const data = await parseJsonResponse(response, { operation });

  if (!data?.permissions?.ADMINISTER?.havePermission) {
    throw new Error(
      "Jira administrator rights are required to change global templates.",
    );
  }
}

async function saveForgeAppProperties(properties) {
  for (const property of properties) {
    const response = await api
      .asApp()
      .requestJira(route`/rest/forge/1/app/properties/${property.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(property.value),
      });
    await parseJsonResponse(response);
  }
}

/**
 * Global templates were written to the Connect add-on property store before the migration, and
 * Forge writes to its own. Never fatal: a legacy store that refuses the request — the Connect key is
 * gone, or was never ours — must leave the caller on Forge data rather than take the screen down.
 */
async function readLegacyAppProperty(addonKey, propertyKey) {
  try {
    const response = await api
      .asApp()
      .requestJira(
        route`/rest/atlassian-connect/1/addons/${addonKey}/properties/${propertyKey}`,
      );

    if (!response.ok) {
      return undefined;
    }

    const data = await parseJsonResponse(response);
    return data?.value;
  } catch (error) {
    console.error("Legacy app property read failed", {
      propertyKey,
      message: error?.message,
    });
    return undefined;
  }
}

resolver.define("getAppProperties", async ({ payload }) => {
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const addonKey = payload?.addonKey || "com.appbox.ai.response.templates";
  const result = {};
  const carriedOver = [];

  for (const propertyKey of properties) {
    const forgeResponse = await api
      .asApp()
      .requestJira(route`/rest/forge/1/app/properties/${propertyKey}`);

    if (forgeResponse.status !== 404) {
      const data = await parseJsonResponse(forgeResponse);
      result[data.key] = data.value;
      continue;
    }

    const legacyValue = await readLegacyAppProperty(addonKey, propertyKey);
    if (legacyValue !== undefined) {
      result[propertyKey] = legacyValue;
      carriedOver.push({ key: propertyKey, value: legacyValue });
    }
  }

  // Copy what the legacy store still holds into the Forge store, so the fallback stops running once
  // a site has been read through. Idempotent: concurrent readers write the same bytes.
  if (carriedOver.length > 0) {
    try {
      await saveForgeAppProperties(carriedOver);
    } catch (error) {
      // The read itself succeeded — the next read simply falls back again.
      console.error("Copying legacy app properties forward failed", {
        message: error?.message,
      });
    }
  }

  return result;
});

resolver.define("saveAppProperties", async ({ payload, context }) => {
  assertLicensed(context);

  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];

  await assertJiraAdmin("saveAppProperties");
  await saveForgeAppProperties(properties);

  return { ok: true };
});

resolver.define("probeAppPropertyMigration", async ({ payload }) => {
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const addonKey = payload?.addonKey || "com.appbox.ai.response.templates";

  await assertJiraAdmin("probeAppPropertyMigration");

  const results = [];

  for (const propertyKey of properties) {
    const forgeResponse = await api
      .asApp()
      .requestJira(route`/rest/forge/1/app/properties/${propertyKey}`);
    const forge = await parseResponseWithoutThrow(forgeResponse);

    let legacy;
    try {
      const legacyResponse = await api
        .asApp()
        .requestJira(
          route`/rest/atlassian-connect/1/addons/${addonKey}/properties/${propertyKey}`,
        );
      legacy = await parseResponseWithoutThrow(legacyResponse);
    } catch (error) {
      legacy = {
        ok: false,
        status: null,
        value: null,
        raw: null,
        error: error?.message || "Unknown error",
      };
    }

    results.push({
      propertyKey,
      forge,
      legacy,
    });
  }

  return {
    addonKey,
    results,
  };
});

export const handler = resolver.getDefinitions();
