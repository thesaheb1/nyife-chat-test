import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { useAdminUsers } from './useAdminUsers';
import type { AdminUserDetail } from '../types';
import { formatCurrency } from '@/shared/utils/formatters';

const STATUS_COLORS: Record<string, string> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
  pending_verification: 'outline',
};

const columns: ColumnDef<AdminUserDetail>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.first_name} {row.original.last_name}</div>
        <div className="text-xs text-muted-foreground">{row.original.email}</div>
      </div>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={STATUS_COLORS[row.original.status] as 'default' | 'secondary' | 'destructive' | 'outline'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'current_plan',
    header: 'Plan',
    cell: ({ row }) => row.original.current_plan ?? 'None',
  },
  {
    accessorKey: 'wallet_balance',
    header: 'Wallet',
    cell: ({ row }) => formatCurrency(row.original.wallet_balance ?? 0),
  },
  {
    accessorKey: 'created_at',
    header: 'Joined',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
];

export function UserListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useAdminUsers({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const users = data?.data?.users ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.users.title')}</h1>
        <Button onClick={() => navigate('/admin/users/create')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.users.createUser')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        page={page}
        totalPages={meta?.totalPages ?? 1}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
      />
    </div>
  );
}
