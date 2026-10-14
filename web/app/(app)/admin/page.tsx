import { AdminGate } from '@/features/admin/AdminGate';
import { AdminPage } from '@/features/admin';

export default function Page() {
  return (
    <AdminGate>
      <AdminPage />
    </AdminGate>
  );
}
