export const ALLOWED_JIRA_COLUMN_RENDERERS = {
  number: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraNumberRenderer',
  },
  string: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: '',
    resolver: 'jiraStringRenderer',
  },
  resolution: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    resolver: 'jiraStringRenderer',
  },
  status: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    resolver: 'jiraStatusRenderer',
  },
  securitylevel: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'name',
    resolver: 'jiraStringRenderer',
  },
  votes: {
    fieldKey: 'id',
    headerKey: 'name',
    valueKey: 'votes',
    resolver: 'jiraVotesRenderer',
  },
  user: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraUserRenderer',
  },
  priority: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraPriorityRenderer',
  },
  textarea: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraRichTextRenderer',
  },
  description: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraDescriptionRenderer',
  },
  datetime: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraDateTimeRenderer',
  },
  date: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraDateRenderer',
  },
  array_string: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraArrayStringRenderer',
  },
  array_version: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraArrayVersionRenderer',
  },
  array_component: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraArrayComponentRenderer',
  },
  timeoriginalestimate: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraRenderedFieldRenderer',
  },
  aggregatetimeoriginalestimate: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraRenderedFieldRenderer',
  },
  aggregatetimeestimate: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraRenderedFieldRenderer',
  },
  timeestimate: {
    fieldKey: 'id',
    headerKey: 'name',
    resolver: 'jiraRenderedFieldRenderer',
  },
};
