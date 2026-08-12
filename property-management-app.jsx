'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAdapter } from '@/lib/maintenance/adapter';
import { mapMaintenance, mapMaintenanceType, mapMaintenanceAttachment, mapMaintenanceComment } from '@/lib/maintenance/mappers';
import * as maint from '@/lib/maintenance/core';
import * as maintStatus from '@/lib/maintenance/status';
import { createTenantAdapter } from '@/lib/tenant/adapter';
import { mapTenant } from '@/lib/tenant/mappers';
import { statusFor, isCurrentRow, awaitingMoveInAck, awaitingMoveOutAck } from '@/lib/tenant/status';
import { blockersFromData } from '@/lib/tenant/deletion';
import * as tenantOps from '@/lib/tenant/core';
import { createPaymentReminderAdapter } from '@/lib/payment-reminders/adapter';
import { mapEmailSettings } from '@/lib/payment-reminders/mappers';
import { EMPTY_EMAIL_SETTINGS } from '@/lib/payment-reminders/constants';
import * as reminderOps from '@/lib/payment-reminders/core';
import { createPropertyAdapter } from '@/lib/property/adapter';
import { mapProperty } from '@/lib/property/mappers';
import * as propertyOps from '@/lib/property/core';
import { createUnitAdapter } from '@/lib/units/adapter';
import { mapUnit } from '@/lib/units/mappers';
import * as unitOps from '@/lib/units/core';
import { createParkingAdapter } from '@/lib/parking/adapter';
import { mapParkingSpot, mapParkingRenter, mapParkingLease } from '@/lib/parking/mappers';
import * as parkingOps from '@/lib/parking/core';
import { activeLeaseForSpot, SPOT_TYPES } from '@/lib/parking/status';
import { lotLayout } from '@/lib/parking/layout';
import { PropertyDetailPage, DocumentsPageV2, TenantContactPage, DocViewer } from './phase2-components';
import { EmailAutomationPage } from './email-automation-components';
import { RenewalsPage } from './renewal-components';
import { fmt, fmtDate } from '@/lib/format';

const supabase = createClient();

// ─── THEME ────────────────────────────────────────────────────────────────────
// Figma-inspired: all-light content, neutral near-black accent, hairline borders.
// Single source of truth for new code; existing inline literals were swapped to
// these values directly. See docs/superpowers/specs/2026-06-12-figma-theme-design.md
const theme = {
  text: "#111111",        // headings / primary text
  textMuted: "#6b7280",   // body / descriptions
  textFaint: "#9ca3af",   // labels / meta
  border: "#eaeaea",      // hairline borders
  accent: "#111111",      // buttons / links / focus
  accentHover: "#000000",
  bg: "#ffffff",
  bgSubtle: "#fafafa",
  sidebar: "#111111",     // neutral near-black
  radius: { sm: 8, md: 12, pill: 99 },
};

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  en: {
    appName: "PropManager", landlord: "Landlord", tenant: "Tenant", signIn: "Sign In",
    email: "Email", password: "Password", logout: "Logout", cancel: "Cancel", note: "Note",
    navDashboard: "Dashboard", navProperties: "Properties", navTenants: "Tenants",
    navLeases: "Leases", navPayments: "Payments", navMaintenance: "Maintenance", navTodo: "To Do List", navEmail: "Email Automation",
    dashTitle: "Dashboard", dashSubtitle: "Good morning! Here's your portfolio overview.",
    dashSummaryTitle: "What needs your attention", dashSummaryGenerate: "Generate Summary", dashSummaryRegenerate: "Regenerate",
    dashSummaryLoading: "Thinking…", dashSummaryEmpty: "Click Generate Summary to get a quick read on what needs your attention this week.",
    dashSummaryError: "Couldn't generate a summary. Try again in a moment.", dashSummaryGeneratedAt: (when) => `Generated ${when}`,
    dashNewTenantsTitle: "New tenants added in the last 7 days", dashDismiss: "Dismiss",
    statProperties: "Properties", statOccupied: "occupied", statRevenue: "Monthly Revenue",
    statActiveLeases: "active leases", statPending: "Pending Payments", statRequireAttention: "require attention",
    statOpenMaint: "Open Maintenance", statRequests: "requests",
    tenantPaymentStatus: "Tenant Payment Status", recentMaintenance: "Recent Maintenance", recentPayments: "Recent Payments",
    colTenant: "Tenant", colTenants: "Tenants", colAmount: "Amount", colDueDate: "Due Date", colPaidDate: "Paid Date",
    colType: "Type", colAchStatus: "ACH Status", colStatus: "Status", colContact: "Contact",
    colProperty: "Property / Unit", colBank: "Bank", colRecurring: "Recurring",
    colTerm: "Term", colDaysRemaining: "Days Remaining",
    propTitle: "Properties", propSubtitle: (n) => `${n} properties in portfolio`,
    addProperty: "Add Property", addPropertyTitle: "Add New Property",
    streetAddress: "Street Address", city: "City", zip: "ZIP", type: "Type", units: "Units", status: "Status",
    tenants: "Tenants", revenue: "Revenue",
    uploadPhoto: "Upload Photo", uploadingPhoto: "Uploading…", changePhoto: "Change Photo",
    tenTitle: "Tenants", tenSubtitle: (n) => `${n} active tenants`, tenSubtitlePast: (n) => `${n} past tenants`,
    addTenant: "Add Tenant", addTenantTitle: "Add New Tenant",
    fullName: "Full Name", phone: "Phone", loginPassword: "Login Password", tempPassword: "Temporary password",
    selectProperty: "Select property", unit: "Unit",
    bankConnected: "Connected", bankNotConnected: "Not connected",
    recurringEnabled: "Enabled", recurringOff: "Off",
    tenantNote: "The tenant will log in with their email address and the password you set above.",
    createTenantAccount: "Create Tenant Account",
    conTitle: "Leases & Contracts", conSubtitle: (n) => `${n} contracts`,
    addLease: "Add Lease", addLeaseTitle: "Add New Lease", editLeaseTitle: "Edit Lease",
    selectTenant: "Select tenant", monthlyRent: "Monthly Rent ($)",
    startDate: "Start Date", endDate: "End Date", dueDayLabel: "Due Day (1-28)",
    dueOf: "Due:", ofMonth: "of month", expired: "Expired", daysRemaining: "days", leaseUpcoming: "Upcoming", rent: "Rent", term: "Term",
    createLease: "Create Lease",
    payTitle: "Payments", paySubtitle: "ACH payment tracking across all tenants",
    filterAll: "All", typeRecurring: "Recurring", typeOneTime: "One-time", naLabel: "N/A",
    maintTitle: "To Do List", maintSubtitle: (n) => `${n} open requests`,
    maintNewRequest: "New Request",
    todoDetailTitle: "Request Details", todoEmptyColumn: "Nothing here",
    priorityHigh: "high priority", priorityMedium: "medium priority", priorityLow: "low priority",
    statusOpen: "Open", statusInProgress: "In Progress", statusResolved: "Resolved",
    statusNew: "New", statusClosed: "Closed",
    noMaintenance: "No maintenance requests",
    maintTenant: "Tenant", maintSelectTenant: "Select tenant...",
    maintUnit: "Unit", maintType: "Type", maintTypeSelect: "Select type...",
    maintAddNewType: "+ Add new type", maintNewTypePlaceholder: "Type name", maintAddTypeSave: "Add",
    maintDescription: "Description", maintDescriptionPlaceholder: "Describe the issue in detail...",
    maintTranslateChinese: "Translate to Chinese", maintTranslating: "Translating...",
    maintTranslatedLabel: "Chinese Translation",
    commentsHeading: "Comments", commentsShow: (n) => n === 1 ? "1 comment" : `${n} comments`, commentsNone: "No comments yet",
    commentReply: "Reply", commentPost: "Post", commentPosting: "Posting...", commentCancel: "Cancel",
    commentPlaceholder: "Write a comment...", commentReplyPlaceholder: "Write a reply...",
    commentDelete: "Delete", commentDeleteConfirm: "Delete this comment?", commentDeleted: "[deleted]",
    commentYou: "You", commentLandlord: "Landlord", commentError: "Couldn't post comment. Please try again.",
    maintAttachments: "Attachments", maintAddFiles: "Add Files",
    maintSubmitting: "Submitting...",
    emailTitle: "Email Automation", emailSubtitle: "Configure automated payment reminder emails",
    navEmailAutomation: "Email Automation", navPaymentReminders: "Payment Reminders",
    navRenewals: "Lease Renewals",
    renewalsTitle: "Lease Renewals",
    renewalsSubtitle: "Review and send renewal addendums for leases nearing expiry",
    renewalStatDue: "Renewals due",
    renewalStatUrgent: "Urgent",
    renewalStatBlocked: "Blocked",
    renewalsDueHeading: "Renewals due",
    renewalsDueEmpty: "No leases are due for renewal right now.",
    renewalsInFlightHeading: "In progress",
    renewalsInFlightEmpty: "No renewals in progress.",
    renewalUrgent: "Urgent",
    renewalEndsOn: "Lease ends",
    renewalDaysLeft: "{n} days left",
    renewalNewTerm: "New term",
    renewalCarriedRent: "Carried rent",
    renewalUnknownProperty: "Unknown property",
    renewalUnknownTenant: "Unknown tenant",
    renewalNoEmail: "No email",
    renewalFixEmail: "Fix tenant email",
    renewalBlockedHint: "A signer is missing a valid email. Add a real email to this tenant before preparing.",
    renewalPrepare: "Prepare renewal",
    renewalPreparing: "Preparing…",
    renewalPrepareTitle: "Prepare renewal",
    renewalReviewTitle: "Review renewal",
    renewalProperty: "Property",
    renewalOriginalLeaseDate: "Original lease date",
    renewalNewTermStart: "New term start",
    renewalNewTermEnd: "New term end",
    renewalMonthlyRent: "Monthly rent",
    renewalSigners: "Signers",
    renewalCountersignNote: "Tenants sign first; you countersign last.",
    renewalPreparedReady: "Draft created. Preview each signer's document, then confirm to send.",
    renewalPreviewLink: "Preview document",
    renewalConfirmSend: "Confirm & send",
    renewalSending: "Sending…",
    renewalPrepareFailed: "Could not prepare the renewal. Please try again.",
    renewalSendFailed: "Could not send the renewal. Please try again.",
    renewalStatus_draft: "Draft",
    renewalStatus_pending_review: "Pending review",
    renewalStatus_sent: "Sent",
    renewalStatus_signed: "Signed",
    renewalStatus_countersigned: "Countersigned",
    renewalStatus_declined: "Declined",
    renewalStatus_blocked: "Blocked",
    emailAutoTitle: "Email Automation", emailAutoSubtitle: "Send tenants timely reminders before key dates",
    tabTemplates: "Templates", tabAutomations: "Automations", tabInbox: "Inbox",
    newTemplate: "New Template", editTemplateTitle: "Edit Template",
    templateName: "Template name", templateNamePlaceholder: "e.g. Move-out reminder — fall semester",
    templateSubject: "Subject", templateBody: "Body", insertField: "Insert field",
    preview: "Preview", previewNoSubject: "(no subject)", previewEmpty: "Your message preview appears here.",
    previewSampleNote: "Preview uses sample data; real tenant values are filled in when sent.",
    templateNameSubjectRequired: "Name and subject are required.",
    save: "Save", edit: "Edit", deleteTemplate: "Delete Template",
    confirmDeleteTemplate: "Delete this template?", noTemplates: "No templates yet. Create your first reminder template.",
    sendTest: "Send Test", testSendTitle: "Send Test Email",
    testSendDesc: "Send this template to a test address so you can check how it looks before going live.",
    testRecipient: "Send to (test address)", testUseTenant: "Fill with a tenant's data (optional)",
    testSampleData: "Sample data", send: "Send", sending: "Sending…",
    testSent: "Test email sent.", testFailed: "Could not send test email.", testRecipientRequired: "A test recipient email is required.",
    emailAutoComingSoon: "Coming soon.",
    evtMoveOut: "Move-out date", evtMoveIn: "Move-in date", evtLeaseEnd: "Lease end date",
    evtProjectedMoveOut: "Projected move-out", evtRentDue: "Rent due",
    newAutomation: "New Automation", editAutomationTitle: "Edit Automation",
    automationName: "Automation name", automationNamePlaceholder: "e.g. Move-out reminders",
    automationEvent: "Trigger event", automationOffsets: "Days before event",
    automationOffsetsHint: "Comma-separated days before the event, e.g. 10, 5, 3.",
    automationTemplate: "Template", automationSelectTemplate: "Select a template…",
    automationScopeProperty: "Property (optional)", automationScopeStatus: "Tenant status (optional)",
    scopeAllProperties: "All properties", scopeAllStatuses: "All statuses",
    statusCurrent: "Current tenant", statusFuture: "Future tenant",
    automationNameRequired: "A name is required.", automationTemplateRequired: "Please choose a template.",
    automationOffsetsRequired: "Enter at least one valid day offset.",
    deleteAutomation: "Delete Automation", confirmDeleteAutomation: "Delete this automation?",
    noAutomations: "No automations yet. Create one to start sending reminders.",
    automationsNeedTemplate: "Create a template first, then build an automation around it.",
    offsetsLabel: "days before",
    runNow: "Run now",
    batchLoading: "Preparing recipients…",
    batchLoadFailed: "Could not prepare this batch.",
    batchNoRecipients: "No tenants match this automation right now.",
    batchPreviewTitle: "Preview email",
    batchPreviewNote: (name) => `Showing data for ${name}`,
    batchPreviewNoSubject: "(no subject)",
    batchContinue: "Continue",
    batchReviewTitle: "Review & edit",
    batchReviewSubtitle: "Edit each recipient's email below. Remove anyone you don't want to include, or add more tenants.",
    batchRecipientCount: (n) => `${n} recipient${n === 1 ? "" : "s"}`,
    batchRecipientSubject: "Subject",
    batchRecipientBody: "Body",
    batchRecipientNoEmail: "No email on file — this recipient will fail to send.",
    batchRemove: "Remove",
    batchAddRecipient: "Add recipient",
    batchAddTenantPlaceholder: "Choose a tenant to add…",
    batchAlreadyAdded: "This tenant is already in the batch.",
    batchSaveFailed: "Could not save your changes.",
    batchSaving: "Saving…",
    batchSendEmails: "Send emails",
    batchConfirmTitle: "Confirm & send",
    batchConfirmBody: (n) => `You're about to send ${n} email${n === 1 ? "" : "s"} to:`,
    batchConfirmSend: "Confirm & send",
    batchSendFailed: "Could not send the batch.",
    batchSending: "Sending…",
    batchResultTitle: "Send complete",
    batchResultSummary: (sent, failed, skipped) => `${sent} sent · ${failed} failed · ${skipped} skipped`,
    batchDone: "Done",
    batchNoName: "Unnamed tenant",
    inboxEmpty: "No emails sent yet.", inboxShowTests: "Show test sends",
    inboxTestTag: "Test", inboxOpened: "Opened", inboxReplied: "Replied",
    inboxReplyThread: "Replies", inboxNoBody: "(no content)",
    st_queued: "Queued", st_sent: "Sent", st_delivered: "Delivered", st_opened: "Opened",
    st_bounced: "Bounced", st_complained: "Complaint", st_failed: "Failed", st_received: "Reply",
    editTemplate: "Edit Template", editTemplateLabel: "Edit Template:",
    variablesNote: "Variables: {tenant_name}, {amount}, {due_date}, {landlord_name}",
    saveTemplate: "Save Template",
    reminder5Day: "5 Days Before Due Date", reminder5DayDesc: "Friendly advance reminder",
    reminderDayOf: "Day-of Reminder", reminderDayOfDesc: "Reminder on the due date",
    reminder1Day: "1 Day Overdue", reminder1DayDesc: "Urgent follow-up",
    reminder3Day: "3 Days Overdue", reminder3DayDesc: "Escalated reminder",
    reminder7Day: "7 Days Overdue", reminder7DayDesc: "Final notice before action",
    st_completed: "Completed", st_pending: "Pending", st_overdue: "Overdue",
    st_active: "Active", st_open: "Open", "st_in-progress": "In Progress", st_resolved: "Resolved", st_new: "New", st_closed: "Closed",
    "st_current tenant": "Current Tenant", "st_future tenant": "Future Tenant", "st_previous tenant": "Previous Tenant",
    st_occupied: "Occupied", st_vacant: "Vacant",
    dashUnpaidRent: "Unpaid Rent", dashVacancies: "Vacancies — Now & Next 6 Months", dashNewTenants: "New Tenants",
    dashUnpaidEmpty: "All active tenants have paid this month.",
    dashVacanciesEmpty: "No vacant units, and no tenants scheduled to move out in the next 6 months.",
    dashNewTenantsEmpty: "No upcoming tenants scheduled.", dashVacating: "Vacating", dashMoveIn: "Move-in",
    dashTenantCount: (n) => `${n} tenant${n === 1 ? "" : "s"}`, dashUnitCount: (n) => `${n} unit${n === 1 ? "" : "s"}`, dashUpcomingCount: (n) => `${n} upcoming`,
    dashUnitsToRentOut: "Units to Rent Out", dashUnitsToRentOutEmpty: "All units are covered for the next 6 months.", dashAvailable: "Available",
    dashTransitions: "Unit Transitions — Next 6 Months", dashTransitionsEmpty: "No unit transitions in the next 6 months.",
    dashExpandAll: "Expand all", dashCollapseAll: "Collapse all",
    dashMovingOut: "Moving out", dashMovingIn: "Moving in",
    dashGap: (mo, d) => mo > 0 && d > 0 ? `Gap ${mo}mo ${d}d` : mo > 0 ? `Gap ${mo}mo` : `Gap ${d}d`,
    dashGapUnresolved: "Need to find new tenant(s)",
    dashCleanBefore: (date) => `Clean unit before ${date}`,
    dashVacantNow: "Vacant now", dashNoOutgoing: "No outgoing tenant", dashNoIncoming: "New tenants needed", dashAvailableNow: "Available now",
    paySubtitleTracker: "Monthly rent tracker by unit", payZelleName: "Zelle Name", payMoveOutDate: "Move-out Date", paySelectAll: "Select All",
    payUnitLabel: (n) => `Unit ${n}`, payUnassigned: "Unassigned",
    saveChanges: "Save Changes", saving: "Saving...", discard: "Discard",
    displayBy: "Display by", displayAll: "All", displayByUnit: "Property + Unit",
    tenNoProperty: "Unassigned", tenFilterProperties: "Filter properties", tenShowAll: "Show all", tenHideAll: "Hide all", tenPerMo: "/mo",
    tenFilterStatus: "Show", tenFilterCurrent: "Current Tenants", tenFilterPast: "Past Tenants",
    tenNoneToShow: "No tenants to show. Adjust the property filter above.",
    tenNonePast: "No past tenants to show.",
    colMonthlyRent: "Monthly Rent", editBtn: "Edit",
    firstName: "First Name", lastName: "Last Name",
    zelleNameLabel: "Zelle Name", zelleNamePlaceholder: "Name or phone on Zelle",
    moveInDateReq: "Move-in Date *", moveInDate: "Move-in Date", moveOutDate: "Move-out Date",
    notesLabel: "Notes", notesPlaceholder: "Internal notes about this tenant",
    securityDepositLabel: "Security Deposit ($)", securityDepositNotReceived: "Security Deposit not received", securityDepositReceived: "Security Deposit received",
    colSecurityDeposit: "Security Deposit", colDepositRefunded: "Security Deposit Refunded", depositRefunded: "Refunded", depositNotRefunded: "Not refunded",
    createLoginLabel: "Create tenant portal login",
    createLoginDesc: "Optional — only needed if the tenant will log in to pay rent or submit maintenance requests",
    creating: "Creating…", noPropOption: "— No property —", selectPropFirst: "— Select a property first —",
    noUnitAssigned: "— No unit assigned —", noUnitsYet: "No units — add units first from the property page",
    monthlyPaymentLabel: "Monthly Payment ($)", passwordReset: "Password Reset",
    newPasswordLabel: "New Password (leave blank to keep current)", minCharsPlaceholder: "Min. 8 characters",
    emailReadOnly: "Email address cannot be changed here. To update a tenant's email, do so from Supabase Auth.",
    emailLoginNote: "This email is the tenant's login. Changing it will update the address used for login and notifications.",
    deleteTenant: "Delete Tenant", deleteWarning: "This will permanently remove their account and all associated data. This cannot be undone.",
    deleteTenantConfirmBefore: "Are you sure you want to delete ", deleteTenantConfirmAfter: "?",
    deleteTenantBlockedBefore: "", deleteTenantBlockedAfter: " still has linked records and can't be deleted:",
    deleteTenantBlockedHint: "Deleting would take these with them, so it's blocked. Remove or reassign them first — or leave the tenant in place, since a move-out date already files them as a previous tenant.",
    deleteTenantFailed: "Could not delete this tenant. Please try again.",
    blocker_payments: (n) => `${n} payment${n === 1 ? "" : "s"}`,
    blocker_contracts: (n) => `${n} lease${n === 1 ? "" : "s"}`,
    blocker_maintenance: (n) => `${n} maintenance request${n === 1 ? "" : "s"}`,
    blocker_documents: (n) => `${n} document${n === 1 ? "" : "s"}`,
    blocker_parkingLeases: (n) => `${n} parking lease${n === 1 ? "" : "s"}`,
    deleting: "Deleting…", langLabel: "Language", navDocuments: "Documents", navAdminUsers: "Admin Users",
    // Units (property detail page — lib/units seam)
    unitAdd: "Add Unit", unitEditTitle: (n) => `Edit Unit ${n}`, unitLabel: (n) => `Unit ${n}`,
    unitEditAction: "Edit unit", unitDeleteAction: "Delete unit",
    unitsEmpty: "No units yet. Add the first unit for this property.",
    unitsOccupiedCount: (occ, total) => `${occ}/${total} occupied`,
    unitNumberLabel: "Unit Number", unitNumberPlaceholder: "e.g. 101, A, 2B",
    unitBedrooms: "Bedrooms", unitBathrooms: "Bathrooms",
    unitRentLabel: "Monthly Rent ($)", unitRentPlaceholder: "e.g. 1500", unitRentPerMonth: (v) => `${v}/mo`,
    unitBedBath: (b, ba) => `${b} bed / ${ba} bath`,
    unitTenantHeading: "Tenant", unitTenantsHeading: (n) => `Tenants (${n})`,
    unitOccupiedUnlinked: "Occupied — tenant unlinked", unitVacant: "Vacant",
    unitNumberRequired: "Unit number is required.",
    unitDeleteTitle: (n) => `Delete Unit ${n}?`,
    unitDeleteWarning: "This permanently removes the unit. This cannot be undone.",
    unitDeleteBlocked: (n) => `${n} tenant${n === 1 ? " is" : "s are"} still assigned to this unit:`,
    unitDeleteReassignHint: "Includes previous tenants, who stay linked to the unit they lived in. Open a tenant to move them to another unit — or clear their unit — then delete this one.",
    unitDeleteConfirm: "Delete Unit",
    unitPropertyNotFound: "Property not found.", unitBack: "Back",
    maintClosedOn: (date) => `Closed ${date}`, maintClosedDate: "Closed",
    // Dashboard move-in / move-out acknowledgment
    dashAckMovedIn: (n) => n === 1 ? "Tenant has moved in" : "Tenants have moved in",
    dashAckMovedOut: (n) => n === 1 ? "Tenant has moved out" : "Tenants have moved out",
    dashAckPendingMoveIn: "Awaiting confirmation", dashAckPendingMoveOut: "Awaiting confirmation",
    dashAckSaving: "Confirming…",
    adminUsersTitle: "Admin Users", adminUsersSubtitle: "Create additional landlord accounts",
    adminName: "Name", adminEmail: "Email", adminPassword: "Password",
    adminCreateBtn: "Create Admin Account", adminCreating: "Creating…",
    adminSuccess: "Admin account created successfully.",
    adminErrFields: "All fields are required.", adminErrPassword: "Password must be at least 8 characters.",
    navPaymentPortal: "Payment Portal", navPaymentHistory: "Payment History", navMyProfile: "My Profile",
    statusCurrentTenant: "Current Tenant", statusFutureTenant: "Future Tenant", statusPreviousTenant: "Previous Tenant",
    tenStatusDerived: "Set automatically from the move-in and move-out dates.",
    docSectionTitle: "Documents", docUploadPdf: "Upload PDF", docAddDriveLink: "Add Drive Link",
    docView: "View", docNoDocuments: "No documents attached", docDriveLinkPlaceholder: "Paste Google Drive share URL",
    docAttach: "Attach", docRemove: "Remove",
    editProperty: "Edit Property", driveFolderUrl: "Google Drive Folder URL",
    inProduction: "In Production", inProductionHint: "Tenants of this property will be hidden from the dashboard, Tenants, Payments, and To Do List pages.", propNotInProduction: "Not in Production",
    failedCreateLease: "Failed to create lease.", failedCreateTenant: "Failed to create tenant.",
    tenantNameMoveInRequired: "First name and move-in date are required.",
    navParking: "Parking",
    parkTitle: "Parking", parkSubtitle: (n) => `${n} parking spots`,
    parkAddSpot: "Add Spot", parkAddSpotTitle: "Add Parking Spot",
    parkSpotLabel: "Spot Label", parkMonthlyRate: "Monthly Rate ($)",
    parkSpotType: "Type (optional)", parkSpotTypeNone: "— None —",
    parkVehicle: "Vehicle", parkCarMake: "Car Make", parkCarModel: "Car Model", parkCarYear: "Car Year",
    parkEditSpot: "Edit Spot", parkEditSpotTitle: "Edit Parking Spot", parkFailedUpdateSpot: "Failed to update spot.",
    parkLotDiagram: "Lot Diagram", parkSpotDetailTitle: (label) => `Spot ${label}`,
    parkOngoing: "Ongoing", parkSpotVacantHint: "This spot is not currently leased.",
    parkUnplaced: (labels) => `Not shown above (no type set): ${labels}`,
    parkNoSpots: "No parking spots yet. Add the first one for a property.",
    parkUnknownProperty: "Unknown property",
    parkAddLease: "Add Parking Lease", parkAddLeaseTitle: "New Parking Lease",
    parkEndLease: "End Parking Lease", parkSince: "since", parkLeaseHeading: "Parking Lease",
    parkEditLease: "Edit Lease", parkEditLeaseTitle: "Edit Parking Lease",
    parkFailedUpdateLease: "Failed to update lease.",
    parkRateRequired: "A rate above 0 is required.",
    parkEndBeforeStart: (start) => `End date cannot be before the start date (${start}).`,
    parkExistingTenant: "Existing Tenant", parkMarketRenter: "Market Renter",
    parkOpenToMarket: "Open to Market", parkMarkTenantPriority: "Mark Tenant-Priority",
    parkDeleteSpot: "Delete Spot", parkDeleteSpotTitle: "Delete Parking Spot",
    parkDeleteSpotConfirm: (label) => `Delete spot "${label}"? This cannot be undone.`,
    parkUnknownTenant: "Unknown tenant", parkUnknownRenter: "Unknown renter",
    parkSpotFieldsRequired: "Property and spot label are required.",
    parkLeaseFieldsRequired: "Rate and start date are required.",
    parkSelectTenantRequired: "Select a tenant.",
    parkRenterNameRequired: "Renter name is required.",
    parkFailedCreateSpot: "Failed to create spot.", parkFailedDeleteSpot: "Failed to delete spot.",
    parkFailedCreateLease: "Failed to create parking lease.",
    st_tenant_priority: "Tenant Priority", st_open_market: "Open Market",
  },
  zh: {
    appName: "房产管理", landlord: "房东", tenant: "租客", signIn: "登录",
    email: "电子邮件", password: "密码", logout: "退出登录", cancel: "取消", note: "备注",
    navDashboard: "控制台", navProperties: "房产", navTenants: "租客",
    navLeases: "合同", navPayments: "付款", navMaintenance: "维修", navTodo: "待办事项", navEmail: "邮件自动化",
    dashTitle: "控制台", dashSubtitle: "早上好！以下是您的房产组合概览。",
    dashSummaryTitle: "需要关注的事项", dashSummaryGenerate: "生成摘要", dashSummaryRegenerate: "重新生成",
    dashSummaryLoading: "生成中…", dashSummaryEmpty: "点击「生成摘要」快速了解本周需要关注的事项。",
    dashSummaryError: "摘要生成失败，请稍后再试。", dashSummaryGeneratedAt: (when) => `生成于 ${when}`,
    dashNewTenantsTitle: "近 7 天新增租客", dashDismiss: "关闭",
    statProperties: "房产数量", statOccupied: "已出租", statRevenue: "月收入",
    statActiveLeases: "有效合同", statPending: "待处理付款", statRequireAttention: "需要关注",
    statOpenMaint: "待处理维修", statRequests: "个请求",
    tenantPaymentStatus: "租客付款状态", recentMaintenance: "最近维修请求", recentPayments: "最近付款记录",
    colTenant: "租客", colTenants: "租客", colAmount: "金额", colDueDate: "到期日", colPaidDate: "付款日",
    colType: "类型", colAchStatus: "ACH状态", colStatus: "状态", colContact: "联系方式",
    colProperty: "房产 / 单元", colBank: "银行账户", colRecurring: "自动续费",
    colTerm: "合同期限", colDaysRemaining: "剩余天数",
    propTitle: "房产管理", propSubtitle: (n) => `共 ${n} 处房产`,
    addProperty: "添加房产", addPropertyTitle: "添加新房产",
    streetAddress: "街道地址", city: "城市", zip: "邮编", type: "类型", units: "单元数", status: "状态",
    tenants: "租客", revenue: "收入",
    uploadPhoto: "上传照片", uploadingPhoto: "上传中…", changePhoto: "更换照片",
    tenTitle: "租客管理", tenSubtitle: (n) => `共 ${n} 名活跃租客`, tenSubtitlePast: (n) => `共 ${n} 名前租客`,
    addTenant: "添加租客", addTenantTitle: "添加新租客",
    fullName: "姓名", phone: "电话", loginPassword: "登录密码", tempPassword: "临时密码",
    selectProperty: "选择房产", unit: "单元",
    bankConnected: "已连接", bankNotConnected: "未连接",
    recurringEnabled: "已开启", recurringOff: "未开启",
    tenantNote: "租客将使用其电子邮件地址和您设置的密码登录系统。",
    createTenantAccount: "创建租客账号",
    conTitle: "租约与合同", conSubtitle: (n) => `共 ${n} 份合同`,
    addLease: "添加租约", addLeaseTitle: "添加新租约", editLeaseTitle: "编辑租约",
    selectTenant: "选择租客", monthlyRent: "月租金（$）",
    startDate: "开始日期", endDate: "结束日期", dueDayLabel: "到期日（1-28日）",
    dueOf: "到期日：每月", ofMonth: "日", expired: "已到期", daysRemaining: "天", leaseUpcoming: "即将开始", rent: "租金", term: "期限",
    createLease: "创建租约",
    payTitle: "付款管理", paySubtitle: "所有租客的ACH付款追踪",
    filterAll: "全部", typeRecurring: "自动续费", typeOneTime: "单次付款", naLabel: "不适用",
    maintTitle: "待办事项", maintSubtitle: (n) => `${n} 个待处理请求`,
    maintNewRequest: "新建请求",
    todoDetailTitle: "请求详情", todoEmptyColumn: "暂无",
    priorityHigh: "高优先级", priorityMedium: "中优先级", priorityLow: "低优先级",
    statusOpen: "待处理", statusInProgress: "处理中", statusResolved: "已解决",
    statusNew: "新建", statusClosed: "已关闭",
    noMaintenance: "暂无维修请求",
    maintTenant: "租客", maintSelectTenant: "选择租客...",
    maintUnit: "单元", maintType: "类型", maintTypeSelect: "选择类型...",
    maintAddNewType: "+ 添加新类型", maintNewTypePlaceholder: "类型名称", maintAddTypeSave: "添加",
    maintDescription: "描述", maintDescriptionPlaceholder: "详细描述问题...",
    maintTranslateChinese: "翻译为中文", maintTranslating: "翻译中...",
    maintTranslatedLabel: "中文翻译",
    commentsHeading: "评论", commentsShow: (n) => `${n} 条评论`, commentsNone: "暂无评论",
    commentReply: "回复", commentPost: "发布", commentPosting: "发布中...", commentCancel: "取消",
    commentPlaceholder: "写下评论...", commentReplyPlaceholder: "写下回复...",
    commentDelete: "删除", commentDeleteConfirm: "确定删除这条评论吗？", commentDeleted: "[已删除]",
    commentYou: "你", commentLandlord: "房东", commentError: "评论发送失败，请重试。",
    maintAttachments: "附件", maintAddFiles: "添加文件",
    maintSubmitting: "提交中...",
    emailTitle: "邮件自动化", emailSubtitle: "配置自动付款提醒邮件",
    navEmailAutomation: "邮件自动化", navPaymentReminders: "租金提醒",
    navRenewals: "租约续签",
    renewalsTitle: "租约续签",
    renewalsSubtitle: "审核并发送即将到期租约的续签附录",
    renewalStatDue: "待续签",
    renewalStatUrgent: "紧急",
    renewalStatBlocked: "已阻止",
    renewalsDueHeading: "待续签租约",
    renewalsDueEmpty: "目前没有需要续签的租约。",
    renewalsInFlightHeading: "进行中",
    renewalsInFlightEmpty: "没有正在进行的续签。",
    renewalUrgent: "紧急",
    renewalEndsOn: "租约到期",
    renewalDaysLeft: "剩余 {n} 天",
    renewalNewTerm: "新租期",
    renewalCarriedRent: "沿用租金",
    renewalUnknownProperty: "未知物业",
    renewalUnknownTenant: "未知租客",
    renewalNoEmail: "无电子邮件",
    renewalFixEmail: "请修正租客邮箱",
    renewalBlockedHint: "有签署人缺少有效邮箱。请先为该租客填写真实邮箱再准备续签。",
    renewalPrepare: "准备续签",
    renewalPreparing: "准备中…",
    renewalPrepareTitle: "准备续签",
    renewalReviewTitle: "审核续签",
    renewalProperty: "物业",
    renewalOriginalLeaseDate: "原租约日期",
    renewalNewTermStart: "新租期开始",
    renewalNewTermEnd: "新租期结束",
    renewalMonthlyRent: "月租金",
    renewalSigners: "签署人",
    renewalCountersignNote: "租客先签署，您最后会签。",
    renewalPreparedReady: "草稿已创建。请预览各签署人的文件，确认后发送。",
    renewalPreviewLink: "预览文件",
    renewalConfirmSend: "确认并发送",
    renewalSending: "发送中…",
    renewalPrepareFailed: "无法准备续签，请重试。",
    renewalSendFailed: "无法发送续签，请重试。",
    renewalStatus_draft: "草稿",
    renewalStatus_pending_review: "待审核",
    renewalStatus_sent: "已发送",
    renewalStatus_signed: "已签署",
    renewalStatus_countersigned: "已会签",
    renewalStatus_declined: "已拒绝",
    renewalStatus_blocked: "已阻止",
    emailAutoTitle: "邮件自动化", emailAutoSubtitle: "在关键日期前向租户发送及时提醒",
    tabTemplates: "模板", tabAutomations: "自动化规则", tabInbox: "收件箱",
    newTemplate: "新建模板", editTemplateTitle: "编辑模板",
    templateName: "模板名称", templateNamePlaceholder: "例如：搬出提醒 — 秋季学期",
    templateSubject: "邮件主题", templateBody: "正文", insertField: "插入字段",
    preview: "预览", previewNoSubject: "（无主题）", previewEmpty: "邮件预览将显示在此处。",
    previewSampleNote: "预览使用示例数据；发送时会填入真实租户的信息。",
    templateNameSubjectRequired: "请填写名称和主题。",
    save: "保存", edit: "编辑", deleteTemplate: "删除模板",
    confirmDeleteTemplate: "确定删除此模板？", noTemplates: "暂无模板。创建你的第一个提醒模板。",
    sendTest: "发送测试", testSendTitle: "发送测试邮件",
    testSendDesc: "将此模板发送到测试地址，以便在正式发送前查看效果。",
    testRecipient: "发送至（测试地址）", testUseTenant: "使用某租户的数据填充（可选）",
    testSampleData: "示例数据", send: "发送", sending: "发送中…",
    testSent: "测试邮件已发送。", testFailed: "无法发送测试邮件。", testRecipientRequired: "请填写测试收件人邮箱。",
    emailAutoComingSoon: "即将推出。",
    evtMoveOut: "搬出日期", evtMoveIn: "入住日期", evtLeaseEnd: "租约到期日",
    evtProjectedMoveOut: "预计搬出", evtRentDue: "租金到期",
    newAutomation: "新建自动化", editAutomationTitle: "编辑自动化",
    automationName: "自动化名称", automationNamePlaceholder: "例如：搬出提醒",
    automationEvent: "触发事件", automationOffsets: "事件前天数",
    automationOffsetsHint: "事件前的天数，以逗号分隔，例如 10、5、3。",
    automationTemplate: "模板", automationSelectTemplate: "选择模板…",
    automationScopeProperty: "物业（可选）", automationScopeStatus: "租户状态（可选）",
    scopeAllProperties: "所有物业", scopeAllStatuses: "所有状态",
    statusCurrent: "当前租户", statusFuture: "未来租户",
    automationNameRequired: "请填写名称。", automationTemplateRequired: "请选择模板。",
    automationOffsetsRequired: "请至少输入一个有效的天数。",
    deleteAutomation: "删除自动化", confirmDeleteAutomation: "确定删除此自动化？",
    noAutomations: "暂无自动化。创建一个以开始发送提醒。",
    automationsNeedTemplate: "请先创建模板，再围绕它构建自动化。",
    offsetsLabel: "天前",
    runNow: "立即发送",
    batchLoading: "正在准备收件人…",
    batchLoadFailed: "无法准备此批次。",
    batchNoRecipients: "目前没有符合此自动化的租户。",
    batchPreviewTitle: "预览邮件",
    batchPreviewNote: (name) => `显示 ${name} 的数据`,
    batchPreviewNoSubject: "（无主题）",
    batchContinue: "继续",
    batchReviewTitle: "审核与编辑",
    batchReviewSubtitle: "在下方编辑每位收件人的邮件。移除不想包含的收件人，或添加更多租户。",
    batchRecipientCount: (n) => `${n} 位收件人`,
    batchRecipientSubject: "主题",
    batchRecipientBody: "正文",
    batchRecipientNoEmail: "无可用邮箱 — 此收件人将发送失败。",
    batchRemove: "移除",
    batchAddRecipient: "添加收件人",
    batchAddTenantPlaceholder: "选择要添加的租户…",
    batchAlreadyAdded: "此租户已在批次中。",
    batchSaveFailed: "无法保存你的更改。",
    batchSaving: "保存中…",
    batchSendEmails: "发送邮件",
    batchConfirmTitle: "确认并发送",
    batchConfirmBody: (n) => `你即将向以下 ${n} 位收件人发送邮件：`,
    batchConfirmSend: "确认并发送",
    batchSendFailed: "无法发送此批次。",
    batchSending: "发送中…",
    batchResultTitle: "发送完成",
    batchResultSummary: (sent, failed, skipped) => `已发送 ${sent} · 失败 ${failed} · 跳过 ${skipped}`,
    batchDone: "完成",
    batchNoName: "未命名租户",
    inboxEmpty: "尚未发送任何邮件。", inboxShowTests: "显示测试发送",
    inboxTestTag: "测试", inboxOpened: "已打开", inboxReplied: "已回复",
    inboxReplyThread: "回复", inboxNoBody: "（无内容）",
    st_queued: "排队中", st_sent: "已发送", st_delivered: "已送达", st_opened: "已打开",
    st_bounced: "退信", st_complained: "投诉", st_failed: "失败", st_received: "回复",
    editTemplate: "编辑模板", editTemplateLabel: "编辑模板：",
    variablesNote: "变量：{tenant_name}，{amount}，{due_date}，{landlord_name}",
    saveTemplate: "保存模板",
    reminder5Day: "到期前5天提醒", reminder5DayDesc: "友好的提前提醒",
    reminderDayOf: "当天提醒", reminderDayOfDesc: "到期当天发送提醒",
    reminder1Day: "逾期1天", reminder1DayDesc: "紧急跟进",
    reminder3Day: "逾期3天", reminder3DayDesc: "升级提醒",
    reminder7Day: "逾期7天", reminder7DayDesc: "最终警告",
    st_completed: "已完成", st_pending: "待处理", st_overdue: "已逾期",
    st_active: "有效", st_open: "待处理", "st_in-progress": "处理中", st_resolved: "已解决", st_new: "新建", st_closed: "已关闭",
    "st_current tenant": "现租客", "st_future tenant": "待入住租客", "st_previous tenant": "前租客",
    st_occupied: "已出租", st_vacant: "空置",
    dashUnpaidRent: "未付租金", dashVacancies: "空置情况 — 当前及未来6个月", dashNewTenants: "新租客",
    dashUnpaidEmpty: "所有现租客本月已付款。",
    dashVacanciesEmpty: "暂无空置单元，且未来6个月内无租客计划退租。",
    dashNewTenantsEmpty: "暂无待入住租客。", dashVacating: "退租日期", dashMoveIn: "入住日",
    dashTenantCount: (n) => `${n} 位租客`, dashUnitCount: (n) => `${n} 套单元`, dashUpcomingCount: (n) => `${n} 位待入住`,
    dashUnitsToRentOut: "待出租单元", dashUnitsToRentOutEmpty: "未来6个月内所有单元均已有租客安排。", dashAvailable: "可用日期",
    dashTransitions: "单元交接 — 未来 6 个月", dashTransitionsEmpty: "未来 6 个月内无单元交接。",
    dashExpandAll: "全部展开", dashCollapseAll: "全部收起",
    dashMovingOut: "搬出", dashMovingIn: "搬入",
    dashGap: (mo, d) => mo > 0 && d > 0 ? `空档 ${mo} 个月 ${d} 天` : mo > 0 ? `空档 ${mo} 个月` : `空档 ${d} 天`,
    dashGapUnresolved: "需要寻找新租客",
    dashCleanBefore: (date) => `请于 ${date} 前打扫单元`,
    dashVacantNow: "目前空置", dashNoOutgoing: "无搬出租客", dashNoIncoming: "需招新租客", dashAvailableNow: "目前可用",
    paySubtitleTracker: "按单元的月租追踪", payZelleName: "Zelle姓名", payMoveOutDate: "退租日期", paySelectAll: "全选",
    payUnitLabel: (n) => `单元 ${n}`, payUnassigned: "未分配单元",
    saveChanges: "保存更改", saving: "保存中…", discard: "撤销更改",
    displayBy: "分组方式", displayAll: "全部", displayByUnit: "房产 + 单元",
    tenNoProperty: "未分配房产", tenFilterProperties: "筛选房产", tenShowAll: "全部显示", tenHideAll: "全部隐藏", tenPerMo: "/月",
    tenFilterStatus: "显示", tenFilterCurrent: "现租客", tenFilterPast: "前租客",
    tenNoneToShow: "暂无可显示的租客。请调整上方的房产筛选。",
    tenNonePast: "暂无可显示的前租客。",
    colMonthlyRent: "月租金", editBtn: "编辑",
    firstName: "名", lastName: "姓",
    zelleNameLabel: "Zelle姓名", zelleNamePlaceholder: "Zelle上的姓名或电话",
    moveInDateReq: "入住日期 *", moveInDate: "入住日期", moveOutDate: "退租日期",
    notesLabel: "备注", notesPlaceholder: "关于此租客的内部备注",
    securityDepositLabel: "押金（$）", securityDepositNotReceived: "押金未收到", securityDepositReceived: "押金已收到",
    colSecurityDeposit: "押金", colDepositRefunded: "押金已退还", depositRefunded: "已退还", depositNotRefunded: "未退还",
    createLoginLabel: "创建租客门户账号",
    createLoginDesc: "可选 — 仅在租客需要登录付款或提交维修请求时使用",
    creating: "创建中…", noPropOption: "— 无房产 —", selectPropFirst: "— 请先选择房产 —",
    noUnitAssigned: "— 未分配单元 —", noUnitsYet: "暂无单元 — 请先在房产页面添加单元",
    monthlyPaymentLabel: "月租金（$）", passwordReset: "密码重置",
    newPasswordLabel: "新密码（留空则保持原密码）", minCharsPlaceholder: "至少8位字符",
    emailReadOnly: "此处无法修改电子邮件。如需更新租客邮箱，请在Supabase Auth中操作。",
    emailLoginNote: "此邮箱为租客登录账号，修改后将同步更新登录及通知所用的邮箱。",
    deleteTenant: "删除租客", deleteWarning: "这将永久删除其账号及所有相关数据，此操作无法撤销。",
    deleteTenantConfirmBefore: "确定要删除 ", deleteTenantConfirmAfter: " 吗？",
    deleteTenantBlockedBefore: "", deleteTenantBlockedAfter: " 仍有关联记录，无法删除：",
    deleteTenantBlockedHint: "删除会一并移除这些记录，因此已被阻止。请先移除或转移这些记录；也可以保留该租客 — 填写退租日期后，系统已将其归类为前租客。",
    deleteTenantFailed: "删除该租客失败，请重试。",
    blocker_payments: (n) => `${n} 条付款记录`,
    blocker_contracts: (n) => `${n} 份租约`,
    blocker_maintenance: (n) => `${n} 条维修请求`,
    blocker_documents: (n) => `${n} 份文件`,
    blocker_parkingLeases: (n) => `${n} 份停车租约`,
    deleting: "删除中…", langLabel: "语言", navDocuments: "文件", navAdminUsers: "管理员用户",
    // 单元（房产详情页 — lib/units seam）
    unitAdd: "添加单元", unitEditTitle: (n) => `编辑单元 ${n}`, unitLabel: (n) => `单元 ${n}`,
    unitEditAction: "编辑单元", unitDeleteAction: "删除单元",
    unitsEmpty: "暂无单元。为此房产添加第一个单元。",
    unitsOccupiedCount: (occ, total) => `${total} 个单元中 ${occ} 个已入住`,
    unitNumberLabel: "单元号", unitNumberPlaceholder: "例如 101、A、2B",
    unitBedrooms: "卧室数", unitBathrooms: "卫生间数",
    unitRentLabel: "月租金（$）", unitRentPlaceholder: "例如 1500", unitRentPerMonth: (v) => `${v}/月`,
    unitBedBath: (b, ba) => `${b} 卧 / ${ba} 卫`,
    unitTenantHeading: "租户", unitTenantsHeading: (n) => `租户（${n}）`,
    unitOccupiedUnlinked: "已入住 — 未关联租户", unitVacant: "空置",
    unitNumberRequired: "请填写单元号。",
    unitDeleteTitle: (n) => `删除单元 ${n}？`,
    unitDeleteWarning: "此操作将永久删除该单元，且无法撤销。",
    unitDeleteBlocked: (n) => `仍有 ${n} 位租户分配在此单元：`,
    unitDeleteReassignHint: "包括前租客，他们仍关联着曾入住的单元。点击租户可将其转移到其他单元，或清除单元分配，然后再删除此单元。",
    unitDeleteConfirm: "删除单元",
    unitPropertyNotFound: "未找到房产。", unitBack: "返回",
    maintClosedOn: (date) => `已关闭 ${date}`, maintClosedDate: "关闭日期",
    // 仪表板入住 / 退租确认
    dashAckMovedIn: () => "租户已入住",
    dashAckMovedOut: () => "租户已退租",
    dashAckPendingMoveIn: "待确认", dashAckPendingMoveOut: "待确认",
    dashAckSaving: "确认中…",
    adminUsersTitle: "管理员用户", adminUsersSubtitle: "创建额外的房东账号",
    adminName: "姓名", adminEmail: "电子邮件", adminPassword: "密码",
    adminCreateBtn: "创建管理员账号", adminCreating: "创建中…",
    adminSuccess: "管理员账号创建成功。",
    adminErrFields: "所有字段均为必填项。", adminErrPassword: "密码至少需要8位字符。",
    navPaymentPortal: "付款门户", navPaymentHistory: "付款记录", navMyProfile: "我的资料",
    statusCurrentTenant: "现租客", statusFutureTenant: "待入住租客", statusPreviousTenant: "前租客",
    tenStatusDerived: "根据入住和搬出日期自动设置。",
    docSectionTitle: "文件", docUploadPdf: "上传 PDF", docAddDriveLink: "添加 Drive 链接",
    docView: "查看", docNoDocuments: "暂无附件", docDriveLinkPlaceholder: "粘贴 Google Drive 分享链接",
    docAttach: "附加", docRemove: "删除",
    editProperty: "编辑房产", driveFolderUrl: "Google Drive 文件夹链接",
    inProduction: "启用中", inProductionHint: "此房产的租客将不再显示在仪表盘、租客、付款和待办事项页面中。", propNotInProduction: "未启用",
    failedCreateLease: "创建租约失败。", failedCreateTenant: "创建租客失败。",
    tenantNameMoveInRequired: "请填写名字和入住日期。",
    navParking: "停车位",
    parkTitle: "停车位", parkSubtitle: (n) => `共 ${n} 个停车位`,
    parkAddSpot: "添加车位", parkAddSpotTitle: "添加停车位",
    parkSpotLabel: "车位编号", parkMonthlyRate: "月租金（$）",
    parkSpotType: "类型（可选）", parkSpotTypeNone: "— 无 —",
    parkVehicle: "车辆", parkCarMake: "汽车品牌", parkCarModel: "汽车型号", parkCarYear: "汽车年份",
    parkEditSpot: "编辑车位", parkEditSpotTitle: "编辑停车位", parkFailedUpdateSpot: "更新车位失败。",
    parkLotDiagram: "车位平面图", parkSpotDetailTitle: (label) => `车位 ${label}`,
    parkOngoing: "长期", parkSpotVacantHint: "此车位当前未出租。",
    parkUnplaced: (labels) => `未显示在上图中（未设置类型）：${labels}`,
    parkNoSpots: "暂无停车位 — 请先为某个房产添加车位。",
    parkUnknownProperty: "未知房产",
    parkAddLease: "添加车位租约", parkAddLeaseTitle: "新建车位租约",
    parkEndLease: "结束车位租约", parkSince: "起租于", parkLeaseHeading: "车位租约",
    parkEditLease: "编辑租约", parkEditLeaseTitle: "编辑车位租约",
    parkFailedUpdateLease: "更新租约失败。",
    parkRateRequired: "租金必须大于 0。",
    parkEndBeforeStart: (start) => `结束日期不能早于起租日期（${start}）。`,
    parkExistingTenant: "现有租客", parkMarketRenter: "市场租客",
    parkOpenToMarket: "开放给市场", parkMarkTenantPriority: "标记为租客优先",
    parkDeleteSpot: "删除车位", parkDeleteSpotTitle: "删除停车位",
    parkDeleteSpotConfirm: (label) => `删除车位 "${label}"？此操作无法撤销。`,
    parkUnknownTenant: "未知租客", parkUnknownRenter: "未知租客",
    parkSpotFieldsRequired: "房产和车位编号为必填项。",
    parkLeaseFieldsRequired: "租金和起租日期为必填项。",
    parkSelectTenantRequired: "请选择一位租客。",
    parkRenterNameRequired: "租客姓名为必填项。",
    parkFailedCreateSpot: "创建车位失败。", parkFailedDeleteSpot: "删除车位失败。",
    parkFailedCreateLease: "创建车位租约失败。",
    st_tenant_priority: "租客优先", st_open_market: "开放市场",
  }
};




// ─── ICONS ────────────────────────────────────────────────────────────────────
export const Icon = ({ name, size = 18 }) => {
  const icons = {
    home: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    building: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    file: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    dollar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    wrench: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
    mail: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    clock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    bank: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    key: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    trending: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    globe: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    sparkles: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 14l.9 2.4L22.3 17l-2.4.9L19 20l-.9-2.4L15.7 17l2.4-.6z"/><path d="M5 17l.6 1.6L7.2 19l-1.6.6L5 21l-.6-1.4L2.8 19l1.6-.4z"/></svg>,
    car: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L19 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>,
  };
  return icons[name] || null;
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
// fmt / fmtDate now live in lib/format (imported at top) — the one home for the
// currency/date formatters previously duplicated here, in renewals, and in lib/email.
const tenantFullName = (ten) => [ten.name, ten.lastName].filter(Boolean).join(" ");

const statusColors = {
  completed: { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  pending:   { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  overdue:   { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  failed:    { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  active:    { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "current tenant":  { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  "future tenant":   { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "previous tenant": { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  open:      { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  new:       { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "in-progress": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  resolved:  { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  closed:    { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  occupied:  { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  vacant:    { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  tenant_priority: { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  open_market:     { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
};

export const Badge = ({ status, t }) => {
  const c = statusColors[status] || statusColors.pending;
  const raw = t ? (t[`st_${status}`] || status) : status;
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block" }} />{label}
    </span>
  );
};

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{ width: 48, height: 26, borderRadius: 13, background: value ? "#111111" : "#d1d5db", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", padding: 0, flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 3, left: value ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
  </button>
);

export const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(17,17,17,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
    <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflow: "auto", border: "1px solid #eaeaea", boxShadow: "0 12px 40px rgba(0,0,0,.10)" }}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #eaeaea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111111", letterSpacing: "-0.02em", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "#fafafa", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: 28 }}>{children}</div>
    </div>
  </div>
);

export const Inp = ({ label, value, onChange, type = "text", placeholder, readOnly }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
      style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 8, fontSize: 14, color: "#111111", background: readOnly ? "#fafafa" : "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
  </div>
);

export const Sel = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 8, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// Read-only replacement for what used to be a status dropdown. Status derives from the
// move-in/move-out dates (lib/tenant/status.js), so there is nothing to pick — this shows
// what the dates currently in the form resolve to, and updates live as they are edited.
export const DerivedStatusField = ({ moveInDate, moveOutDate, t }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.colStatus}</label>
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 8, background: "#fafafa", boxSizing: "border-box", minHeight: 42 }}>
      <Badge status={statusFor({ moveInDate: moveInDate || null, moveOutDate: moveOutDate || null })} t={t} />
    </div>
    <p style={{ margin: "5px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{t.tenStatusDerived}</p>
  </div>
);

export const Btn = ({ children, onClick, variant = "primary", size = "md", icon, disabled = false }) => {
  const s = { primary: { background: "#111111", color: "#fff", border: "1px solid #111111" }, secondary: { background: "#fff", color: "#111111", border: "1px solid #eaeaea" }, ghost: { background: "transparent", color: "#6b7280", border: "none" } };
  const sz = { sm: { padding: "6px 14px", fontSize: 13 }, md: { padding: "10px 20px", fontSize: 14 } };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...s[variant], ...sz[size], borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", transition: "opacity .15s", opacity: disabled ? 0.6 : 1 }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = ".85"; }} onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? "0.6" : "1"; }}>
      {icon && <Icon name={icon} size={15} />}{children}
    </button>
  );
};

// ─── LANGUAGE TOGGLE (landlord sidebar) ──────────────────────────────────────
const LangToggle = ({ lang, setLang }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 10 }}>
    <span style={{ color: "#6b7280" }}><Icon name="globe" size={14} /></span>
    <span style={{ fontSize: 11, color: "#6b7280", flex: 1, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 600 }}>{lang === "zh" ? "语言" : "Language"}</span>
    <div style={{ display: "flex", background: "rgba(0,0,0,.3)", borderRadius: 6, padding: 3, gap: 2 }}>
      {[["en", "EN"], ["zh", "中文"]].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)}
          style={{ padding: "3px 9px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", transition: "all .15s",
            background: lang === l ? "#ffffff" : "transparent",
            color: lang === l ? "#111111" : "#6b7280" }}>
          {label}
        </button>
      ))}
    </div>
  </div>
);

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const Sidebar = ({ user, currentPage, onNavigate, onLogout, lang, setLang, t }) => {
  const landlordNav = [
    { id: "dashboard", label: t.navDashboard, icon: "home" },
    { id: "properties", label: t.navProperties, icon: "building" },
    { id: "tenants", label: t.navTenants, icon: "users" },
    { id: "payments", label: t.navPayments, icon: "dollar" },
    { id: "maintenance", label: t.navTodo, icon: "wrench" },
  ];
  const landlordBottomNav = [
    { id: "parking", label: t.navParking, icon: "car" },
    { id: "contracts", label: t.navLeases, icon: "file" },
    { id: "renewals", label: t.navRenewals, icon: "file" },
    { id: "email-automation", label: t.navEmailAutomation, icon: "mail" },
    { id: "email", label: t.navPaymentReminders, icon: "dollar" },
    { id: "documents", label: t.navDocuments, icon: "key" },
    { id: "admin-users", label: t.navAdminUsers, icon: "users" },
  ];
  const tenantNav = [
    { id: "dashboard", label: t.navDashboard, icon: "home" },
    { id: "payment-portal", label: t.navPaymentPortal, icon: "dollar" },
    { id: "payment-history", label: t.navPaymentHistory, icon: "clock" },
    { id: "profile", label: t.navMyProfile, icon: "key" },
    { id: "maintenance-new", label: t.navMaintenance, icon: "wrench" },
  ];
  const nav = user.role === "landlord" ? landlordNav : tenantNav;
  const bottomNav = user.role === "landlord" ? landlordBottomNav : [];

  const NavButton = ({ item }) => {
    const active = currentPage === item.id;
    return (
      <button key={item.id} onClick={() => onNavigate(item.id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", marginBottom: 3, textAlign: "left", fontFamily: "inherit", transition: "all .15s",
          background: active ? "rgba(255,255,255,.10)" : "transparent", color: active ? "#ffffff" : "#9ca3af", fontWeight: active ? 600 : 400, fontSize: 14 }}>
        <Icon name={item.icon} size={17} />{item.label}
        {active && <span style={{ marginLeft: "auto", width: 4, height: 4, background: "#ffffff", borderRadius: "50%" }} />}
      </button>
    );
  };

  return (
    <div style={{ width: 240, background: "#111111", minHeight: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#111111,#000000)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}><Icon name="building" size={20} /></div>
          <div>
            <div style={{ color: "#f5f5f5", fontWeight: 700, fontSize: 16, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.appName}</div>
            <div style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: ".7px" }}>{user.role === "landlord" ? t.landlord : t.tenant}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "14px 12px" }}>
        {/* Language toggle — landlord only */}
        {user.role === "landlord" && <LangToggle lang={lang} setLang={setLang} />}
        {nav.map(item => <NavButton key={item.id} item={item} />)}
      </nav>

      {bottomNav.length > 0 && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          {bottomNav.map(item => <NavButton key={item.id} item={item} />)}
        </div>
      )}

      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ padding: "10px 12px", marginBottom: 4 }}>
          <div style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600 }}>{user.name}</div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>{user.email}</div>
        </div>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: "#6b7280", fontFamily: "inherit", fontSize: 14 }}>
          <Icon name="logout" size={17} />{t.logout}
        </button>
      </div>
    </div>
  );
};

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", letterSpacing: "-0.5px" }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

// Property filter chip row, shared by the Tenants and Payments pages. `hidden` is a Set of
// HIDDEN chip ids (not shown ones) so a newly-added property is visible by default without
// needing to touch stored state. Callers own persistence; this is presentation only.
const filterChipBase = { display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 7, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" };
const filterLinkBase = { marginLeft: 4, fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", padding: 0 };
const filterBarLabel = { fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px" };

export const PropertyFilterBar = ({ chips, hidden, setHidden, t }) => {
  if (chips.length <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <span style={filterBarLabel}>{t.tenFilterProperties}</span>
      {chips.map(({ id, label }) => {
        const shown = !hidden.has(id);
        return (
          <button key={id}
            onClick={() => setHidden(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })}
            style={{ ...filterChipBase, borderColor: shown ? "#111111" : "#eaeaea", background: shown ? "#f5f5f5" : "#fff", color: shown ? "#111111" : "#9ca3af" }}>
            <span style={{ width: 15, height: 15, borderRadius: 4, border: "1px solid", borderColor: shown ? "#111111" : "#cbd5e1", background: shown ? "#111111" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {shown && <Icon name="check" size={10} />}
            </span>
            {label}
          </button>
        );
      })}
      {hidden.size > 0
        ? <button onClick={() => setHidden(new Set())} style={{ ...filterLinkBase, color: "#111111" }}>{t.tenShowAll}</button>
        : <button onClick={() => setHidden(new Set(chips.map(c => c.id)))} style={{ ...filterLinkBase, color: "#9ca3af" }}>{t.tenHideAll}</button>}
    </div>
  );
};

// Property ids flagged NOT in production (`properties.inProduction === false`, see
// lib/property/mappers.js). A tenant or maintenance request tied to one of these ids
// is excluded from the dashboard, Tenants, Payments, and To Do List pages — the flag
// retires a property from active tracking without deleting its history. A tenant with
// no assigned property is unaffected, since the flag is per-property, not per-tenant.
const nonProductionPropertyIds = (properties) =>
  new Set((properties || []).filter(p => p.inProduction === false).map(p => p.id));

const StatCard = ({ label, value, sub, icon, color = "#111111" }) => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #f5f5f5", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <p style={{ margin: "0 0 6px", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{value}</p>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>{sub}</p>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon name={icon} size={20} /></div>
    </div>
  </div>
);

// Shared by both dashboard transition-acknowledgment buttons ("…have moved in" /
// "…have moved out"); only cursor + opacity differ while a confirm is in flight.
const ackBtnStyle = { alignSelf: "flex-start", marginTop: 4, background: "#111111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit" };

// ─── LANDLORD DASHBOARD ───────────────────────────────────────────────────────
const LandlordDashboard = ({ data, setData, t, lang, langReady, user, setPage, setSelectedPropertyId, setSelectedTenantId }) => {
  const { properties, tenants: allTenants, payments: allPayments, maintenance: allMaintenance, contracts, units: allUnits = [] } = data;
  // Everything below reads `tenants`/`payments`/`maintenance`/`units` (not the `all*`
  // names), so scoping down here — instead of hunting every call site in this
  // ~250-line component — makes every dashboard calculation agree by construction.
  // `properties` itself is NOT filtered: the flag hides a property's tenants, not the
  // property listing (that stays on the Properties page, where the flag is toggled).
  const tenantMx = useTenantMutations();
  const [ackingRow, setAckingRow] = useState(null);   // row key currently being confirmed

  // Confirm every pending move-in (or move-out) on one unit row at once, which
  // is what the landlord means by "the tenants have moved in". Optimistic: the
  // row disappears immediately, and on failure the acked fields are restored so
  // it comes back rather than silently staying gone.
  const acknowledgeTransition = async (rowKey, tenantsToAck, direction) => {
    if (!tenantsToAck.length) return;
    const field = direction === "in" ? "moveInAckedAt" : "moveOutAckedAt";
    const now = new Date().toISOString();
    const ids = new Set(tenantsToAck.map(x => x.id));
    setAckingRow(rowKey);
    let prevTenants;
    setData(d => {
      prevTenants = d.tenants;
      return { ...d, tenants: d.tenants.map(x => ids.has(x.id) ? { ...x, [field]: x[field] || now } : x) };
    });
    try {
      const op = direction === "in" ? tenantMx.acknowledgeMoveIn : tenantMx.acknowledgeMoveOut;
      await Promise.all(tenantsToAck.map(x => op(x.id, x[field])));
    } catch (e) {
      console.error("[dashboard] acknowledge transition", e);
      setData(d => ({ ...d, tenants: prevTenants }));
    }
    setAckingRow(null);
  };

  const excludedPropertyIds = useMemo(() => nonProductionPropertyIds(properties), [properties]);
  const tenants = useMemo(
    () => allTenants.filter(x => !x.propertyId || !excludedPropertyIds.has(x.propertyId)),
    [allTenants, excludedPropertyIds]
  );
  const visibleTenantIds = useMemo(() => new Set(tenants.map(x => x.id)), [tenants]);
  const payments = useMemo(
    () => allPayments.filter(x => !x.tenantId || visibleTenantIds.has(x.tenantId)),
    [allPayments, visibleTenantIds]
  );
  const maintenance = useMemo(
    () => allMaintenance.filter(x => !x.propertyId || !excludedPropertyIds.has(x.propertyId)),
    [allMaintenance, excludedPropertyIds]
  );
  const units = useMemo(
    () => allUnits.filter(x => !excludedPropertyIds.has(x.propertyId)),
    [allUnits, excludedPropertyIds]
  );
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(null);
  const [expandedTransitions, setExpandedTransitions] = useState(new Set());
  const autoGeneratedRef = useRef(false);
  const cacheKey = user?.id ? `propmanager_summary_${user.id}` : null;

  // Recently-added tenant banner: surfaces tenants created within the last 7 days.
  // Dismissal persists per-tenant-id, so the banner reappears when a *new* tenant
  // is added later but stays gone for ones the landlord has already acknowledged.
  const NEW_TENANT_DAYS = 7;
  const [dismissedNew, setDismissedNew] = useState(new Set());
  const [dismissReady, setDismissReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("propmanager_dismissed_new_tenants");
      if (raw) setDismissedNew(new Set(JSON.parse(raw)));
    } catch {}
    setDismissReady(true);
  }, []);
  const recentNewTenants = useMemo(() => {
    const cutoff = Date.now() - NEW_TENANT_DAYS * 86400000;
    return (tenants || []).filter(x => x.createdAt && new Date(x.createdAt).getTime() >= cutoff);
  }, [tenants]);
  const visibleNewTenants = recentNewTenants.filter(x => !dismissedNew.has(x.id));
  const dismissNewTenants = () => {
    const next = new Set(dismissedNew);
    recentNewTenants.forEach(x => next.add(x.id));
    setDismissedNew(next);
    try { localStorage.setItem("propmanager_dismissed_new_tenants", JSON.stringify([...next])); } catch {}
  };

  // Fingerprint of every field the summary depends on. If this changes between
  // sessions, we must regenerate; if it's identical we can reuse the cached summary.
  const fingerprint = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const tenantSig = (tenants || []).map(x =>
      `${x.id}:${x.status}:${x.moveInDate || ''}:${x.moveOutDate || ''}:${x.securityDeposit || ''}:${x.monthlyRent || ''}:${x.propertyId || ''}:${x.unitId || ''}:${x.unit || ''}`
    ).sort().join('|');
    const paymentSig = (payments || []).map(x =>
      `${x.id}:${x.status}:${x.dueDate || ''}:${x.paidDate || ''}:${x.tenantId || ''}`
    ).sort().join('|');
    const maintSig = (maintenance || []).map(x =>
      `${x.id}:${x.status}:${x.type || ''}:${x.priority || ''}:${x.date || ''}:${(x.description || '').slice(0,50)}`
    ).sort().join('|');
    const propSig = (properties || []).map(x => `${x.id}:${x.address || ''}`).sort().join('|');
    const unitSig = (units || []).map(x => `${x.id}:${x.propertyId}:${x.unitNumber || ''}:${x.status || ''}`).sort().join('|');
    return `${today}::${tenantSig}::${paymentSig}::${maintSig}::${propSig}::${unitSig}`;
  }, [tenants, payments, maintenance, properties, units]);

  const persistSummary = (json, langUsed, fp) => {
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        summary: json.summary || "",
        lang: langUsed,
        fingerprint: fp,
        generatedAt: json.generatedAt || new Date().toISOString(),
      }));
    } catch {}
  };

  const generateSummary = async () => {
    if (!user?.id || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(null);
    const langAtCall = lang;
    const fpAtCall = fingerprint;
    try {
      const res = await fetch("/api/dashboard/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landlordId: user.id, lang: langAtCall }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setSummary(json.summary || "");
      setSummaryGeneratedAt(json.generatedAt || new Date().toISOString());
      persistSummary(json, langAtCall, fpAtCall);
    } catch (err) {
      setSummaryError(err.message || "error");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (autoGeneratedRef.current) return;
    if (!user?.id || !langReady) return;
    if (summary || summaryLoading) return;
    autoGeneratedRef.current = true;
    // Try cached summary first
    try {
      const raw = cacheKey ? localStorage.getItem(cacheKey) : null;
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && cached.summary && cached.lang === lang && cached.fingerprint === fingerprint) {
          setSummary(cached.summary);
          setSummaryGeneratedAt(cached.generatedAt || null);
          return;
        }
      }
    } catch {}
    generateSummary();
  }, [user?.id, langReady]);
  const occupied = properties.filter(p => p.status === "occupied").length;
  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "overdue");
  const openMaint = maintenance.filter(m => maintStatus.isOpen(m.status));

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayStr = now.toISOString().split("T")[0];
  const paidTenantIds = new Set(
    payments
      .filter(p => p.status === "completed" && p.dueDate && p.dueDate.startsWith(currentMonthKey))
      .map(p => p.tenantId)
  );
  // Only flag rent as unpaid once we're at the 5th of the month or later — gives tenants a grace window through the 4th.
  // A tenant who hasn't moved in yet owes nothing, so a future move-in date excludes them regardless of
  // stored status (the add-tenant form defaults status to "current tenant" even for a future move-in).
  // Mirrors wasActiveLastMonth() in app/api/dashboard/summary/route.js.
  const unpaidTenants = now.getDate() < 5
    ? []
    : tenants.filter(ten => ten.status === "current tenant"
                            && (!ten.moveInDate || ten.moveInDate <= todayStr)
                            && !paidTenantIds.has(ten.id));
  const activeContracts = contracts.filter(c =>
    c.status === "active" &&
    (!c.startDate || c.startDate <= todayStr) &&
    (!c.endDate || c.endDate >= todayStr)
  );
  const sixMo = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const sixMoStr = sixMo.toISOString().split("T")[0];

  // Per-unit transition rows: outgoing (current tenant moving out in next 6mo) + incoming (future tenant)
  const transitionRows = (() => {
    const map = new Map();
    const keyFor = (propertyId, unitId, unitLabel) =>
      `${propertyId || "_"}::${unitId || unitLabel || "_"}`;
    const ensureRow = (k, propertyId, propertyAddress, unitId, unitLabel) => {
      if (!map.has(k)) map.set(k, {
        key: k, propertyId, propertyAddress, unitId, unitLabel,
        outgoing: [], incoming: [], vacantNow: false,
      });
      return map.get(k);
    };

    // Upcoming move-outs in the window, PLUS move-outs whose date has passed
    // that nobody has confirmed. Without the second clause the row dismisses
    // itself the day after the move-out (the tenant derives to "previous"), so
    // a move-out that never actually happened silently disappears.
    tenants
      .filter(ten => (ten.status === "current tenant" && ten.moveOutDate
                      && ten.moveOutDate >= todayStr && ten.moveOutDate <= sixMoStr)
                     || awaitingMoveOutAck(ten))
      .forEach(ten => {
        const unit = units.find(u => u.id === ten.unitId);
        const prop = properties.find(p => p.id === ten.propertyId);
        const k = keyFor(ten.propertyId, ten.unitId, ten.unit);
        ensureRow(k, ten.propertyId, prop?.address || "", ten.unitId, unit?.unitNumber || ten.unit || "—").outgoing.push(ten);
      });

    // Same on the way in: a future tenant flips to "current" on their move-in
    // day and would vanish from this list, so keep them until confirmed.
    tenants
      .filter(ten => ten.status === "future tenant" || awaitingMoveInAck(ten))
      .forEach(ten => {
        const unit = units.find(u => u.id === ten.unitId);
        const prop = properties.find(p => p.id === ten.propertyId);
        const k = keyFor(ten.propertyId, ten.unitId, ten.unit);
        ensureRow(k, ten.propertyId, prop?.address || "", ten.unitId, unit?.unitNumber || ten.unit || "—").incoming.push(ten);
      });

    units.filter(u => u.status === "vacant").forEach(u => {
      const prop = properties.find(p => p.id === u.propertyId);
      const k = keyFor(u.propertyId, u.id, u.unitNumber);
      ensureRow(k, u.propertyId, prop?.address || "", u.id, u.unitNumber || "—").vacantNow = true;
    });

    return Array.from(map.values()).map(row => {
      // Sort each side by date
      row.outgoing.sort((a, b) => (a.moveOutDate || "").localeCompare(b.moveOutDate || ""));
      row.incoming.sort((a, b) => (a.moveInDate || "").localeCompare(b.moveInDate || ""));
      // Gap = calendar months + days between latest move-out and earliest move-in
      let gapMonths = 0, gapDays = 0;
      const latestOut = row.outgoing.length ? row.outgoing[row.outgoing.length - 1].moveOutDate : null;
      const earliestIn = row.incoming.length && row.incoming[0].moveInDate ? row.incoming[0].moveInDate : null;
      if (latestOut && earliestIn) {
        const out = new Date(`${latestOut}T00:00:00`);
        const incoming = new Date(`${earliestIn}T00:00:00`);
        if (incoming > out) {
          gapMonths = (incoming.getFullYear() - out.getFullYear()) * 12 + (incoming.getMonth() - out.getMonth());
          gapDays = incoming.getDate() - out.getDate();
          if (gapDays < 0) {
            gapMonths -= 1;
            // days in the calendar month preceding `incoming`
            gapDays += new Date(incoming.getFullYear(), incoming.getMonth(), 0).getDate();
          }
        }
      }
      // Are ALL current tenants of this unit in the outgoing list? Compare the
      // outgoing count against every current tenant matching the same
      // property+unit (or property+unitId).
      const currentOnUnit = tenants.filter(t => {
        if (t.status !== "current tenant") return false;
        if (t.propertyId !== row.propertyId) return false;
        if (row.unitId) return t.unitId === row.unitId;
        return String(t.unit || "").trim() === String(row.unitLabel || "").trim();
      });
      const allCurrentMovingOut = row.outgoing.length > 0 && currentOnUnit.length === row.outgoing.length;
      // The transitions whose date has arrived but that nobody has confirmed —
      // these are what the "have moved in / out" buttons act on.
      const pendingMoveIns = row.incoming.filter(x => awaitingMoveInAck(x));
      const pendingMoveOuts = row.outgoing.filter(x => awaitingMoveOutAck(x));
      return { ...row, gapMonths, gapDays, allCurrentMovingOut, earliestIncomingDate: earliestIn, pendingMoveIns, pendingMoveOuts };
    }).sort((a, b) => {
      if (a.propertyAddress !== b.propertyAddress)
        return a.propertyAddress.localeCompare(b.propertyAddress);
      return String(a.unitLabel).localeCompare(String(b.unitLabel), undefined, { numeric: true });
    });
  })();

  return (
    <div>
      <PageHeader title={t.dashTitle} subtitle={t.dashSubtitle} />
      {dismissReady && visibleNewTenants.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, background: "#f0fdf4", border: "1px solid #dcfce7", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: "#166534", lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}>{t.dashNewTenantsTitle}</span>{": "}
            {visibleNewTenants.map((x, i) => {
              const prop = properties.find(p => p.id === x.propertyId);
              const unitLabel = x.unit || units.find(u => u.id === x.unitId)?.unitNumber || "";
              const loc = [prop?.address, unitLabel && `${t.unit} ${unitLabel}`].filter(Boolean).join(" · ");
              return (
                <span key={x.id}>
                  {i > 0 && ", "}
                  <button onClick={() => { setSelectedTenantId(x.id); setPage('tenant-detail'); }} style={{ background: "none", border: "none", padding: 0, color: "#166534", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                    {x.name}{x.lastName ? ` ${x.lastName}` : ""}
                  </button>
                  {loc && <span style={{ color: "#4d7c5a", fontWeight: 400 }}>{` (${loc})`}</span>}
                </span>
              );
            })}
          </div>
          <button onClick={dismissNewTenants} title={t.dashDismiss} aria-label={t.dashDismiss} style={{ background: "none", border: "none", padding: 0, color: "#166534", fontSize: 18, lineHeight: 1, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>×</button>
        </div>
      )}
      <div style={{ background: "linear-gradient(135deg,#f5f5f5,#fafafa)", borderRadius: 14, padding: 22, border: "1px solid #f3f4f6", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: summary || summaryLoading || summaryError ? 12 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Icon name="sparkles" size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashSummaryTitle}</h3>
          </div>
          <button
            onClick={generateSummary}
            disabled={summaryLoading || !user?.id}
            style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: summaryLoading ? "#9ca3af" : "#111111", border: "none", borderRadius: 8, cursor: summaryLoading ? "default" : "pointer" }}
          >
            {summaryLoading ? t.dashSummaryLoading : (summary ? t.dashSummaryRegenerate : t.dashSummaryGenerate)}
          </button>
        </div>
        {summaryError ? (
          <div style={{ fontSize: 14, color: "#b91c1c", lineHeight: 1.55 }}>{t.dashSummaryError}</div>
        ) : summary ? (
          <div>
            <div style={{ fontSize: 15, color: "#1a1a1a", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{summary}</div>
            {summaryGeneratedAt && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                {t.dashSummaryGeneratedAt(new Date(summaryGeneratedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}
              </div>
            )}
          </div>
        ) : summaryLoading ? null : (
          <div style={{ fontSize: 13, color: "#6b7280" }}>{t.dashSummaryEmpty}</div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label={t.statProperties} value={properties.length} sub={`${occupied} ${t.statOccupied}`} icon="building" />
        <StatCard label={t.statPending} value={pendingPayments.length} sub={t.statRequireAttention} icon="clock" color="#ef4444" />
        <StatCard label={t.statOpenMaint} value={openMaint.length} sub={t.statRequests} icon="wrench" color="#f59e0b" />
      </div>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashTransitions}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.dashUnitCount(transitionRows.length)}</span>
            {transitionRows.length > 0 && (() => {
              const allExpanded = transitionRows.every(r => expandedTransitions.has(r.key));
              return (
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpandedTransitions(allExpanded ? new Set() : new Set(transitionRows.map(r => r.key)))}
                >
                  {allExpanded ? t.dashCollapseAll : t.dashExpandAll}
                </Btn>
              );
            })()}
          </div>
        </div>
        {transitionRows.length === 0 ? (
          <div style={{ padding: "14px 0", fontSize: 13, color: "#6b7280" }}>{t.dashTransitionsEmpty}</div>
        ) : transitionRows.map(row => {
          const showGapBadge = row.gapMonths > 0 || row.gapDays > 0;
          const showUnresolvedBadge = !showGapBadge && (row.outgoing.length > 0 || row.vacantNow) && row.incoming.length === 0;
          return (
            <div key={row.key} style={{ padding: "14px 0", borderBottom: "1px solid #fafafa" }}>
              <div
                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, cursor: "pointer", padding: 8, margin: `-8px -8px ${expandedTransitions.has(row.key) ? 2 : -8}px -8px`, borderRadius: 8, transition: "background .15s" }}
                onClick={() => setExpandedTransitions(prev => { const next = new Set(prev); next.has(row.key) ? next.delete(row.key) : next.add(row.key); return next; })}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#9ca3af", userSelect: "none" }}>{expandedTransitions.has(row.key) ? "▾" : "▸"}</span>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: "#111111", cursor: row.propertyId && setPage ? "pointer" : "default" }}
                    onClick={e => { e.stopPropagation(); if (row.propertyId && setPage && setSelectedPropertyId) { setSelectedPropertyId(row.propertyId); setPage("property-detail"); } }}
                    onMouseEnter={e => { if (row.propertyId && setPage) e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >
                    Unit {row.unitLabel} · {row.propertyAddress}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {showGapBadge && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "4px 10px", borderRadius: 6, letterSpacing: ".3px" }}>
                      {t.dashGap(row.gapMonths, row.gapDays)}
                    </span>
                  )}
                  {showUnresolvedBadge && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", background: "#fee2e2", padding: "4px 10px", borderRadius: 6, letterSpacing: ".3px" }}>
                      {t.dashGapUnresolved}
                    </span>
                  )}
                  {row.allCurrentMovingOut && row.incoming.length > 0 && row.earliestIncomingDate && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#0369a1" }}>
                      {t.dashCleanBefore(fmtDate(row.earliestIncomingDate))}
                    </span>
                  )}
                </div>
              </div>
              {expandedTransitions.has(row.key) && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{t.dashMovingOut}</div>
                  {row.outgoing.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {row.outgoing.map(ten => (
                        <div key={ten.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#fb923c,#ea580c)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(ten.name || "?").charAt(0)}</div>
                          <div>
                            <div
                              style={{ fontSize: 15, fontWeight: 600, color: "#111111", cursor: setPage ? "pointer" : "default" }}
                              onClick={() => { if (setPage && setSelectedTenantId) { setSelectedTenantId(ten.id); setPage("tenant-detail"); } }}
                              onMouseEnter={e => { if (setPage) e.currentTarget.style.textDecoration = "underline"; }}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                            >{tenantFullName(ten)}</div>
                            <div style={{ fontSize: 13, color: "#9ca3af" }}>{fmtDate(ten.moveOutDate)}</div>
                            {awaitingMoveOutAck(ten) && (
                              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600, marginTop: 2 }}>{t.dashAckPendingMoveOut}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {row.pendingMoveOuts.length > 0 && (
                        <button
                          onClick={() => acknowledgeTransition(row.key, row.pendingMoveOuts, "out")}
                          disabled={ackingRow === row.key}
                          style={{ ...ackBtnStyle, cursor: ackingRow === row.key ? "wait" : "pointer", opacity: ackingRow === row.key ? 0.7 : 1 }}
                        >
                          {ackingRow === row.key ? t.dashAckSaving : t.dashAckMovedOut(row.pendingMoveOuts.length)}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>
                      {row.vacantNow ? t.dashVacantNow : t.dashNoOutgoing}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{t.dashMovingIn}</div>
                  {row.incoming.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {row.incoming.map(ten => (
                        <div key={ten.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(ten.name || "?").charAt(0)}</div>
                          <div>
                            <div
                              style={{ fontSize: 15, fontWeight: 600, color: "#111111", cursor: setPage ? "pointer" : "default" }}
                              onClick={() => { if (setPage && setSelectedTenantId) { setSelectedTenantId(ten.id); setPage("tenant-detail"); } }}
                              onMouseEnter={e => { if (setPage) e.currentTarget.style.textDecoration = "underline"; }}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                            >{tenantFullName(ten)}</div>
                            <div style={{ fontSize: 13, color: "#16a34a" }}>{ten.moveInDate ? fmtDate(ten.moveInDate) : "—"}</div>
                            {(!ten.securityDeposit || +ten.securityDeposit <= 0) ? (
                              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 2 }}>{t.securityDepositNotReceived}</div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginTop: 2 }}>{t.securityDepositReceived}</div>
                            )}
                            {awaitingMoveInAck(ten) && (
                              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600, marginTop: 2 }}>{t.dashAckPendingMoveIn}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {row.pendingMoveIns.length > 0 && (
                        <button
                          onClick={() => acknowledgeTransition(row.key, row.pendingMoveIns, "in")}
                          disabled={ackingRow === row.key}
                          style={{ ...ackBtnStyle, cursor: ackingRow === row.key ? "wait" : "pointer", opacity: ackingRow === row.key ? 0.7 : 1 }}
                        >
                          {ackingRow === row.key ? t.dashAckSaving : t.dashAckMovedIn(row.pendingMoveIns.length)}
                        </button>
                      )}
                    </div>
                  ) : (() => {
                    const latestOut = row.outgoing.length ? row.outgoing[row.outgoing.length - 1].moveOutDate : null;
                    let availableLabel = null;
                    if (latestOut) {
                      const next = new Date(`${latestOut}T00:00:00`);
                      next.setDate(next.getDate() + 1);
                      const iso = next.toISOString().slice(0, 10);
                      availableLabel = `Unit ${row.unitLabel} ${t.dashAvailable} ${fmtDate(iso)}`;
                    } else if (row.vacantNow) {
                      availableLabel = `Unit ${row.unitLabel} ${t.dashAvailableNow}`;
                    }
                    return (
                      <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", padding: "7px 12px", borderRadius: 8, letterSpacing: ".2px" }}>
                          <span style={{ fontSize: 15, lineHeight: 1 }}>⚠</span>
                          {t.dashNoIncoming}
                        </div>
                        {availableLabel && (
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c", marginTop: 8 }}>
                            {availableLabel}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashUnpaidRent} — {currentMonthLabel}</h3>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.dashTenantCount(unpaidTenants.length)}</span>
          </div>
          {unpaidTenants.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: 13, color: "#6b7280" }}>{t.dashUnpaidEmpty}</div>
          ) : unpaidTenants.map(ten => {
            const prop = properties.find(p => p.id === ten.propertyId);
            return (
              <div key={ten.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #fafafa" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#111111,#000000)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{(ten.name || "?").charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{tenantFullName(ten)}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{ten.unit} · {prop?.address}</div>
                    {ten.notes && (
                      <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 4 }}>{ten.notes}</div>
                    )}
                  </div>
                </div>
                <Badge status="overdue" t={t} />
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.recentPayments}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
                {[t.colTenant, t.colAmount, t.colDueDate].map(h => <th key={h} style={{ padding: "0 12px 10px 0", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payments.slice(0,5).map(p => {
                const ten = tenants.find(ten => ten.id === p.tenantId);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #fafafa" }}>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14, fontWeight: 500 }}>{ten ? tenantFullName(ten) : "—"}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14 }}>{fmt(p.amount || ten?.monthlyRent || 0)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "#6b7280" }}>{p.dueDate ? fmtDate(p.dueDate.slice(0,7) + "-05T12:00:00") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── PROPERTIES PAGE ──────────────────────────────────────────────────────────
const PropertiesPage = ({ data, t, refresh, user, setPage, setSelectedPropertyId }) => {
  const propertyMx = usePropertyMutations();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ address: "", city: "", state: "CA", zip: "", units: "1", type: "Single Family", status: "vacant", inProduction: true });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const setEF = (k,v) => setEditForm(f => ({...f,[k]:v}));
  const [editError, setEditError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRefs = useRef({});

  const handleImageUpload = async (propertyId, file) => {
    if (!file) return;
    setUploadingId(propertyId);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("propertyId", propertyId);
      fd.append("landlordId", user.id);
      const res = await fetch("/api/properties/upload-image", { method: "POST", body: fd });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { error: text || "Upload failed" }; }
      if (!res.ok) {
        setUploadError(json.error || "Upload failed");
      } else {
        await refresh();
      }
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };
  const add = async () => {
    if (!form.address) return;
    try {
      await propertyMx.create({
        landlordId: user.id, address: form.address, city: form.city, state: form.state, zip: form.zip,
        units: form.units, type: form.type, status: form.status, inProduction: form.inProduction,
      });
    } catch { return; }
    await refresh(); setShow(false);
  };
  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditing(p);
    setEditForm({ address: p.address, city: p.city, state: p.state, zip: p.zip, units: String(p.units || ""), type: p.type || "Single Family", status: p.status || "vacant", driveLink: p.driveLink || "", inProduction: p.inProduction !== false });
  };
  const saveEdit = async () => {
    setEditError(null);
    const res = await fetch("/api/properties/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: editing.id,
        address: editForm.address, city: editForm.city, state: editForm.state, zip: editForm.zip,
        units: editForm.units, type: editForm.type, status: editForm.status,
        driveLink: editForm.driveLink || "", inProduction: editForm.inProduction,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setEditError(json.error || "Failed to save."); return; }
    await refresh();
    setEditing(null);
  };
  const deleteProperty = async () => {
    try { await propertyMx.remove(confirmDelete.id); } catch { return; }
    await refresh(); setConfirmDelete(null);
  };

  return (
    <div>
      <PageHeader title={t.propTitle} subtitle={t.propSubtitle(data.properties.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addProperty}</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18 }}>
        {data.properties.map(p => {
          const propertyUnits = (data.units || []).filter(u => u.propertyId === p.id);
          const occupiedUnits = propertyUnits.filter(u => u.status === 'occupied').length;
          const totalUnits = propertyUnits.length;
          return (
            <div key={p.id} onClick={() => { if (setSelectedPropertyId && setPage) { setSelectedPropertyId(p.id); setPage('property-detail'); } }} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f5f5f5", boxShadow: "0 1px 3px rgba(0,0,0,.04)", cursor: setSelectedPropertyId ? "pointer" : "default", transition: "box-shadow .15s" }}
              onMouseEnter={e => { if (setSelectedPropertyId) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.10)"; }}
              onMouseLeave={e => { if (setSelectedPropertyId) e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.04)"; }}>
              <div style={{ position: "relative", height: 160, background: "#f5f5f5", overflow: "hidden", cursor: setSelectedPropertyId ? "pointer" : "default" }}
                onClick={() => { if (setSelectedPropertyId && setPage) { setSelectedPropertyId(p.id); setPage('property-detail'); } }}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="home" size={40} color="#cbd5e1" /></div>
                }
                <input
                  ref={el => { fileInputRefs.current[p.id] = el; }}
                  type="file" accept="image/*" style={{ display: "none" }}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); handleImageUpload(p.id, e.target.files[0]); }}
                />
                <button
                  onClick={e => { e.stopPropagation(); setUploadError(null); fileInputRefs.current[p.id]?.click(); }}
                  disabled={uploadingId === p.id}
                  style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(15,23,42,0.7)", color: "#fff", border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: uploadingId === p.id ? "default" : "pointer", backdropFilter: "blur(4px)" }}>
                  {uploadingId === p.id ? t.uploadingPhoto : p.imageUrl ? t.changePhoto : t.uploadPhoto}
                </button>
                {uploadError && uploadingId !== p.id && (
                  <div style={{ position: "absolute", top: 8, left: 8, right: 8, background: "rgba(220,38,38,0.85)", color: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600 }}>{uploadError}</div>
                )}
              </div>
              <div style={{ padding: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{p.address}</h3>
                    {p.inProduction === false && (
                      <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 700, color: "#991b1b", background: "#fee2e2", padding: "2px 8px", borderRadius: 6, letterSpacing: ".3px" }}>{t.propNotInProduction}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={e => openEdit(p, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", borderRadius: 6, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#111111"} onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}>
                      <Icon name="edit" size={15} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(p); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9ca3af", borderRadius: 6, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}>
                      <Icon name="trash" size={15} />
                    </button>
                    <Badge status={p.status} t={t} />
                  </div>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>{p.city}, {p.state} {p.zip} · {p.type}</p>
                <div style={{ background: "#fafafa", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>Occupied Units</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#111111" }}>{occupiedUnits}<span style={{ color: "#9ca3af", fontSize: 13, fontWeight: 400 }}>/{totalUnits}</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {show && (
        <Modal title={t.addPropertyTitle} onClose={() => setShow(false)}>
          <Inp label={t.streetAddress} value={form.address} onChange={v => setF("address",v)} placeholder="123 Main Street" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.city} value={form.city} onChange={v => setF("city",v)} />
            <Inp label={t.zip} value={form.zip} onChange={v => setF("zip",v)} />
          </div>
          <Sel label={t.type} value={form.type} onChange={v => setF("type",v)} options={["Single Family","Duplex","Condo","Apartment","Townhouse"].map(x => ({value:x,label:x}))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.units} value={form.units} onChange={v => setF("units",v)} type="number" />
            <Sel label={t.status} value={form.status} onChange={v => setF("status",v)} options={[{value:"vacant",label:t.st_vacant},{value:"occupied",label:t.st_occupied}]} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              <input type="checkbox" checked={form.inProduction} onChange={e => setF("inProduction", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              {t.inProduction}
            </label>
            {!form.inProduction && <p style={{ margin: "5px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{t.inProductionHint}</p>}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShow(false)}>{t.cancel}</Btn>
            <Btn onClick={add}>{t.addProperty}</Btn>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title={t.editProperty} onClose={() => setEditing(null)}>
          <Inp label={t.streetAddress} value={editForm.address} onChange={v => setEF("address",v)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.city} value={editForm.city} onChange={v => setEF("city",v)} />
            <Inp label={t.zip} value={editForm.zip} onChange={v => setEF("zip",v)} />
          </div>
          <Sel label={t.type} value={editForm.type} onChange={v => setEF("type",v)} options={["Single Family","Duplex","Condo","Apartment","Townhouse"].map(x => ({value:x,label:x}))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.units} value={editForm.units} onChange={v => setEF("units",v)} type="number" />
            <Sel label={t.status} value={editForm.status} onChange={v => setEF("status",v)} options={[{value:"vacant",label:t.st_vacant},{value:"occupied",label:t.st_occupied}]} />
          </div>
          <Inp label={t.driveFolderUrl} value={editForm.driveLink} onChange={v => setEF("driveLink",v)} placeholder="https://drive.google.com/drive/folders/..." />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>
              <input type="checkbox" checked={editForm.inProduction} onChange={e => setEF("inProduction", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              {t.inProduction}
            </label>
            {!editForm.inProduction && <p style={{ margin: "5px 0 0", fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{t.inProductionHint}</p>}
          </div>
          {editError && <div style={{ fontSize: 13, color: "#ef4444", marginTop: 4 }}>{editError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => { setEditing(null); setEditError(null); }}>{t.cancel}</Btn>
            <Btn onClick={saveEdit}>{t.saveChanges}</Btn>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete Property" onClose={() => setConfirmDelete(null)}>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>Are you sure you want to delete <strong>{confirmDelete.address}</strong>? This cannot be undone.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setConfirmDelete(null)}>{t.cancel}</Btn>
            <Btn onClick={deleteProperty} style={{ background: "#ef4444" }}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── TENANT DELETE MODAL ──────────────────────────────────────────────────────
// One modal for both places a tenant can be deleted from (the tenants table and
// the tenant detail page), exported for the latter — same reason
// `useUnitMutations` is exported: the second caller lives in
// phase2-components.jsx. Duplicating it there would mean two copies of the
// blocker rendering, and the refusal wording is the whole point of this screen.
//
// `onDeleted` runs only after the server confirms the delete; the caller decides
// what "gone" means for its surface (close the modal vs. navigate back).
export const TenantDeleteModal = ({ tenant, data, t, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [serverBlockers, setServerBlockers] = useState(null);
  const [error, setError] = useState("");

  // Counted from loaded data so the refusal appears *before* the red button
  // rather than after pressing it. The server's answer wins once we have one:
  // this snapshot can be stale or RLS-narrowed, so it can undercount, and an
  // empty list here is "nothing known to block", not permission.
  const blockers = serverBlockers ?? blockersFromData(data, tenant.id);

  const confirmDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/delete-tenant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: tenant.id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 409 here means the pre-flight missed something — show what the
        // server found instead of the stale local list.
        if (json.blockers?.length) setServerBlockers(json.blockers);
        else setError(json.error || t.deleteTenantFailed);
        setDeleting(false);
        return;
      }
    } catch {
      setError(t.deleteTenantFailed);
      setDeleting(false);
      return;
    }
    await onDeleted();
  };

  return (
    <Modal title={t.deleteTenant} onClose={() => { if (!deleting) onClose(); }}>
      {blockers.length > 0 ? (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#111111" }}>
            {t.deleteTenantBlockedBefore}<strong>{tenantFullName(tenant)}</strong>{t.deleteTenantBlockedAfter}
          </p>
          <div style={{ margin: "0 0 16px", border: "1px solid #eaeaea", borderRadius: 8, overflow: "hidden" }}>
            {blockers.map((b, i) => (
              <div key={b.key} style={{ padding: "10px 12px", fontSize: 14, color: "#374151", borderTop: i === 0 ? "none" : "1px solid #f5f5f5" }}>
                {t[`blocker_${b.key}`] ? t[`blocker_${b.key}`](b.count) : `${b.count} × ${b.key}`}
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>{t.deleteTenantBlockedHint}</p>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>
            {t.deleteTenantConfirmBefore}<strong>{tenantFullName(tenant)}</strong>{t.deleteTenantConfirmAfter}
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#9ca3af" }}>
            {t.deleteWarning}
          </p>
        </>
      )}
      {error && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="secondary" onClick={onClose} disabled={deleting}>{t.cancel}</Btn>
        {/* Hidden, not disabled, while something is in the way — the list above
            already says why, and the server would refuse anyway. */}
        {blockers.length === 0 && (
          <button onClick={confirmDelete} disabled={deleting} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1, fontFamily: "inherit" }}>
            {deleting ? t.deleting : t.deleteTenant}
          </button>
        )}
      </div>
    </Modal>
  );
};

// ─── TENANTS PAGE ─────────────────────────────────────────────────────────────
const TenantsPage = ({ data, setData, t, refresh, user, setPage, setSelectedTenantId }) => {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  // No `status` field: it derives from moveInDate/moveOutDate (lib/tenant/status.js).
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", password: "", zelleName: "", moveInDate: "", moveOutDate: "", notes: "", securityDeposit: "", securityDepositRefunded: false, createLogin: false });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));

  const [editTenant, setEditTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const setEF = (k,v) => setEditForm(f => ({...f,[k]:v}));

  const [editError, setEditError] = useState("");

  const [groupBy, setGroupBy] = useState("unit");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openEdit = (ten) => {
    setEditTenant(ten);
    setEditError("");
    setEditForm({ name: ten.name, lastName: ten.lastName || "", email: ten.email || "", phone: ten.phone, propertyId: ten.propertyId || "", unit: ten.unit || "", unitId: ten.unitId || "", monthlyRent: ten.monthlyRent || "", password: "", zelleName: ten.zelleName || "", moveInDate: ten.moveInDate || "", moveOutDate: ten.moveOutDate || "", notes: ten.notes || "", securityDeposit: ten.securityDeposit || "", securityDepositRefunded: ten.securityDepositRefunded || false });
  };

  const saveEdit = async () => {
    setEditError("");
    setEditSaving(true);
    const res = await fetch("/api/auth/update-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: editTenant.id,
        name: editForm.name,
        lastName: editForm.lastName || null,
        email: (editForm.email || "").trim() !== (editTenant.email || "").trim() ? (editForm.email || "").trim() : undefined,
        phone: editForm.phone,
        propertyId: editForm.propertyId || null,
        unit: editForm.unit,
        unitId: editForm.unitId || null,
        monthlyRent: editForm.monthlyRent || null,
        password: editForm.password || null,
        zelleName: editForm.zelleName || null,
        moveInDate: editForm.moveInDate || null,
        moveOutDate: editForm.moveOutDate || null,
        notes: editForm.notes || null,
        securityDeposit: editForm.securityDeposit === "" ? null : editForm.securityDeposit,
        securityDepositRefunded: editForm.securityDepositRefunded,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setEditError(json.error || "Something went wrong."); setEditSaving(false); return; }
    await refresh();
    setEditTenant(null);
    setEditSaving(false);
  };

  const add = async () => {
    if (!form.name || !form.moveInDate) {
      setAddError(t.tenantNameMoveInRequired);
      return;
    }
    setAddError("");
    setSaving(true);
    const res = await fetch("/api/auth/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, lastName: form.lastName || null, phone: form.phone,
        email: form.email?.trim() || null,
        password: form.createLogin ? form.password : null,
        propertyId: form.propertyId, unit: form.unit,
        zelleName: form.zelleName, landlordId: user.id,
        moveInDate: form.moveInDate, moveOutDate: form.moveOutDate || null,
        notes: form.notes || null,
        securityDeposit: form.securityDeposit === "" ? null : form.securityDeposit,
        securityDepositRefunded: form.securityDepositRefunded,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddError(json.error || t.failedCreateTenant);
      setSaving(false);
      return;
    }
    await refresh();
    setShow(false);
    setForm({ name: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", password: "", zelleName: "", moveInDate: "", moveOutDate: "", notes: "", securityDeposit: "", securityDepositRefunded: false, createLogin: false });
    setSaving(false);
  };

  // Persisted property filter: store HIDDEN property ids so newly-added properties show by default
  const [hiddenProps, setHiddenProps] = useState(new Set());
  const [filterReady, setFilterReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("propmanager_tenant_hidden_props");
      if (raw) setHiddenProps(new Set(JSON.parse(raw)));
    } catch { /* ignore malformed storage */ }
    setFilterReady(true);
  }, []);
  useEffect(() => {
    if (filterReady) localStorage.setItem("propmanager_tenant_hidden_props", JSON.stringify([...hiddenProps]));
  }, [hiddenProps, filterReady]);

  // Persisted status filter: "current" shows current + future tenants, "past" shows previous tenants
  const [statusFilter, setStatusFilter] = useState("current");
  const [statusReady, setStatusReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("propmanager_tenant_status_filter");
      if (raw === "current" || raw === "past") setStatusFilter(raw);
    } catch { /* ignore malformed storage */ }
    setStatusReady(true);
  }, []);
  useEffect(() => {
    if (statusReady) localStorage.setItem("propmanager_tenant_status_filter", statusFilter);
  }, [statusFilter, statusReady]);

  // Tenants of a property flagged "not in production" never reach the page, independent
  // of the show/hide chip state above — that state is a per-session display preference,
  // this is a data-level exclusion. Properties with no visible tenants left are also
  // dropped from the chip list itself, since toggling an always-empty chip is dead UI.
  const excludedPropertyIds = nonProductionPropertyIds(data.properties);
  const inProductionTenants = data.tenants.filter(ten => !ten.propertyId || !excludedPropertyIds.has(ten.propertyId));

  const propKey = (ten) => ten.propertyId || "__none__";
  const isVisible = (ten) => !hiddenProps.has(propKey(ten));
  const filterChips = [
    ...data.properties.filter(p => !excludedPropertyIds.has(p.id)).map(p => ({ id: p.id, label: p.address })),
    ...(inProductionTenants.some(ten => !ten.propertyId) ? [{ id: "__none__", label: t.tenNoProperty }] : []),
  ];

  const currentTenants = inProductionTenants.filter(ten => ten.status?.toLowerCase() === "current tenant" && isVisible(ten));
  const futureTenants  = inProductionTenants.filter(ten => ten.status?.toLowerCase() === "future tenant" && isVisible(ten));
  const pastTenants    = inProductionTenants.filter(ten => ten.status?.toLowerCase() === "previous tenant" && isVisible(ten));

  // Tenants shown depend on the persisted status filter; past view has no "future" secondary group
  const primaryTenants   = statusFilter === "past" ? pastTenants : currentTenants;
  const secondaryTenants = statusFilter === "past" ? []          : futureTenants;

  // Two-level hierarchy: property → unit → tenants (primary + secondary stacked per unit)
  const propertyGroups = groupBy === "none" ? null : (() => {
    const map = {};
    const ensureUnit = (ten) => {
      const key = propKey(ten);
      if (!map[key]) map[key] = { key, prop: data.properties.find(p => p.id === ten.propertyId) || null, units: {} };
      const unitKey = ten.unit || "—";
      if (!map[key].units[unitKey]) map[key].units[unitKey] = { unit: unitKey, current: [], future: [] };
      return map[key].units[unitKey];
    };
    primaryTenants.forEach(ten => ensureUnit(ten).current.push(ten));
    secondaryTenants.forEach(ten => ensureUnit(ten).future.push(ten));
    return Object.values(map)
      .map(g => {
        const unitList = Object.values(g.units).sort((a, b) =>
          String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
        const currentCount = unitList.reduce((s, u) => s + u.current.length, 0);
        const totalRent = unitList.reduce((s, u) => s + u.current.reduce((x, ten) => x + (ten.monthlyRent || 0), 0), 0);
        return { ...g, unitList, currentCount, totalRent };
      })
      .sort((a, b) => (a.prop?.address || "￿").localeCompare(b.prop?.address || "￿"));
  })();

  // Inline "Security Deposit Refunded" checkbox (Past Tenants view). Optimistically
  // flips local state, persists via the dedicated route, and reverts on failure.
  const toggleRefunded = async (ten, checked) => {
    setData(d => ({ ...d, tenants: d.tenants.map(x => x.id === ten.id ? { ...x, securityDepositRefunded: checked } : x) }));
    try {
      const res = await fetch("/api/auth/set-deposit-refunded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: ten.id, refunded: checked }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setData(d => ({ ...d, tenants: d.tenants.map(x => x.id === ten.id ? { ...x, securityDepositRefunded: !checked } : x) }));
    }
  };

  const renderTenantRow = (ten) => {
    const prop = data.properties.find(p => p.id === ten.propertyId);
    return (
      <tr key={ten.id} style={{ borderTop: "1px solid #fafafa" }}>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#111111,#000000)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{(ten.name || "?").charAt(0)}</div>
            <button onClick={() => { if (setSelectedTenantId && setPage) { setSelectedTenantId(ten.id); setPage('tenant-detail'); } }} style={{ background: "none", border: "none", padding: 0, cursor: setPage ? "pointer" : "default", fontSize: 14, fontWeight: 600, color: "#111111", fontFamily: "inherit", textAlign: "left" }} onMouseEnter={e => { if (setPage) e.currentTarget.style.textDecoration = "underline"; }} onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{tenantFullName(ten)}</button>
          </div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>{ten.email}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{ten.phone}</div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>{prop?.address || "—"}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>{ten.unit || data.units.find(u => u.id === ten.unitId)?.unitNumber || "—"}</div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: ten.monthlyRent ? "#111111" : "#9ca3af" }}>
            {ten.monthlyRent ? fmt(ten.monthlyRent) : "—"}
          </span>
        </td>
        <td style={{ padding: "14px 20px" }}><Badge status={ten.status} t={t} /></td>
        <td style={{ padding: "14px 20px", whiteSpace: "nowrap" }}>
          {statusFilter === "past" ? (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={!!ten.securityDepositRefunded} onChange={e => toggleRefunded(ten, e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: ten.securityDepositRefunded ? "#16a34a" : "#9ca3af" }}>{ten.securityDepositRefunded ? t.depositRefunded : t.depositNotRefunded}</span>
            </label>
          ) : (!ten.securityDeposit || +ten.securityDeposit <= 0) ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{t.securityDepositNotReceived}</span>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{fmt(ten.securityDeposit)}</span>
          )}
        </td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => openEdit(ten)} style={{ background: "#fafafa", border: "1px solid #eaeaea", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
              <Icon name="edit" size={13} /> {t.editBtn}
            </button>
            <button onClick={() => setDeleteTarget(ten)} style={{ ...dangerIconBtnStyle, fontSize: 12 }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <PageHeader title={t.tenTitle} subtitle={statusFilter === "past" ? t.tenSubtitlePast(pastTenants.length) : t.tenSubtitle(currentTenants.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addTenant}</Btn>} />

      {/* Status filter (persisted across sessions) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px" }}>{t.tenFilterStatus}</span>
        {[["current", t.tenFilterCurrent], ["past", t.tenFilterPast]].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              borderColor: statusFilter === val ? "#111111" : "#eaeaea",
              background: statusFilter === val ? "#f5f5f5" : "#fff",
              color: statusFilter === val ? "#111111" : "#6b7280" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Property filter (persisted across sessions) */}
      <PropertyFilterBar chips={filterChips} hidden={hiddenProps} setHidden={setHiddenProps} t={t} />

      {/* Display by toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px" }}>{t.displayBy}</span>
        {[["none", t.displayAll], ["unit", t.displayByUnit]].map(([val, label]) => (
          <button key={val} onClick={() => setGroupBy(val)}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              borderColor: groupBy === val ? "#111111" : "#eaeaea",
              background: groupBy === val ? "#f5f5f5" : "#fff",
              color: groupBy === val ? "#111111" : "#6b7280" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {[t.colTenant, t.colContact, t.colProperty, t.colMonthlyRent, t.colStatus, statusFilter === "past" ? t.colDepositRefunded : t.colSecurityDeposit, ""].map((h,i) => <th key={i} style={{ padding: "14px 20px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {primaryTenants.length === 0 && secondaryTenants.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "28px 20px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>{statusFilter === "past" ? t.tenNonePast : t.tenNoneToShow}</td></tr>
            ) : groupBy === "none" ? (
              <>
                {primaryTenants.map(ten => renderTenantRow(ten))}
                {secondaryTenants.length > 0 && <>
                  <tr><td colSpan={7} style={{ padding: "8px 20px", background: "#fafafa", borderTop: "2px solid #eaeaea", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".6px" }}>{t.statusFutureTenant}</td></tr>
                  {secondaryTenants.map(ten => renderTenantRow(ten))}
                </>}
              </>
            ) : (
              <>
                {propertyGroups.map(({ key, prop, unitList, currentCount, totalRent }) => (
                  <Fragment key={key}>
                    {/* Property section (top level) */}
                    <tr>
                      <td colSpan={7} style={{ padding: "14px 20px", background: "#fafafa", borderTop: "1px solid #eaeaea" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ color: "#6b7280", display: "flex" }}><Icon name="building" size={16} /></span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#111111", letterSpacing: "-0.2px" }}>{prop?.address || t.tenNoProperty}</span>
                          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{t.dashUnitCount(unitList.length)} · {t.dashTenantCount(currentCount)}</span>
                          {totalRent > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{fmt(totalRent)}{t.tenPerMo}</span>}
                        </div>
                      </td>
                    </tr>
                    {/* Units (nested under property) */}
                    {unitList.map(({ unit, current, future }) => (
                      <Fragment key={`${key}::${unit}`}>
                        <tr>
                          <td colSpan={7} style={{ padding: "8px 20px 8px 48px", background: "#f5f5f5", borderTop: "1px solid #eaeaea", borderLeft: "3px solid #e5e5e5" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{t.unit} {unit}</span>
                              <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.dashTenantCount(current.length)}</span>
                            </div>
                          </td>
                        </tr>
                        {current.map(ten => renderTenantRow(ten))}
                        {future.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={7} style={{ padding: "6px 20px 6px 48px", background: "#fafafa", borderLeft: "3px solid #e5e5e5", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".6px" }}>
                                {t.statusFutureTenant}
                              </td>
                            </tr>
                            {future.map(ten => renderTenantRow(ten))}
                          </>
                        )}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Tenant Modal */}
      {show && (
        <Modal title={t.addTenantTitle} onClose={() => { setShow(false); setAddError(""); }} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.firstName} value={form.name} onChange={v => setF("name",v)} placeholder="Jane" />
            <Inp label={t.lastName} value={form.lastName||""} onChange={v => setF("lastName",v)} placeholder="Smith" />
            <Inp label={t.email} value={form.email} onChange={v => setF("email",v)} type="email" placeholder="tenant@email.com" />
            <Inp label={t.phone} value={form.phone} onChange={v => setF("phone",v)} />
            <Sel label={t.navProperties} value={form.propertyId} onChange={v => setF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={form.unit} onChange={v => setF("unit",v)} placeholder="Unit A" />
            <Inp label={t.zelleNameLabel} value={form.zelleName} onChange={v => setF("zelleName",v)} placeholder={t.zelleNamePlaceholder} />
            <DerivedStatusField moveInDate={form.moveInDate} moveOutDate={form.moveOutDate} t={t} />
            <Inp label={t.moveInDateReq} value={form.moveInDate} onChange={v => setF("moveInDate",v)} type="date" />
            <Inp label={t.moveOutDate} value={form.moveOutDate||""} onChange={v => setF("moveOutDate",v)} type="date" />
            <Inp label={t.securityDepositLabel} value={form.securityDeposit} onChange={v => setF("securityDeposit",v)} type="number" placeholder="0" />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151", alignSelf: "end", paddingBottom: 10 }}>
              <input type="checkbox" checked={form.securityDepositRefunded} onChange={e => setF("securityDepositRefunded", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              {t.colDepositRefunded}
            </label>
            <div style={{ gridColumn: "1 / -1", marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.notesLabel}</label>
              <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder={t.notesPlaceholder} rows={3}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", background: "#fafafa", borderRadius: 9, border: "1px solid #eaeaea" }}>
            <Toggle value={form.createLogin} onChange={v => setF("createLogin", v)} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{t.createLoginLabel}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{t.createLoginDesc}</div>
            </div>
          </div>
          {form.createLogin && (
            <div style={{ marginTop: 12 }}>
              <Inp label={t.loginPassword} value={form.password} onChange={v => setF("password",v)} type="text" placeholder={t.tempPassword} />
            </div>
          )}
          {addError && <div style={{ fontSize: 13, color: "#ef4444", marginTop: 12 }}>{addError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => { setShow(false); setAddError(""); }}>{t.cancel}</Btn>
            <Btn onClick={add} disabled={saving}>{saving ? t.creating : t.addTenant}</Btn>
          </div>
        </Modal>
      )}

      {/* Edit Tenant Modal */}
      {editTenant && (
        <Modal title={`Edit — ${tenantFullName(editTenant)}`} onClose={() => setEditTenant(null)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.firstName} value={editForm.name} onChange={v => setEF("name",v)} />
            <Inp label={t.lastName} value={editForm.lastName||""} onChange={v => setEF("lastName",v)} />
            <Inp label={t.phone} value={editForm.phone} onChange={v => setEF("phone",v)} />
            <Sel label={t.navProperties} value={editForm.propertyId} onChange={v => setEF("propertyId",v)} options={[{value:"",label:t.noPropOption},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{t.unit}</div>
              {(() => {
                const propUnits = (data.units || []).filter(u => u.propertyId === editForm.propertyId);
                return (
                  <select
                    value={editForm.unitId || ""}
                    onChange={e => {
                      const uid = e.target.value;
                      const matched = propUnits.find(u => u.id === uid);
                      setEF("unitId", uid || "");
                      setEF("unit", matched ? matched.unitNumber : "");
                    }}
                    style={{ width: "100%", background: "#fff", color: "#111111", border: "1px solid #eaeaea", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}
                    disabled={!editForm.propertyId}
                  >
                    {!editForm.propertyId ? (
                      <option value="">{t.selectPropFirst}</option>
                    ) : propUnits.length === 0 ? (
                      <>
                        <option value="">{t.noUnitAssigned}</option>
                        <option value="" disabled>{t.noUnitsYet}</option>
                      </>
                    ) : (
                      <>
                        <option value="">{t.noUnitAssigned}</option>
                        {propUnits.map(u => (
                          <option key={u.id} value={u.id}>
                            Unit {u.unitNumber} — {u.bedrooms}bd/{u.bathrooms}ba ({u.status})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                );
              })()}
            </div>
            <Inp label={t.monthlyPaymentLabel} value={editForm.monthlyRent} onChange={v => setEF("monthlyRent",v)} type="number" placeholder="0" />
            <DerivedStatusField moveInDate={editForm.moveInDate} moveOutDate={editForm.moveOutDate} t={t} />
            <Inp label={t.zelleNameLabel} value={editForm.zelleName} onChange={v => setEF("zelleName",v)} placeholder={t.zelleNamePlaceholder} />
            <Inp label={t.moveInDate} value={editForm.moveInDate} onChange={v => setEF("moveInDate",v)} type="date" />
            <Inp label={t.moveOutDate} value={editForm.moveOutDate} onChange={v => setEF("moveOutDate",v)} type="date" />
            <Inp label={t.securityDepositLabel} value={editForm.securityDeposit} onChange={v => setEF("securityDeposit",v)} type="number" placeholder="0" />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#374151", alignSelf: "end", paddingBottom: 10 }}>
              <input type="checkbox" checked={!!editForm.securityDepositRefunded} onChange={e => setEF("securityDepositRefunded", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
              {t.colDepositRefunded}
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <Inp label={t.email} value={editForm.email} onChange={v => setEF("email",v)} type="email" placeholder="tenant@email.com" />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: -8, marginBottom: 4 }}>{t.emailLoginNote}</div>
            </div>
            <div style={{ gridColumn: "1 / -1", marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.notesLabel}</label>
              <textarea value={editForm.notes || ""} onChange={e => setEF("notes", e.target.value)} placeholder={t.notesPlaceholder} rows={3}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{t.passwordReset}</div>
            <Inp label={t.newPasswordLabel} value={editForm.password} onChange={v => setEF("password",v)} type="password" placeholder={t.minCharsPlaceholder} />
          </div>
          {editError && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px" }}>{editError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditTenant(null)}>{t.cancel}</Btn>
            <Btn onClick={saveEdit}>{editSaving ? t.saving : t.saveChanges}</Btn>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <TenantDeleteModal
          tenant={deleteTarget}
          data={data}
          t={t}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => { await refresh(); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
};

// ─── CONTRACTS PAGE ───────────────────────────────────────────────────────────
const ContractsPage = ({ data, t, refresh, user }) => {
  const EMPTY_FORM = { tenantIds: [], propertyId: "", unit: "", startDate: "", endDate: "", rentAmount: "", dueDay: "1" };
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const [editContract, setEditContract] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const setEF = (k,v) => setEditForm(f => ({...f,[k]:v}));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  // Document attachment state (for Edit Lease modal)
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showDriveLinkInput, setShowDriveLinkInput] = useState(false);
  const [driveLinkInput, setDriveLinkInput] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState(null);
  const docFileRef = useRef(null);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    setDeleteError(null);
    const res = await fetch("/api/contracts/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: deleteTarget.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDeleteError(json.error || "Failed to delete lease.");
      setDeleteSaving(false);
      return;
    }
    setDeleteTarget(null);
    setDeleteSaving(false);
    await refresh();
  };
  const closeEdit = () => { setEditContract(null); setViewingDoc(null); setShowDriveLinkInput(false); setDriveLinkInput(""); setDocError(null); };
  const openEdit = (c) => {
    setEditContract(c);
    setEditForm({ tenantIds: c.tenantIds || [], propertyId: c.propertyId || "", unit: c.unit || "", startDate: c.startDate || "", endDate: c.endDate || "", rentAmount: c.rentAmount ? String(c.rentAmount) : "", dueDay: c.dueDay ? String(c.dueDay) : "1" });
    setViewingDoc(null);
    setShowDriveLinkInput(false);
    setDriveLinkInput("");
    setDocError(null);
  };
  const [editError, setEditError] = useState(null);
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);
  const save = async () => {
    setEditError(null);
    if (!editForm.rentAmount) {
      setEditError("Rent amount is required.");
      return;
    }
    const res = await fetch("/api/contracts/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: editContract.id,
        propertyId: editForm.propertyId,
        unit: editForm.unit,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        rentAmount: editForm.rentAmount,
        dueDay: editForm.dueDay,
        tenantIds: editForm.tenantIds,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEditError(json.error || "Failed to save lease.");
      return;
    }
    closeEdit();
    await refresh();
  };
  const add = async () => {
    if (!form.tenantIds.length || !form.rentAmount) return;
    setAddError(null);
    setAdding(true);
    const res = await fetch("/api/contracts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landlordId: user.id,
        propertyId: form.propertyId,
        unit: form.unit,
        startDate: form.startDate,
        endDate: form.endDate,
        rentAmount: form.rentAmount,
        dueDay: form.dueDay,
        tenantIds: form.tenantIds,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddError(json.error || t.failedCreateLease);
      setAdding(false);
      return;
    }
    setForm(EMPTY_FORM);
    await refresh();
    setShow(false);
    setAdding(false);
  };

  return (
    <div>
      <PageHeader title={t.conTitle} subtitle={t.conSubtitle(data.contracts.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addLease}</Btn>} />
      <div style={{ display: "grid", gap: 14 }}>
        {[...data.contracts].sort((a, b) => {
          const pa = data.properties.find(p => p.id === a.propertyId)?.address || "";
          const pb = data.properties.find(p => p.id === b.propertyId)?.address || "";
          if (pa !== pb) return pa.localeCompare(pb);
          return String(a.unit || "").localeCompare(String(b.unit || ""), undefined, { numeric: true });
        }).map(c => {
          const prop = data.properties.find(p => p.id === c.propertyId);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const startDate = c.startDate ? new Date(`${c.startDate}T00:00:00`) : null;
          const endDate = c.endDate ? new Date(`${c.endDate}T00:00:00`) : null;
          const notStartedYet = startDate && startDate > today;
          const daysLeft = endDate ? Math.ceil((endDate - today) / 86400000) : NaN;
          const firstDoc = (data.documents || []).find(d => d.contractId === c.id);
          return (
            <div
              key={c.id}
              onClick={firstDoc ? () => setViewingDoc(firstDoc) : undefined}
              style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center", cursor: firstDoc ? "pointer" : "default" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", marginBottom: 6 }}>
                  {prop?.address}{c.unit ? ` · ${c.unit}` : ""}
                </div>
                {(c.tenantIds || []).map(tid => {
                  const ten = data.tenants.find(t => t.id === tid);
                  return (
                    <div key={tid} style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>
                      {ten ? tenantFullName(ten) : "Unknown Tenant"}
                    </div>
                  );
                })}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.rent}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{fmt(c.rentAmount)}<span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>/mo</span></div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{t.dueOf} {c.dueDay}{t.ofMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{fmtDate(c.startDate)}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>→ {fmtDate(c.endDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.colDaysRemaining}</div>
                {notStartedYet ? (
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.leaseUpcoming}</div>
                ) : !endDate || daysLeft <= 0 ? (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Month to Month</div>
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 700, color: daysLeft < 60 ? "#ef4444" : "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{daysLeft} {t.daysRemaining}</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <Badge status={c.status} t={t} />
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="secondary" size="sm" icon="edit" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t.editBtn}</Btn>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    style={{ ...dangerIconBtnStyle, fontSize: 13 }}
                    aria-label="Delete lease"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editContract && (
        <Modal title={t.editLeaseTitle} onClose={closeEdit} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600, marginBottom: 6 }}>{t.colTenants}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", padding: "4px 0" }}>
                {data.tenants.filter(ten => ten.status !== "previous tenant").map(ten => (
                  <label key={ten.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#111111" }}>
                    <input type="checkbox" checked={editForm.tenantIds.includes(ten.id)}
                      onChange={e => { const ids = e.target.checked ? [...editForm.tenantIds, ten.id] : editForm.tenantIds.filter(id => id !== ten.id); setEF("tenantIds", ids); }} />
                    {tenantFullName(ten)}
                  </label>
                ))}
              </div>
            </div>
            <Sel label={t.navProperties} value={editForm.propertyId} onChange={v => setEF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={editForm.unit} onChange={v => setEF("unit",v)} />
            <Inp label={t.monthlyRent} value={editForm.rentAmount} onChange={v => setEF("rentAmount",v)} type="number" />
            <Inp label={t.startDate} value={editForm.startDate} onChange={v => setEF("startDate",v)} type="date" />
            <Inp label={t.endDate} value={editForm.endDate} onChange={v => setEF("endDate",v)} type="date" />
            <Inp label={t.dueDayLabel} value={editForm.dueDay} onChange={v => setEF("dueDay",v)} type="number" />
          </div>
          {/* Documents section */}
          <div style={{ marginTop: 20, borderTop: "1px solid #f5f5f5", paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t.docSectionTitle}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={docFileRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editContract) return;
                    setDocUploading(true);
                    setDocError(null);
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("landlordId", user.id);
                    fd.append("contractId", editContract.id);
                    fd.append("documentType", "lease");
                    const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
                    const json = await res.json().catch(() => ({}));
                    setDocUploading(false);
                    if (!res.ok) { setDocError(json.error || "Upload failed."); return; }
                    e.target.value = "";
                    await refresh();
                  }}
                />
                <Btn variant="secondary" size="sm" onClick={() => docFileRef.current?.click()} disabled={docUploading}>
                  {docUploading ? "Uploading…" : t.docUploadPdf}
                </Btn>
                <Btn variant="secondary" size="sm" onClick={() => { setShowDriveLinkInput(v => !v); setDriveLinkInput(""); setDocError(null); }}>
                  {t.docAddDriveLink}
                </Btn>
              </div>
            </div>
            {showDriveLinkInput && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  type="url"
                  placeholder={t.docDriveLinkPlaceholder}
                  value={driveLinkInput}
                  onChange={e => setDriveLinkInput(e.target.value)}
                  style={{ flex: 1, border: "1px solid #eaeaea", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                />
                <Btn size="sm" onClick={async () => {
                  if (!driveLinkInput.trim() || !editContract) return;
                  setDocError(null);
                  const res = await fetch("/api/documents/add-drive-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contractId: editContract.id, driveLink: driveLinkInput.trim(), landlordId: user.id, documentType: "lease" }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) { setDocError(json.error || "Failed to save link."); return; }
                  setShowDriveLinkInput(false);
                  setDriveLinkInput("");
                  await refresh();
                }}>{t.docAttach}</Btn>
              </div>
            )}
            {docError && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{docError}</div>}
            {(() => {
              const contractDocs = (data.documents || []).filter(d => d.contractId === editContract?.id);
              if (contractDocs.length === 0) return (
                <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic", padding: "4px 0" }}>{t.docNoDocuments}</div>
              );
              return contractDocs.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #fafafa" }}>
                  <span style={{ fontSize: 16 }}>{doc.driveLink ? "🔗" : "📄"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.driveLink ? (doc.driveLink.length > 50 ? doc.driveLink.slice(0, 50) + "…" : doc.driveLink) : doc.fileName}
                  </span>
                  <button
                    onClick={() => setViewingDoc(doc)}
                    style={{ background: "#111111", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >{t.docView}</button>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/documents/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId: doc.id }) });
                      if (res.ok) await refresh();
                    }}
                    style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 10px", fontSize: 12, color: "#ef4444", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >{t.docRemove}</button>
                </div>
              ));
            })()}
          </div>
          {editError && <div style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{editError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
            <Btn variant="secondary" onClick={closeEdit}>{t.cancel}</Btn>
            <Btn onClick={save}>{t.saveChanges}</Btn>
          </div>
        </Modal>
      )}
      {viewingDoc && <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
      {deleteTarget && (
        <Modal title="Delete Lease" onClose={() => { if (!deleteSaving) { setDeleteTarget(null); setDeleteError(null); } }}>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#111111" }}>
            Are you sure you want to delete the lease for <strong>{data.properties.find(p => p.id === deleteTarget.propertyId)?.address || ""} · Unit {deleteTarget.unit}</strong>?
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
            This will remove the lease record and unlink any payments tied to it. Tenant profiles will not be deleted. This cannot be undone.
          </p>
          {deleteError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444" }}>{deleteError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleteSaving}>Cancel</Btn>
            <button
              onClick={confirmDelete}
              disabled={deleteSaving}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: deleteSaving ? "wait" : "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit", opacity: deleteSaving ? 0.7 : 1 }}
            >
              {deleteSaving ? "Deleting..." : "Delete Lease"}
            </button>
          </div>
        </Modal>
      )}
      {show && (
        <Modal title={t.addLeaseTitle} onClose={() => { setForm(EMPTY_FORM); setShow(false); setAddError(null); }} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600, marginBottom: 6 }}>{t.colTenant}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", padding: "4px 0" }}>
                {data.tenants
                  .filter(ten => ten.status !== "previous tenant")
                  .map(ten => (
                    <label key={ten.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "#111111" }}>
                      <input
                        type="checkbox"
                        checked={form.tenantIds.includes(ten.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...form.tenantIds, ten.id]
                            : form.tenantIds.filter(id => id !== ten.id);
                          setF("tenantIds", ids);
                        }}
                      />
                      {tenantFullName(ten)}
                    </label>
                  ))}
              </div>
            </div>
            <Sel label={t.navProperties} value={form.propertyId} onChange={v => setF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={form.unit} onChange={v => setF("unit",v)} placeholder="Unit A" />
            <Inp label={t.monthlyRent} value={form.rentAmount} onChange={v => setF("rentAmount",v)} type="number" />
            <Inp label={t.startDate} value={form.startDate} onChange={v => setF("startDate",v)} type="date" />
            <Inp label={t.endDate} value={form.endDate} onChange={v => setF("endDate",v)} type="date" />
            <Inp label={t.dueDayLabel} value={form.dueDay} onChange={v => setF("dueDay",v)} type="number" />
          </div>
          {addError && <div style={{ fontSize: 13, color: "#ef4444", marginTop: 8 }}>{addError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => { setForm(EMPTY_FORM); setShow(false); setAddError(null); }}>{t.cancel}</Btn>
            <Btn onClick={add} disabled={adding}>{adding ? t.saving : t.createLease}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── PARKING PAGE ─────────────────────────────────────────────────────────────
const EMPTY_SPOT_FORM = { propertyId: "", label: "", type: "" };
const EMPTY_LEASE_FORM = { renterType: "tenant", tenantId: "", renterName: "", renterEmail: "", renterPhone: "", rate: "", startDate: "", endDate: "", carMake: "", carModel: "", carYear: "" };

// Label/value row for the spot detail modal. Renders an em-dash for anything empty so
// the rows stay aligned instead of collapsing when a field is unset.
const detailRowStyle = { display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 };
// Also used above the VEHICLE block in both lease modals.
const detailSectionHeading = { fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 };
const DetailRow = ({ label, value }) => (
  <div style={detailRowStyle}>
    <span style={{ color: "#9ca3af" }}>{label}</span>
    <span style={{ color: value ? "#111111" : "#9ca3af", fontWeight: value ? 600 : 400, textAlign: "right" }}>{value || "—"}</span>
  </div>
);

// Interactive lot diagram. Geometry comes from lib/parking/layout.js so the math stays
// pure and unit-tested; this only paints what that returns and wires up clicks.
//
// Occupancy is the parked car, not a filled bay: every bay is drawn the same empty
// pavement, and an occupied one gets a car block inside it. A lot then reads the way
// a real one does — you see the cars, and the vacancies are the gaps between them.
// The bay still owns the click, so it keeps a fill (a hairline-visible pavement tone
// rather than `none`, which would let clicks fall straight through it).
const BAY_FILL = "#ffffff";
const BAY_STROKE = "#cbd5e1";
const carFill = () => statusColors.occupied;

const ParkingLotDiagram = ({ spots, occBySpotId, onSelect, t }) => {
  const { width, height, outline, stalls, unplaced } = lotLayout(spots);
  if (!stalls.length) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #eaeaea", borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
        {t.parkLotDiagram}
      </div>
      {/* viewBox + preserveAspectRatio hold the lot's proportions at any width. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={t.parkLotDiagram}
        style={{ width: "100%", height: "auto", maxWidth: 520, display: "block", margin: "0 auto" }}
      >
        <rect x={outline.x} y={outline.y} width={outline.w} height={outline.h} fill="#fafafa" stroke="#eaeaea" strokeWidth="2" rx="4" />

        {stalls.map(stall => {
          const occ = occBySpotId.get(stall.id);
          const car = occ ? carFill() : null;
          return (
            <g key={stall.id} onClick={() => onSelect(stall.id)} style={{ cursor: "pointer" }}
               role="button" tabIndex={0} aria-label={`${t.parkSpotLabel} ${stall.label}`}
               onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(stall.id); } }}>
              <title>{`${stall.label} · ${occ ? occ.name : t.st_vacant}`}</title>
              <polygon points={stall.points} fill={BAY_FILL} stroke={BAY_STROKE} strokeWidth="1.5" />
              {car && <polygon points={stall.car} fill={car.bg} stroke={car.dot} strokeWidth="1.5" style={{ pointerEvents: "none" }} />}
              <text x={stall.labelX} y={stall.labelY} textAnchor="middle" dominantBaseline="central"
                    fontSize="15" fontWeight="700" fill={car ? car.text : "#9ca3af"} style={{ pointerEvents: "none", userSelect: "none" }}>
                {stall.label}
              </text>
            </g>
          );
        })}
      </svg>
      {unplaced.length > 0 && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10, textAlign: "center" }}>
          {t.parkUnplaced(unplaced.map(s => s.label).join(", "))}
        </div>
      )}
    </div>
  );
};

const ParkingPage = ({ data, t, refresh, user }) => {
  const mx = useParkingMutations();
  // Local YYYY-MM-DD, deliberately NOT toISOString(), which is UTC. Every date
  // comparison this page depends on runs through daysBetween in lib/format,
  // which normalizes to LOCAL midnight -- so a UTC date string makes an evening
  // in a negative-offset timezone read as tomorrow. Concretely: a lease created
  // at 8pm Pacific got start_date = tomorrow, isActiveLease said "not started",
  // and the spot rendered vacant until the next day. Same for End Lease, which
  // would leave the lease running an extra day.
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [showSpotModal, setShowSpotModal] = useState(false);
  // null = the modal is in "add" mode; a spot = "edit" mode. One modal serves both
  // so the form markup isn't duplicated.
  const [editingSpot, setEditingSpot] = useState(null);
  const [spotForm, setSpotForm] = useState(EMPTY_SPOT_FORM);
  const setSF = (k, v) => setSpotForm(f => ({ ...f, [k]: v }));
  const [spotError, setSpotError] = useState(null);
  const [savingSpot, setSavingSpot] = useState(false);

  const [leaseSpot, setLeaseSpot] = useState(null);
  const [leaseForm, setLeaseForm] = useState(EMPTY_LEASE_FORM);
  const setLF = (k, v) => setLeaseForm(f => ({ ...f, [k]: v }));
  const [leaseError, setLeaseError] = useState(null);
  const [savingLease, setSavingLease] = useState(false);

  // The lease being edited, or null. Holds the lease itself rather than an id:
  // unlike the spot detail modal, this one is a form seeded once on open, so a
  // mid-edit refresh must not overwrite what the user is typing.
  const [editingLease, setEditingLease] = useState(null);
  const [leaseEditForm, setLeaseEditForm] = useState({ rate: "", endDate: "", carMake: "", carModel: "", carYear: "" });
  const setLEF = (k, v) => setLeaseEditForm(f => ({ ...f, [k]: v }));
  const [leaseEditError, setLeaseEditError] = useState(null);
  const [savingLeaseEdit, setSavingLeaseEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Spot clicked in the lot diagram. Holds the id rather than the spot object so the
  // modal re-reads from fresh data after an edit or a lease change instead of showing
  // a stale snapshot captured at click time.
  const [detailSpotId, setDetailSpotId] = useState(null);

  const openAddSpot = () => {
    setEditingSpot(null);
    setSpotForm(EMPTY_SPOT_FORM);
    setSpotError(null);
    setShowSpotModal(true);
  };

  const openEditSpot = (spot) => {
    setEditingSpot(spot);
    setSpotForm({
      propertyId: spot.propertyId,
      label: spot.label,
      type: spot.type || "",
    });
    setSpotError(null);
    setShowSpotModal(true);
  };

  const saveSpot = async () => {
    // Property is only required when adding — on edit it's fixed and not shown.
    if ((!editingSpot && !spotForm.propertyId) || !spotForm.label.trim()) {
      setSpotError(t.parkSpotFieldsRequired);
      return;
    }
    setSavingSpot(true);
    setSpotError(null);
    try {
      if (editingSpot) {
        await mx.updateSpot(editingSpot.id, { label: spotForm.label, type: spotForm.type });
      } else {
        await mx.createSpot({ landlordId: user.id, propertyId: spotForm.propertyId, label: spotForm.label.trim(), type: spotForm.type });
      }
      await refresh();
      setShowSpotModal(false);
      setEditingSpot(null);
    } catch (e) {
      setSpotError(e.message || (editingSpot ? t.parkFailedUpdateSpot : t.parkFailedCreateSpot));
    }
    setSavingSpot(false);
  };

  const toggleMarketStatus = async (spot) => {
    await mx.setMarketStatus(spot.id, spot.marketStatus === "open_market" ? "tenant_priority" : "open_market");
    await refresh();
  };

  const confirmDeleteSpot = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await mx.deleteSpot(deleteTarget.id);
      await refresh();
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message || t.parkFailedDeleteSpot);
    }
    setDeleting(false);
  };

  const openAddLease = (spot) => {
    setLeaseSpot(spot);
    // No rate prefill: the spot no longer carries an asking rate. The lease's
    // rate is the only rate there is, and it is entered here.
    setLeaseForm({ ...EMPTY_LEASE_FORM, startDate: todayStr() });
    setLeaseError(null);
  };

  const saveLease = async () => {
    if (!leaseForm.rate || !leaseForm.startDate) { setLeaseError(t.parkLeaseFieldsRequired); return; }
    if (leaseForm.renterType === "tenant" && !leaseForm.tenantId) { setLeaseError(t.parkSelectTenantRequired); return; }
    if (leaseForm.renterType === "market" && !leaseForm.renterName.trim()) { setLeaseError(t.parkRenterNameRequired); return; }
    setSavingLease(true);
    setLeaseError(null);
    try {
      await mx.createLease({
        landlordId: user.id,
        parkingSpotId: leaseSpot.id,
        rate: leaseForm.rate,
        startDate: leaseForm.startDate,
        endDate: leaseForm.endDate || null,
        carMake: leaseForm.carMake,
        carModel: leaseForm.carModel,
        carYear: leaseForm.carYear,
        tenantId: leaseForm.renterType === "tenant" ? leaseForm.tenantId : undefined,
        renter: leaseForm.renterType === "market"
          ? { name: leaseForm.renterName.trim(), email: leaseForm.renterEmail.trim(), phone: leaseForm.renterPhone.trim() }
          : undefined,
      });
      await refresh();
      setLeaseSpot(null);
    } catch (e) {
      setLeaseError(e.message || t.parkFailedCreateLease);
    }
    setSavingLease(false);
  };

  const endLeaseNow = async (lease) => {
    await mx.endLease(lease.id, todayStr());
    await refresh();
  };

  const openEditLease = (lease) => {
    setEditingLease(lease);
    setLeaseEditForm({
      rate: lease.rate == null ? "" : String(lease.rate),
      endDate: lease.endDate || "",
      carMake: lease.carMake || "",
      carModel: lease.carModel || "",
      carYear: lease.carYear == null ? "" : String(lease.carYear),
    });
    setLeaseEditError(null);
  };

  const saveLeaseEdit = async () => {
    // Guards match what would otherwise fail below with an untranslated message:
    // core's updateLease rejects a non-positive rate, and the DB's
    // (end_date >= start_date) CHECK rejects an end date before the start.
    if (!(Number(leaseEditForm.rate) > 0)) { setLeaseEditError(t.parkRateRequired); return; }
    if (leaseEditForm.endDate && leaseEditForm.endDate < editingLease.startDate) {
      setLeaseEditError(t.parkEndBeforeStart(fmtDate(editingLease.startDate)));
      return;
    }
    setSavingLeaseEdit(true);
    setLeaseEditError(null);
    try {
      await mx.updateLease(editingLease.id, leaseEditForm);
      await refresh();
      setEditingLease(null);
    } catch (e) {
      setLeaseEditError(e.message || t.parkFailedUpdateLease);
    }
    setSavingLeaseEdit(false);
  };

  const spots = data.parkingSpots || [];
  const leases = data.parkingLeases || [];
  const renters = data.parkingRenters || [];

  // Returns null when vacant, otherwise { lease, name, kind, person }. `person` is the
  // underlying tenant or renter row so the detail modal can show contact details —
  // the cards only ever needed `name`, but a diagram click should surface who to call.
  const occupantFor = (spot) => {
    const lease = activeLeaseForSpot(leases.filter(l => l.parkingSpotId === spot.id));
    if (!lease) return null;
    if (lease.tenantId) {
      const ten = data.tenants.find(x => x.id === lease.tenantId);
      return { lease, name: ten ? tenantFullName(ten) : t.parkUnknownTenant, kind: "tenant", person: ten || null };
    }
    const renter = renters.find(r => r.id === lease.renterId);
    return { lease, name: renter ? renter.name : t.parkUnknownRenter, kind: "renter", person: renter || null };
  };

  // Resolved once per spot and shared by the diagram and the cards — occupantFor scans
  // every lease, so calling it from both render paths would double that work.
  const occBySpotId = new Map(spots.map(s => [s.id, occupantFor(s)]));

  const byProperty = new Map();
  for (const s of spots) {
    if (!byProperty.has(s.propertyId)) byProperty.set(s.propertyId, []);
    byProperty.get(s.propertyId).push(s);
  }

  return (
    <div>
      <PageHeader title={t.parkTitle} subtitle={t.parkSubtitle(spots.length)} action={<Btn icon="plus" onClick={openAddSpot}>{t.parkAddSpot}</Btn>} />

      {spots.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 15, padding: "60px 0" }}>{t.parkNoSpots}</div>
      ) : (
        [...byProperty.entries()].map(([propertyId, propSpots]) => {
          const prop = data.properties.find(p => p.id === propertyId);
          return (
            <div key={propertyId} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
                {prop?.address || t.parkUnknownProperty}
              </div>
              {/* Only lots whose spots carry a type can be drawn — placement is derived
                  from it, so an untyped property just gets its cards as before. */}
              {propSpots.some(s => s.type) && (
                <ParkingLotDiagram spots={propSpots} occBySpotId={occBySpotId} onSelect={setDetailSpotId} t={t} />
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {[...propSpots].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })).map(spot => {
                  const occ = occBySpotId.get(spot.id);
                  return (
                    <div key={spot.id} style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #eaeaea" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{spot.label}</div>
                          {spot.type && <div style={{ fontSize: 12, color: "#6b7280" }}>{spot.type}</div>}
                          {(() => {
                            // "2019 Honda Civic" from whichever parts the active lease
                            // filled in; nothing renders if none are, and a vacant spot
                            // shows no vehicle at all.
                            const car = occ ? [occ.lease.carYear, occ.lease.carMake, occ.lease.carModel].filter(Boolean).join(" ") : "";
                            return car ? <div style={{ fontSize: 12, color: "#111111", fontWeight: 600 }}>{car}</div> : null;
                          })()}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {/* Editing stays available while leased — renaming a spot or
                              fixing its type doesn't invalidate an active lease. Deleting
                              does, so that stays gated on the spot being free. */}
                          <button onClick={() => openEditSpot(spot)} style={iconBtn} title={t.parkEditSpot}>
                            <Icon name="edit" size={13} />
                          </button>
                          {!occ && (
                            <button onClick={() => setDeleteTarget(spot)} style={dangerIconBtnStyle} title={t.parkDeleteSpot}>
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                        <Badge status={occ ? "occupied" : "vacant"} t={t} />
                        <Badge status={spot.marketStatus} t={t} />
                      </div>
                      {occ ? (
                        <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{occ.name}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                            {fmt(occ.lease.rate)}/mo &middot; {t.parkSince} {fmtDate(occ.lease.startDate)}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Btn size="sm" variant="secondary" onClick={() => openEditLease(occ.lease)}>{t.parkEditLease}</Btn>
                            <Btn size="sm" variant="secondary" onClick={() => endLeaseNow(occ.lease)}>{t.parkEndLease}</Btn>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Btn size="sm" variant="secondary" onClick={() => openAddLease(spot)}>{t.parkAddLease}</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => toggleMarketStatus(spot)}>
                            {spot.marketStatus === "open_market" ? t.parkMarkTenantPriority : t.parkOpenToMarket}
                          </Btn>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {showSpotModal && (
        <Modal title={editingSpot ? t.parkEditSpotTitle : t.parkAddSpotTitle} onClose={() => { setShowSpotModal(false); setEditingSpot(null); }}>
          {editingSpot ? (
            // Property is fixed once a spot exists: moving it would strand lease
            // history against a lot the spot no longer belongs to, and could collide
            // with the unique (property_id, label) constraint on arrival.
            <Inp label={t.selectProperty} value={data.properties.find(p => p.id === editingSpot.propertyId)?.address || t.parkUnknownProperty} readOnly />
          ) : (
            <Sel label={t.selectProperty} value={spotForm.propertyId} onChange={v => setSF("propertyId", v)}
              options={[{ value: "", label: t.selectProperty }, ...data.properties.map(p => ({ value: p.id, label: p.address }))]} />
          )}
          <Inp label={t.parkSpotLabel} value={spotForm.label} onChange={v => setSF("label", v)} placeholder="A12" />
          <Sel label={t.parkSpotType} value={spotForm.type} onChange={v => setSF("type", v)}
            options={[{ value: "", label: t.parkSpotTypeNone }, ...SPOT_TYPES.map(x => ({ value: x, label: x }))]} />
          {spotError && <p style={{ color: "#ef4444", fontSize: 13 }}>{spotError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => { setShowSpotModal(false); setEditingSpot(null); }}>{t.cancel}</Btn>
            <Btn onClick={saveSpot} disabled={savingSpot}>
              {savingSpot ? t.saving : editingSpot ? t.saveChanges : t.parkAddSpot}
            </Btn>
          </div>
        </Modal>
      )}

      {leaseSpot && (
        <Modal title={t.parkAddLeaseTitle} onClose={() => setLeaseSpot(null)}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Btn size="sm" variant={leaseForm.renterType === "tenant" ? "primary" : "secondary"} onClick={() => setLF("renterType", "tenant")}>{t.parkExistingTenant}</Btn>
            <Btn size="sm" variant={leaseForm.renterType === "market" ? "primary" : "secondary"} onClick={() => setLF("renterType", "market")}>{t.parkMarketRenter}</Btn>
          </div>
          {leaseForm.renterType === "tenant" ? (
            <Sel label={t.selectTenant} value={leaseForm.tenantId} onChange={v => setLF("tenantId", v)}
              options={[{ value: "", label: t.selectTenant }, ...data.tenants.map(ten => ({ value: ten.id, label: tenantFullName(ten) }))]} />
          ) : (
            <>
              <Inp label={t.fullName} value={leaseForm.renterName} onChange={v => setLF("renterName", v)} />
              <Inp label={t.email} value={leaseForm.renterEmail} onChange={v => setLF("renterEmail", v)} />
              <Inp label={t.phone} value={leaseForm.renterPhone} onChange={v => setLF("renterPhone", v)} />
            </>
          )}
          <Inp label={t.parkMonthlyRate} value={leaseForm.rate} onChange={v => setLF("rate", v)} type="number" placeholder="0" />
          <Inp label={t.startDate} value={leaseForm.startDate} onChange={v => setLF("startDate", v)} type="date" />
          <Inp label={t.endDate} value={leaseForm.endDate} onChange={v => setLF("endDate", v)} type="date" />
          <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 14, marginTop: 2 }}>
            <div style={detailSectionHeading}>{t.parkVehicle}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label={t.parkCarMake} value={leaseForm.carMake} onChange={v => setLF("carMake", v)} placeholder="Honda" />
              <Inp label={t.parkCarModel} value={leaseForm.carModel} onChange={v => setLF("carModel", v)} placeholder="Civic" />
            </div>
            <Inp label={t.parkCarYear} value={leaseForm.carYear} onChange={v => setLF("carYear", v)} type="number" placeholder="2019" />
          </div>
          {leaseError && <p style={{ color: "#ef4444", fontSize: 13 }}>{leaseError}</p>}
          <Btn onClick={saveLease} disabled={savingLease}>{savingLease ? t.creating : t.parkAddLease}</Btn>
        </Modal>
      )}

      {editingLease && (
        <Modal title={t.parkEditLeaseTitle} onClose={() => setEditingLease(null)}>
          <Inp label={t.parkMonthlyRate} value={leaseEditForm.rate} onChange={v => setLEF("rate", v)} type="number" placeholder="0" />
          <Inp label={t.endDate} value={leaseEditForm.endDate} onChange={v => setLEF("endDate", v)} type="date" />
          <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 14, marginTop: 2 }}>
            <div style={detailSectionHeading}>{t.parkVehicle}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Inp label={t.parkCarMake} value={leaseEditForm.carMake} onChange={v => setLEF("carMake", v)} placeholder="Honda" />
              <Inp label={t.parkCarModel} value={leaseEditForm.carModel} onChange={v => setLEF("carModel", v)} placeholder="Civic" />
            </div>
            <Inp label={t.parkCarYear} value={leaseEditForm.carYear} onChange={v => setLEF("carYear", v)} type="number" placeholder="2019" />
          </div>
          {leaseEditError && <p style={{ color: "#ef4444", fontSize: 13 }}>{leaseEditError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditingLease(null)}>{t.cancel}</Btn>
            <Btn onClick={saveLeaseEdit} disabled={savingLeaseEdit}>{savingLeaseEdit ? t.saving : t.saveChanges}</Btn>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title={t.parkDeleteSpotTitle} onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: "#374151" }}>{t.parkDeleteSpotConfirm(deleteTarget.label)}</p>
          {deleteError && <p style={{ color: "#ef4444", fontSize: 13 }}>{deleteError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" onClick={() => setDeleteTarget(null)}>{t.cancel}</Btn>
            <Btn onClick={confirmDeleteSpot} disabled={deleting}>{deleting ? t.deleting : t.parkDeleteSpot}</Btn>
          </div>
        </Modal>
      )}

      {/* Spot detail — opened by clicking a stall in the lot diagram. Read-only view
          plus the same actions the card offers, so the diagram is a full entry point
          rather than a navigation aid. */}
      {detailSpotId && (() => {
        const spot = spots.find(s => s.id === detailSpotId);
        if (!spot) return null;   // spot deleted while the modal was open
        const occ = occBySpotId.get(spot.id);
        const prop = data.properties.find(p => p.id === spot.propertyId);
        const close = () => setDetailSpotId(null);
        return (
          <Modal title={t.parkSpotDetailTitle(spot.label)} onClose={close}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge status={occ ? "occupied" : "vacant"} t={t} />
              <Badge status={spot.marketStatus} t={t} />
            </div>

            <DetailRow label={t.selectProperty} value={prop?.address || t.parkUnknownProperty} />
            <DetailRow label={t.parkSpotType} value={spot.type} />

            <div style={{ borderTop: "1px solid #eaeaea", marginTop: 14, paddingTop: 14 }}>
              {occ ? (
                <>
                  <div style={detailSectionHeading}>
                    {occ.kind === "tenant" ? t.parkExistingTenant : t.parkMarketRenter}
                  </div>
                  <DetailRow label={t.fullName} value={occ.name} />
                  <DetailRow label={t.email} value={occ.person?.email} />
                  <DetailRow label={t.phone} value={occ.person?.phone} />
                  {/* The rate and dates belong to the parking lease, not the person — and
                      a parking lease is a separate agreement from the tenant's residential
                      lease (see CONTEXT.md), so the heading names it explicitly. */}
                  <div style={{ ...detailSectionHeading, marginTop: 14 }}>{t.parkLeaseHeading}</div>
                  <DetailRow label={t.parkMonthlyRate} value={fmt(occ.lease.rate)} />
                  <DetailRow label={t.startDate} value={fmtDate(occ.lease.startDate)} />
                  <DetailRow label={t.endDate} value={occ.lease.endDate ? fmtDate(occ.lease.endDate) : t.parkOngoing} />
                  <DetailRow label={t.parkVehicle} value={[occ.lease.carYear, occ.lease.carMake, occ.lease.carModel].filter(Boolean).join(" ")} />
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openEditSpot(spot); }}>{t.parkEditSpot}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openEditLease(occ.lease); }}>{t.parkEditLease}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); endLeaseNow(occ.lease); }}>{t.parkEndLease}</Btn>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{t.parkSpotVacantHint}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openEditSpot(spot); }}>{t.parkEditSpot}</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => { close(); openAddLease(spot); }}>{t.parkAddLease}</Btn>
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};

// ─── PAYMENTS PAGE ────────────────────────────────────────────────────────────
const PaymentsPage = ({ data, t, setPage, setSelectedTenantId }) => {
  // 3-month window: previous, current, next month
  const months = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 1; i >= -1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      result.push({
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        key: `${yyyy}-${mm}`,
        dueDate: `${yyyy}-${mm}-01`,
      });
    }
    return result;
  }, []);

  // "tenantId-YYYY-MM" → payment record id (from DB)
  const [saved, setSaved] = useState(() => {
    const map = {};
    for (const p of data.payments) {
      if (p.status === "completed" && p.dueDate) {
        map[`${p.tenantId}-${p.dueDate.slice(0, 7)}`] = p.id;
      }
    }
    return map;
  });

  // Local checkbox state - starts matching saved, diverges as user clicks
  const [checked, setChecked] = useState(() => ({ ...saved }));
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState(null);

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    const allKeys = new Set([...Object.keys(saved), ...Object.keys(checked)]);
    for (const k of allKeys) {
      if (!!saved[k] !== !!checked[k]) return true;
    }
    return false;
  }, [saved, checked]);

  // Persisted property filter — same pattern as the Tenants page: store HIDDEN ids so a newly
  // added property shows by default. Its own storage key, so narrowing the payment view doesn't
  // silently narrow the tenant roster as well.
  // Read lazily rather than via an effect: the whole dashboard is gated behind authLoading, so
  // this never runs during SSR or hydration. That also removes the "ready" flag the Tenants page
  // needs to stop its write effect clobbering storage before the read lands.
  const [hiddenProps, setHiddenProps] = useState(() => {
    try {
      const raw = typeof window !== "undefined" && localStorage.getItem("propmanager_payment_hidden_props");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); /* ignore malformed storage */ }
  });
  useEffect(() => {
    try {
      localStorage.setItem("propmanager_payment_hidden_props", JSON.stringify([...hiddenProps]));
    } catch { /* ignore quota / private-mode failures */ }
  }, [hiddenProps]);

  // Tenants of a property flagged "not in production" are excluded regardless of the
  // show/hide chip state (a per-session display preference; this is a data-level
  // exclusion), and such properties are dropped from the chip list itself.
  const excludedPropertyIds = nonProductionPropertyIds(data.properties);

  const filterChips = [
    ...data.properties.filter(p => !excludedPropertyIds.has(p.id)).map(p => ({ id: p.id, label: p.address })),
    ...(data.tenants.some(ten => ten.status === "current tenant" && !ten.propertyId)
      ? [{ id: "__none__", label: t.tenNoProperty }] : []),
  ];

  // Group tenants by unit. Plain const, not useMemo — the React Compiler memoizes
  // consts automatically; a manual useMemo here trips "memoization could not be
  // preserved" once its body closes over excludedPropertyIds (see CLAUDE.md).
  const grouped = (() => {
    const unitMap = {};
    const noUnit = [];
    const visible = data.tenants.filter(ten =>
      ten.status === "current tenant"
      && (!ten.propertyId || !excludedPropertyIds.has(ten.propertyId))
      && !hiddenProps.has(ten.propertyId || "__none__"));
    for (const tenant of visible) {
      if (tenant.unitId) {
        if (!unitMap[tenant.unitId]) {
          unitMap[tenant.unitId] = { unit: data.units.find(u => u.id === tenant.unitId), tenants: [] };
        }
        unitMap[tenant.unitId].tenants.push(tenant);
      } else {
        noUnit.push(tenant);
      }
    }
    const groups = Object.values(unitMap).sort((a, b) =>
      (a.unit?.unitNumber || "").localeCompare(b.unit?.unitNumber || "", undefined, { numeric: true })
    );
    if (noUnit.length > 0) groups.push({ unit: null, tenants: noUnit });
    return groups;
  })();

  const allTenants = grouped.flatMap(g => g.tenants);

  const getContract = (tenant) => data.contracts.find(c => c.tenantIds.includes(tenant.id));

  const toggle = (tenantId, monthKey) => {
    const mapKey = `${tenantId}-${monthKey}`;
    setChecked(prev => {
      const next = { ...prev };
      if (next[mapKey]) { delete next[mapKey]; } else { next[mapKey] = true; }
      return next;
    });
  };

  const toggleColumn = (monthKey) => {
    const allChecked = allTenants.every(t => !!checked[`${t.id}-${monthKey}`]);
    setChecked(prev => {
      const next = { ...prev };
      for (const tenant of allTenants) {
        const mapKey = `${tenant.id}-${monthKey}`;
        if (allChecked) { delete next[mapKey]; } else { next[mapKey] = true; }
      }
      return next;
    });
  };

  const saveChanges = async () => {
    setSaving(true);
    setPayError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const allKeys = new Set([...Object.keys(saved), ...Object.keys(checked)]);
    const toInsert = [];
    const toDelete = [];

    for (const mapKey of allKeys) {
      const wasSaved = !!saved[mapKey];
      const isChecked = !!checked[mapKey];
      if (isChecked && !wasSaved) {
        // New check - need to insert
        const [tenantId, monthKey] = [mapKey.slice(0, 36), mapKey.slice(37)];
        const tenant = data.tenants.find(t => t.id === tenantId);
        const contract = tenant ? getContract(tenant) : null;
        const row = {
          landlord_id: user.id,
          tenant_id: tenantId,
          amount: tenant?.monthlyRent || 0,
          due_date: `${monthKey}-01`,
          paid_date: new Date().toISOString().split("T")[0],
          status: "completed",
          type: "recurring",
        };
        if (contract?.id) row.contract_id = contract.id;
        toInsert.push({ mapKey, row });
      } else if (!isChecked && wasSaved) {
        // Unchecked - need to delete
        toDelete.push({ mapKey, id: saved[mapKey] });
      }
    }

    const newSaved = { ...saved };

    // Batch delete (server-side route to bypass RLS DELETE restriction)
    if (toDelete.length > 0) {
      const ids = toDelete.map(d => d.id);
      const res = await fetch("/api/payments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPayError(`Failed to delete: ${json.error || "unknown error"}`);
        setSaving(false);
        return;
      }
      if (json.deletedCount !== ids.length) {
        setPayError(`Delete partially failed: ${json.deletedCount}/${ids.length} rows removed.`);
        setSaving(false);
        return;
      }
      for (const d of toDelete) delete newSaved[d.mapKey];
    }

    // Batch insert
    if (toInsert.length > 0) {
      const { data: inserted, error } = await supabase
        .from("payments")
        .insert(toInsert.map(i => i.row))
        .select();
      if (error) {
        setPayError(`Failed to save: ${error.message}`);
        setSaving(false);
        return;
      }
      // Map returned rows back to mapKeys by matching tenant_id + due_date
      for (const rec of inserted) {
        const mk = `${rec.tenant_id}-${rec.due_date.slice(0, 7)}`;
        newSaved[mk] = rec.id;
      }
    }

    setSaved(newSaved);
    setChecked({ ...newSaved });
    setSaving(false);
  };

  const colCount = 3 + months.length;

  return (
    <div>
      <PageHeader title={t.payTitle} subtitle={t.paySubtitleTracker} />
      {payError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>{payError}</div>}
      {/* Property filter (persisted across sessions) */}
      <PropertyFilterBar chips={filterChips} hidden={hiddenProps} setHidden={setHiddenProps} t={t} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={saveChanges} disabled={saving || !hasChanges}
          style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: hasChanges ? "#111111" : "#eaeaea", color: hasChanges ? "#fff" : "#9ca3af", fontSize: 14, fontWeight: 600, cursor: (saving || !hasChanges) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
          {saving ? t.saving : t.saveChanges}
        </button>
        {hasChanges && (
          <button onClick={() => setChecked({ ...saved })}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #eaeaea", background: "#fff", color: "#6b7280", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t.discard}
          </button>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead style={{ background: "#fafafa" }}>
            <tr style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.colTenant}</th>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.payZelleName}</th>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.rent}</th>
              {months.map(m => (
                <th key={m.key} style={{ padding: "14px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{m.label}</th>
              ))}
            </tr>
            <tr style={{ borderTop: "1px solid #eaeaea", background: "#f5f5f5" }}>
              <td colSpan={3} style={{ padding: "5px 18px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px", textAlign: "right" }}>
                {t.paySelectAll}
              </td>
              {months.map(m => {
                const allChecked = allTenants.length > 0 && allTenants.every(t => !!checked[`${t.id}-${m.key}`]);
                const someChecked = !allChecked && allTenants.some(t => !!checked[`${t.id}-${m.key}`]);
                return (
                  <td key={m.key} style={{ padding: "5px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={() => toggleColumn(m.key)}
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#111111" }}
                      title={allChecked ? "Uncheck all" : "Check all"}
                    />
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ unit, tenants }) => (
              <Fragment key={unit?.id || "unassigned"}>
                <tr>
                  <td colSpan={colCount} style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".6px", background: "#fafafa", borderTop: "1px solid #eaeaea" }}>
                    {unit ? t.payUnitLabel(unit.unitNumber) : t.payUnassigned}
                  </td>
                </tr>
                {tenants.map(tenant => {
                  const rentAmount = tenant.monthlyRent || null;
                  return (
                    <tr key={tenant.id} style={{ borderTop: "1px solid #f5f5f5", background: "transparent" }}>
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#111111,#000000)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{(tenant.name || "?").charAt(0)}</div>
                          {setPage && setSelectedTenantId ? (
                            <span onClick={() => { setSelectedTenantId(tenant.id); setPage("tenant-detail"); }}
                              style={{ fontSize: 14, fontWeight: 600, color: "#111111", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>
                              {tenantFullName(tenant)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{tenantFullName(tenant)}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#6b7280" }}>
                        {tenant.zelleName || <span style={{ color: "#d1d5db" }}>-</span>}
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 600, color: "#111111" }}>
                        {rentAmount ? fmt(rentAmount) : <span style={{ color: "#d1d5db" }}>-</span>}
                      </td>
                      {months.map(month => {
                        const mapKey = `${tenant.id}-${month.key}`;
                        const isChecked = !!checked[mapKey];
                        const isDirty = !!checked[mapKey] !== !!saved[mapKey];
                        return (
                          <td key={month.key} style={{ padding: "13px 10px", textAlign: "center", background: isDirty ? "#f5f5f5" : "transparent" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggle(tenant.id, month.key)}
                              style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#111111" }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(() => {
                  const unitTotal = tenants.reduce((s, t) => s + (t.monthlyRent || 0), 0);
                  return unitTotal > 0 ? (
                    <tr style={{ borderTop: "1px solid #eaeaea", background: "#fafafa" }}>
                      <td colSpan={3} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#6b7280" }}>Total</td>
                      <td style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#111111" }}>{fmt(unitTotal)}</td>
                      <td colSpan={months.length} />
                    </tr>
                  ) : null;
                })()}
              </Fragment>
            ))}
            {data.tenants.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 48, textAlign: "center", color: "#9ca3af", fontSize: 15 }}>No tenants found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── MAINTENANCE PAGE ─────────────────────────────────────────────────────────
const AttachmentChip = ({ att }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    supabase.storage.from("documents").createSignedUrl(att.filePath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [att.filePath]);
  const isImage = att.fileType?.startsWith("image/");
  return (
    <a href={url || "#"} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fafafa", border: "1px solid #eaeaea", borderRadius: 8, padding: isImage ? 0 : "5px 10px", overflow: "hidden", textDecoration: "none", cursor: url ? "pointer" : "default", opacity: url ? 1 : 0.6 }}>
      {isImage && url ? (
        <img src={url} alt={att.fileName} style={{ width: 56, height: 56, objectFit: "cover", display: "block" }} />
      ) : (
        <span style={{ fontSize: 12, color: "#374151", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.fileName}</span>
      )}
    </a>
  );
};

// React-coupled wrapper over the maintenance core (lib/maintenance). It owns the
// optimistic local-state updates + rollback that the core deliberately knows
// nothing about: the core persists and returns/throws; this hook applies the
// change to `data`, and on failure restores the exact prior snapshot and reports
// the error. The single home for the rollback that 9 scattered writes lacked.
function useMaintenanceMutations(setData, { onError } = {}) {
  // Plain values — the React Compiler memoizes; manual useMemo/useCallback here
  // conflicts with it. createSupabaseAdapter(supabase) is effectively stable.
  const adapter = createSupabaseAdapter(supabase);
  const report = (e) => { console.error("[maintenance]", e); onError?.(e); };

  // Apply optimistically, persist, roll back on failure. Rollback restores ONLY
  // the touched slice (via a functional updater), so a concurrent change to a
  // different slice in flight isn't clobbered.
  const optimistic = async (slice, applyFn, persistFn) => {
    let prevSlice;
    setData(d => { prevSlice = d[slice]; return applyFn(d); });
    try { return await persistFn(); }
    catch (e) { setData(d => ({ ...d, [slice]: prevSlice })); report(e); throw e; }
  };

  return {
    // Optimistic (instant board move / thread change), with rollback.
    // `existingClosedAt` comes from the row the caller already has, so re-closing
    // an already-closed ticket keeps its original close date. The optimistic
    // patch runs the same rule as the core so the card doesn't flash a stale
    // date before the refetch.
    setStatus: (id, status, existingClosedAt = null) => {
      const now = new Date().toISOString();
      const closedAt = maintStatus.nextClosedAt(status, existingClosedAt, now);
      return optimistic("maintenance",
        d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id
          ? { ...m, status, closedAt, closedDate: closedAt ? closedAt.split("T")[0] : null }
          : m) }),
        () => maint.setStatus(adapter, id, status, { existingClosedAt, now }),
      );
    },
    deleteComment: (comment, hasReplies) => {
      const now = new Date().toISOString();
      return optimistic("maintenanceComments",
        d => ({ ...d, maintenanceComments: hasReplies
          ? d.maintenanceComments.map(x => x.id === comment.id ? { ...x, deletedAt: now, body: "", bodyZh: "" } : x)
          : d.maintenanceComments.filter(x => x.id !== comment.id) }),
        () => maint.deleteComment(adapter, comment, hasReplies, now),
      );
    },
    // Pessimistic (persist first, then reflect the real result), error surfaced.
    addComment: async (input) => {
      try {
        const c = await maint.addComment(adapter, input);
        setData(d => ({ ...d, maintenanceComments: [...(d.maintenanceComments || []), c] }));
        return c;
      } catch (e) { report(e); throw e; }
    },
    // Translate is best-effort and silent on failure (matching prior behavior):
    // log to console but do NOT route through onError, so a failed translate
    // never pops the comment-action error banner.
    translateComment: async (comment) => {
      try {
        const t = await maint.translateComment(adapter, comment);
        if (t) setData(d => ({ ...d, maintenanceComments: d.maintenanceComments.map(x => x.id === comment.id ? { ...x, bodyZh: t } : x) }));
        return t;
      } catch (e) { console.error("[maintenance] translateComment", e); return null; }
    },
    translateRequest: async (req) => {
      try {
        const t = await maint.translateRequest(adapter, req);
        if (t) setData(d => ({ ...d, maintenance: d.maintenance.map(x => x.id === req.id ? { ...x, descriptionZh: t } : x) }));
        return t;
      } catch (e) { console.error("[maintenance] translateRequest", e); return null; }
    },
    addType: async (input) => {
      const ty = await maint.addType(adapter, input);
      setData(d => ({ ...d, maintenanceTypes: [...(d.maintenanceTypes || []), ty].sort((a, b) => a.name.localeCompare(b.name)) }));
      return ty;
    },
    submitRequest: (input) => maint.submitRequest(adapter, input),
    createRequest: (formData) => maint.createRequest(adapter, formData),
  };
}

// Payment-reminder settings writes behind the lib/payment-reminders seam.
// setReminder is optimistic (toggle flips instantly) with rollback on failure;
// the field→column mapping lives in the core, not here.
function useEmailSettingsMutations(setData) {
  const adapter = createPaymentReminderAdapter(supabase);
  return {
    setReminder: async (field, value) => {
      let prevValue;
      setData(d => { prevValue = d.emailSettings[field]; return { ...d, emailSettings: { ...d.emailSettings, [field]: value } }; });
      try { await reminderOps.setReminderField(adapter, field, value); }
      // Roll back only this field, so a concurrent toggle of another field isn't clobbered.
      catch (e) { setData(d => ({ ...d, emailSettings: { ...d.emailSettings, [field]: prevValue } })); console.error("[payment-reminders]", e); }
    },
    saveTemplates: (templates) => reminderOps.saveTemplates(adapter, templates),
  };
}

// Property writes behind the lib/property seam (create / delete / drive-link).
// Call sites refresh() after, so no optimistic state coupling here. Edit +
// image-upload remain in their server routes.
function usePropertyMutations() {
  const adapter = createPropertyAdapter(supabase);
  return {
    create: (fields) => propertyOps.createProperty(adapter, fields),
    remove: (id) => propertyOps.deleteProperty(adapter, id),
    setDriveLink: (id, link) => propertyOps.setDriveLink(adapter, id, link),
  };
}

// Unit writes behind the lib/units seam (create / edit / guarded delete).
// Call sites refresh() after, same shape as usePropertyMutations(). Exported
// because PropertyDetailPage (phase2-components) is the only caller — the hook
// stays the single write path for units even though the UI lives next door.
export function useUnitMutations() {
  const adapter = createUnitAdapter(supabase);
  return {
    create: (fields) => unitOps.createUnit(adapter, fields),
    update: (id, fields) => unitOps.updateUnit(adapter, id, fields),
    remove: (id) => unitOps.deleteUnit(adapter, id),
  };
}

// Parking writes behind the lib/parking seam (spot CRUD, lease create/edit/end).
// Call sites refresh() after, same shape as usePropertyMutations() — no
// optimistic state coupling here.
function useParkingMutations() {
  const adapter = createParkingAdapter(supabase);
  return {
    createSpot: (fields) => parkingOps.createSpot(adapter, fields),
    updateSpot: (id, fields) => parkingOps.updateSpot(adapter, id, fields),
    setMarketStatus: (id, marketStatus) => parkingOps.setMarketStatus(adapter, id, marketStatus),
    updateLease: (id, fields) => parkingOps.updateLease(adapter, id, fields),
    deleteSpot: (id) => parkingOps.deleteSpot(adapter, id),
    createLease: (fields) => parkingOps.createLease(adapter, fields),
    endLease: (id, endDate) => parkingOps.endLease(adapter, id, endDate),
  };
}

// Tenant self-service profile writes behind the lib/tenant seam. These call
// refresh()/setUser at the call site (not optimistic setData), so the hook just
// builds the adapter and exposes the typed ops — no React state coupling.
function useTenantMutations() {
  const adapter = createTenantAdapter(supabase);
  return {
    setRecurringPayment: (id, value) => tenantOps.setRecurringPayment(adapter, id, value),
    setBankConnected: (id) => tenantOps.setBankConnected(adapter, id),
    updateDisplayName: (id, name) => tenantOps.updateDisplayName(adapter, id, name),
    acknowledgeMoveIn: (id, alreadyAckedAt) => tenantOps.acknowledgeMoveIn(adapter, id, { alreadyAckedAt }),
    acknowledgeMoveOut: (id, alreadyAckedAt) => tenantOps.acknowledgeMoveOut(adapter, id, { alreadyAckedAt }),
  };
}

// Shared threaded-comment UI for a single maintenance request. Used by both the
// landlord MaintenancePage and the tenant TenantMaintenancePage. `viewer` carries
// the posting identity (author_id must equal auth.uid()); `L` is a localized label
// bag so the component stays locale-agnostic.
const CommentThread = ({ request, comments, viewer, setData, L }) => {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [translating, setTranslating] = useState({});
  const [confirmId, setConfirmId] = useState(null);
  const [error, setError] = useState("");

  const threadComments = comments.filter(c => c.maintenanceRequestId === request.id);
  const byDate = (a, b) => (a.createdAt || "").localeCompare(b.createdAt || "");
  const topLevel = threadComments.filter(c => !c.parentCommentId).sort(byDate);
  const repliesOf = (id) => threadComments.filter(c => c.parentCommentId === id).sort(byDate);
  const liveCount = threadComments.filter(c => !c.deletedAt).length;

  const mx = useMaintenanceMutations(setData, { onError: () => setError(L.error) });

  const insertComment = async (text, parentId) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    setError("");
    if (!viewer.landlordId) { setError(L.error); return false; }
    try {
      await mx.addComment({
        requestId: request.id, parentId: parentId || null, landlordId: viewer.landlordId,
        body: trimmed, authorType: viewer.authorType, authorId: viewer.authorId, authorName: viewer.authorName,
      });
      return true;
    } catch { return false; }
  };

  const postTop = async () => { setPosting(true); const ok = await insertComment(body, null); if (ok) setBody(""); setPosting(false); };
  const postReply = async (parentId) => { setPosting(true); const ok = await insertComment(replyBody, parentId); if (ok) { setReplyBody(""); setReplyTo(null); } setPosting(false); };

  const translate = async (c) => {
    setTranslating(s => ({ ...s, [c.id]: true }));
    try {
      await mx.translateComment(c);
    } finally {
      setTranslating(s => ({ ...s, [c.id]: false }));
    }
  };

  const remove = async (c) => {
    setConfirmId(null);
    const hasReplies = !c.parentCommentId && repliesOf(c.id).length > 0;
    await mx.deleteComment(c, hasReplies).catch(() => {});
  };

  // author_id is always auth.uid() (landlord: user.authId; tenant: user.id,
  // which equals the tenant's auth.uid()), so this UI check matches the
  // author-only RLS delete policy exactly.
  const isMine = (c) => c.authorId === viewer.authorId && c.authorType === viewer.authorType;

  const renderComment = (c, isReply) => {
    const deleted = !!c.deletedAt;
    const isLandlord = c.authorType === "landlord";
    return (
      <div key={c.id} style={{ display: "flex", gap: 10, padding: "8px 0", marginLeft: isReply ? 34 : 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, background: isLandlord ? "linear-gradient(135deg,#111111,#000000)" : "linear-gradient(135deg,#6b7280,#4b5563)" }}>
          {(c.authorName || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>{c.authorName || "—"}</span>
            {isLandlord && <span style={{ fontSize: 10, fontWeight: 700, color: "#000000", background: "#f5f5f5", padding: "1px 6px", borderRadius: 99, textTransform: "uppercase", letterSpacing: ".3px" }}>{L.landlord}</span>}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate((c.createdAt || "").split("T")[0])}</span>
          </div>
          {deleted ? (
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>{L.deleted}</p>
          ) : (
            <p style={{ margin: "3px 0 0", fontSize: 14, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.body}</p>
          )}
          {!deleted && c.bodyZh && <p style={{ margin: "5px 0 0", fontSize: 13, color: "#000000", background: "#f5f5f5", borderRadius: 7, padding: "6px 9px", whiteSpace: "pre-wrap" }}>{c.bodyZh}</p>}
          {!deleted && (
            <div style={{ display: "flex", gap: 12, marginTop: 5, alignItems: "center" }}>
              {!isReply && <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyBody(""); }} style={commentLinkStyle}>{L.reply}</button>}
              {!c.bodyZh && (isMine(c) || viewer.authorType === "landlord") && <button onClick={() => translate(c)} disabled={translating[c.id]} style={{ ...commentLinkStyle, color: translating[c.id] ? "#9ca3af" : "#111111" }}>{translating[c.id] ? L.translating : L.translate}</button>}
              {isMine(c) && (confirmId === c.id ? (
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{L.deleteConfirm}</span>
                  <button onClick={() => remove(c)} style={{ ...commentLinkStyle, color: "#dc2626", fontWeight: 700 }}>{L.delete}</button>
                  <button onClick={() => setConfirmId(null)} style={commentLinkStyle}>{L.cancel}</button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(c.id)} style={{ ...commentLinkStyle, color: "#9ca3af" }}>{L.delete}</button>
              ))}
            </div>
          )}
          {replyTo === c.id && !isReply && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder={L.replyPlaceholder}
                onKeyDown={e => { if (e.key === "Enter" && replyBody.trim() && !posting) postReply(c.id); }}
                style={commentInputStyle} />
              <button onClick={() => postReply(c.id)} disabled={posting || !replyBody.trim()} style={commentSendStyle(posting || !replyBody.trim())}>{posting ? L.posting : L.post}</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #f5f5f5", paddingTop: 10 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#6b7280", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{open ? "▾" : "▸"}</span>
        {liveCount > 0 ? L.show(liveCount) : L.heading}
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {topLevel.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", padding: "4px 0 10px" }}>{L.none}</div>}
          {topLevel.map(top => (
            <div key={top.id}>
              {renderComment(top, false)}
              {repliesOf(top.id).map(r => renderComment(r, true))}
            </div>
          ))}
          {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={body} onChange={e => setBody(e.target.value)} placeholder={L.placeholder}
              onKeyDown={e => { if (e.key === "Enter" && body.trim() && !posting) postTop(); }}
              style={commentInputStyle} />
            <button onClick={postTop} disabled={posting || !body.trim()} style={commentSendStyle(posting || !body.trim())}>{posting ? L.posting : L.post}</button>
          </div>
        </div>
      )}
    </div>
  );
};

const commentLinkStyle = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#111111" };
const commentInputStyle = { flex: 1, padding: "8px 12px", border: "1px solid #eaeaea", borderRadius: 8, fontSize: 13, color: "#111111", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const commentSendStyle = (disabled) => ({ padding: "8px 16px", borderRadius: 8, border: "none", background: disabled ? "#eaeaea" : "#111111", color: disabled ? "#9ca3af" : "#fff", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 });

// Outlined red icon-button for row-level delete actions. Call sites override fontSize.
const dangerIconBtnStyle = { background: "#fff", border: "1px solid #fca5a5", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", fontFamily: "inherit" };
// Neutral sibling of the above, for non-destructive row-level actions (edit).
const iconBtn = { background: "#fff", border: "1px solid #eaeaea", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontWeight: 600, color: "#6b7280", display: "flex", alignItems: "center", fontFamily: "inherit" };

// ─── TO DO LIST (kanban) ────────────────────────────────────────────────────
// Board over the existing maintenance_requests. Stored status values are unchanged
// (new / in-progress / closed, plus legacy resolved/open); these map onto three
// columns. Dragging a card to a column writes that column's status.
// Column keys + their bilingual label tokens. The key→column logic and the
// open-status predicate live in lib/maintenance/status (columnOf/isOpen),
// shared with the dashboard counts and the server create route so they can't drift.
const TODO_COLUMNS = [
  { key: "new", tKey: "statusNew" },
  { key: "in-progress", tKey: "statusInProgress" },
  { key: "closed", tKey: "statusClosed" },
];
const todoColumnOf = maintStatus.columnOf;

// Priority → accent color, shared by the landlord board and the tenant request list.
const PRIORITY_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" };

// `closedText` is pre-formatted by the caller (the card stays locale-agnostic,
// same as `sub`/`typeText`). Empty for open tickets and for ones closed before
// closed_at existed.
const TodoCard = ({ request, tenantName, sub, closedText, typeText, priorityColor, commentCount, attachmentCount, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: request.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(request.id)}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        background: "#fff", borderRadius: 10, border: "1px solid #eee",
        padding: "12px 14px", display: "flex", gap: 10, alignItems: "stretch",
        cursor: "grab", boxShadow: "0 1px 2px rgba(0,0,0,.04)", touchAction: "none",
      }}>
      <div style={{ width: 3, borderRadius: 3, background: priorityColor || "#eaeaea", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#111111", fontWeight: 500, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{request.description}</p>
        {/* Shown whenever a translation exists, regardless of the UI language:
            the point is that a bilingual landlord can read the card without
            opening it. Clamped to 2 lines like the original so a long request
            can't make one card tower over the rest of the column. */}
        {request.descriptionZh && (
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#4b5563", lineHeight: 1.4, background: "#f7f7f8", borderRadius: 6, padding: "5px 8px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{request.descriptionZh}</p>
        )}
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{tenantName}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: closedText || typeText || commentCount || attachmentCount ? 8 : 0 }}>{sub}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {closedText && <span style={{ background: "#ecfdf5", color: "#047857", padding: "1px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{closedText}</span>}
          {typeText && <span style={{ background: "#f3f4f6", color: "#111111", padding: "1px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{typeText}</span>}
          {commentCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "#9ca3af" }}><Icon name="mail" size={12} />{commentCount}</span>}
          {attachmentCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "#9ca3af" }}><Icon name="file" size={12} />{attachmentCount}</span>}
        </div>
      </div>
    </div>
  );
};

const TodoColumn = ({ id, title, count, emptyText, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div style={{ flex: "1 0 300px", minWidth: 300, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 12px" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111111" }}>{title}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 99, padding: "1px 9px" }}>{count}</span>
      </div>
      <div ref={setNodeRef} style={{ background: isOver ? "#f0f0f0" : "#fafafa", borderRadius: 12, padding: 10, display: "grid", gap: 10, alignContent: "start", minHeight: 120, flex: 1, transition: "background .15s" }}>
        {children}
        {count === 0 && <div style={{ textAlign: "center", padding: "24px 0", color: "#cbcbcb", fontSize: 13 }}>{emptyText}</div>}
      </div>
    </div>
  );
};

const MaintenancePage = ({ data, setData, t, refresh, user }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ tenantId: "", status: "new", type: "", description: "", descriptionZh: "" });
  const [files, setFiles] = useState([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [showAddType, setShowAddType] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [translateState, setTranslateState] = useState("idle");
  const [cardTranslating, setCardTranslating] = useState({});
  const [detailId, setDetailId] = useState(null);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fileInputRef = useRef(null);
  const mx = useMaintenanceMutations(setData);

  // Requests/tenants tied to a property flagged "not in production" don't reach this
  // board — retiring a property hides its To Do List entries the same as it hides the
  // property's tenants on the dashboard, Tenants, and Payments pages.
  const excludedPropertyIds = nonProductionPropertyIds(data.properties);
  const visibleMaintenance = data.maintenance.filter(m => !m.propertyId || !excludedPropertyIds.has(m.propertyId));
  const visibleTenants = data.tenants.filter(ten => !ten.propertyId || !excludedPropertyIds.has(ten.propertyId));

  // A few px of movement before a drag begins, so a click opens the card detail
  // and only an actual drag moves it between columns.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const m = visibleMaintenance.find(x => x.id === active.id);
    if (!m || todoColumnOf(m.status) === over.id) return;
    updateStatus(active.id, over.id, m.closedAt);
  };

  const selectedTenant = visibleTenants.find(ten => ten.id === form.tenantId);
  const selectedUnit = selectedTenant
    ? (data.units.find(u => u.id === selectedTenant.unitId)?.unitNumber || selectedTenant.unit || "—")
    : "—";

  const updateStatus = (id, status, existingClosedAt) => mx.setStatus(id, status, existingClosedAt).catch(() => {});

  const addType = async () => {
    if (!newTypeName.trim() || !user?.id) return;
    setAddingType(true);
    try {
      const ty = await mx.addType({ landlordId: user.id, name: newTypeName });
      setF("type", ty.name);
    } catch { /* error logged to console; reset the add-type form either way */ }
    setNewTypeName("");
    setShowAddType(false);
    setAddingType(false);
  };

  const translate = async () => {
    if (!form.description.trim()) return;
    setTranslateState("loading");
    try {
      const res = await fetch("/api/maintenance/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: form.description, landlordId: user.id }),
      });
      const json = await res.json();
      if (res.ok) { setF("descriptionZh", json.translation); setTranslateState("done"); }
      else setTranslateState("idle");
    } catch { setTranslateState("idle"); }
  };

  const handleFileAdd = (e) => {
    const newFiles = Array.from(e.target.files).map(f => ({
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    setFiles(prev => {
      const copy = [...prev];
      if (copy[idx].previewUrl) URL.revokeObjectURL(copy[idx].previewUrl);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const resetModal = () => {
    setForm({ tenantId: "", status: "new", type: "", description: "", descriptionZh: "" });
    files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setFiles([]);
    setShowAddType(false);
    setNewTypeName("");
    setTranslateState("idle");
    setSubmitError("");
  };

  const submit = async () => {
    if (!form.tenantId || !form.description.trim()) return;
    setSubmitError("");
    setSubmitting(true);
    const fd = new FormData();
    fd.append("tenantId", form.tenantId);
    fd.append("propertyId", selectedTenant?.propertyId || "");
    fd.append("unit", selectedUnit !== "—" ? selectedUnit : "");
    fd.append("status", form.status);
    fd.append("type", form.type);
    fd.append("description", form.description);
    if (form.descriptionZh) fd.append("descriptionZh", form.descriptionZh);
    fd.append("landlordId", user.id);
    files.forEach(({ file }) => fd.append("files", file));
    try {
      await mx.createRequest(fd);
    } catch (e) { setSubmitError(e.message || "Something went wrong."); setSubmitting(false); return; }
    await refresh();
    setShowModal(false);
    resetModal();
    setSubmitting(false);
  };

  const pColors = PRIORITY_COLORS;
  const pLabels = { high: t.priorityHigh, medium: t.priorityMedium, low: t.priorityLow };

  const commentViewer = { authorType: "landlord", authorId: user.authId, landlordId: user.id, authorName: user.name };
  const commentLabels = {
    heading: t.commentsHeading, show: t.commentsShow, none: t.commentsNone,
    reply: t.commentReply, post: t.commentPost, posting: t.commentPosting, cancel: t.commentCancel,
    placeholder: t.commentPlaceholder, replyPlaceholder: t.commentReplyPlaceholder,
    delete: t.commentDelete, deleteConfirm: t.commentDeleteConfirm, deleted: t.commentDeleted,
    translate: t.maintTranslateChinese, translating: t.maintTranslating, landlord: t.commentLandlord,
    error: t.commentError,
  };

  return (
    <div>
      <PageHeader title={t.maintTitle} subtitle={t.maintSubtitle(visibleMaintenance.filter(m => maintStatus.isOpen(m.status)).length)} action={<Btn icon="plus" onClick={() => { resetModal(); setShowModal(true); }}>{t.maintNewRequest}</Btn>} />

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
          {TODO_COLUMNS.map(col => {
            const cards = visibleMaintenance.filter(m => todoColumnOf(m.status) === col.key);
            return (
              <TodoColumn key={col.key} id={col.key} title={t[col.tKey]} count={cards.length} emptyText={t.todoEmptyColumn}>
                {cards.map(m => {
                  const ten = data.tenants.find(ten => ten.id === m.tenantId);
                  const prop = data.properties.find(p => p.id === m.propertyId);
                  const attachmentCount = (data.maintenanceAttachments || []).filter(a => a.maintenanceRequestId === m.id).length;
                  const commentCount = (data.maintenanceComments || []).filter(c => c.maintenanceRequestId === m.id && !c.deletedAt).length;
                  const sub = `${prop?.address || "—"}${m.unit ? ` · ${m.unit}` : ""} · ${fmtDate(m.date)}`;
                  return (
                    <TodoCard key={m.id} request={m} tenantName={ten ? tenantFullName(ten) : "—"} sub={sub}
                      closedText={m.closedDate ? t.maintClosedOn(fmtDate(m.closedDate)) : ""}
                      typeText={m.type} priorityColor={pColors[m.priority]} commentCount={commentCount}
                      attachmentCount={attachmentCount} onOpen={setDetailId} />
                  );
                })}
              </TodoColumn>
            );
          })}
        </div>
      </DndContext>

      {/* Card detail modal */}
      {detailId && (() => {
        const m = visibleMaintenance.find(x => x.id === detailId);
        if (!m) return null;
        const ten = data.tenants.find(ten => ten.id === m.tenantId);
        const prop = data.properties.find(p => p.id === m.propertyId);
        const attachments = (data.maintenanceAttachments || []).filter(a => a.maintenanceRequestId === m.id);
        return (
          <Modal title={t.todoDetailTitle} onClose={() => setDetailId(null)} wide>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 16, color: "#111111", fontWeight: 600, flex: 1, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.description}</p>
              {!m.descriptionZh && (
                <button
                  onClick={async () => {
                    setCardTranslating(s => ({ ...s, [m.id]: true }));
                    try {
                      await mx.translateRequest({ id: m.id, description: m.description, landlordId: user.id });
                    } finally {
                      setCardTranslating(s => ({ ...s, [m.id]: false }));
                    }
                  }}
                  disabled={cardTranslating[m.id]}
                  style={{ fontSize: 11, fontWeight: 600, color: cardTranslating[m.id] ? "#9ca3af" : "#111111", background: "none", border: "1px solid #e5e5e5", borderRadius: 6, padding: "3px 9px", cursor: cardTranslating[m.id] ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0 }}>
                  {cardTranslating[m.id] ? t.maintTranslating : t.maintTranslateChinese}
                </button>
              )}
            </div>
            {m.descriptionZh && <p style={{ margin: "0 0 10px", fontSize: 14, color: "#000000", background: "#f5f5f5", borderRadius: 7, padding: "8px 11px", whiteSpace: "pre-wrap" }}>{m.descriptionZh}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13, color: "#6b7280", margin: "8px 0 14px" }}>
              <span>{ten ? tenantFullName(ten) : "—"}</span>
              <span>{prop?.address}{m.unit ? ` · ${m.unit}` : ""}</span>
              <span>{fmtDate(m.date)}</span>
              {/* Null on open tickets and on ones closed before closed_at existed. */}
              {m.closedDate && <span style={{ fontWeight: 600 }}>{t.maintClosedOn(fmtDate(m.closedDate))}</span>}
              {m.priority && <span style={{ color: pColors[m.priority], fontWeight: 600 }}>{pLabels[m.priority]}</span>}
              {m.type && <span style={{ background: "#f3f4f6", color: "#111111", padding: "1px 8px", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{m.type}</span>}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: attachments.length ? 14 : 4 }}>
              <Badge status={m.status} t={t} />
              <select value={m.status} onChange={e => updateStatus(m.id, e.target.value, m.closedAt)}
                style={{ padding: "6px 10px", border: "1px solid #eaeaea", borderRadius: 8, fontSize: 12, color: "#374151", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                <option value="new">{t.statusNew}</option>
                <option value="in-progress">{t.statusInProgress}</option>
                <option value="closed">{t.statusClosed}</option>
                {/* Keep legacy stored values selectable so the control matches the Badge until the landlord re-files it */}
                {m.status === "open" && <option value="open">{t.statusOpen}</option>}
                {m.status === "resolved" && <option value="resolved">{t.statusResolved}</option>}
              </select>
            </div>
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                {attachments.map(att => <AttachmentChip key={att.id} att={att} />)}
              </div>
            )}
            <CommentThread request={m} comments={data.maintenanceComments || []} viewer={commentViewer} setData={setData} L={commentLabels} />
          </Modal>
        );
      })()}

      {/* New Request Modal */}
      {showModal && (
        <Modal title={t.maintNewRequest} onClose={() => { setShowModal(false); resetModal(); }} wide>
          {/* Tenant + Unit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.maintTenant} *</label>
              <select value={form.tenantId} onChange={e => setF("tenantId", e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}>
                <option value="">{t.maintSelectTenant}</option>
                {visibleTenants.filter(ten => ten.status === "current tenant" || ten.status === "future tenant").map(ten => (
                  <option key={ten.id} value={ten.id}>{tenantFullName(ten)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.maintUnit}</label>
              <div style={{ padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: selectedUnit !== "—" ? "#111111" : "#9ca3af", background: "#fafafa" }}>
                {selectedUnit}
              </div>
            </div>
          </div>

          {/* Status + Type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <Sel label={t.colStatus} value={form.status} onChange={v => setF("status", v)} options={[
              { value: "new", label: t.statusNew },
              { value: "in-progress", label: t.statusInProgress },
              { value: "closed", label: t.statusClosed },
            ]} />
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.maintType}</label>
              <select value={form.type} onChange={e => { if (e.target.value === "__add__") { setShowAddType(true); } else { setF("type", e.target.value); } }}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}>
                <option value="">{t.maintTypeSelect}</option>
                {(data.maintenanceTypes || []).map(mt => (
                  <option key={mt.id} value={mt.name}>{mt.name}</option>
                ))}
                <option value="__add__">{t.maintAddNewType}</option>
              </select>
              {showAddType && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addType(); if (e.key === "Escape") { setShowAddType(false); setNewTypeName(""); } }}
                    placeholder={t.maintNewTypePlaceholder}
                    autoFocus
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid #111111", borderRadius: 8, fontSize: 14, color: "#111111", outline: "none", fontFamily: "inherit" }}
                  />
                  <button onClick={addType} disabled={addingType || !newTypeName.trim()}
                    style={{ padding: "8px 14px", background: "#111111", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: addingType || !newTypeName.trim() ? "not-allowed" : "pointer", opacity: addingType || !newTypeName.trim() ? 0.6 : 1, fontFamily: "inherit" }}>
                    {t.maintAddTypeSave}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t.maintDescription} *</label>
              <button onClick={translate} disabled={translateState === "loading" || !form.description.trim()}
                style={{ fontSize: 12, fontWeight: 600, color: translateState === "loading" ? "#9ca3af" : "#111111", background: "none", border: "none", cursor: translateState === "loading" || !form.description.trim() ? "not-allowed" : "pointer", padding: 0, fontFamily: "inherit", opacity: !form.description.trim() ? 0.5 : 1 }}>
                {translateState === "loading" ? t.maintTranslating : t.maintTranslateChinese}
              </button>
            </div>
            <textarea value={form.description} onChange={e => { setF("description", e.target.value); if (translateState === "done") setTranslateState("idle"); }}
              placeholder={t.maintDescriptionPlaceholder} rows={4}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
          </div>

          {/* Chinese translation */}
          {(translateState === "done" || form.descriptionZh) && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{t.maintTranslatedLabel}</label>
              <textarea value={form.descriptionZh} onChange={e => setF("descriptionZh", e.target.value)} rows={3}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #e5e5e5", borderRadius: 9, fontSize: 14, color: "#111111", background: "#f5f5f5", boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
            </div>
          )}

          {/* Attachments */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t.maintAttachments}</label>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 12, fontWeight: 600, color: "#111111", background: "none", border: "1px solid #e5e5e5", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                + {t.maintAddFiles}
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileAdd} style={{ display: "none" }} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
            </div>
            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {files.map((f, idx) => (
                  <div key={idx} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, background: "#fafafa", border: "1px solid #eaeaea", borderRadius: 8, padding: f.previewUrl ? 0 : "6px 10px", overflow: "hidden" }}>
                    {f.previewUrl ? (
                      <img src={f.previewUrl} alt={f.file.name} style={{ width: 64, height: 64, objectFit: "cover", display: "block" }} />
                    ) : (
                      <span style={{ fontSize: 12, color: "#374151", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file.name}</span>
                    )}
                    <button onClick={() => removeFile(idx)}
                      style={{ position: f.previewUrl ? "absolute" : "static", top: 2, right: 2, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {submitError && <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 12 }}>{submitError}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => { setShowModal(false); resetModal(); }}>{t.cancel}</Btn>
            <Btn onClick={submit} disabled={submitting || !form.tenantId || !form.description.trim()}>{submitting ? t.maintSubmitting : t.maintNewRequest}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── EMAIL PAGE ───────────────────────────────────────────────────────────────
const EmailPage = ({ data, setData, t, refresh }) => {
  const s = data.emailSettings;
  const reminderMx = useEmailSettingsMutations(setData);
  const updS = (k, v) => reminderMx.setReminder(k, v);
  const updT = (k, v) => setData(d => ({...d, emailSettings:{...d.emailSettings,templates:{...d.emailSettings.templates,[k]:v}}}));
  const saveTemplate = async () => {
    try { await reminderMx.saveTemplates(s.templates); setEditing(null); }
    catch (e) { console.error("[payment-reminders] saveTemplates", e); } // leave the editor open on failure
  };
  const [editing, setEditing] = useState(null);
  const reminders = [
    { key:"fiveDayReminder",   tKey:"fiveDayReminder",   label:t.reminder5Day,  desc:t.reminder5DayDesc },
    { key:"dayOfReminder",     tKey:"dayOfReminder",     label:t.reminderDayOf, desc:t.reminderDayOfDesc },
    { key:"oneDayOverdue",     tKey:"oneDayOverdue",     label:t.reminder1Day,  desc:t.reminder1DayDesc },
    { key:"threeDayOverdue",   tKey:"threeDayOverdue",   label:t.reminder3Day,  desc:t.reminder3DayDesc },
    { key:"sevenDayOverdue",   tKey:"sevenDayOverdue",   label:t.reminder7Day,  desc:t.reminder7DayDesc },
  ];

  return (
    <div>
      <PageHeader title={t.emailTitle} subtitle={t.emailSubtitle} />
      <div style={{ display: "grid", gap: 14 }}>
        {reminders.map(r => (
          <div key={r.key} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: s[r.key]?"rgba(17,17,17,.1)":"#fafafa", display: "flex", alignItems: "center", justifyContent: "center", color: s[r.key]?"#111111":"#9ca3af" }}><Icon name="mail" size={19} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>{r.label}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={() => setEditing(editing===r.key?null:r.key)} style={{ padding: "7px 14px", border: "1px solid #eaeaea", borderRadius: 8, background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="edit" size={14} />{t.editTemplate}
              </button>
              <Toggle value={s[r.key]} onChange={v => updS(r.key, v)} />
            </div>
          </div>
        ))}
        {editing && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #111111" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111111" }}>{t.editTemplateLabel} {reminders.find(r => r.key===editing)?.label}</h4>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{t.variablesNote}</span>
            </div>
            <textarea value={s.templates[reminders.find(r => r.key===editing)?.tKey]} onChange={e => updT(reminders.find(r => r.key===editing)?.tKey, e.target.value)}
              style={{ width: "100%", minHeight: 160, padding: "12px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 13, color: "#374151", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <Btn size="sm" onClick={saveTemplate}>{t.saveTemplate}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TENANT PAGES (English only — tenant UI not translated) ──────────────────
const TenantDashboard = ({ data, user }) => {
  const tenant = data.tenants.find(t => t.id === user.id);
  const contract = data.contracts.find(c => c.tenantIds.includes(user.id));
  const property = data.properties.find(p => p.id === tenant?.propertyId);
  const payments = data.payments.filter(p => p.tenantId === user.id).sort((a,b) => new Date(b.dueDate)-new Date(a.dueDate));
  const openMaint = data.maintenance.filter(m => m.tenantId === user.id && maintStatus.isOpen(m.status));

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}!`} subtitle="Your rental portal overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Monthly Rent" value={contract ? fmt(contract.rentAmount) : "—"} sub={contract ? `Due the ${contract.dueDay}${contract.dueDay===1?"st":"th"} of each month` : ""} icon="dollar" />
        <StatCard label="Next Payment" value={contract ? `Mar ${contract.dueDay}` : "—"} sub={payments[0] ? <Badge status={payments[0].status} t={T.en} /> : ""} icon="calendar" color="#3b82f6" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Your Unit</h3>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 50, height: 50, background: "linear-gradient(135deg,#111111,#1a1a1a)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", flexShrink: 0 }}><Icon name="home" size={24} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111111" }}>{property?.address}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{property?.city}, {property?.state} {property?.zip}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{tenant?.unit} · {property?.type}</div>
            </div>
          </div>
          {contract && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Lease Start", fmtDate(contract.startDate)],["Lease End", fmtDate(contract.endDate)]].map(([lbl,val]) => (
                <div key={lbl} style={{ background: "#fafafa", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Recent Payments</h3>
          {payments.slice(0,4).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #fafafa" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{fmt(p.amount)}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Due {fmtDate(p.dueDate)}</div>
              </div>
              <Badge status={p.status} t={T.en} />
            </div>
          ))}
          {payments.length === 0 && <p style={{ color: "#9ca3af", fontSize: 14 }}>No payment history yet.</p>}
        </div>
      </div>
    </div>
  );
};

const PaymentPortal = ({ data, setData, user, refresh }) => {
  const [step, setStep] = useState("overview");
  const [bankForm, setBankForm] = useState({ routingNumber: "", accountNumber: "", accountName: "", accountType: "checking" });
  const [success, setSuccess] = useState(false);
  const tenantMx = useTenantMutations();
  const tenant = data.tenants.find(t => t.id === user.id);
  const contract = data.contracts.find(c => c.tenantIds.includes(user.id));
  const toggleRecurring = async () => {
    try { await tenantMx.setRecurringPayment(user.id, !tenant.recurringPayment); await refresh(); }
    catch (e) { console.error("[tenant] setRecurringPayment", e); }
  };
  const connectBank = async () => {
    if(!bankForm.routingNumber||!bankForm.accountNumber) return;
    try { await tenantMx.setBankConnected(user.id); await refresh(); setStep("overview"); }
    catch (e) { console.error("[tenant] setBankConnected", e); }
  };
  const makePayment = async () => {
    const res = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: user.id, contract_id: contract?.id, amount: contract?.rentAmount }),
    });
    if (res.ok) {
      await refresh();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };
  if (!tenant||!contract) return <div style={{ padding:32,color:"#6b7280" }}>No lease found.</div>;

  return (
    <div>
      <PageHeader title="Payment Portal" subtitle="ACH payments & bank account management" />
      {success && <div style={{ background:"#dcfce7",border:"1px solid #86efac",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:10,color:"#166534",fontSize:14,fontWeight:600 }}><Icon name="check" size={18} />Payment initiated! ACH transfer processing (1-3 business days).</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f5f5f5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: tenant.bankConnected?"rgba(34,197,94,.1)":"#fafafa", display: "flex", alignItems: "center", justifyContent: "center", color: tenant.bankConnected?"#22c55e":"#9ca3af" }}><Icon name="bank" size={21} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Bank Account</div>
              <div style={{ fontSize: 13, color: tenant.bankConnected?"#22c55e":"#9ca3af", fontWeight: 500 }}>{tenant.bankConnected?"✓ Connected & verified":"Not connected"}</div>
            </div>
          </div>
          {step !== "bank" ? (
            tenant.bankConnected ? (
              <div>
                <div style={{ background: "#fafafa", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Account ending in <strong>••••4521</strong></div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Chase Bank · Checking</div>
                </div>
                <Btn variant="secondary" size="sm" icon="edit" onClick={() => setStep("bank")}>Update Account</Btn>
              </div>
            ) : (
              <div>
                <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>Connect your bank account to enable ACH payments.</p>
                <Btn icon="bank" onClick={() => setStep("bank")}>Connect Bank Account</Btn>
              </div>
            )
          ) : (
            <div>
              <Inp label="Account Holder Name" value={bankForm.accountName} onChange={v => setBankForm(f => ({...f,accountName:v}))} placeholder="John Smith" />
              <Inp label="Routing Number" value={bankForm.routingNumber} onChange={v => setBankForm(f => ({...f,routingNumber:v}))} placeholder="021000021" />
              <Inp label="Account Number" value={bankForm.accountNumber} onChange={v => setBankForm(f => ({...f,accountNumber:v}))} type="password" />
              <Sel label="Account Type" value={bankForm.accountType} onChange={v => setBankForm(f => ({...f,accountType:v}))} options={[{value:"checking",label:"Checking"},{value:"savings",label:"Savings"}]} />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" size="sm" onClick={() => setStep("overview")}>Cancel</Btn>
                <Btn size="sm" icon="key" onClick={connectBank}>Verify & Connect</Btn>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: tenant.recurringPayment?"rgba(17,17,17,.1)":"#fafafa", display: "flex", alignItems: "center", justifyContent: "center", color: tenant.recurringPayment?"#111111":"#9ca3af" }}><Icon name="refresh" size={19} /></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Auto-Pay</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>Pay {fmt(contract.rentAmount)} on the {contract.dueDay}{contract.dueDay===1?"st":"th"}</div>
                  <div style={{ fontSize: 12, color: tenant.recurringPayment?"#111111":"#9ca3af", marginTop: 3, fontWeight: 500 }}>{tenant.recurringPayment?"Enabled":"Disabled"}</div>
                </div>
              </div>
              <Toggle value={tenant.recurringPayment} onChange={toggleRecurring} />
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(59,130,246,.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}><Icon name="dollar" size={19} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>Make a Payment</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>One-time ACH transfer</div>
              </div>
            </div>
            <div style={{ background: "#fafafa", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Amount</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111111" }}>{fmt(contract.rentAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>To</span>
                <span style={{ fontSize: 13, color: "#374151" }}>Brian Zhang (Landlord)</span>
              </div>
            </div>
            <Btn onClick={makePayment} icon="bank">{tenant.bankConnected?"Submit ACH Payment":"Bank Account Required"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

const TenantMaintenancePage = ({ data, setData, user, refresh }) => {
  const [form, setForm] = useState({ description: "", priority: "medium" });
  const [success, setSuccess] = useState(false);
  const mx = useMaintenanceMutations(setData);
  const tenant = data.tenants.find(t => t.id === user.id);
  const myReqs = data.maintenance.filter(m => m.tenantId === user.id);
  const commentViewer = { authorType: "tenant", authorId: user.id, landlordId: tenant?.landlordId || null, authorName: tenant ? tenantFullName(tenant) : (user.name || user.email) };
  const commentLabels = {
    heading: "Comments", show: (n) => n === 1 ? "1 comment" : `${n} comments`, none: "No comments yet",
    reply: "Reply", post: "Post", posting: "Posting...", cancel: "Cancel",
    placeholder: "Write a comment...", replyPlaceholder: "Write a reply...",
    delete: "Delete", deleteConfirm: "Delete this comment?", deleted: "[deleted]",
    translate: "Translate to Chinese", translating: "Translating...", landlord: "Landlord",
    error: "Couldn't post comment. Please try again.",
  };
  const submit = async () => {
    if (!form.description) return;
    try {
      await mx.submitRequest({
        tenantId: user.id, propertyId: tenant?.propertyId, unit: tenant?.unit,
        description: form.description, priority: form.priority,
      });
    } catch { return; }
    await refresh();
    setForm({description:"",priority:"medium"});
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };
  return (
    <div>
      <PageHeader title="Maintenance Requests" subtitle="Submit and track repair requests" />
      {success && <div style={{ background:"#dcfce7",border:"1px solid #86efac",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:10,color:"#166534",fontSize:14,fontWeight:600 }}><Icon name="check" size={18} />Request submitted! Your landlord will be notified.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f5f5f5" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>New Request</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Describe the issue in detail..." rows={5}
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>
          <Sel label="Priority" value={form.priority} onChange={v => setForm(f => ({...f,priority:v}))} options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} />
          <Btn icon="plus" onClick={submit}>Submit Request</Btn>
        </div>
        <div>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>My Requests</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {myReqs.map(m => {
              return (
                <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid #f5f5f5", display: "flex", gap: 12 }}>
                  <div style={{ width: 3, borderRadius: 3, background: PRIORITY_COLORS[m.priority], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#111111", marginBottom: 6 }}>{m.description}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{fmtDate(m.date)}</span>
                      <Badge status={m.status} t={T.en} />
                    </div>
                    <CommentThread request={m} comments={data.maintenanceComments || []} viewer={commentViewer} setData={setData} L={commentLabels} />
                  </div>
                </div>
              );
            })}
            {myReqs.length === 0 && <p style={{ color: "#9ca3af", fontSize: 14 }}>No requests submitted yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const TenantLeasePage = ({ data, user }) => {
  const contract = data.contracts.find(c => c.tenantIds.includes(user.id));
  const tenant = data.tenants.find(t => t.id === user.id);
  const property = data.properties.find(p => p.id === tenant?.propertyId);
  if (!contract) return <div style={{ padding:32,color:"#6b7280" }}>No active lease found.</div>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = contract.startDate ? new Date(`${contract.startDate}T00:00:00`) : null;
  const endDate = contract.endDate ? new Date(`${contract.endDate}T00:00:00`) : null;
  const notStartedYet = startDate && startDate > today;
  const daysLeft = endDate ? Math.ceil((endDate - today) / 86400000) : 0;
  return (
    <div>
      <PageHeader title="My Lease" subtitle="Current lease agreement details" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f5f5f5" }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#111111,#1a1a1a)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}><Icon name="file" size={24} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Lease Agreement</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{property?.address} · {tenant?.unit}</div>
            </div>
          </div>
          {[["Tenant", user.name],["Address",`${property?.address}, ${property?.city}`],["Unit",contract.unit],["Monthly Rent",fmt(contract.rentAmount)],["Due Day",`${contract.dueDay}${contract.dueDay===1?"st":"th"} of month`],["Start",fmtDate(contract.startDate)],["End",fmtDate(contract.endDate)],["Status",<Badge status={contract.status} t={T.en} />]].map(([lbl,val]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #fafafa" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{lbl}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#111111" }}>{val}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ background: notStartedYet ? "#f5f5f5" : daysLeft<60?"#fef2f2":"#f0fdf4", borderRadius: 14, padding: 24, border: `1px solid ${notStartedYet ? "#9ca3af" : daysLeft<60?"#fca5a5":"#86efac"}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: notStartedYet ? "#000000" : daysLeft<60?"#991b1b":"#166534", fontWeight: 600, marginBottom: 6 }}>LEASE EXPIRY</div>
            {notStartedYet ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Upcoming</div>
                <div style={{ fontSize: 14, color: "#000000" }}>Starts {fmtDate(contract.startDate)}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, fontWeight: 800, color: daysLeft<60?"#ef4444":"#22c55e", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{daysLeft} days</div>
                <div style={{ fontSize: 14, color: daysLeft<60?"#991b1b":"#166534" }}>Expires {fmtDate(contract.endDate)}</div>
              </>
            )}
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f5f5f5" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#111111" }}>Landlord Contact</h4>
            <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>Brian Zhang</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>brian@property.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PaymentHistoryPage = ({ data, user }) => {
  const payments = data.payments.filter(p => p.tenantId === user.id).sort((a,b) => new Date(b.dueDate)-new Date(a.dueDate));
  const total = payments.filter(p => p.status==="completed").reduce((s,p) => s+p.amount, 0);
  return (
    <div>
      <PageHeader title="Payment History" subtitle={`${payments.length} payments · ${fmt(total)} total paid`} />
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {["Amount","Due Date","Paid Date","Type","ACH Status","Status"].map(h => <th key={h} style={{ padding: "14px 20px", textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} style={{ borderTop: "1px solid #fafafa" }}>
                <td style={{ padding:"14px 20px",fontSize:16,fontWeight:700,color:"#111111",fontFamily:"'Inter',system-ui,-apple-system,sans-serif" }}>{fmt(p.amount)}</td>
                <td style={{ padding:"14px 20px",fontSize:13,color:"#6b7280" }}>{fmtDate(p.dueDate)}</td>
                <td style={{ padding:"14px 20px",fontSize:13,color:"#6b7280" }}>{fmtDate(p.paidDate)}</td>
                <td style={{ padding:"14px 20px",fontSize:12,color:"#6b7280",textTransform:"capitalize" }}>{p.type}</td>
                <td style={{ padding:"14px 20px" }}>{p.achStatus?<Badge status={p.achStatus} t={T.en} />:<span style={{ color:"#d1d5db" }}>—</span>}</td>
                <td style={{ padding:"14px 20px" }}><Badge status={p.status} t={T.en} /></td>
              </tr>
            ))}
            {payments.length===0 && <tr><td colSpan={6} style={{ padding:40,textAlign:"center",color:"#9ca3af" }}>No payment history yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── DOCUMENTS PAGE (landlord only) ───────────────────────────────────────────
const toEmbedUrl = (link) => {
  if (!link) return null;
  const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`;
  const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  return null;
};

const DocumentsPage = ({ data, refresh }) => {
  const propertyMx = usePropertyMutations();
  const [selectedId, setSelectedId] = useState(data.properties[0]?.id || "");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const selected = data.properties.find(p => p.id === selectedId);

  useEffect(() => {
    setLink(selected?.driveLink || "");
    setMsg("");
  }, [selectedId]);

  const save = async () => {
    setSaving(true); setMsg("");
    try { await propertyMx.setDriveLink(selectedId, link); }
    catch { setMsg("Failed to save."); setSaving(false); return; }
    await refresh(); setMsg("Saved."); setSaving(false);
  };

  const embedUrl = toEmbedUrl(link);

  if (!data.properties.length) return (
    <div>
      <PageHeader title="Documents" subtitle="Link Google Drive folders to your properties" />
      <div style={{ background: "#fff", borderRadius: 14, padding: 40, border: "1px solid #f5f5f5", textAlign: "center", color: "#9ca3af" }}>Add a property first to attach documents.</div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Documents" subtitle="Link Google Drive folders to your properties" />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
        {/* Property list */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", overflow: "hidden" }}>
          {data.properties.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              style={{ width: "100%", padding: "14px 16px", border: "none", borderBottom: "1px solid #fafafa", background: p.id === selectedId ? "rgba(17,17,17,.08)" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111111" }}>{p.address}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{p.city} · {p.driveLink ? "✓ Linked" : "No folder"}</div>
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{selected?.address}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>Paste a Google Drive folder or file share link below.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={link} onChange={e => { setLink(e.target.value); setMsg(""); }}
                placeholder="https://drive.google.com/drive/folders/..."
                style={{ flex: 1, padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 13, color: "#111111", fontFamily: "inherit", outline: "none" }} />
              <button onClick={save} disabled={saving}
                style={{ padding: "10px 20px", background: "linear-gradient(135deg,#111111,#000000)", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg === "Saved." ? "#22c55e" : "#ef4444" }}>{msg}</p>}
          </div>

          {embedUrl ? (
            <iframe src={embedUrl} title="Google Drive" style={{ width: "100%", height: 520, border: "1px solid #eaeaea", borderRadius: 10 }} allow="autoplay" />
          ) : (
            <div style={{ height: 200, border: "1.5px dashed #eaeaea", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
              Paste a Drive link above to preview the folder here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ADMIN USERS PAGE ─────────────────────────────────────────────────────────
const AdminUsersPage = ({ t, user: currentUser, refresh }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const loadUsers = async () => {
    const res = await fetch("/api/auth/list-users");
    const json = await res.json();
    if (json.users) setAllUsers(json.users.filter(u => u.role !== "tenant").map(u => ({ ...u, displayName: u.name || u.email })).sort((a, b) => a.displayName.localeCompare(b.displayName)));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSubmit = async () => {
    setMsg(null);
    if (!form.name || !form.email || !form.password) { setMsg({ text: t.adminErrFields, error: true }); return; }
    if (form.password.length < 8) { setMsg({ text: t.adminErrPassword, error: true }); return; }
    setLoading(true);
    const res = await fetch("/api/auth/register-landlord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (json.error) { setMsg({ text: json.error, error: true }); return; }
    setMsg({ text: t.adminSuccess, error: false });
    setForm({ name: "", email: "", password: "" });
    loadUsers();
    if (refresh) refresh();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/auth/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: confirmDelete.id, role: confirmDelete.role }),
    });
    const json = await res.json();
    if (!res.ok) { setDeleteError(json.error || "Delete failed"); setDeleting(false); return; }
    loadUsers();
    if (refresh) await refresh();
    setConfirmDelete(null);
    setDeleting(false);
  };

  const RoleBadge = ({ role }) => {
    const styles = {
      admin:      { bg: "rgba(17,17,17,.12)",  color: "#111111", label: "Admin" },
      tenant:     { bg: "rgba(34,197,94,.12)",  color: "#16a34a", label: "Tenant" },
      unassigned: { bg: "rgba(148,163,184,.15)", color: "#6b7280", label: "Unassigned" },
    };
    const s = styles[role] || styles.unassigned;
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".5px", background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      <PageHeader title={t.adminUsersTitle} subtitle={t.adminUsersSubtitle} />

      {/* User list */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f5f5f5", overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Name", "Email", "Role", ""].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id} style={{ borderTop: "1px solid #fafafa" }}>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#111111" }}>{u.displayName}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#6b7280" }}>{u.email || "—"}</td>
                <td style={{ padding: "14px 20px" }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  {u.id !== currentUser?.id && (
                    <button onClick={() => { setDeleteError(null); setConfirmDelete(u); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}>
                      <Icon name="trash" size={14} /> Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create admin form */}
      <div style={{ maxWidth: 520 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Create Admin User</h3>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f5f5f5" }}>
          <Inp label={t.adminName} value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Inp label={t.adminEmail} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
          <Inp label={t.adminPassword} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" placeholder={t.minCharsPlaceholder} />
          {msg && <p style={{ fontSize: 13, margin: "8px 0", color: msg.error ? "#ef4444" : "#22c55e" }}>{msg.text}</p>}
          <Btn onClick={handleSubmit} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? t.adminCreating : t.adminCreateBtn}
          </Btn>
        </div>
      </div>

      {confirmDelete && (
        <Modal title="Delete User" onClose={() => setConfirmDelete(null)}>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>
            Are you sure you want to delete <strong>{confirmDelete.displayName}</strong>?
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#9ca3af" }}>This will permanently remove their account and cannot be undone.</p>
          {deleteError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#ef4444" }}>{deleteError}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Btn>
            <Btn onClick={handleDelete} disabled={deleting} style={{ background: "#ef4444" }}>{deleting ? "Deleting..." : "Delete"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── TENANT PROFILE PAGE ──────────────────────────────────────────────────────
const TenantProfilePage = ({ user, setUser }) => {
  const cardStyle = { background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f5f5f5", marginBottom: 20 };
  const headStyle = { margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#111111", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", paddingBottom: 14, borderBottom: "1px solid #f5f5f5" };
  const msgStyle = (err) => ({ fontSize: 13, marginTop: 8, color: err ? "#ef4444" : "#22c55e" });
  const tenantMx = useTenantMutations();

  // ── Name ──
  const [name, setName] = useState(user.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState({ text: "", error: false });
  const saveName = async () => {
    if (!name.trim()) return;
    setNameSaving(true); setNameMsg({ text: "", error: false });
    try {
      const saved = await tenantMx.updateDisplayName(user.id, name);
      setUser(u => ({ ...u, name: saved }));
      setNameMsg({ text: "Name updated.", error: false });
    } catch (e) { setNameMsg({ text: e.message, error: true }); }
    setNameSaving(false);
  };

  // ── Email ──
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ text: "", error: false });
  const saveEmail = async () => {
    setEmailMsg({ text: "", error: false });
    if (!newEmail.trim() || !emailPassword) { setEmailMsg({ text: "Both fields are required.", error: true }); return; }
    setEmailSaving(true);
    // Verify current password first
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: emailPassword });
    if (authErr) { setEmailMsg({ text: "Incorrect password.", error: true }); setEmailSaving(false); return; }
    // Request email change — Supabase sends a confirmation link to the new address
    const { error: updateErr } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (updateErr) { setEmailMsg({ text: updateErr.message, error: true }); setEmailSaving(false); return; }
    setEmailMsg({ text: "A confirmation link has been sent to your new email. Click it to complete the change.", error: false });
    setNewEmail(""); setEmailPassword("");
    setEmailSaving(false);
  };

  // ── Password ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: "", error: false });
  const savePassword = async () => {
    setPwMsg({ text: "", error: false });
    if (!currentPw || !newPw || !confirmPw) { setPwMsg({ text: "All fields are required.", error: true }); return; }
    if (newPw.length < 8) { setPwMsg({ text: "New password must be at least 8 characters.", error: true }); return; }
    if (newPw !== confirmPw) { setPwMsg({ text: "Passwords do not match.", error: true }); return; }
    setPwSaving(true);
    // Verify current password
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
    if (authErr) { setPwMsg({ text: "Current password is incorrect.", error: true }); setPwSaving(false); return; }
    // Update password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
    if (updateErr) { setPwMsg({ text: updateErr.message, error: true }); setPwSaving(false); return; }
    setPwMsg({ text: "Password updated successfully.", error: false });
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwSaving(false);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", border: "1px solid #eaeaea", borderRadius: 9, fontSize: 14, color: "#111111", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 580 }}>
      <PageHeader title="My Profile" subtitle="Manage your account details" />

      {/* Name */}
      <div style={cardStyle}>
        <h3 style={headStyle}>Display Name</h3>
        <label style={labelStyle}>Full Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        {nameMsg.text && <p style={msgStyle(nameMsg.error)}>{nameMsg.text}</p>}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={saveName}>{nameSaving ? "Saving…" : "Save Name"}</Btn>
        </div>
      </div>

      {/* Email */}
      <div style={cardStyle}>
        <h3 style={headStyle}>Change Email</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>Current email: <strong style={{ color: "#111111" }}>{user.email}</strong></p>
        <label style={labelStyle}>New Email Address</label>
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={labelStyle}>Current Password (to confirm)</label>
        <input value={emailPassword} onChange={e => setEmailPassword(e.target.value)} type="password" style={inputStyle} />
        {emailMsg.text && <p style={msgStyle(emailMsg.error)}>{emailMsg.text}</p>}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={saveEmail}>{emailSaving ? "Sending…" : "Update Email"}</Btn>
        </div>
      </div>

      {/* Password */}
      <div style={cardStyle}>
        <h3 style={headStyle}>Change Password</h3>
        <label style={labelStyle}>Current Password</label>
        <input value={currentPw} onChange={e => setCurrentPw(e.target.value)} type="password" style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={labelStyle}>New Password</label>
        <input value={newPw} onChange={e => setNewPw(e.target.value)} type="password" placeholder="Min. 8 characters" style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={labelStyle}>Confirm New Password</label>
        <input value={confirmPw} onChange={e => setConfirmPw(e.target.value)} type="password" style={inputStyle} />
        {pwMsg.text && <p style={msgStyle(pwMsg.error)}>{pwMsg.text}</p>}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={savePassword}>{pwSaving ? "Saving…" : "Update Password"}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// EMPTY_EMAIL_SETTINGS now lives in lib/payment-reminders/constants (imported at top).

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState({ properties: [], tenants: [], contracts: [], payments: [], maintenance: [], emailSettings: EMPTY_EMAIL_SETTINGS, units: [], documents: [], maintenanceTypes: [], maintenanceAttachments: [], maintenanceComments: [], emailTemplates: [], emailAutomations: [], emailMessages: [], leaseRenewals: [], contractTenants: [], parkingSpots: [], parkingRenters: [], parkingLeases: [] });
  const [loadingData, setLoadingData] = useState(false);
  const [lang, setLang] = useState("zh");
  const [langReady, setLangReady] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("propmanager_lang");
    if (stored) setLang(stored);
    setLangReady(true);
  }, []);
  useEffect(() => { if (langReady) localStorage.setItem("propmanager_lang", lang); }, [lang, langReady]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const t = T[lang];
  const prevPageRef = useRef(null);

  useEffect(() => { document.body.style.margin = "0"; document.body.style.background = "#fafafa"; }, []);
  useEffect(() => { if (user) fetchAllData(); }, [user]);

  // Sync browser history with internal page state
  useEffect(() => {
    const state = { page, propertyId: selectedPropertyId, tenantId: selectedTenantId };
    if (prevPageRef.current === null) {
      window.history.replaceState(state, "");
    } else if (prevPageRef.current !== page) {
      window.history.pushState(state, "");
    }
    prevPageRef.current = page;
  }, [page, selectedPropertyId, selectedTenantId]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = (e) => {
      if (e.state?.page) {
        setPage(e.state.page);
        setSelectedPropertyId(e.state.propertyId ?? null);
        setSelectedTenantId(e.state.tenantId ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Restore session on page load and react to auth state changes
  useEffect(() => {
    const resolveUser = async (authUser) => {
      if (!authUser) { setUser(null); setAuthLoading(false); return; }
      const { data: membership } = await supabase.from("landlord_members").select("landlord_id").eq("auth_user_id", authUser.id).maybeSingle();
      if (membership) {
        const { data: landlord } = await supabase.from("landlord_profiles").select("*").eq("id", membership.landlord_id).single();
        if (landlord) { setUser({ id: landlord.id, authId: authUser.id, role: "landlord", email: authUser.email, name: landlord.name || authUser.email?.split("@")[0] }); setAuthLoading(false); return; }
      }
      const { data: tenant } = await supabase.from("tenant_profiles").select("*").eq("id", authUser.id).single();
      if (tenant) { setUser({ id: tenant.id, authId: authUser.id, role: "tenant", email: authUser.email, name: tenant.name || authUser.email?.split("@")[0] }); }
      setAuthLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── MAPPERS (snake_case Supabase → camelCase UI) ──────────────────────────
  // mapProperty now lives in lib/property/mappers (imported at top).
  // mapTenant now lives in lib/tenant/mappers (imported at top) — the one home for the tenant read-shape.
  const mapContract  = (c) => ({ id: c.id, tenantIds: (c.contract_tenants || []).map(ct => ct.tenant_id), propertyId: c.property_id, unit: c.unit, startDate: c.start_date, endDate: c.end_date, rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status || "active" });
  const mapPayment   = (p) => ({ id: p.id, tenantId: p.tenant_id, contractId: p.contract_id, amount: p.amount, dueDate: p.due_date, paidDate: p.paid_date, status: p.status, type: p.type, achStatus: p.ach_status });
  // mapMaintenance / -Type / -Attachment / -Comment now live in lib/maintenance/mappers (imported at top) — one home for the aggregate's shape.
  // mapUnit now lives in lib/units/mappers (imported at top). The `status` it
  // returns is overwritten below with occupancy derived from the unit's tenants.
  const mapDocument = (d) => ({ id: d.id, landlordId: d.landlord_id, tenantId: d.tenant_id, propertyId: d.property_id, unitId: d.unit_id, contractId: d.contract_id || null, fileName: d.file_name, filePath: d.file_path, fileType: d.file_type, documentType: d.document_type, aiExtracted: d.ai_extracted, uploadedAt: d.uploaded_at, driveLink: d.drive_link || null })
  // mapEmailSettings now lives in lib/payment-reminders/mappers (imported at top).
  const mapEmailTemplate = (e) => ({ id: e.id, name: e.name, subject: e.subject || "", bodyHtml: e.body_html || "", bodyText: e.body_text || "", updatedAt: e.updated_at, createdAt: e.created_at });
  const mapEmailAutomation = (a) => ({ id: a.id, name: a.name, eventType: a.event_type, offsetDays: a.offset_days || [], templateId: a.template_id || null, scope: a.scope || null, enabled: a.enabled || false });
  const mapEmailMessage = (m) => ({ id: m.id, direction: m.direction, automationId: m.automation_id || null, templateId: m.template_id || null, tenantId: m.tenant_id || null, eventType: m.event_type || null, eventDate: m.event_date || null, toEmail: m.to_email || "", subject: m.subject || "", bodyHtml: m.body_html || "", bodyText: m.body_text || "", status: m.status, deliveredAt: m.delivered_at || null, openedAt: m.opened_at || null, repliedAt: m.replied_at || null, replyToMessageId: m.reply_to_message_id || null, isTest: m.is_test || false, createdAt: m.created_at });
  const mapLeaseRenewal = (r) => ({ id: r.id, landlordId: r.landlord_id || null, contractId: r.contract_id, propertyId: r.property_id || null, originalLeaseDate: r.original_lease_date || null, newTermStart: r.new_term_start || null, newTermEnd: r.new_term_end || null, rentAmount: r.rent_amount, status: r.status || "draft", docusealSubmissionId: r.docuseal_submission_id || null, signers: r.signers || [], appliedToContract: r.applied_to_contract || false, createdAt: r.created_at || null, updatedAt: r.updated_at || null });
  const mapContractTenant = (ct) => ({ contractId: ct.contract_id, tenantId: ct.tenant_id });

  // ─── DATA FETCHING ─────────────────────────────────────────────────────────
  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      if (user.role === "landlord") {
        const [propRes, tenRes, conRes, payRes, maintRes, emailRes, unitRes, docRes, llRes, maintTypesRes, maintAttRes, maintCommRes, emailTplRes, emailAutoRes, emailMsgRes, renewalRes, parkSpotRes, parkRenterRes, parkLeaseRes] = await Promise.all([
          supabase.from("properties").select("*").order("created_at", { ascending: true }),
          supabase.from("tenant_profiles").select("*"),
          supabase.from("contracts").select("*, contract_tenants(tenant_id)"),
          supabase.from("payments").select("*").order("due_date", { ascending: false }),
          supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("email_settings").select("*").single(),
          supabase.from("units").select("*").order("unit_number", { ascending: true }),
          supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
          supabase.from("landlord_profiles").select("*"),
          supabase.from("maintenance_types").select("*").order("name", { ascending: true }),
          supabase.from("maintenance_attachments").select("*").order("created_at", { ascending: true }),
          supabase.from("maintenance_comments").select("*").order("created_at", { ascending: true }),
          supabase.from("email_templates").select("*").order("updated_at", { ascending: false }),
          supabase.from("email_automations").select("*").order("created_at", { ascending: true }),
          supabase.from("email_messages").select("*").neq("status", "draft").order("created_at", { ascending: false }).limit(300),
          supabase.from("lease_renewals").select("*").order("created_at", { ascending: false }),
          supabase.from("parking_spots").select("*").order("label", { ascending: true }),
          supabase.from("parking_renters").select("*"),
          supabase.from("parking_leases").select("*").order("start_date", { ascending: false }),
        ]);
        const today = new Date().toISOString().split("T")[0];
        const units = (unitRes.data || []).map(mapUnit).map(unit => {
          const tenantsInUnit = (tenRes.data || []).filter(t => t.unit_id === unit.id);
          // Occupancy follows the DERIVED status, same rule the server routes apply.
          const isOccupied = tenantsInUnit.some(t => isCurrentRow(t));
          return { ...unit, status: isOccupied ? "occupied" : "vacant" };
        });

        // Fetch contract_tenants via service-role route — RLS blocks the
        // client-side join so contract_tenants(tenant_id) comes back empty.
        let linkMap = new Map();
        const contractIds = (conRes.data || []).map(c => c.id);
        if (contractIds.length > 0) {
          try {
            const linkRes = await fetch(`/api/contracts/tenant-links`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contractIds }),
            });
            if (linkRes.ok) {
              const { links } = await linkRes.json();
              for (const l of links || []) {
                if (!linkMap.has(l.contract_id)) linkMap.set(l.contract_id, []);
                linkMap.get(l.contract_id).push(l.tenant_id);
              }
            }
          } catch (_) { /* fall back to client-side join */ }
        }

        const mappedContracts = (conRes.data || []).map(mapContract).map(c => {
          const fromApi = linkMap.get(c.id);
          return fromApi && fromApi.length > 0 ? { ...c, tenantIds: fromApi } : c;
        });

        // Flatten the contract→tenant junction into a list the Renewals page
        // consumes. Prefer the service-role linkMap (RLS-safe); fall back to
        // the embedded client-side join when the API route is unavailable.
        const contractTenants = [];
        for (const c of (conRes.data || [])) {
          const fromApi = linkMap.get(c.id);
          const tenantIds = (fromApi && fromApi.length > 0)
            ? fromApi
            : (c.contract_tenants || []).map(ct => ct.tenant_id);
          for (const tenantId of tenantIds) {
            contractTenants.push(mapContractTenant({ contract_id: c.id, tenant_id: tenantId }));
          }
        }

        setData({
          properties:    (propRes.data  || []).map(mapProperty),
          tenants:       (tenRes.data   || []).map(mapTenant),
          contracts:     mappedContracts,
          payments:      (payRes.data   || []).map(mapPayment),
          maintenance:            (maintRes.data     || []).map(mapMaintenance),
          emailSettings:          mapEmailSettings(emailRes.data),
          units,
          documents:              (docRes.data       || []).map(mapDocument),
          landlords:              (llRes.data        || []),
          maintenanceTypes:       (maintTypesRes.data || []).map(mapMaintenanceType),
          maintenanceAttachments: (maintAttRes.data  || []).map(mapMaintenanceAttachment),
          maintenanceComments:    (maintCommRes.data || []).map(mapMaintenanceComment),
          emailTemplates:         (emailTplRes.data  || []).map(mapEmailTemplate),
          emailAutomations:       (emailAutoRes.data || []).map(mapEmailAutomation),
          emailMessages:          (emailMsgRes.data  || []).map(mapEmailMessage),
          leaseRenewals:          (renewalRes.data   || []).map(mapLeaseRenewal),
          contractTenants,
          parkingSpots:           (parkSpotRes.data   || []).map(mapParkingSpot),
          parkingRenters:         (parkRenterRes.data || []).map(mapParkingRenter),
          parkingLeases:          (parkLeaseRes.data  || []).map(mapParkingLease),
        });
      } else {
        // Tenant: fetch own profile + related data
        const { data: tenRow } = await supabase.from("tenant_profiles").select("*").eq("id", user.id).single();
        const tenant = tenRow ? mapTenant(tenRow) : null;
        const { data: ctRows } = await supabase
          .from("contract_tenants")
          .select("contract_id")
          .eq("tenant_id", user.id)
          .order("created_at", { ascending: false });
        const contractId = ctRows?.[0]?.contract_id;
        const [propRes, conRes, payRes, maintRes, maintCommRes] = await Promise.all([
          tenant?.propertyId ? supabase.from("properties").select("*").eq("id", tenant.propertyId) : Promise.resolve({ data: [] }),
          contractId ? supabase.from("contracts").select("*, contract_tenants(tenant_id)").eq("id", contractId) : Promise.resolve({ data: [] }),
          supabase.from("payments").select("*").eq("tenant_id", user.id).order("due_date", { ascending: false }),
          supabase.from("maintenance_requests").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }),
          supabase.from("maintenance_comments").select("*").order("created_at", { ascending: true }),
        ]);
        setData({
          properties:    (propRes.data  || []).map(mapProperty),
          tenants:       tenant ? [tenant] : [],
          contracts:     (conRes.data   || []).map(mapContract),
          payments:      (payRes.data   || []).map(mapPayment),
          maintenance:   (maintRes.data || []).map(mapMaintenance),
          emailSettings: EMPTY_EMAIL_SETTINGS,
          units:         [],
          documents:     [],
          maintenanceComments: (maintCommRes.data || []).map(mapMaintenanceComment),
          parkingSpots:   [],
          parkingRenters: [],
          parkingLeases:  [],
        });
      }
    } catch (err) {
      console.error("fetchAllData error:", err);
    }
    setLoadingData(false);
  };

  if (authLoading) return null;
  // The dashboard lives behind a server-side auth guard (app/(app)/dashboard/layout.js).
  // This is a client-side fallback for the rare case the guard's session check and the
  // client profile resolution disagree (e.g. valid cookie but missing profile row).
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login?next=/dashboard";
    return null;
  }

  if (loadingData && !data.properties.length && !data.tenants.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", color: "#6b7280", fontSize: 16 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); -webkit-font-smoothing: antialiased;`}</style>
        Loading your portfolio…
      </div>
    );
  }

  const refresh = fetchAllData;

  const renderPage = () => {
    if (user.role === "landlord") {
      const props = { data, setData, t, lang, langReady, refresh, user };
      switch (page) {
        case "dashboard":        return <LandlordDashboard {...props} setPage={setPage} setSelectedPropertyId={setSelectedPropertyId} setSelectedTenantId={setSelectedTenantId} />;
        case "properties":       return <PropertiesPage {...props} setPage={setPage} setSelectedPropertyId={setSelectedPropertyId} />;
        case "tenants":          return <TenantsPage {...props} setPage={setPage} setSelectedTenantId={setSelectedTenantId} />;
        case "tenant-detail":    return <TenantContactPage data={data} setData={setData} refresh={fetchAllData} user={user} t={t} tenantId={selectedTenantId} onBack={() => setPage('tenants')} onNavigateToProperty={(id) => { setSelectedPropertyId(id); setPage('property-detail'); }} />;
        case "parking":          return <ParkingPage {...props} />;
        case "contracts":        return <ContractsPage {...props} />;
        case "payments":         return <PaymentsPage data={data} t={t} setPage={setPage} setSelectedTenantId={setSelectedTenantId} />;
        case "maintenance":      return <MaintenancePage {...props} />;
        case "email":            return <EmailPage {...props} />;
        case "email-automation": return <EmailAutomationPage {...props} />;
        case "renewals":         return <RenewalsPage {...props} />;
        case "documents":        return <DocumentsPageV2 data={data} setData={setData} refresh={fetchAllData} user={user} />;
        case "property-detail":  return <PropertyDetailPage data={data} setData={setData} refresh={fetchAllData} user={user} t={t} propertyId={selectedPropertyId} onBack={() => setPage('properties')} onNavigateToTenant={(id) => { setSelectedTenantId(id); setPage('tenant-detail'); }} />;
        case "admin-users":      return <AdminUsersPage t={t} data={data} user={user} refresh={fetchAllData} />;
        default:                 return <LandlordDashboard {...props} />;
      }
    } else {
      const props = { data, setData, user, refresh };
      switch (page) {
        case "dashboard":       return <TenantDashboard data={data} user={user} />;
        case "payment-portal":  return <PaymentPortal {...props} />;
        case "maintenance-new": return <TenantMaintenancePage {...props} />;
        case "lease":           return <TenantLeasePage data={data} user={user} />;
        case "payment-history": return <PaymentHistoryPage data={data} user={user} />;
        case "profile":         return <TenantProfilePage user={user} setUser={setUser} />;
        default:                return <TenantDashboard data={data} user={user} />;
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Leave the dashboard surface entirely and land on the public marketing home.
    window.location.href = "/";
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; -webkit-font-smoothing: antialiased; }`}</style>
      <Sidebar user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout} lang={lang} setLang={setLang} t={t} />
      <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", minHeight: "100vh" }}>
        {renderPage()}
      </main>
    </div>
  );
}
