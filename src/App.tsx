import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConfirmProvider } from '@/ui/dialog';
import { Layout } from '@/ui/Layout';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { DefectsList } from '@/features/defects/DefectsList';
import { IssueFormPage } from '@/features/defects/IssueForm';
import { IssueDetail } from '@/features/defects/IssueDetail';
import { StepFormPage } from '@/features/defects/StepForm';
import { ServicePage } from '@/features/service/ServicePage';
import { PartsPage } from '@/features/parts/PartsPage';
import { MorePage } from '@/features/more/MorePage';
import { VehicleSettings } from '@/features/more/VehicleSettings';
import { VendorsSettings } from '@/features/more/VendorsSettings';
import { GroupsSettings } from '@/features/more/GroupsSettings';
import { GeneralSettings } from '@/features/more/GeneralSettings';
import { SyncLog } from '@/features/more/SyncLog';

// The claude.ai preview can't use real URL paths, so it keeps the route in memory.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;

export function App() {
  return (
    <Router basename={import.meta.env.MODE === 'artifact' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <ConfirmProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="defects" element={<DefectsList />} />
            <Route path="defects/new" element={<IssueFormPage />} />
            <Route path="defects/:id" element={<IssueDetail />} />
            <Route path="defects/:id/edit" element={<IssueFormPage />} />
            <Route path="defects/:id/steps/new" element={<StepFormPage />} />
            <Route path="defects/:id/steps/:stepId" element={<StepFormPage />} />
            <Route path="service" element={<ServicePage />} />
            <Route path="parts" element={<PartsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="more/vehicle" element={<VehicleSettings />} />
            <Route path="more/vendors" element={<VendorsSettings />} />
            <Route path="more/groups" element={<GroupsSettings />} />
            <Route path="more/settings" element={<GeneralSettings />} />
            <Route path="more/sync" element={<SyncLog />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </ConfirmProvider>
    </Router>
  );
}
