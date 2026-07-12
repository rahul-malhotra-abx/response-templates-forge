import { Component } from '@angular/core';

type AdminTab = 'global-templates' | 'project-enablement';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './app-admin-panel.component.html',
  styleUrls: ['./app-admin-panel.component.scss'],
})
export class AppAdminPanelComponent {
  activeTab: AdminTab = 'global-templates';
  private readonly tabs: AdminTab[] = ['global-templates', 'project-enablement'];

  get selectedTabIndex(): number {
    const index = this.tabs.indexOf(this.activeTab);
    return index > -1 ? index : 0;
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
  }

  onTabChange(index: number): void {
    this.activeTab = this.tabs[index] || 'global-templates';
  }
}
