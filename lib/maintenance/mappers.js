// The one home for the camelCase shape of the maintenance aggregate.
// Supabase returns snake_case; the UI speaks camelCase. These four mappers are
// the only place that knowledge lives — fetchAllData imports them rather than
// redefining them, and the core builds its return values through them.

export const mapMaintenance = (m) => ({
  id: m.id,
  tenantId: m.tenant_id,
  propertyId: m.property_id,
  unit: m.unit,
  description: m.description,
  descriptionZh: m.description_zh || "",
  type: m.type || "",
  priority: m.priority,
  status: m.status,
  date: (m.created_at || m.date || "").split("T")[0],
});

export const mapMaintenanceType = (t) => ({ id: t.id, name: t.name });

export const mapMaintenanceAttachment = (a) => ({
  id: a.id,
  maintenanceRequestId: a.maintenance_request_id,
  fileName: a.file_name,
  filePath: a.file_path,
  fileType: a.file_type || "",
  fileSize: a.file_size || 0,
});

export const mapMaintenanceComment = (c) => ({
  id: c.id,
  maintenanceRequestId: c.maintenance_request_id,
  parentCommentId: c.parent_comment_id || null,
  landlordId: c.landlord_id,
  body: c.body,
  bodyZh: c.body_zh || "",
  authorType: c.author_type,
  authorId: c.author_id,
  authorName: c.author_name || "",
  deletedAt: c.deleted_at || null,
  createdAt: c.created_at,
});
