import Resolver from "@forge/resolver";
import api, { assumeTrustedRoute, getAppContext, route } from "@forge/api";
import { kvs } from "@forge/kvs";

const resolver = new Resolver();

/** `context.license` is only populated for a paid app in production, so absence is only fatal there. */
function isLicenseActive(license, environmentType) {
  if (license) {
    return license.active !== false;
  }

  return String(environmentType || "").toUpperCase() !== "PRODUCTION";
}

/** Read-only rather than shut out — this catches a licence that lapses mid-session. */
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
  // ADMINISTER_PROJECTS cannot be evaluated without a project to evaluate it against.
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

// Comments and description edits go through the bridge instead, so Jira attributes them to the user.

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

  // App property routes are absent by design — they have dedicated resolvers.
  const allowedPrefixes = ["/rest/api/3/"];
  const isAllowed = allowedPrefixes.some((prefix) => url.startsWith(prefix));
  if (!isAllowed) {
    throw new Error(`Unsupported Jira path: ${url}`);
  }

  // Always the user — as the app, a caller could read any issue or project it named.
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

/** App storage carries no user context, so Jira cannot police these writes — the caller is checked here. */
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

const LEGACY_ADDON_KEY = "com.appbox.ai.response.templates";

async function copyPropertyStoreToStorage(listRoute, valueRoute) {
  const imported = [];
  const listResponse = await api.asApp().requestJira(listRoute);
  if (!listResponse.ok) {
    // A store that cannot be listed is the difference between a full and a silent partial migration.
    console.warn("Legacy property store could not be listed", {
      status: listResponse.status,
    });
    return imported;
  }

  const { keys = [] } = await parseJsonResponse(listResponse, {
    operation: "migrateLegacyTemplates",
  });

  for (const { key } of keys) {
    if ((await kvs.get(key)) !== undefined) {
      continue;
    }

    const response = await api.asApp().requestJira(valueRoute(key));
    if (!response.ok) {
      continue;
    }

    const { value } = await parseJsonResponse(response, {
      operation: "migrateLegacyTemplates",
      key,
    });
    if (value !== undefined) {
      await kvs.set(key, value);
      imported.push(key);
    }
  }

  return imported;
}

/**
 * Forge store first, Connect second: that is the precedence the property-store build read with,
 * and a key already in storage is never overwritten, so re-running on upgrade is harmless.
 */
export async function migrateLegacyTemplates() {
  const fromForge = await copyPropertyStoreToStorage(
    route`/rest/forge/1/app/properties`,
    (key) => route`/rest/forge/1/app/properties/${key}`,
  );

  // Only the paid Connect key ever shipped; the free listing has no legacy store behind it.
  const fromConnect = await copyPropertyStoreToStorage(
    route`/rest/atlassian-connect/1/addons/${LEGACY_ADDON_KEY}/properties`,
    (key) =>
      route`/rest/atlassian-connect/1/addons/${LEGACY_ADDON_KEY}/properties/${key}`,
  );

  const imported = [...fromForge, ...fromConnect];
  console.log("Legacy template import finished", {
    fromForge,
    fromConnect,
    imported: imported.length,
  });
  return imported;
}

resolver.define("getAppProperties", async ({ payload }) => {
  const properties = Array.isArray(payload?.properties)
    ? payload.properties
    : [];
  const result = {};

  for (const propertyKey of properties) {
    const value = await kvs.get(propertyKey);
    if (value !== undefined) {
      result[propertyKey] = value;
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

  for (const property of properties) {
    await kvs.set(property.key, property.value);
  }

  return { ok: true };
});

resolver.define("importLegacyAppProperties", async ({ context }) => {
  assertLicensed(context);

  // The permission call is inline on purpose: FSRT does not follow it through a helper.
  const permissionResponse = await api
    .asUser()
    .requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  const permissions = await parseJsonResponse(permissionResponse, {
    operation: "importLegacyAppProperties",
  });

  if (!permissions?.permissions?.ADMINISTER?.havePermission) {
    throw new Error(
      "Jira administrator rights are required to import global templates.",
    );
  }

  return { imported: await migrateLegacyTemplates() };
});

export const handler = resolver.getDefinitions();
