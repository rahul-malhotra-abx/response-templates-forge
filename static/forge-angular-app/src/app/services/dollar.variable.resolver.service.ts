import { JiraUserModel } from '../models/jira.user.model';

import * as dayjs from 'dayjs';

export const DollarVariableResolverService = {
  /*********** CUSTOM DOLLAR VARIABLES ************/
  current_user_account_id: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.currentUser.accountId;
  },
  current_user_name: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.currentUser.displayName;
  },
  current_date_short: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('MMM DD YYYY');
  },
  current_date_long: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('MMMM DD YYYY');
  },
  current_month: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('MMMM');
  },
  current_year: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('YYYY');
  },
  current_time_short: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('HH:mm');
  },
  current_time_long: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('h:mm:ss a');
  },
  current_date_time_short: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('MMM DD YYYY HH:mm');
  },
  current_date_time_long: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return dayjs().format('MMMM DD YYYY hh:mm:ss a');
  },
  current_template_name: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.currentUser.displayName;
  },
  issue_key: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.key;
  },
  issue_type: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields.issuetype.name;
  },
  project_key: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.projectData.key;
  },
  project_type: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.projectData.projectTypeKey;
  },
  project_name: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.projectData.name;
  },
  project_lead_name: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.projectData.lead.displayName;
  },
  /*********** JIRA COLUMNS ************/
  jiraUserRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key]['displayName'] : '';
  },
  jiraStringRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key] : '';
  },
  jiraNumberRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key] : '';
  },
  jiraArrayStringRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key].join(', ') : '';
  },
  jiraArrayVersionRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key].map((v) => v.name).join(', ') : '';
  },
  jiraArrayComponentRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key].map((v) => v.name).join(', ') : '';
  },
  jiraStatusRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key].name : '';
  },
  jiraDescriptionRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.renderedFields.description?.replace(/\n/g, ' ');
  },
  jiraVotesRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.renderedFields.votes || 0;
  },
  jiraDateTimeRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? dayjs(params.issueData.fields[params.column.key]).format('MMMM DD, YYYY, H:mm a') : '';
  },
  jiraDateRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? dayjs(params.issueData.fields[params.column.key]).format('MMMM DD, YYYY') : '';
  },
  jiraPriorityRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.fields[params.column.key] ? params.issueData.fields[params.column.key].name : '';
  },
  jiraRenderedFieldRenderer: (params: { column: any; currentUser: JiraUserModel; projectData: any; issueData: any }): string => {
    return params.issueData.renderedFields[params.column.key] || '';
  },
};
