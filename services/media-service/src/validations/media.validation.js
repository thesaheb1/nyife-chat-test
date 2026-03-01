'use strict';

const { z } = require('zod');

const uploadSchema = z.object({
  // File comes from multer, not body — this validates optional metadata
}).passthrough();

const uploadToWhatsAppSchema = z.object({
  file_id: z.string().uuid('Invalid file ID'),
  phone_number_id: z.string().min(1, 'Phone number ID is required'),
});

const listMediaSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  search: z.string().max(200).optional(),
});

const mediaIdParamSchema = z.object({
  id: z.string().uuid('Invalid media file ID'),
});

const whatsappMediaIdParamSchema = z.object({
  mediaId: z.string().min(1, 'WhatsApp media ID is required'),
});

module.exports = {
  uploadSchema,
  uploadToWhatsAppSchema,
  listMediaSchema,
  mediaIdParamSchema,
  whatsappMediaIdParamSchema,
};
