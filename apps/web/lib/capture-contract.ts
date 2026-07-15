import { z } from "zod";

export const MIN_CAPTURE_COUNT = 2;
export const MAX_CAPTURE_COUNT = 4;
export const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
export const MAX_CAPTURE_TOTAL_BYTES = 24 * 1024 * 1024;
export const MAX_CAPTURE_DATA_URL_CHARACTERS = 11_184_900;
export const MAX_EXPORT_REQUEST_BYTES = 46 * 1024 * 1024;
export const MIN_CAPTURE_WIDTH = 240;
export const MIN_CAPTURE_HEIGHT = 160;
export const MAX_CAPTURE_DIMENSION = 7680;
export const MAX_CAPTURE_PIXELS = 33_177_600;

export const CAPTURE_PROVENANCE_LABELS = {
  "creator-owned": "Creator-owned product UI",
  "authorized-use": "Authorized product UI",
} as const;

export type CaptureProvenance = keyof typeof CAPTURE_PROVENANCE_LABELS;

export const CaptureUploadSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  order: z
    .number()
    .int()
    .min(0)
    .max(MAX_CAPTURE_COUNT - 1),
  fileName: z.string().trim().min(1).max(180),
  label: z.string().trim().min(3).max(80),
  description: z.string().trim().min(12).max(180),
  provenance: z.enum(["creator-owned", "authorized-use"]),
  mediaType: z.enum(["image/png", "image/jpeg"]),
  dataUrl: z.string().min(32).max(MAX_CAPTURE_DATA_URL_CHARACTERS),
});

export const CaptureUploadListSchema = z
  .array(CaptureUploadSchema)
  .min(MIN_CAPTURE_COUNT)
  .max(MAX_CAPTURE_COUNT)
  .superRefine((captures, context) => {
    const ids = new Set<string>();
    const orders = new Set<number>();
    for (const [index, capture] of captures.entries()) {
      if (ids.has(capture.id)) {
        context.addIssue({
          code: "custom",
          message: "Capture ids must be unique.",
          path: [index, "id"],
        });
      }
      if (orders.has(capture.order)) {
        context.addIssue({
          code: "custom",
          message: "Capture order values must be unique.",
          path: [index, "order"],
        });
      }
      ids.add(capture.id);
      orders.add(capture.order);
    }
    for (let expected = 0; expected < captures.length; expected += 1) {
      if (!orders.has(expected)) {
        context.addIssue({
          code: "custom",
          message: "Capture order must be contiguous and start at zero.",
          path: [],
        });
        break;
      }
    }
  });

export type CaptureUpload = z.infer<typeof CaptureUploadSchema>;
