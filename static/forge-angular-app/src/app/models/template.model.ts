import {JiraUserModel} from './jira.user.model';

export interface Template {
  id: string;
  name: string;
  content: any;
  starred: boolean;
  scope: string;
  updatedAt: Date;
  updatedBy: JiraUserModel;
}

export interface SignatureTemplate {
  id: string;
  name: string;
  content: any;
  active: boolean;
  updatedAt: Date;
  updatedBy: JiraUserModel;
}

export const TemplateScopes = {
  PERSONAL: 'Personal',
  PROJECT: 'Project',
  GLOBAL: 'Global'
}
