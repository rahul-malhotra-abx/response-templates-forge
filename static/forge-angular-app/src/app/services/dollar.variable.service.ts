import {DollarVariableResolverService} from "./dollar.variable.resolver.service";
import {UtilsService} from "./utils.service";
import {JiraUserModel} from "../models/jira.user.model";
import {JiraService} from "./jira.service";
import {CUSTOM_DOLLAR_VARIABLES} from "../models/custom.dollar.variables";

export class DollarVariableService {

  /**
   * Resolved values are dropped into a serialized template, so they have to be escaped for a JSON
   * string context. Jira field values carry quotes, newlines and backslashes — inserting those raw
   * ended the string early and the caller's JSON.parse then failed on the whole template.
   */
  private static escapeForJsonString(value: any): string {
    const stringValue = value === undefined || value === null ? '' : `${value}`;
    return JSON.stringify(stringValue).slice(1, -1);
  }

  static async resolveDollarVariables(text: string, currentUser: JiraUserModel, projectData: any, issueData: any): Promise<string> {
    const allJiraColumns = await JiraService.getJiraFields();
    const allColumns = [...allJiraColumns, ...CUSTOM_DOLLAR_VARIABLES]
    let textCopy = UtilsService.deepCopy(text);
    const variablesToResolve = textCopy.match(/(\${[a-zA-Z0-9_]*})/g) || [];
    for (const variableToResolve of variablesToResolve) {
      const variableKey = variableToResolve.match(/[a-zA-Z0-9_]+/g)[0];
      const column = allColumns.find(col => col.key === variableKey);
      if (column) {
        const columnType = column.resolver ? column : UtilsService.getColumnType(column);
        const resolver = DollarVariableResolverService[columnType.resolver];
        if (resolver) {
          const response = resolver({column, currentUser, projectData, issueData}) || " ";
          // Replacer function, not a string: `$&` and friends are live syntax in a string
          // replacement, so a field value containing `$` would corrupt the output.
          const resolvedValue = DollarVariableService.escapeForJsonString(response);
          textCopy = textCopy.replace(variableToResolve, () => resolvedValue)
        }
      }
    }
    return textCopy;
  }

}
