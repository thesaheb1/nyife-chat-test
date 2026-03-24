import { Badge } from '@/components/ui/badge';
import type { Template } from '@/core/types';
import {
  TEMPLATE_META_STATUS_CLASSES,
  TEMPLATE_QUALITY_CLASSES,
  TEMPLATE_QUALITY_LABELS,
  TEMPLATE_STATUS_CLASSES,
  TEMPLATE_STATUS_LABELS,
  getTemplateMetaStatusLabel,
  resolveTemplateMetaStatus,
} from './templateCatalog';

export function TemplateStatusBadges({
  template,
  showMetaStatus = false,
  showQuality = true,
}: {
  template: Template;
  showMetaStatus?: boolean;
  showQuality?: boolean;
}) {
  const effectiveMetaStatus = resolveTemplateMetaStatus(template);
  const metaStatusLabel = getTemplateMetaStatusLabel(effectiveMetaStatus);

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className={TEMPLATE_STATUS_CLASSES[template.status]}>
        {TEMPLATE_STATUS_LABELS[template.status]}
      </Badge>
      {showMetaStatus && metaStatusLabel && effectiveMetaStatus ? (
        <Badge variant="outline" className={TEMPLATE_META_STATUS_CLASSES[effectiveMetaStatus] || TEMPLATE_STATUS_CLASSES.pending}>
          {metaStatusLabel}
        </Badge>
      ) : null}
      {showQuality && template.quality_score ? (
        <Badge variant="outline" className={TEMPLATE_QUALITY_CLASSES[template.quality_score]}>
          {TEMPLATE_QUALITY_LABELS[template.quality_score]}
        </Badge>
      ) : null}
    </div>
  );
}
