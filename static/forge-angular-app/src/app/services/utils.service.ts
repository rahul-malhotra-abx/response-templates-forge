import { JiraUserModel } from '../models/jira.user.model';
import { ALLOWED_JIRA_COLUMN_RENDERERS } from '../models/allowed.jira.column.renderers';
import { Template, TemplateScopes } from '../models/template.model';
import { ENVIRONMENT } from '../environment';
import { DEFAULT_LIMITS } from '../models/default.limits';

export class UtilsService {
  static mergeJiraDataKeys(properties: any, prefix: string) {
    if (!properties) {
      return undefined;
    }

    const normalizedProperties = Object.keys(properties).reduce((obj, key) => {
      obj[key] = typeof properties[key] === 'string' ? UtilsService.safeParse(properties[key]) || properties[key] : properties[key];
      return obj;
    }, {});
    let stringData = '';
    const orderedProperties = Object.keys(normalizedProperties)
      .sort()
      .reduce((obj, key) => {
        obj[key] = normalizedProperties[key];
        return obj;
      }, {});
    let totalSize =
      normalizedProperties[`${prefix}_0`] && normalizedProperties[`${prefix}_0`].totalSize ? normalizedProperties[`${prefix}_0`].totalSize : 0;
    for (const key of Object.keys(orderedProperties)) {
      if (key.startsWith(prefix) && !isNaN(normalizedProperties[key].current) && normalizedProperties[key].current < totalSize) {
        stringData +=
          typeof normalizedProperties[key].data === 'object' ? JSON.stringify(normalizedProperties[key].data) : normalizedProperties[key].data;
      }
    }
    return stringData ? JSON.parse(stringData) : undefined;
  }

  static deepCopy(object: any) {
    return JSON.parse(JSON.stringify(object));
  }

  static minifyUserDetails(user: JiraUserModel) {
    return {
      accountId: user.accountId,
      displayName: user.displayName,
      avatarUrls: {
        '24x24': user.avatarUrls['24x24'],
      },
    };
  }

  static safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return '';
    }
  }

  static getParentDomain() {
    let domain = window.location.origin;
    try {
      domain = document.location.ancestorOrigins[0] || window.location.origin;
    } catch (e) {}
    if (this.getParameterByName('xdm_e')) {
      return decodeURIComponent(this.getParameterByName('xdm_e'));
    }
    if (window['AP'] && window['AP']._hostOrigin && window['AP']._hostOrigin !== '*') {
      domain = window['AP']._hostOrigin;
    }
    return domain;
  }

  static getParameterByName(name: string, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) {
      return null;
    }
    if (!results[2]) {
      return '';
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  static randomIntFromInterval(min: number, max: number) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  static sliceIntoChunks(arr: any[], chunkSize: number) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
    }
    return res;
  }

  static async breakBlobToParts(blobString, partSize): Promise<string[]> {
    const numberOfParts = Math.ceil(blobString.size / partSize);
    const chunks = [];
    for (let i = 0; i < numberOfParts; i++) {
      chunks.push(await blobString.slice(i * partSize, (i + 1) * partSize, { type: 'text/plain' }).text());
    }
    return chunks;
  }

  static stripUserModel(user: JiraUserModel) {
    const copyOfUser = this.deepCopy(user);
    delete copyOfUser['applicationRoles'];
    delete copyOfUser['groups'];
    delete copyOfUser['locale'];
    delete copyOfUser['self'];
    delete copyOfUser['timezone'];
    delete copyOfUser['expand'];
    return copyOfUser;
  }

  static filterRenderableColumns(allColumns, allowedColumns) {
    const renderableColumns = [];
    for (const column of allColumns) {
      if (
        column.schema &&
        Object.keys(allowedColumns).includes(column.schema.type === 'array' ? `${column.schema.type}_${column.schema.items}` : column.schema.type)
      ) {
        renderableColumns.push(column);
      }
    }
    return renderableColumns;
  }

  static getNthElementAfterSplit(str, delimiter, index) {
    try {
      return str.split(delimiter)[index];
    } catch (e) {
      return undefined;
    }
  }

  static getColumnType(column) {
    let columnType;
    if (
      ALLOWED_JIRA_COLUMN_RENDERERS[column.schema.system] ||
      ALLOWED_JIRA_COLUMN_RENDERERS[UtilsService.getNthElementAfterSplit(column.schema.custom, ':', 1)]
    ) {
      columnType =
        ALLOWED_JIRA_COLUMN_RENDERERS[column.schema.system] ??
        ALLOWED_JIRA_COLUMN_RENDERERS[UtilsService.getNthElementAfterSplit(column.schema.custom, ':', 1)];
    } else {
      columnType =
        ALLOWED_JIRA_COLUMN_RENDERERS[
          column.schema.system === 'array' || column.schema.type === 'array' ? `${column.schema.type}_${column.schema.items}` : column.schema.type
        ];
    }
    return columnType;
  }

  static dynamicSort(property: string) {
    let sortOrder = 1;
    if (property[0] === '-') {
      sortOrder = -1;
      property = property.substr(1);
    }
    return function (a, b) {
      // convert numbers' to string for sorting
      const aProperty = Number.isInteger(a[property]) ? a[property].toString() : a[property].toLowerCase();
      const bProperty = Number.isInteger(b[property]) ? b[property].toString() : b[property].toLowerCase();

      const result = aProperty < bProperty ? -1 : aProperty > bProperty ? 1 : 0;
      return result * sortOrder;
    };
  }

  static templateContainsDollarVariables(template: Template) {
    try {
      return JSON.stringify(template.content).match(/(\${[a-zA-Z0-9_]*})/g);
    } catch (e) {
      return false;
    }
  }

  static hasOneOfPermission(requestedPermissions: string[], userPermissions: any) {
    for (const [permissionKey, permission] of Object.entries(userPermissions.permissions)) {
      if (requestedPermissions.indexOf(permissionKey) > -1 && permission['havePermission']) {
        return true;
      }
    }
    return false;
  }

  static canAddTemplate(scope: string, projectTemplates: Template[], personalTemplates: Template[]) {
    if (ENVIRONMENT.FREE_VERSION) {
      if (scope === TemplateScopes.PROJECT && projectTemplates.length >= DEFAULT_LIMITS.FREE_PROJECT_TEMPLATE_COUNT) {
        alert(
          `Cannot add more than ${DEFAULT_LIMITS.FREE_PROJECT_TEMPLATE_COUNT} project templates in free version, upgrade to pro version to add more.`,
        );
        return false;
      }
      if (scope === TemplateScopes.PERSONAL && personalTemplates.length >= DEFAULT_LIMITS.FREE_PERSONAL_TEMPLATE_COUNT) {
        alert(
          `Cannot add more than ${DEFAULT_LIMITS.FREE_PERSONAL_TEMPLATE_COUNT} personal templates in free version, upgrade to pro version to add more.`,
        );
        return false;
      }
    } else {
      if (scope === TemplateScopes.PROJECT && projectTemplates.length >= DEFAULT_LIMITS.PROJECT_TEMPLATE_COUNT) {
        alert(`Cannot add more than ${DEFAULT_LIMITS.PROJECT_TEMPLATE_COUNT} project templates.`);
        return false;
      }
      if (scope === TemplateScopes.PERSONAL && personalTemplates.length >= DEFAULT_LIMITS.PERSONAL_TEMPLATE_COUNT) {
        alert(`Cannot add more than ${DEFAULT_LIMITS.PERSONAL_TEMPLATE_COUNT} personal templates.`);
        return false;
      }
    }
    return true;
  }
}
