// The one home for the camelCase shape of a `documents` row.
//
// A document is either an uploaded file (filePath, in Supabase Storage) or a
// Google Drive link (driveLink) — never both, though nothing enforces that.
export const mapDocument = (d) => ({
  id: d.id,
  landlordId: d.landlord_id,
  tenantId: d.tenant_id,
  propertyId: d.property_id,
  unitId: d.unit_id,
  contractId: d.contract_id || null,
  fileName: d.file_name,
  filePath: d.file_path,
  fileType: d.file_type,
  documentType: d.document_type,
  aiExtracted: d.ai_extracted,
  uploadedAt: d.uploaded_at,
  driveLink: d.drive_link || null,
});
