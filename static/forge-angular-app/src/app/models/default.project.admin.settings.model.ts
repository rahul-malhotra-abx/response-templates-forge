export interface ProjectAdminSetting {
  version: number;
  responseTemplatesEnabled: boolean;
}

export const DefaultProjectAdminSettings: ProjectAdminSetting = {
  version: 1.0,
  responseTemplatesEnabled: true,
};
