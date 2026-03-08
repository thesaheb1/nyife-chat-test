import type { HeaderFormat, TemplateMediaAsset } from './templateBuilder';

type MediaRule = {
  label: string;
  mimeTypes: string[];
  maxSizeBytes: number;
};

export const TEMPLATE_MEDIA_RULES: Partial<Record<HeaderFormat, MediaRule>> = {
  IMAGE: {
    label: 'Image',
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  VIDEO: {
    label: 'Video',
    mimeTypes: ['video/mp4', 'video/3gpp', 'video/3gp'],
    maxSizeBytes: 16 * 1024 * 1024,
  },
  DOCUMENT: {
    label: 'Document',
    mimeTypes: [
      'text/plain',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxSizeBytes: 100 * 1024 * 1024,
  },
};

export function getTemplateMediaRule(format: HeaderFormat) {
  return TEMPLATE_MEDIA_RULES[format] || null;
}

export function formatBytes(bytes: number | undefined) {
  if (!bytes || Number.isNaN(bytes)) {
    return null;
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getTemplateMediaAccept(format: HeaderFormat) {
  return getTemplateMediaRule(format)?.mimeTypes.join(',') || '';
}

export function getTemplateMediaHelper(format: HeaderFormat) {
  const rule = getTemplateMediaRule(format);

  if (!rule) {
    if (format === 'LOCATION') {
      return 'Location headers do not require a file upload.';
    }

    return 'Upload a sample file so Meta can validate the header.';
  }

  return `${rule.label}: ${rule.mimeTypes.join(', ')}. Max ${formatBytes(rule.maxSizeBytes)}. Meta’s official API reference publishes file type and size limits; it does not publish a hard template-header aspect-ratio rule.`;
}

export function validateTemplateMediaFile(file: File, format: HeaderFormat) {
  const rule = getTemplateMediaRule(format);

  if (!rule) {
    return null;
  }

  if (!rule.mimeTypes.includes(file.type)) {
    return `${rule.label} headers support ${rule.mimeTypes.join(', ')} only.`;
  }

  if (file.size > rule.maxSizeBytes) {
    return `${rule.label} headers must be ${formatBytes(rule.maxSizeBytes)} or smaller.`;
  }

  return null;
}

function formatAspectRatio(width: number, height: number) {
  if (!width || !height) {
    return null;
  }

  return `${(width / height).toFixed(2)}:1`;
}

async function loadImageMetadata(file: File): Promise<Pick<TemplateMediaAsset, 'width' | 'height' | 'aspect_ratio'> | null> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = reject;
      next.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      aspect_ratio: formatAspectRatio(image.naturalWidth, image.naturalHeight) || undefined,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadVideoMetadata(file: File): Promise<Pick<TemplateMediaAsset, 'width' | 'height' | 'aspect_ratio'> | null> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const next = document.createElement('video');
      next.preload = 'metadata';
      next.onloadedmetadata = () => resolve(next);
      next.onerror = reject;
      next.src = objectUrl;
    });

    return {
      width: video.videoWidth,
      height: video.videoHeight,
      aspect_ratio: formatAspectRatio(video.videoWidth, video.videoHeight) || undefined,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function extractTemplateMediaMetadata(file: File, format: HeaderFormat) {
  if (format === 'IMAGE') {
    return loadImageMetadata(file);
  }

  if (format === 'VIDEO') {
    return loadVideoMetadata(file);
  }

  return null;
}
