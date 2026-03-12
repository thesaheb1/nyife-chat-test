import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Permissions } from '@/core/types';
import {
  CRUD_ACTIONS,
  buildPermissionMap,
  normalizePermissionMap,
  type PermissionAction,
  type ResourceDefinition,
} from '@/core/permissions/catalog';

type PermissionMatrixProps = {
  definitions: ResourceDefinition[];
  value: Permissions;
  onChange: (next: Permissions) => void;
  disabled?: boolean;
};

export function PermissionMatrix({
  definitions,
  value,
  onChange,
  disabled = false,
}: PermissionMatrixProps) {
  const normalizedValue = normalizePermissionMap(value, definitions);
  const resourceKeys = definitions.map((definition) => definition.key);

  const updatePermissions = (
    updater: (current: Permissions) => Permissions
  ) => {
    onChange(updater(normalizedValue));
  };

  const setAll = (enabled: boolean) => {
    onChange(buildPermissionMap(resourceKeys, enabled));
  };

  const setResource = (resource: string, enabled: boolean) => {
    updatePermissions((current) => ({
      resources: {
        ...current.resources,
        [resource]: CRUD_ACTIONS.reduce(
          (accumulator, action) => {
            accumulator[action] = enabled;
            return accumulator;
          },
          {} as Permissions['resources'][string]
        ),
      },
    }));
  };

  const togglePermission = (resource: string, action: PermissionAction) => {
    updatePermissions((current) => ({
      resources: {
        ...current.resources,
        [resource]: {
          ...current.resources[resource],
          [action]: !current.resources[resource][action],
        },
      },
    }));
  };

  const getRowSelectionState = (resource: string) => {
    const flags = CRUD_ACTIONS.map((action) => normalizedValue.resources[resource]?.[action] === true);

    if (flags.every(Boolean)) {
      return true;
    }

    if (flags.some(Boolean)) {
      return 'indeterminate' as const;
    }

    return false;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAll(true)}>
          Select All
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAll(false)}>
          Select None
        </Button>
      </div>

      <div className="max-h-80 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr className="border-b">
              <th className="p-2 text-left font-medium">Resource</th>
              <th className="w-20 p-2 text-center font-medium">All</th>
              {CRUD_ACTIONS.map((action) => (
                <th key={action} className="w-20 p-2 text-center font-medium capitalize">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {definitions.map((definition) => {
              const rowState = getRowSelectionState(definition.key);
              return (
                <tr key={definition.key} className="border-b last:border-b-0">
                  <td className="p-2">{definition.label}</td>
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={rowState}
                      disabled={disabled}
                      onCheckedChange={(checked) => setResource(definition.key, checked === true)}
                    />
                  </td>
                  {CRUD_ACTIONS.map((action) => (
                    <td key={action} className="p-2 text-center">
                      <Checkbox
                        checked={Boolean(normalizedValue.resources[definition.key]?.[action])}
                        disabled={disabled}
                        onCheckedChange={() => togglePermission(definition.key, action)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
