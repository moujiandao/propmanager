// The one home for the camelCase shape of a `lease_renewals` row.
//
// `originalLeaseDate` is the immutable "X date" pinned at the root of a renewal
// chain — see lib/docuseal/renewal.js, which derives the new term from it.
export const mapLeaseRenewal = (r) => ({
  id: r.id,
  landlordId: r.landlord_id || null,
  contractId: r.contract_id,
  propertyId: r.property_id || null,
  originalLeaseDate: r.original_lease_date || null,
  newTermStart: r.new_term_start || null,
  newTermEnd: r.new_term_end || null,
  rentAmount: r.rent_amount,
  status: r.status || 'draft',
  docusealSubmissionId: r.docuseal_submission_id || null,
  signers: r.signers || [],
  appliedToContract: r.applied_to_contract || false,
  createdAt: r.created_at || null,
  updatedAt: r.updated_at || null,
});
