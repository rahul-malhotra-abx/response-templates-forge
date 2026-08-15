const environments = {
  RESPONSE_TEMPLATE_PRO: {
    /**
     * String
     * Name of the App.
     */
    APP_NAME: 'Response Template Pro',
    APP_MODE: 'RESPONSE_TEMPLATE_PRO',
    APP_KEY: 'com.appbox.ai.response.templates',
    APP_BASE_KEY: 'com.appbox.ai.response.templates',
    // EDITOR_APP_BASE_PATH: 'http://localhost:3001', // For Local Environment
    EDITOR_APP_BASE_PATH: 'https://jira-editor.appbox.ai',
    EDITOR_IFRAME_CHANNEL: 'iframed.react',
    FREE_VERSION: false,
    PAID_VERSION: true,
  },
  RESPONSE_TEMPLATE_FREE: {
    /**
     * String
     * Name of the App.
     */
    APP_NAME: 'Response Template Free',
    APP_MODE: 'RESPONSE_TEMPLATE_FREE',
    APP_KEY: 'com.appbox.ai.response.templates.free',
    APP_BASE_KEY: 'com.appbox.ai.response.templates',
    // EDITOR_APP_BASE_PATH: 'http://localhost:3001', // For Local Environment
    EDITOR_APP_BASE_PATH: 'https://jira-editor.appbox.ai',
    EDITOR_IFRAME_CHANNEL: 'iframed.react',
    FREE_VERSION: true,
    PAID_VERSION: false,
  },
};

type EnvironmentMode = keyof typeof environments;

export function getEnvironment(mode: EnvironmentMode) {
  return environments[mode];
}
