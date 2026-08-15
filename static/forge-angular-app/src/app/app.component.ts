import { Component, OnInit } from '@angular/core';
import { NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { ForgeContextService } from './services/forge-context.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    config: NgbTooltipConfig,
    private router: Router,
    private forgeContextService: ForgeContextService,
  ) {
    config.openDelay = 500;
    config.container = 'body';
  }

  async ngOnInit(): Promise<void> {
    // Module routing in Forge is determined by extension context, not incoming URL.
    // We only redirect when context is available, preserving local dev behavior.
    let context: any;
    try {
      context = await this.forgeContextService.getContext();
    } catch (_error) {
      return;
    }
    if (!context) {
      return;
    }

    const extension = context.extension || {};
    const moduleKey = extension.moduleKey || context.moduleKey;
    const extensionType = extension.type || context.type;
    const projectId = extension.project?.id || context.project?.id;

    const normalizedModuleKey = String(moduleKey || '').toLowerCase();
    const normalizedExtensionType = String(extensionType || '').toLowerCase();
    const isAdminContext = normalizedModuleKey.startsWith('response-templates-admin') || normalizedExtensionType === 'jira:adminpage';

    if (isAdminContext) {
      await this.router.navigate(['/app-admin-panel']);
      return;
    }

    // Route mapping is intentionally explicit so each Forge module key/type maps to one Angular route.
    // Some Forge contexts do not include moduleKey, so type is used as a fallback.
    switch (moduleKey) {
      case 'response-templates-project-forge':
        if (projectId) {
          await this.router.navigate([`/project/${projectId}/templates`]);
        }
        break;
      case 'response-templates-issue-panel':
        await this.router.navigate(['/ticket/response']);
        break;
      case 'response-templates-admin': {
        await this.router.navigate(['/app-admin-panel']);
        break;
      }
      default:
        switch (extensionType) {
          case 'jira:projectPage':
            if (projectId) {
              await this.router.navigate([`/project/${projectId}/templates`]);
            }
            break;
          case 'jira:issuePanel':
            await this.router.navigate(['/ticket/response']);
            break;
          case 'jira:adminPage': {
            await this.router.navigate(['/app-admin-panel']);
            break;
          }
          default:
            break;
        }
        break;
    }
  }
}
