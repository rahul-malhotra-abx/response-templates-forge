import {DollarVariableResolverService} from "./dollar.variable.resolver.service";
import {UtilsService} from "./utils.service";
import {JiraUserModel} from "../models/jira.user.model";
import {JiraService} from "./jira.service";
import {CUSTOM_DOLLAR_VARIABLES} from "../models/custom.dollar.variables";

export class DollarVariableService {

  /** Values land in a serialized template, so they must be escaped for a JSON string context. */
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
          // A function, not a string — `$&` is live syntax in a string replacement.
          const resolvedValue = DollarVariableService.escapeForJsonString(response);
          textCopy = textCopy.replace(variableToResolve, () => resolvedValue)
        }
      }
    }
    return textCopy;
  }

}
