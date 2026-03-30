import { Badge } from '@/components/ui/badge';
import type { WhatsAppFlow } from '@/core/types';
import {
  FLOW_STATUS_CLASSES,
  FLOW_STATUS_LABELS,
  normalizeFlowStatusToken,
} from './flowCatalog';

export function FlowStatusBadges({
  flow,
  showMetaStatus = true,
  showSendability = true,
  showLocalChanges = false,
}: {
  flow: Pick<WhatsAppFlow, 'status' | 'meta_status' | 'can_send_message' | 'has_local_changes'>;
  showMetaStatus?: boolean;
  showSendability?: boolean;
  showLocalChanges?: boolean;
}) {
  const primaryStatus = normalizeFlowStatusToken(flow.status) || 'DRAFT';
  const metaStatus = normalizeFlowStatusToken(flow.meta_status);
  const showDistinctMetaStatus = showMetaStatus && metaStatus && metaStatus !== primaryStatus;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={FLOW_STATUS_CLASSES[primaryStatus]}>
        {FLOW_STATUS_LABELS[primaryStatus]}
      </Badge>
      {showDistinctMetaStatus ? (
        <Badge variant="outline" className={FLOW_STATUS_CLASSES[metaStatus]}>
          {FLOW_STATUS_LABELS[metaStatus]}
        </Badge>
      ) : null}
      {showLocalChanges && flow.has_local_changes ? (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
          Local changes
        </Badge>
      ) : null}
      {showSendability && flow.can_send_message === false ? (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
          Send blocked
        </Badge>
      ) : null}
    </div>
  );
}

