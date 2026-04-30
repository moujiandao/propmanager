'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { createClient } from '@/lib/supabase/client';
import { PropertyDetailPage, DocumentsPageV2, TenantContactPage } from './phase2-components';

const supabase = createClient();

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const T = {
  en: {
    appName: "PropManager", landlord: "Landlord", tenant: "Tenant", signIn: "Sign In",
    email: "Email", password: "Password", logout: "Logout", cancel: "Cancel", note: "Note",
    navDashboard: "Dashboard", navProperties: "Properties", navTenants: "Tenants",
    navLeases: "Leases", navPayments: "Payments", navMaintenance: "Maintenance", navEmail: "Email Automation",
    dashTitle: "Dashboard", dashSubtitle: "Good morning! Here's your portfolio overview.",
    statProperties: "Properties", statOccupied: "occupied", statRevenue: "Monthly Revenue",
    statActiveLeases: "active leases", statPending: "Pending Payments", statRequireAttention: "require attention",
    statOpenMaint: "Open Maintenance", statRequests: "requests",
    tenantPaymentStatus: "Tenant Payment Status", recentMaintenance: "Recent Maintenance", recentPayments: "Recent Payments",
    colTenant: "Tenant", colAmount: "Amount", colDueDate: "Due Date", colPaidDate: "Paid Date",
    colType: "Type", colAchStatus: "ACH Status", colStatus: "Status", colContact: "Contact",
    colProperty: "Property / Unit", colBank: "Bank", colRecurring: "Recurring",
    colTerm: "Term", colDaysRemaining: "Days Remaining",
    propTitle: "Properties", propSubtitle: (n) => `${n} properties in portfolio`,
    addProperty: "Add Property", addPropertyTitle: "Add New Property",
    streetAddress: "Street Address", city: "City", zip: "ZIP", type: "Type", units: "Units", status: "Status",
    tenants: "Tenants", revenue: "Revenue",
    uploadPhoto: "Upload Photo", uploadingPhoto: "Uploading…", changePhoto: "Change Photo",
    tenTitle: "Tenants", tenSubtitle: (n) => `${n} active tenants`,
    addTenant: "Add Tenant", addTenantTitle: "Add New Tenant",
    fullName: "Full Name", phone: "Phone", loginPassword: "Login Password", tempPassword: "Temporary password",
    selectProperty: "Select property", unit: "Unit",
    bankConnected: "Connected", bankNotConnected: "Not connected",
    recurringEnabled: "Enabled", recurringOff: "Off",
    tenantNote: "The tenant will log in with their email address and the password you set above.",
    createTenantAccount: "Create Tenant Account",
    conTitle: "Leases & Contracts", conSubtitle: (n) => `${n} contracts`,
    addLease: "Add Lease", addLeaseTitle: "Add New Lease",
    selectTenant: "Select tenant", monthlyRent: "Monthly Rent ($)",
    startDate: "Start Date", endDate: "End Date", dueDayLabel: "Due Day (1-28)",
    dueOf: "Due:", ofMonth: "of month", expired: "Expired", daysRemaining: "days", rent: "Rent", term: "Term",
    createLease: "Create Lease",
    payTitle: "Payments", paySubtitle: "ACH payment tracking across all tenants",
    filterAll: "All", typeRecurring: "Recurring", typeOneTime: "One-time", naLabel: "N/A",
    maintTitle: "Maintenance Requests", maintSubtitle: (n) => `${n} open requests`,
    priorityHigh: "high priority", priorityMedium: "medium priority", priorityLow: "low priority",
    statusOpen: "Open", statusInProgress: "In Progress", statusResolved: "Resolved",
    noMaintenance: "No maintenance requests",
    emailTitle: "Email Automation", emailSubtitle: "Configure automated payment reminder emails",
    editTemplate: "Edit Template", editTemplateLabel: "Edit Template:",
    variablesNote: "Variables: {tenant_name}, {amount}, {due_date}, {landlord_name}",
    saveTemplate: "Save Template",
    reminder5Day: "5 Days Before Due Date", reminder5DayDesc: "Friendly advance reminder",
    reminderDayOf: "Day-of Reminder", reminderDayOfDesc: "Reminder on the due date",
    reminder1Day: "1 Day Overdue", reminder1DayDesc: "Urgent follow-up",
    reminder3Day: "3 Days Overdue", reminder3DayDesc: "Escalated reminder",
    reminder7Day: "7 Days Overdue", reminder7DayDesc: "Final notice before action",
    st_completed: "Completed", st_pending: "Pending", st_overdue: "Overdue", st_failed: "Failed",
    st_active: "Active", st_open: "Open", "st_in-progress": "In Progress", st_resolved: "Resolved",
    "st_current tenant": "Current Tenant", "st_future tenant": "Future Tenant", "st_previous tenant": "Previous Tenant",
    st_occupied: "Occupied", st_vacant: "Vacant",
    dashUnpaidRent: "Unpaid Rent", dashVacancies: "Vacancies — Now & Next 6 Months", dashNewTenants: "New Tenants",
    dashUnpaidEmpty: "All active tenants have paid this month.",
    dashVacanciesEmpty: "No vacant units, and no tenants scheduled to move out in the next 6 months.",
    dashNewTenantsEmpty: "No upcoming tenants scheduled.", dashVacating: "Vacating", dashMoveIn: "Move-in",
    dashTenantCount: (n) => `${n} tenant${n === 1 ? "" : "s"}`, dashUnitCount: (n) => `${n} unit${n === 1 ? "" : "s"}`, dashUpcomingCount: (n) => `${n} upcoming`,
    paySubtitleTracker: "Monthly rent tracker by unit", payZelleName: "Zelle Name", payMoveOutDate: "Move-out Date",
    payUnitLabel: (n) => `Unit ${n}`, payUnassigned: "Unassigned",
    saveChanges: "Save Changes", saving: "Saving...", discard: "Discard",
    displayBy: "Display by", displayAll: "All", displayByUnit: "Property + Unit",
    colMonthlyRent: "Monthly Rent", editBtn: "Edit",
    firstName: "First Name", lastName: "Last Name",
    zelleNameLabel: "Zelle Name", zelleNamePlaceholder: "Name or phone on Zelle",
    moveInDateReq: "Move-in Date *", moveInDate: "Move-in Date", moveOutDate: "Move-out Date",
    createLoginLabel: "Create tenant portal login",
    createLoginDesc: "Optional — only needed if the tenant will log in to pay rent or submit maintenance requests",
    creating: "Creating…", noPropOption: "— No property —", selectPropFirst: "— Select a property first —",
    noUnitAssigned: "— No unit assigned —", noUnitsYet: "No units — add units first from the property page",
    monthlyPaymentLabel: "Monthly Payment ($)", passwordReset: "Password Reset",
    newPasswordLabel: "New Password (leave blank to keep current)", minCharsPlaceholder: "Min. 8 characters",
    emailReadOnly: "Email address cannot be changed here. To update a tenant's email, do so from Supabase Auth.",
    deleteTenant: "Delete Tenant", deleteWarning: "This will permanently remove their account and all associated data. This cannot be undone.",
    deleting: "Deleting…", langLabel: "Language", navDocuments: "Documents", navAdminUsers: "Admin Users",
    adminUsersTitle: "Admin Users", adminUsersSubtitle: "Create additional landlord accounts",
    adminName: "Name", adminEmail: "Email", adminPassword: "Password",
    adminCreateBtn: "Create Admin Account", adminCreating: "Creating…",
    adminSuccess: "Admin account created successfully.",
    adminErrFields: "All fields are required.", adminErrPassword: "Password must be at least 8 characters.",
    navPaymentPortal: "Payment Portal", navPaymentHistory: "Payment History", navMyProfile: "My Profile",
    statusCurrentTenant: "Current Tenant", statusFutureTenant: "Future Tenant", statusPreviousTenant: "Previous Tenant",
  },
  zh: {
    appName: "房产管理", landlord: "房东", tenant: "租客", signIn: "登录",
    email: "电子邮件", password: "密码", logout: "退出登录", cancel: "取消", note: "备注",
    navDashboard: "控制台", navProperties: "房产", navTenants: "租客",
    navLeases: "合同", navPayments: "付款", navMaintenance: "维修", navEmail: "邮件自动化",
    dashTitle: "控制台", dashSubtitle: "早上好！以下是您的房产组合概览。",
    statProperties: "房产数量", statOccupied: "已出租", statRevenue: "月收入",
    statActiveLeases: "有效合同", statPending: "待处理付款", statRequireAttention: "需要关注",
    statOpenMaint: "待处理维修", statRequests: "个请求",
    tenantPaymentStatus: "租客付款状态", recentMaintenance: "最近维修请求", recentPayments: "最近付款记录",
    colTenant: "租客", colAmount: "金额", colDueDate: "到期日", colPaidDate: "付款日",
    colType: "类型", colAchStatus: "ACH状态", colStatus: "状态", colContact: "联系方式",
    colProperty: "房产 / 单元", colBank: "银行账户", colRecurring: "自动续费",
    colTerm: "合同期限", colDaysRemaining: "剩余天数",
    propTitle: "房产管理", propSubtitle: (n) => `共 ${n} 处房产`,
    addProperty: "添加房产", addPropertyTitle: "添加新房产",
    streetAddress: "街道地址", city: "城市", zip: "邮编", type: "类型", units: "单元数", status: "状态",
    tenants: "租客", revenue: "收入",
    uploadPhoto: "上传照片", uploadingPhoto: "上传中…", changePhoto: "更换照片",
    tenTitle: "租客管理", tenSubtitle: (n) => `共 ${n} 名活跃租客`,
    addTenant: "添加租客", addTenantTitle: "添加新租客",
    fullName: "姓名", phone: "电话", loginPassword: "登录密码", tempPassword: "临时密码",
    selectProperty: "选择房产", unit: "单元",
    bankConnected: "已连接", bankNotConnected: "未连接",
    recurringEnabled: "已开启", recurringOff: "未开启",
    tenantNote: "租客将使用其电子邮件地址和您设置的密码登录系统。",
    createTenantAccount: "创建租客账号",
    conTitle: "租约与合同", conSubtitle: (n) => `共 ${n} 份合同`,
    addLease: "添加租约", addLeaseTitle: "添加新租约",
    selectTenant: "选择租客", monthlyRent: "月租金（$）",
    startDate: "开始日期", endDate: "结束日期", dueDayLabel: "到期日（1-28日）",
    dueOf: "到期日：每月", ofMonth: "日", expired: "已到期", daysRemaining: "天", rent: "租金", term: "期限",
    createLease: "创建租约",
    payTitle: "付款管理", paySubtitle: "所有租客的ACH付款追踪",
    filterAll: "全部", typeRecurring: "自动续费", typeOneTime: "单次付款", naLabel: "不适用",
    maintTitle: "维修请求", maintSubtitle: (n) => `${n} 个待处理请求`,
    priorityHigh: "高优先级", priorityMedium: "中优先级", priorityLow: "低优先级",
    statusOpen: "待处理", statusInProgress: "处理中", statusResolved: "已解决",
    noMaintenance: "暂无维修请求",
    emailTitle: "邮件自动化", emailSubtitle: "配置自动付款提醒邮件",
    editTemplate: "编辑模板", editTemplateLabel: "编辑模板：",
    variablesNote: "变量：{tenant_name}，{amount}，{due_date}，{landlord_name}",
    saveTemplate: "保存模板",
    reminder5Day: "到期前5天提醒", reminder5DayDesc: "友好的提前提醒",
    reminderDayOf: "当天提醒", reminderDayOfDesc: "到期当天发送提醒",
    reminder1Day: "逾期1天", reminder1DayDesc: "紧急跟进",
    reminder3Day: "逾期3天", reminder3DayDesc: "升级提醒",
    reminder7Day: "逾期7天", reminder7DayDesc: "最终警告",
    st_completed: "已完成", st_pending: "待处理", st_overdue: "已逾期", st_failed: "失败",
    st_active: "有效", st_open: "待处理", "st_in-progress": "处理中", st_resolved: "已解决",
    "st_current tenant": "现租客", "st_future tenant": "待入住租客", "st_previous tenant": "前租客",
    st_occupied: "已出租", st_vacant: "空置",
    dashUnpaidRent: "未付租金", dashVacancies: "空置情况 — 当前及未来6个月", dashNewTenants: "新租客",
    dashUnpaidEmpty: "所有现租客本月已付款。",
    dashVacanciesEmpty: "暂无空置单元，且未来6个月内无租客计划退租。",
    dashNewTenantsEmpty: "暂无待入住租客。", dashVacating: "退租日期", dashMoveIn: "入住日",
    dashTenantCount: (n) => `${n} 位租客`, dashUnitCount: (n) => `${n} 套单元`, dashUpcomingCount: (n) => `${n} 位待入住`,
    paySubtitleTracker: "按单元的月租追踪", payZelleName: "Zelle姓名", payMoveOutDate: "退租日期",
    payUnitLabel: (n) => `单元 ${n}`, payUnassigned: "未分配单元",
    saveChanges: "保存更改", saving: "保存中…", discard: "撤销更改",
    displayBy: "分组方式", displayAll: "全部", displayByUnit: "房产 + 单元",
    colMonthlyRent: "月租金", editBtn: "编辑",
    firstName: "名", lastName: "姓",
    zelleNameLabel: "Zelle姓名", zelleNamePlaceholder: "Zelle上的姓名或电话",
    moveInDateReq: "入住日期 *", moveInDate: "入住日期", moveOutDate: "退租日期",
    createLoginLabel: "创建租客门户账号",
    createLoginDesc: "可选 — 仅在租客需要登录付款或提交维修请求时使用",
    creating: "创建中…", noPropOption: "— 无房产 —", selectPropFirst: "— 请先选择房产 —",
    noUnitAssigned: "— 未分配单元 —", noUnitsYet: "暂无单元 — 请先在房产页面添加单元",
    monthlyPaymentLabel: "月租金（$）", passwordReset: "密码重置",
    newPasswordLabel: "新密码（留空则保持原密码）", minCharsPlaceholder: "至少8位字符",
    emailReadOnly: "此处无法修改电子邮件。如需更新租客邮箱，请在Supabase Auth中操作。",
    deleteTenant: "删除租客", deleteWarning: "这将永久删除其账号及所有相关数据，此操作无法撤销。",
    deleting: "删除中…", langLabel: "语言", navDocuments: "文件", navAdminUsers: "管理员用户",
    adminUsersTitle: "管理员用户", adminUsersSubtitle: "创建额外的房东账号",
    adminName: "姓名", adminEmail: "电子邮件", adminPassword: "密码",
    adminCreateBtn: "创建管理员账号", adminCreating: "创建中…",
    adminSuccess: "管理员账号创建成功。",
    adminErrFields: "所有字段均为必填项。", adminErrPassword: "密码至少需要8位字符。",
    navPaymentPortal: "付款门户", navPaymentHistory: "付款记录", navMyProfile: "我的资料",
    statusCurrentTenant: "现租客", statusFutureTenant: "待入住租客", statusPreviousTenant: "前租客",
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
  };
  return icons[name] || null;
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const tenantFullName = (ten) => [ten.name, ten.lastName].filter(Boolean).join(" ");

const statusColors = {
  completed: { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  pending:   { bg: "#e0e7ff", text: "#312e81", dot: "#6366f1" },
  overdue:   { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  failed:    { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  active:    { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "current tenant":  { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  "future tenant":   { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "previous tenant": { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  open:      { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "in-progress": { bg: "#e0e7ff", text: "#312e81", dot: "#6366f1" },
  resolved:  { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  occupied:  { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  vacant:    { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
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
  <button onClick={() => onChange(!value)} style={{ width: 48, height: 26, borderRadius: 13, background: value ? "#4f46e5" : "#d1d5db", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", padding: 0, flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 3, left: value ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
  </button>
);

export const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.15)" }}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "#f8fafc", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: 28 }}>{children}</div>
    </div>
  </div>
);

export const Inp = ({ label, value, onChange, type = "text", placeholder, readOnly }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", background: readOnly ? "#f8fafc" : "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
  </div>
);

export const Sel = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

export const Btn = ({ children, onClick, variant = "primary", size = "md", icon }) => {
  const s = { primary: { background: "linear-gradient(135deg,#4f46e5,#4338ca)", color: "#fff", border: "none" }, secondary: { background: "#f8fafc", color: "#374151", border: "1.5px solid #e2e8f0" }, ghost: { background: "transparent", color: "#64748b", border: "none" } };
  const sz = { sm: { padding: "6px 14px", fontSize: 13 }, md: { padding: "10px 20px", fontSize: 14 } };
  return (
    <button onClick={onClick} style={{ ...s[variant], ...sz[size], borderRadius: 9, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", transition: "opacity .15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = ".85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {icon && <Icon name={icon} size={15} />}{children}
    </button>
  );
};

// ─── LANGUAGE TOGGLE (landlord sidebar) ──────────────────────────────────────
const LangToggle = ({ lang, setLang }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 10 }}>
    <span style={{ color: "#64748b" }}><Icon name="globe" size={14} /></span>
    <span style={{ fontSize: 11, color: "#64748b", flex: 1, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 600 }}>{lang === "zh" ? "语言" : "Language"}</span>
    <div style={{ display: "flex", background: "rgba(0,0,0,.3)", borderRadius: 6, padding: 3, gap: 2 }}>
      {[["en", "EN"], ["zh", "中文"]].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)}
          style={{ padding: "3px 9px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", transition: "all .15s",
            background: lang === l ? "rgba(79,70,229,.9)" : "transparent",
            color: lang === l ? "#fff" : "#64748b" }}>
          {label}
        </button>
      ))}
    </div>
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [tab, setTab] = useState("landlord");
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setEmail(""); setPassword(""); setName(""); setConfirmPassword(""); setError(""); setSuccess(""); };
  useEffect(() => { reset(); setMode("login"); }, [tab]);

  const handleLogin = async () => {
    setLoading(true); setError("");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Invalid email or password."); setLoading(false); return; }

    const { data: landlord } = await supabase.from("landlord_profiles").select("*").eq("id", authData.user.id).single();
    if (landlord) { onLogin({ id: landlord.id, authId: authData.user.id, role: "landlord", email, name: landlord.name || email.split("@")[0] }); return; }

    const { data: tenant } = await supabase.from("tenant_profiles").select("*").eq("id", authData.user.id).single();
    if (tenant) { onLogin({ id: tenant.id, authId: authData.user.id, role: "tenant", email, name: tenant.name || email.split("@")[0] }); return; }

    setError("No profile found for this account.");
    setLoading(false);
  };

  const handleSignup = async () => {
    setError(""); setSuccess("");
    if (!name.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Email is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    const res = await fetch("/api/auth/register-landlord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error || "Something went wrong. Please try again."); return; }
    setSuccess("Account created! You can now sign in.");
    setMode("login");
    setPassword(""); setName(""); setConfirmPassword("");
  };

  const inputStyle = { width: "100%", padding: "11px 14px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, color: "#f1f5f9", fontSize: 14, boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: ".5px", textTransform: "uppercase" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; -webkit-font-smoothing: antialiased; }`}</style>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => <div key={i} style={{ position: "absolute", width: 2, height: 2, background: `rgba(79,70,229,${0.15+i*0.05})`, borderRadius: "50%", top: `${10+i*12}%`, left: `${5+i*13}%`, boxShadow: `0 0 ${20+i*10}px ${8+i*4}px rgba(79,70,229,${0.05+i*0.02})` }} />)}
      </div>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#4f46e5,#3730a3)", borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="home" size={28} /></div>
          <h1 style={{ color: "#f8fafc", fontSize: 22, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>2703 Ridge Rd Berkeley CA</h1>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 15, fontWeight: 300 }}>Property management, simplified.</p>
        </div>
        <div style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 32 }}>
          {/* Role tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "rgba(0,0,0,.2)", borderRadius: 10, padding: 4 }}>
            {["landlord", "tenant"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: "8px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .2s", background: tab === t ? "rgba(79,70,229,.9)" : "transparent", color: tab === t ? "#fff" : "#94a3b8" }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <>
              {success && <p style={{ color: "#4ade80", fontSize: 13, margin: "0 0 16px", background: "rgba(74,222,128,.1)", padding: "10px 14px", borderRadius: 8 }}>{success}</p>}
              {[["Email", email, setEmail, "email"], ["Password", password, setPassword, "password"]].map(([lbl, val, setter, type]) => (
                <div key={lbl} style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{lbl}</label>
                  <input value={val} onChange={e => setter(e.target.value)} type={type}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    style={inputStyle} />
                </div>
              ))}
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
              <button onClick={handleLogin} disabled={loading}
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#4f46e5,#4338ca)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
              {tab === "landlord" && (
                <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 13, color: "#64748b" }}>
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { reset(); setMode("signup"); }} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Create one</button>
                </p>
              )}
              {tab === "tenant" && (
                <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 12, color: "#475569" }}>
                  Tenant accounts are created by your landlord.
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 20px", textAlign: "center" }}>Create your landlord account</p>
              {[["Full Name", name, setName, "text"], ["Email", email, setEmail, "email"], ["Password", password, setPassword, "password"], ["Confirm Password", confirmPassword, setConfirmPassword, "password"]].map(([lbl, val, setter, type]) => (
                <div key={lbl} style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{lbl}</label>
                  <input value={val} onChange={e => setter(e.target.value)} type={type}
                    onKeyDown={e => e.key === "Enter" && handleSignup()}
                    style={inputStyle} />
                </div>
              ))}
              {error && <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 16px" }}>{error}</p>}
              <button onClick={handleSignup} disabled={loading}
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#4f46e5,#4338ca)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
                {loading ? "Creating account…" : "Create Account"}
              </button>
              <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 13, color: "#64748b" }}>
                Already have an account?{" "}
                <button onClick={() => { reset(); setMode("login"); }} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Sign in</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const Sidebar = ({ user, currentPage, onNavigate, onLogout, lang, setLang, t }) => {
  const landlordNav = [
    { id: "dashboard", label: t.navDashboard, icon: "home" },
    { id: "properties", label: t.navProperties, icon: "building" },
    { id: "tenants", label: t.navTenants, icon: "users" },
    { id: "payments", label: t.navPayments, icon: "dollar" },
    { id: "maintenance", label: t.navMaintenance, icon: "wrench" },
  ];
  const landlordBottomNav = [
    { id: "contracts", label: t.navLeases, icon: "file" },
    { id: "email", label: t.navEmail, icon: "mail" },
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
          background: active ? "rgba(79,70,229,.15)" : "transparent", color: active ? "#a5b4fc" : "#94a3b8", fontWeight: active ? 600 : 400, fontSize: 14 }}>
        <Icon name={item.icon} size={17} />{item.label}
        {active && <span style={{ marginLeft: "auto", width: 4, height: 4, background: "#4f46e5", borderRadius: "50%" }} />}
      </button>
    );
  };

  return (
    <div style={{ width: 240, background: "#0f172a", minHeight: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#4f46e5,#3730a3)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}><Icon name="building" size={20} /></div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.appName}</div>
            <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: ".7px" }}>{user.role === "landlord" ? t.landlord : t.tenant}</div>
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
          <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>{user.name}</div>
          <div style={{ color: "#475569", fontSize: 12 }}>{user.email}</div>
        </div>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: "#64748b", fontFamily: "inherit", fontSize: 14 }}>
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
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", letterSpacing: "-0.5px" }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const StatCard = ({ label, value, sub, icon, color = "#4f46e5" }) => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <p style={{ margin: "0 0 6px", color: "#64748b", fontSize: 13, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{value}</p>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>{sub}</p>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon name={icon} size={20} /></div>
    </div>
  </div>
);

// ─── LANDLORD DASHBOARD ───────────────────────────────────────────────────────
const LandlordDashboard = ({ data, t, setPage, setSelectedPropertyId, setSelectedTenantId }) => {
  const { properties, tenants, payments, maintenance, contracts, units = [] } = data;
  const occupied = properties.filter(p => p.status === "occupied").length;
  const futureTenants = tenants.filter(t => t.status === "future tenant");
  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "overdue");
  const openMaint = maintenance.filter(m => m.status !== "resolved");

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const paidTenantIds = new Set(
    payments
      .filter(p => p.status === "completed" && p.dueDate && p.dueDate.startsWith(currentMonthKey))
      .map(p => p.tenantId)
  );
  const unpaidTenants = tenants.filter(ten => ten.status === "current tenant" && !paidTenantIds.has(ten.id));

  const todayStr = now.toISOString().split("T")[0];
  const activeContracts = contracts.filter(c =>
    c.status === "active" &&
    (!c.startDate || c.startDate <= todayStr) &&
    (!c.endDate || c.endDate >= todayStr)
  );
  const sixMo = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const sixMoStr = sixMo.toISOString().split("T")[0];
  const currentVacancies = units.filter(u => u.status === "vacant").map(u => {
    const prop = properties.find(p => p.id === u.propertyId);
    return { key: `v-${u.id}`, unitLabel: u.unitNumber || "—", propertyAddress: prop?.address || "", propertyId: u.propertyId, tenantId: null, status: "vacant", dateLabel: "Vacant now", tenantName: null };
  });
  const upcomingVacancies = tenants
    .filter(ten => ten.moveOutDate && ten.moveOutDate >= todayStr && ten.moveOutDate <= sixMoStr)
    .map(ten => {
      const unit = units.find(u => u.id === ten.unitId);
      const prop = properties.find(p => p.id === ten.propertyId);
      return { key: `m-${ten.id}`, unitLabel: unit?.unitNumber || ten.unit || "—", propertyAddress: prop?.address || "", propertyId: ten.propertyId, tenantId: ten.id, status: "pending", dateLabel: `${t.dashVacating} ${fmtDate(ten.moveOutDate)}`, tenantName: tenantFullName(ten) };
    });
  const vacancies = [...currentVacancies, ...upcomingVacancies];

  return (
    <div>
      <PageHeader title={t.dashTitle} subtitle={t.dashSubtitle} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label={t.statProperties} value={properties.length} sub={`${occupied} ${t.statOccupied}`} icon="building" />
        <StatCard label={t.statRevenue} value={fmt(activeContracts.reduce((s,c) => s+c.rentAmount, 0))} sub={t.statActiveLeases} icon="trending" color="#22c55e" />
        <StatCard label={t.statPending} value={pendingPayments.length} sub={t.statRequireAttention} icon="clock" color="#ef4444" />
        <StatCard label={t.statOpenMaint} value={openMaint.length} sub={t.statRequests} icon="wrench" color="#818cf8" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashVacancies}</h3>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.dashUnitCount(vacancies.length)}</span>
          </div>
          {vacancies.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: 13, color: "#64748b" }}>{t.dashVacanciesEmpty}</div>
          ) : vacancies.map(v => (
            <div key={v.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
              <div>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: v.propertyId && setPage ? "#4f46e5" : "#0f172a", cursor: v.propertyId && setPage ? "pointer" : "default" }}
                  onClick={() => { if (v.propertyId && setPage && setSelectedPropertyId) { setSelectedPropertyId(v.propertyId); setPage("property-detail"); } }}
                  onMouseEnter={e => { if (v.propertyId && setPage) e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                >
                  Unit {v.unitLabel} · {v.propertyAddress}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {v.tenantName ? (
                    <>
                      <span
                        style={{ cursor: v.tenantId && setPage ? "pointer" : "default", color: v.tenantId && setPage ? "#4f46e5" : "#94a3b8" }}
                        onClick={() => { if (v.tenantId && setPage && setSelectedTenantId) { setSelectedTenantId(v.tenantId); setPage("tenant-detail"); } }}
                        onMouseEnter={e => { if (v.tenantId && setPage) e.currentTarget.style.textDecoration = "underline"; }}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                      >{v.tenantName}</span>
                      {` · ${v.dateLabel}`}
                    </>
                  ) : v.dateLabel}
                </div>
              </div>
              <Badge status={v.status} t={t} />
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashNewTenants}</h3>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.dashUpcomingCount(futureTenants.length)}</span>
          </div>
          {futureTenants.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: 13, color: "#64748b" }}>{t.dashNewTenantsEmpty}</div>
          ) : futureTenants.map(ten => {
            const prop = properties.find(p => p.id === ten.propertyId);
            return (
              <div key={ten.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{(ten.name || "?").charAt(0)}</div>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 600, color: setPage ? "#4f46e5" : "#0f172a", cursor: setPage ? "pointer" : "default" }}
                      onClick={() => { if (setPage && setSelectedTenantId) { setSelectedTenantId(ten.id); setPage("tenant-detail"); } }}
                      onMouseEnter={e => { if (setPage) e.currentTarget.style.textDecoration = "underline"; }}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                    >{tenantFullName(ten)}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.unit || data.units?.find(u => u.id === ten.unitId)?.unitNumber || "—"} · {prop?.address || "—"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>{ten.moveInDate ? fmtDate(ten.moveInDate) : "—"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.dashMoveIn}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.dashUnpaidRent} — {currentMonthLabel}</h3>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.dashTenantCount(unpaidTenants.length)}</span>
          </div>
          {unpaidTenants.length === 0 ? (
            <div style={{ padding: "14px 0", fontSize: 13, color: "#64748b" }}>{t.dashUnpaidEmpty}</div>
          ) : unpaidTenants.map(ten => {
            const prop = properties.find(p => p.id === ten.propertyId);
            return (
              <div key={ten.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#3730a3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{(ten.name || "?").charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{tenantFullName(ten)}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.unit} · {prop?.address}</div>
                  </div>
                </div>
                <Badge status="overdue" t={t} />
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.recentPayments}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
                {[t.colTenant, t.colAmount, t.colDueDate].map(h => <th key={h} style={{ padding: "0 12px 10px 0", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payments.slice(0,5).map(p => {
                const ten = tenants.find(ten => ten.id === p.tenantId);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #f8fafc" }}>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14, fontWeight: 500 }}>{ten ? tenantFullName(ten) : "—"}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14 }}>{fmt(p.amount || ten?.monthlyRent || 0)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "#64748b" }}>{p.dueDate ? fmtDate(p.dueDate.slice(0,7) + "-05T12:00:00") : "—"}</td>
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
const PropertiesPage = ({ data, setData, t, refresh, user, setPage, setSelectedPropertyId }) => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ address: "", city: "", state: "CA", zip: "", units: "1", type: "Single Family", status: "vacant" });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const setEF = (k,v) => setEditForm(f => ({...f,[k]:v}));
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
    const { error } = await supabase.from("properties").insert({
      landlord_id: user.id, address: form.address, city: form.city, state: form.state, zip: form.zip,
      units: +form.units, type: form.type, status: form.status,
    });
    if (!error) { await refresh(); setShow(false); }
  };
  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditing(p);
    setEditForm({ address: p.address, city: p.city, state: p.state, zip: p.zip, units: String(p.units || ""), type: p.type || "Single Family", status: p.status || "vacant" });
  };
  const saveEdit = async () => {
    const { error } = await supabase.from("properties").update({
      address: editForm.address, city: editForm.city, state: editForm.state, zip: editForm.zip,
      units: +editForm.units, type: editForm.type, status: editForm.status,
    }).eq("id", editing.id);
    if (!error) { await refresh(); setEditing(null); }
  };
  const deleteProperty = async () => {
    const { error } = await supabase.from("properties").delete().eq("id", confirmDelete.id);
    if (!error) { await refresh(); setConfirmDelete(null); }
  };

  const propTodayStr = new Date().toISOString().split("T")[0];

  return (
    <div>
      <PageHeader title={t.propTitle} subtitle={t.propSubtitle(data.properties.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addProperty}</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18 }}>
        {data.properties.map(p => {
          const rev = data.contracts
            .filter(c => c.propertyId === p.id && c.status === "active" && (!c.startDate || c.startDate <= propTodayStr) && (!c.endDate || c.endDate >= propTodayStr))
            .reduce((s,c) => s+c.rentAmount, 0);
          const propertyUnits = (data.units || []).filter(u => u.propertyId === p.id);
          const occupiedUnits = propertyUnits.filter(u => u.status === 'occupied').length;
          const totalUnits = propertyUnits.length;
          return (
            <div key={p.id} onClick={() => { if (setSelectedPropertyId && setPage) { setSelectedPropertyId(p.id); setPage('property-detail'); } }} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,.04)", cursor: setSelectedPropertyId ? "pointer" : "default", transition: "box-shadow .15s" }}
              onMouseEnter={e => { if (setSelectedPropertyId) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.10)"; }}
              onMouseLeave={e => { if (setSelectedPropertyId) e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.04)"; }}>
              <div style={{ position: "relative", height: 160, background: "#f1f5f9", overflow: "hidden", cursor: setSelectedPropertyId ? "pointer" : "default" }}
                onClick={() => { if (setSelectedPropertyId && setPage) { setSelectedPropertyId(p.id); setPage('property-detail'); } }}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="home" size={40} color="#cbd5e1" /></div>
                }
                <input
                  ref={el => { fileInputRefs.current[p.id] = el; }}
                  type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => handleImageUpload(p.id, e.target.files[0])}
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
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{p.address}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={e => openEdit(p, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#94a3b8", borderRadius: 6, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#4f46e5"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                      <Icon name="edit" size={15} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(p); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#94a3b8", borderRadius: 6, display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
                      <Icon name="trash" size={15} />
                    </button>
                    <Badge status={p.status} t={t} />
                  </div>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>{p.city}, {p.state} {p.zip} · {p.type}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>Occupied Units</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{occupiedUnits}<span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 400 }}>/{totalUnits}</span></div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.revenue}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{fmt(rev)}</div>
                  </div>
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
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShow(false)}>{t.cancel}</Btn>
            <Btn onClick={add}>{t.addProperty}</Btn>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit Property" onClose={() => setEditing(null)}>
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
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setEditing(null)}>{t.cancel}</Btn>
            <Btn onClick={saveEdit}>Save Changes</Btn>
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

// ─── TENANTS PAGE ─────────────────────────────────────────────────────────────
const TenantsPage = ({ data, setData, t, refresh, user, setPage, setSelectedTenantId }) => {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", password: "", zelleName: "", status: "current tenant", moveInDate: "", createLogin: false });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));

  const [editTenant, setEditTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const setEF = (k,v) => setEditForm(f => ({...f,[k]:v}));

  const [editError, setEditError] = useState("");

  const [groupBy, setGroupBy] = useState("unit");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = async () => {
    setDeleting(true);
    await fetch("/api/auth/delete-tenant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: deleteTarget.id }) });
    await refresh();
    setDeleteTarget(null);
    setDeleting(false);
  };

  const openEdit = (ten) => {
    setEditTenant(ten);
    setEditError("");
    setEditForm({ name: ten.name, lastName: ten.lastName || "", phone: ten.phone, propertyId: ten.propertyId || "", unit: ten.unit || "", unitId: ten.unitId || "", status: ten.status || "current tenant", monthlyRent: ten.monthlyRent || "", password: "", zelleName: ten.zelleName || "", moveInDate: ten.moveInDate || "", moveOutDate: ten.moveOutDate || "" });
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
        phone: editForm.phone,
        propertyId: editForm.propertyId || null,
        unit: editForm.unit,
        unitId: editForm.unitId || null,
        status: editForm.status,
        monthlyRent: editForm.monthlyRent || null,
        password: editForm.password || null,
        zelleName: editForm.zelleName || null,
        moveInDate: editForm.moveInDate || null,
        moveOutDate: editForm.moveOutDate || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setEditError(json.error || "Something went wrong."); setEditSaving(false); return; }
    await refresh();
    setEditTenant(null);
    setEditSaving(false);
  };

  const add = async () => {
    if (!form.name || !form.moveInDate) return;
    setSaving(true);
    const res = await fetch("/api/auth/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, lastName: form.lastName || null, phone: form.phone,
        email: form.createLogin ? form.email : null,
        password: form.createLogin ? form.password : null,
        propertyId: form.propertyId, unit: form.unit,
        zelleName: form.zelleName, status: form.status, landlordId: user.id,
        moveInDate: form.moveInDate, moveOutDate: form.moveOutDate || null,
      }),
    });
    if (res.ok) { await refresh(); setShow(false); setForm({ name: "", lastName: "", email: "", phone: "", propertyId: "", unit: "", password: "", zelleName: "", status: "current tenant", moveInDate: "", createLogin: false }); }
    setSaving(false);
  };

  const currentTenants = data.tenants.filter(t => t.status?.toLowerCase() === "current tenant");

  // Build grouped structure when groupBy === "unit"
  const tenantGroups = (() => {
    if (groupBy === "none") return null;
    const map = {};
    currentTenants.forEach(ten => {
      const prop = data.properties.find(p => p.id === ten.propertyId);
      const key = `${ten.propertyId}::${ten.unit || "—"}`;
      if (!map[key]) map[key] = { prop, unit: ten.unit || "—", tenants: [] };
      map[key].tenants.push(ten);
    });
    return Object.values(map).sort((a, b) => {
      const pa = a.prop?.address || ""; const pb = b.prop?.address || "";
      if (pa !== pb) return pa.localeCompare(pb);
      return String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true });
    });
  })();

  const renderTenantRow = (ten) => {
    const prop = data.properties.find(p => p.id === ten.propertyId);
    return (
      <tr key={ten.id} style={{ borderTop: "1px solid #f8fafc" }}>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#3730a3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{(ten.name || "?").charAt(0)}</div>
            <button onClick={() => { if (setSelectedTenantId && setPage) { setSelectedTenantId(ten.id); setPage('tenant-detail'); } }} style={{ background: "none", border: "none", padding: 0, cursor: setPage ? "pointer" : "default", fontSize: 14, fontWeight: 600, color: setPage ? "#4f46e5" : "#0f172a", fontFamily: "inherit", textAlign: "left" }} onMouseEnter={e => { if (setPage) e.currentTarget.style.textDecoration = "underline"; }} onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{tenantFullName(ten)}</button>
          </div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>{ten.email}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.phone}</div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>{prop?.address || "—"}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.unit || data.units.find(u => u.id === ten.unitId)?.unitNumber || "—"}</div>
        </td>
        <td style={{ padding: "14px 20px" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: ten.monthlyRent ? "#0f172a" : "#94a3b8" }}>
            {ten.monthlyRent ? fmt(ten.monthlyRent) : "—"}
          </span>
        </td>
        <td style={{ padding: "14px 20px" }}><Badge status={ten.status} t={t} /></td>
        <td style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => openEdit(ten)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
              <Icon name="edit" size={13} /> {t.editBtn}
            </button>
            <button onClick={() => setDeleteTarget(ten)} style={{ background: "#fff", border: "1px solid #fca5a5", borderRadius: 7, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", fontFamily: "inherit" }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <PageHeader title={t.tenTitle} subtitle={t.tenSubtitle(currentTenants.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addTenant}</Btn>} />

      {/* Display by toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px" }}>{t.displayBy}</span>
        {[["none", t.displayAll], ["unit", t.displayByUnit]].map(([val, label]) => (
          <button key={val} onClick={() => setGroupBy(val)}
            style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
              borderColor: groupBy === val ? "#4f46e5" : "#e2e8f0",
              background: groupBy === val ? "#eef2ff" : "#fff",
              color: groupBy === val ? "#4f46e5" : "#64748b" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {[t.colTenant, t.colContact, t.colProperty, t.colMonthlyRent, t.colStatus, ""].map((h,i) => <th key={i} style={{ padding: "14px 20px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {groupBy === "none" ? (
              <>
                {currentTenants.map(ten => renderTenantRow(ten))}
                {futureTenants.length > 0 && <>
                  <tr><td colSpan={6} style={{ padding: "8px 20px", background: "#f8fafc", borderTop: "2px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px" }}>{t.statusFutureTenant}</td></tr>
                  {futureTenants.map(ten => renderTenantRow(ten))}
                </>}
              </>
            ) : (
              <>
                {tenantGroups.map(({ prop, unit, tenants }) => {
                  const totalRent = tenants.reduce((s, t) => s + (t.monthlyRent || 0), 0);
                  return (
                    <Fragment key={`${prop?.id}::${unit}`}>
                      <tr>
                        <td colSpan={6} style={{ padding: "12px 20px", background: "#1e293b", borderTop: "2px solid #334155" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.2px" }}>{prop?.address || "No property"}</span>
                            <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>·</span>
                            <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Unit {unit}</span>
                            <span style={{ marginLeft: "auto", fontSize: 12, color: "#475569" }}>{tenants.length} tenant{tenants.length !== 1 ? "s" : ""}</span>
                            {totalRent > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>{fmt(totalRent)}/mo</span>}
                          </div>
                        </td>
                      </tr>
                      {tenants.map(ten => renderTenantRow(ten))}
                    </Fragment>
                  );
                })}
                {futureGroups.length > 0 && futureGroups.map(({ prop, unit, tenants }) => (
                  <Fragment key={`future-${prop?.id}::${unit}`}>
                    <tr>
                      <td colSpan={6} style={{ padding: "12px 20px", background: "#334155", borderTop: "2px solid #475569" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#cbd5e1", letterSpacing: "-0.2px" }}>{prop?.address || "No property"}</span>
                          <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>·</span>
                          <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Unit {unit}</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>{t.statusFutureTenant}</span>
                        </div>
                      </td>
                    </tr>
                    {tenants.map(ten => renderTenantRow(ten))}
                  </Fragment>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Tenant Modal */}
      {show && (
        <Modal title={t.addTenantTitle} onClose={() => setShow(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.firstName} value={form.name} onChange={v => setF("name",v)} placeholder="Jane" />
            <Inp label={t.lastName} value={form.lastName||""} onChange={v => setF("lastName",v)} placeholder="Smith" />
            <Inp label={t.phone} value={form.phone} onChange={v => setF("phone",v)} />
            <Sel label={t.navProperties} value={form.propertyId} onChange={v => setF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={form.unit} onChange={v => setF("unit",v)} placeholder="Unit A" />
            <Inp label={t.zelleNameLabel} value={form.zelleName} onChange={v => setF("zelleName",v)} placeholder={t.zelleNamePlaceholder} />
            <Sel label={t.colStatus} value={form.status} onChange={v => setF("status",v)} options={[{value:"current tenant",label:t.statusCurrentTenant},{value:"future tenant",label:t.statusFutureTenant},{value:"previous tenant",label:t.statusPreviousTenant}]} />
            <Inp label={t.moveInDateReq} value={form.moveInDate} onChange={v => setF("moveInDate",v)} type="date" />
            <Inp label={t.moveOutDate} value={form.moveOutDate||""} onChange={v => setF("moveOutDate",v)} type="date" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", background: "#f8fafc", borderRadius: 9, border: "1px solid #e2e8f0" }}>
            <Toggle value={form.createLogin} onChange={v => setF("createLogin", v)} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{t.createLoginLabel}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{t.createLoginDesc}</div>
            </div>
          </div>
          {form.createLogin && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Inp label={t.email} value={form.email} onChange={v => setF("email",v)} type="email" placeholder="tenant@email.com" />
              <Inp label={t.loginPassword} value={form.password} onChange={v => setF("password",v)} type="text" placeholder={t.tempPassword} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setShow(false)}>{t.cancel}</Btn>
            <Btn onClick={add}>{saving ? t.creating : t.addTenant}</Btn>
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
                    style={{ width: "100%", background: "#0f172a", color: "#f1f5f9", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit" }}
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
            <Sel label={t.colStatus} value={editForm.status} onChange={v => setEF("status",v)} options={[{value:"current tenant",label:t.statusCurrentTenant},{value:"future tenant",label:t.statusFutureTenant},{value:"previous tenant",label:t.statusPreviousTenant}]} />
            <Inp label={t.zelleNameLabel} value={editForm.zelleName} onChange={v => setEF("zelleName",v)} placeholder={t.zelleNamePlaceholder} />
            <Inp label={t.moveInDate} value={editForm.moveInDate} onChange={v => setEF("moveInDate",v)} type="date" />
            <Inp label={t.moveOutDate} value={editForm.moveOutDate} onChange={v => setEF("moveOutDate",v)} type="date" />
          </div>
          <div style={{ marginTop: 4, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{t.passwordReset}</div>
            <Inp label={t.newPasswordLabel} value={editForm.password} onChange={v => setEF("password",v)} type="password" placeholder={t.minCharsPlaceholder} />
          </div>
          {editError && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px" }}>{editError}</p>}
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 9, padding: 12, marginBottom: 16, fontSize: 13, color: "#0369a1" }}>
            {t.emailReadOnly}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setEditTenant(null)}>{t.cancel}</Btn>
            <Btn onClick={saveEdit}>{editSaving ? t.saving : t.saveChanges}</Btn>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal title={t.deleteTenant} onClose={() => setDeleteTarget(null)}>
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>
            Are you sure you want to delete <strong>{tenantFullName(deleteTarget)}</strong>?
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>
            {t.deleteWarning}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setDeleteTarget(null)}>{t.cancel}</Btn>
            <button onClick={confirmDelete} disabled={deleting} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1, fontFamily: "inherit" }}>
              {deleting ? t.deleting : t.deleteTenant}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── CONTRACTS PAGE ───────────────────────────────────────────────────────────
const ContractsPage = ({ data, setData, t, refresh, user }) => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ tenantId: "", propertyId: "", unit: "", startDate: "", endDate: "", rentAmount: "", dueDay: "1" });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const add = async () => {
    if (!form.tenantId || !form.rentAmount) return;
    const { error } = await supabase.from("contracts").insert({
      landlord_id: user.id, tenant_id: form.tenantId, property_id: form.propertyId, unit: form.unit,
      start_date: form.startDate, end_date: form.endDate,
      rent_amount: +form.rentAmount, due_day: +form.dueDay, status: "active",
    });
    if (!error) { await refresh(); setShow(false); }
  };

  return (
    <div>
      <PageHeader title={t.conTitle} subtitle={t.conSubtitle(data.contracts.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addLease}</Btn>} />
      <div style={{ display: "grid", gap: 14 }}>
        {data.contracts.map(c => {
          const ten = data.tenants.find(ten => ten.id === c.tenantId);
          const prop = data.properties.find(p => p.id === c.propertyId);
          const daysLeft = Math.ceil((new Date(c.endDate)-new Date())/86400000);
          return (
            <div key={c.id} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.colTenant}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{ten ? tenantFullName(ten) : "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{prop?.address} · {c.unit}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.rent}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{fmt(c.rentAmount)}<span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>/mo</span></div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{t.dueOf} {c.dueDay}{t.ofMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{fmtDate(c.startDate)}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>→ {fmtDate(c.endDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.colDaysRemaining}</div>
                <div style={{ fontSize: daysLeft <= 0 ? 14 : 20, fontWeight: 700, color: daysLeft < 60 ? "#ef4444" : "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{daysLeft > 0 ? `${daysLeft} ${t.daysRemaining}` : "Month to Month"}</div>
              </div>
              <Badge status={c.status} t={t} />
            </div>
          );
        })}
      </div>
      {show && (
        <Modal title={t.addLeaseTitle} onClose={() => setShow(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Sel label={t.colTenant} value={form.tenantId} onChange={v => setF("tenantId",v)} options={[{value:"",label:t.selectTenant},...data.tenants.map(ten => ({value:ten.id,label:tenantFullName(ten)}))]} />
            <Sel label={t.navProperties} value={form.propertyId} onChange={v => setF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={form.unit} onChange={v => setF("unit",v)} placeholder="Unit A" />
            <Inp label={t.monthlyRent} value={form.rentAmount} onChange={v => setF("rentAmount",v)} type="number" />
            <Inp label={t.startDate} value={form.startDate} onChange={v => setF("startDate",v)} type="date" />
            <Inp label={t.endDate} value={form.endDate} onChange={v => setF("endDate",v)} type="date" />
            <Inp label={t.dueDayLabel} value={form.dueDay} onChange={v => setF("dueDay",v)} type="number" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShow(false)}>{t.cancel}</Btn>
            <Btn onClick={add}>{t.createLease}</Btn>
          </div>
        </Modal>
      )}
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

  // Group tenants by unit
  const grouped = useMemo(() => {
    const unitMap = {};
    const noUnit = [];
    for (const tenant of data.tenants.filter(t => t.status === "current tenant")) {
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
  }, [data.tenants, data.units]);

  const allTenants = useMemo(() => grouped.flatMap(g => g.tenants), [grouped]);

  const getContract = (tenant) => data.contracts.find(c => c.tenantId === tenant.id);

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
          amount: contract?.rentAmount || tenant?.monthlyRent || 0,
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

    // Batch delete
    if (toDelete.length > 0) {
      const ids = toDelete.map(d => d.id);
      const { error } = await supabase.from("payments").delete().in("id", ids);
      if (error) {
        setPayError(`Failed to delete: ${error.message}`);
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={saveChanges} disabled={saving || !hasChanges}
          style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: hasChanges ? "#4f46e5" : "#e2e8f0", color: hasChanges ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: 600, cursor: (saving || !hasChanges) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
          {saving ? t.saving : t.saveChanges}
        </button>
        {hasChanges && (
          <button onClick={() => setChecked({ ...saved })}
            style={{ padding: "9px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {t.discard}
          </button>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.colTenant}</th>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.payZelleName}</th>
              <th style={{ padding: "14px 18px", textAlign: "left", whiteSpace: "nowrap" }}>{t.rent}</th>
              {months.map(m => (
                <th key={m.key} style={{ padding: "14px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{m.label}</th>
              ))}
            </tr>
            <tr style={{ borderTop: "1px solid #e2e8f0", background: "#f1f5f9" }}>
              <td colSpan={3} />
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
                      style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#4f46e5" }}
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
                  <td colSpan={colCount} style={{ padding: "8px 18px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".6px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
                    {unit ? t.payUnitLabel(unit.unitNumber) : t.payUnassigned}
                  </td>
                </tr>
                {tenants.map(tenant => {
                  const rentAmount = getContract(tenant)?.rentAmount || tenant.monthlyRent || null;
                  return (
                    <tr key={tenant.id} style={{ borderTop: "1px solid #f1f5f9", background: "transparent" }}>
                      <td style={{ padding: "13px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#3730a3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{(tenant.name || "?").charAt(0)}</div>
                          {setPage && setSelectedTenantId ? (
                            <span onClick={() => { setSelectedTenantId(tenant.id); setPage("tenant-detail"); }}
                              style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>
                              {tenantFullName(tenant)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{tenantFullName(tenant)}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 13, color: "#64748b" }}>
                        {tenant.zelleName || <span style={{ color: "#d1d5db" }}>-</span>}
                      </td>
                      <td style={{ padding: "13px 18px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                        {rentAmount ? fmt(rentAmount) : <span style={{ color: "#d1d5db" }}>-</span>}
                      </td>
                      {months.map(month => {
                        const mapKey = `${tenant.id}-${month.key}`;
                        const isChecked = !!checked[mapKey];
                        const isDirty = !!checked[mapKey] !== !!saved[mapKey];
                        return (
                          <td key={month.key} style={{ padding: "13px 10px", textAlign: "center", background: isDirty ? "#eef2ff" : "transparent" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggle(tenant.id, month.key)}
                              style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#4f46e5" }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(() => {
                  const unitTotal = tenants.reduce((s, t) => s + (getContract(t)?.rentAmount || 0), 0);
                  return unitTotal > 0 ? (
                    <tr style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <td colSpan={3} style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#64748b" }}>Total</td>
                      <td style={{ padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(unitTotal)}</td>
                      <td colSpan={months.length} />
                    </tr>
                  ) : null;
                })()}
              </Fragment>
            ))}
            {data.tenants.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 15 }}>No tenants found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── MAINTENANCE PAGE ─────────────────────────────────────────────────────────
const MaintenancePage = ({ data, setData, t, refresh }) => {
  const pColors = { high: "#ef4444", medium: "#818cf8", low: "#3b82f6" };
  const pLabels = { high: t.priorityHigh, medium: t.priorityMedium, low: t.priorityLow };
  const updateStatus = async (id, status) => {
    // Optimistic update for instant UI feedback
    setData(d => ({...d, maintenance: d.maintenance.map(m => m.id===id?{...m,status}:m)}));
    await supabase.from("maintenance_requests").update({ status }).eq("id", id);
  };

  return (
    <div>
      <PageHeader title={t.maintTitle} subtitle={t.maintSubtitle(data.maintenance.filter(m => m.status!=="resolved").length)} />
      <div style={{ display: "grid", gap: 14 }}>
        {data.maintenance.map(m => {
          const ten = data.tenants.find(ten => ten.id === m.tenantId);
          const prop = data.properties.find(p => p.id === m.propertyId);
          return (
            <div key={m.id} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9", display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{ width: 4, borderRadius: 4, alignSelf: "stretch", background: pColors[m.priority]||"#e2e8f0", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 15, color: "#0f172a", fontWeight: 500 }}>{m.description}</p>
                    <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#64748b" }}>
                      <span>{ten ? tenantFullName(ten) : "—"}</span><span>{prop?.address} · {m.unit}</span><span>{fmtDate(m.date)}</span>
                      <span style={{ color: pColors[m.priority], fontWeight: 600 }}>{pLabels[m.priority]}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Badge status={m.status} t={t} />
                    <select value={m.status} onChange={e => updateStatus(m.id, e.target.value)}
                      style={{ padding: "6px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#374151", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                      <option value="open">{t.statusOpen}</option>
                      <option value="in-progress">{t.statusInProgress}</option>
                      <option value="resolved">{t.statusResolved}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {data.maintenance.length === 0 && <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 15 }}>{t.noMaintenance}</div>}
      </div>
    </div>
  );
};

// ─── EMAIL PAGE ───────────────────────────────────────────────────────────────
const EmailPage = ({ data, setData, t, refresh }) => {
  const s = data.emailSettings;
  const KEY_MAP = { fiveDayReminder: "five_day_reminder", dayOfReminder: "day_of_reminder", oneDayOverdue: "one_day_overdue", threeDayOverdue: "three_day_overdue", sevenDayOverdue: "seven_day_overdue" };
  const updS = async (k, v) => {
    setData(d => ({...d, emailSettings:{...d.emailSettings,[k]:v}}));
    await supabase.from("email_settings").upsert({ [KEY_MAP[k]]: v }, { onConflict: "landlord_id" });
  };
  const updT = (k, v) => setData(d => ({...d, emailSettings:{...d.emailSettings,templates:{...d.emailSettings.templates,[k]:v}}}));
  const saveTemplate = async () => {
    await supabase.from("email_settings").upsert({ templates: s.templates }, { onConflict: "landlord_id" });
    setEditing(null);
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
          <div key={r.key} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: s[r.key]?"rgba(79,70,229,.1)":"#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: s[r.key]?"#4f46e5":"#94a3b8" }}><Icon name="mail" size={19} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{r.label}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={() => setEditing(editing===r.key?null:r.key)} style={{ padding: "7px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="edit" size={14} />{t.editTemplate}
              </button>
              <Toggle value={s[r.key]} onChange={v => updS(r.key, v)} />
            </div>
          </div>
        ))}
        {editing && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1.5px solid #4f46e5" }}>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{t.editTemplateLabel} {reminders.find(r => r.key===editing)?.label}</h4>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.variablesNote}</span>
            </div>
            <textarea value={s.templates[reminders.find(r => r.key===editing)?.tKey]} onChange={e => updT(reminders.find(r => r.key===editing)?.tKey, e.target.value)}
              style={{ width: "100%", minHeight: 160, padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, color: "#374151", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6 }} />
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
  const contract = data.contracts.find(c => c.tenantId === user.id);
  const property = data.properties.find(p => p.id === tenant?.propertyId);
  const payments = data.payments.filter(p => p.tenantId === user.id).sort((a,b) => new Date(b.dueDate)-new Date(a.dueDate));
  const openMaint = data.maintenance.filter(m => m.tenantId === user.id && m.status !== "resolved");

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}!`} subtitle="Your rental portal overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Monthly Rent" value={contract ? fmt(contract.rentAmount) : "—"} sub={contract ? `Due the ${contract.dueDay}${contract.dueDay===1?"st":"th"} of each month` : ""} icon="dollar" />
        <StatCard label="Next Payment" value={contract ? `Mar ${contract.dueDay}` : "—"} sub={payments[0] ? <Badge status={payments[0].status} t={T.en} /> : ""} icon="calendar" color="#3b82f6" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Your Unit</h3>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 50, height: 50, background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5", flexShrink: 0 }}><Icon name="home" size={24} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{property?.address}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{property?.city}, {property?.state} {property?.zip}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{tenant?.unit} · {property?.type}</div>
            </div>
          </div>
          {contract && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Lease Start", fmtDate(contract.startDate)],["Lease End", fmtDate(contract.endDate)]].map(([lbl,val]) => (
                <div key={lbl} style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Recent Payments</h3>
          {payments.slice(0,4).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmt(p.amount)}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Due {fmtDate(p.dueDate)}</div>
              </div>
              <Badge status={p.status} t={T.en} />
            </div>
          ))}
          {payments.length === 0 && <p style={{ color: "#94a3b8", fontSize: 14 }}>No payment history yet.</p>}
        </div>
      </div>
    </div>
  );
};

const PaymentPortal = ({ data, setData, user, refresh }) => {
  const [step, setStep] = useState("overview");
  const [bankForm, setBankForm] = useState({ routingNumber: "", accountNumber: "", accountName: "", accountType: "checking" });
  const [success, setSuccess] = useState(false);
  const tenant = data.tenants.find(t => t.id === user.id);
  const contract = data.contracts.find(c => c.tenantId === user.id);
  const toggleRecurring = async () => {
    await supabase.from("tenant_profiles").update({ recurring_payment: !tenant.recurringPayment }).eq("id", user.id);
    await refresh();
  };
  const connectBank = async () => {
    if(!bankForm.routingNumber||!bankForm.accountNumber) return;
    await supabase.from("tenant_profiles").update({ bank_connected: true }).eq("id", user.id);
    await refresh();
    setStep("overview");
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
  if (!tenant||!contract) return <div style={{ padding:32,color:"#64748b" }}>No lease found.</div>;

  return (
    <div>
      <PageHeader title="Payment Portal" subtitle="ACH payments & bank account management" />
      {success && <div style={{ background:"#dcfce7",border:"1px solid #86efac",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:10,color:"#166534",fontSize:14,fontWeight:600 }}><Icon name="check" size={18} />Payment initiated! ACH transfer processing (1-3 business days).</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: tenant.bankConnected?"rgba(34,197,94,.1)":"#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: tenant.bankConnected?"#22c55e":"#94a3b8" }}><Icon name="bank" size={21} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Bank Account</div>
              <div style={{ fontSize: 13, color: tenant.bankConnected?"#22c55e":"#94a3b8", fontWeight: 500 }}>{tenant.bankConnected?"✓ Connected & verified":"Not connected"}</div>
            </div>
          </div>
          {step !== "bank" ? (
            tenant.bankConnected ? (
              <div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Account ending in <strong>••••4521</strong></div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Chase Bank · Checking</div>
                </div>
                <Btn variant="secondary" size="sm" icon="edit" onClick={() => setStep("bank")}>Update Account</Btn>
              </div>
            ) : (
              <div>
                <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>Connect your bank account to enable ACH payments.</p>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: tenant.recurringPayment?"rgba(79,70,229,.1)":"#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: tenant.recurringPayment?"#4f46e5":"#94a3b8" }}><Icon name="refresh" size={19} /></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Auto-Pay</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Pay {fmt(contract.rentAmount)} on the {contract.dueDay}{contract.dueDay===1?"st":"th"}</div>
                  <div style={{ fontSize: 12, color: tenant.recurringPayment?"#4f46e5":"#94a3b8", marginTop: 3, fontWeight: 500 }}>{tenant.recurringPayment?"Enabled":"Disabled"}</div>
                </div>
              </div>
              <Toggle value={tenant.recurringPayment} onChange={toggleRecurring} />
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(59,130,246,.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}><Icon name="dollar" size={19} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Make a Payment</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>One-time ACH transfer</div>
              </div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Amount</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{fmt(contract.rentAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>To</span>
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
  const tenant = data.tenants.find(t => t.id === user.id);
  const myReqs = data.maintenance.filter(m => m.tenantId === user.id);
  const submit = async () => {
    if (!form.description) return;
    const { error } = await supabase.from("maintenance_requests").insert({
      tenant_id: user.id, property_id: tenant?.propertyId, unit: tenant?.unit,
      description: form.description, priority: form.priority, status: "open",
    });
    if (!error) {
      await refresh();
      setForm({description:"",priority:"medium"});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };
  return (
    <div>
      <PageHeader title="Maintenance Requests" subtitle="Submit and track repair requests" />
      {success && <div style={{ background:"#dcfce7",border:"1px solid #86efac",borderRadius:12,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:10,color:"#166534",fontSize:14,fontWeight:600 }}><Icon name="check" size={18} />Request submitted! Your landlord will be notified.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>New Request</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Describe the issue in detail..." rows={5}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>
          <Sel label="Priority" value={form.priority} onChange={v => setForm(f => ({...f,priority:v}))} options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} />
          <Btn icon="plus" onClick={submit}>Submit Request</Btn>
        </div>
        <div>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>My Requests</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {myReqs.map(m => {
              const pC = { high:"#ef4444",medium:"#818cf8",low:"#3b82f6" };
              return (
                <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid #f1f5f9", display: "flex", gap: 12 }}>
                  <div style={{ width: 3, borderRadius: 3, background: pC[m.priority], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#0f172a", marginBottom: 6 }}>{m.description}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{fmtDate(m.date)}</span>
                      <Badge status={m.status} t={T.en} />
                    </div>
                  </div>
                </div>
              );
            })}
            {myReqs.length === 0 && <p style={{ color: "#94a3b8", fontSize: 14 }}>No requests submitted yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const TenantLeasePage = ({ data, user }) => {
  const contract = data.contracts.find(c => c.tenantId === user.id);
  const tenant = data.tenants.find(t => t.id === user.id);
  const property = data.properties.find(p => p.id === tenant?.propertyId);
  if (!contract) return <div style={{ padding:32,color:"#64748b" }}>No active lease found.</div>;
  const daysLeft = Math.ceil((new Date(contract.endDate)-new Date())/86400000);
  return (
    <div>
      <PageHeader title="My Lease" subtitle="Current lease agreement details" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 22 }}>
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}><Icon name="file" size={24} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Lease Agreement</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{property?.address} · {tenant?.unit}</div>
            </div>
          </div>
          {[["Tenant", user.name],["Address",`${property?.address}, ${property?.city}`],["Unit",contract.unit],["Monthly Rent",fmt(contract.rentAmount)],["Due Day",`${contract.dueDay}${contract.dueDay===1?"st":"th"} of month`],["Start",fmtDate(contract.startDate)],["End",fmtDate(contract.endDate)],["Status",<Badge status={contract.status} t={T.en} />]].map(([lbl,val]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{lbl}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>{val}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ background: daysLeft<60?"#fef2f2":"#f0fdf4", borderRadius: 14, padding: 24, border: `1px solid ${daysLeft<60?"#fca5a5":"#86efac"}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: daysLeft<60?"#991b1b":"#166534", fontWeight: 600, marginBottom: 6 }}>LEASE EXPIRY</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: daysLeft<60?"#ef4444":"#22c55e", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{daysLeft} days</div>
            <div style={{ fontSize: 14, color: daysLeft<60?"#991b1b":"#166534" }}>Expires {fmtDate(contract.endDate)}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Landlord Contact</h4>
            <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>Brian Zhang</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>brian@property.com</p>
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
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {["Amount","Due Date","Paid Date","Type","ACH Status","Status"].map(h => <th key={h} style={{ padding: "14px 20px", textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} style={{ borderTop: "1px solid #f8fafc" }}>
                <td style={{ padding:"14px 20px",fontSize:16,fontWeight:700,color:"#0f172a",fontFamily:"'Inter',system-ui,-apple-system,sans-serif" }}>{fmt(p.amount)}</td>
                <td style={{ padding:"14px 20px",fontSize:13,color:"#64748b" }}>{fmtDate(p.dueDate)}</td>
                <td style={{ padding:"14px 20px",fontSize:13,color:"#64748b" }}>{fmtDate(p.paidDate)}</td>
                <td style={{ padding:"14px 20px",fontSize:12,color:"#64748b",textTransform:"capitalize" }}>{p.type}</td>
                <td style={{ padding:"14px 20px" }}>{p.achStatus?<Badge status={p.achStatus} t={T.en} />:<span style={{ color:"#d1d5db" }}>—</span>}</td>
                <td style={{ padding:"14px 20px" }}><Badge status={p.status} t={T.en} /></td>
              </tr>
            ))}
            {payments.length===0 && <tr><td colSpan={6} style={{ padding:40,textAlign:"center",color:"#94a3b8" }}>No payment history yet.</td></tr>}
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
    const { error } = await supabase.from("properties").update({ drive_link: link.trim() || null }).eq("id", selectedId);
    if (error) { setMsg("Failed to save."); }
    else { await refresh(); setMsg("Saved."); }
    setSaving(false);
  };

  const embedUrl = toEmbedUrl(link);

  if (!data.properties.length) return (
    <div>
      <PageHeader title="Documents" subtitle="Link Google Drive folders to your properties" />
      <div style={{ background: "#fff", borderRadius: 14, padding: 40, border: "1px solid #f1f5f9", textAlign: "center", color: "#94a3b8" }}>Add a property first to attach documents.</div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Documents" subtitle="Link Google Drive folders to your properties" />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
        {/* Property list */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          {data.properties.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              style={{ width: "100%", padding: "14px 16px", border: "none", borderBottom: "1px solid #f8fafc", background: p.id === selectedId ? "rgba(79,70,229,.08)" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: p.id === selectedId ? "#4f46e5" : "#0f172a" }}>{p.address}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{p.city} · {p.driveLink ? "✓ Linked" : "No folder"}</div>
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{selected?.address}</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>Paste a Google Drive folder or file share link below.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={link} onChange={e => { setLink(e.target.value); setMsg(""); }}
                placeholder="https://drive.google.com/drive/folders/..."
                style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 13, color: "#0f172a", fontFamily: "inherit", outline: "none" }} />
              <button onClick={save} disabled={saving}
                style={{ padding: "10px 20px", background: "linear-gradient(135deg,#4f46e5,#4338ca)", border: "none", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: msg === "Saved." ? "#22c55e" : "#ef4444" }}>{msg}</p>}
          </div>

          {embedUrl ? (
            <iframe src={embedUrl} title="Google Drive" style={{ width: "100%", height: 520, border: "1.5px solid #e2e8f0", borderRadius: 10 }} allow="autoplay" />
          ) : (
            <div style={{ height: 200, border: "1.5px dashed #e2e8f0", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>
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
      admin:      { bg: "rgba(79,70,229,.12)",  color: "#4f46e5", label: "Admin" },
      tenant:     { bg: "rgba(34,197,94,.12)",  color: "#16a34a", label: "Tenant" },
      unassigned: { bg: "rgba(148,163,184,.15)", color: "#64748b", label: "Unassigned" },
    };
    const s = styles[role] || styles.unassigned;
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".5px", background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      <PageHeader title={t.adminUsersTitle} subtitle={t.adminUsersSubtitle} />

      {/* User list */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name", "Email", "Role", ""].map(h => (
                <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id} style={{ borderTop: "1px solid #f8fafc" }}>
                <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{u.displayName}</td>
                <td style={{ padding: "14px 20px", fontSize: 13, color: "#64748b" }}>{u.email || "—"}</td>
                <td style={{ padding: "14px 20px" }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  {u.id !== currentUser?.id && (
                    <button onClick={() => { setDeleteError(null); setConfirmDelete(u); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, padding: "4px 8px", borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"} onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}>
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
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>Create Admin User</h3>
        <div style={{ background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f1f5f9" }}>
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
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8" }}>This will permanently remove their account and cannot be undone.</p>
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
  const cardStyle = { background: "#fff", borderRadius: 14, padding: 28, border: "1px solid #f1f5f9", marginBottom: 20 };
  const headStyle = { margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", paddingBottom: 14, borderBottom: "1px solid #f1f5f9" };
  const msgStyle = (err) => ({ fontSize: 13, marginTop: 8, color: err ? "#ef4444" : "#22c55e" });

  // ── Name ──
  const [name, setName] = useState(user.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState({ text: "", error: false });
  const saveName = async () => {
    if (!name.trim()) return;
    setNameSaving(true); setNameMsg({ text: "", error: false });
    const { error } = await supabase.from("tenant_profiles").update({ name: name.trim() }).eq("id", user.id);
    if (error) { setNameMsg({ text: error.message, error: true }); }
    else { setUser(u => ({ ...u, name: name.trim() })); setNameMsg({ text: "Name updated.", error: false }); }
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

  const inputStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" };
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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>Current email: <strong style={{ color: "#0f172a" }}>{user.email}</strong></p>
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
const EMPTY_EMAIL_SETTINGS = {
  fiveDayReminder: false, dayOfReminder: false, oneDayOverdue: false, threeDayOverdue: false, sevenDayOverdue: false,
  templates: {
    fiveDayReminder: "Dear {tenant_name},\n\nThis is a friendly reminder that your rent payment of ${amount} is due in 5 days on {due_date}.\n\nThank you,\n{landlord_name}",
    dayOfReminder: "Dear {tenant_name},\n\nYour rent payment of ${amount} is due today, {due_date}.\n\nThank you,\n{landlord_name}",
    oneDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} was due yesterday. Please make your payment as soon as possible.\n\nThank you,\n{landlord_name}",
    threeDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} is now 3 days overdue. Please contact us immediately.\n\nThank you,\n{landlord_name}",
    sevenDayOverdue: "Dear {tenant_name},\n\nYour rent payment of ${amount} is now 7 days overdue. This is your final reminder before additional action is taken.\n\n{landlord_name}",
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState({ properties: [], tenants: [], contracts: [], payments: [], maintenance: [], emailSettings: EMPTY_EMAIL_SETTINGS, units: [], documents: [] });
  const [loadingData, setLoadingData] = useState(false);
  const [lang, setLang] = useState("en");
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const t = T[lang];
  const prevPageRef = useRef(null);

  useEffect(() => { document.body.style.margin = "0"; document.body.style.background = "#f8fafc"; }, []);
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
      if (!authUser) { setUser(null); return; }
      const { data: landlord } = await supabase.from("landlord_profiles").select("*").eq("id", authUser.id).single();
      if (landlord) { setUser({ id: landlord.id, authId: authUser.id, role: "landlord", email: authUser.email, name: landlord.name || authUser.email?.split("@")[0] }); return; }
      const { data: tenant } = await supabase.from("tenant_profiles").select("*").eq("id", authUser.id).single();
      if (tenant) { setUser({ id: tenant.id, authId: authUser.id, role: "tenant", email: authUser.email, name: tenant.name || authUser.email?.split("@")[0] }); }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── MAPPERS (snake_case Supabase → camelCase UI) ──────────────────────────
  const mapProperty  = (p) => ({ id: p.id, address: p.address, city: p.city, state: p.state || "CA", zip: p.zip, units: p.units, type: p.type, status: p.status, driveLink: p.drive_link || "", imageUrl: p.image_url || null });
  const mapTenant    = (t) => ({ id: t.id, name: t.name, lastName: t.last_name || "", email: t.email, phone: t.phone || "", propertyId: t.property_id, unit: t.unit, status: t.status === "active" ? "current tenant" : t.status === "inactive" ? "previous tenant" : t.status || "current tenant", bankConnected: t.bank_connected || false, recurringPayment: t.recurring_payment || false, monthlyRent: t.monthly_rent || 0, moveInDate: t.move_in_date, moveOutDate: t.move_out_date, hasCosigner: t.has_cosigner || false, studentStatus: t.student_status, studentYear: t.student_year, zelleName: t.zelle_name, homeAddress: t.home_address, age: t.age, unitId: t.unit_id });
  const mapContract  = (c) => ({ id: c.id, tenantId: c.tenant_id, propertyId: c.property_id, unit: c.unit, startDate: c.start_date, endDate: c.end_date, rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status || "active" });
  const mapPayment   = (p) => ({ id: p.id, tenantId: p.tenant_id, contractId: p.contract_id, amount: p.amount, dueDate: p.due_date, paidDate: p.paid_date, status: p.status, type: p.type, achStatus: p.ach_status });
  const mapMaintenance = (m) => ({ id: m.id, tenantId: m.tenant_id, propertyId: m.property_id, unit: m.unit, description: m.description, priority: m.priority, status: m.status, date: (m.created_at || m.date || "").split("T")[0] });
  const mapUnit = (u) => ({ id: u.id, propertyId: u.property_id, unitNumber: u.unit_number, bedrooms: u.bedrooms, bathrooms: u.bathrooms, monthlyRent: u.monthly_rent, status: u.status });
  const mapDocument = (d) => ({ id: d.id, landlordId: d.landlord_id, tenantId: d.tenant_id, propertyId: d.property_id, unitId: d.unit_id, fileName: d.file_name, filePath: d.file_path, fileType: d.file_type, documentType: d.document_type, aiExtracted: d.ai_extracted, uploadedAt: d.uploaded_at })
  const mapEmailSettings = (e) => !e ? EMPTY_EMAIL_SETTINGS : ({
    fiveDayReminder: e.five_day_reminder || false, dayOfReminder: e.day_of_reminder || false,
    oneDayOverdue: e.one_day_overdue || false, threeDayOverdue: e.three_day_overdue || false,
    sevenDayOverdue: e.seven_day_overdue || false, templates: e.templates || EMPTY_EMAIL_SETTINGS.templates,
  });

  // ─── DATA FETCHING ─────────────────────────────────────────────────────────
  const fetchAllData = async () => {
    setLoadingData(true);
    try {
      if (user.role === "landlord") {
        const [propRes, tenRes, conRes, payRes, maintRes, emailRes, unitRes, docRes, llRes] = await Promise.all([
          supabase.from("properties").select("*").order("created_at", { ascending: true }),
          supabase.from("tenant_profiles").select("*"),
          supabase.from("contracts").select("*"),
          supabase.from("payments").select("*").order("due_date", { ascending: false }),
          supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("email_settings").select("*").single(),
          supabase.from("units").select("*").order("unit_number", { ascending: true }),
          supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
          supabase.from("landlord_profiles").select("*"),
        ]);
        const today = new Date().toISOString().split("T")[0];
        const units = (unitRes.data || []).map(mapUnit).map(unit => {
          const tenantsInUnit = (tenRes.data || []).filter(t => t.unit_id === unit.id);
          const isOccupied = tenantsInUnit.some(t => {
            const status = t.status === "active" ? "current tenant" : t.status;
            return status === "current tenant";
          });
          return { ...unit, status: isOccupied ? "occupied" : "vacant" };
        });
        setData({
          properties:    (propRes.data  || []).map(mapProperty),
          tenants:       (tenRes.data   || []).map(mapTenant),
          contracts:     (conRes.data   || []).map(mapContract),
          payments:      (payRes.data   || []).map(mapPayment),
          maintenance:   (maintRes.data || []).map(mapMaintenance),
          emailSettings: mapEmailSettings(emailRes.data),
          units,
          documents:     (docRes.data   || []).map(mapDocument),
          landlords:     (llRes.data    || []),
        });
      } else {
        // Tenant: fetch own profile + related data
        const { data: tenRow } = await supabase.from("tenant_profiles").select("*").eq("id", user.id).single();
        const tenant = tenRow ? mapTenant(tenRow) : null;
        const [propRes, conRes, payRes, maintRes] = await Promise.all([
          tenant?.propertyId ? supabase.from("properties").select("*").eq("id", tenant.propertyId) : Promise.resolve({ data: [] }),
          supabase.from("contracts").select("*").eq("tenant_id", user.id),
          supabase.from("payments").select("*").eq("tenant_id", user.id).order("due_date", { ascending: false }),
          supabase.from("maintenance_requests").select("*").eq("tenant_id", user.id).order("created_at", { ascending: false }),
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
        });
      }
    } catch (err) {
      console.error("fetchAllData error:", err);
    }
    setLoadingData(false);
  };

  if (!user) return <LoginPage onLogin={u => { setUser(u); setPage("dashboard"); }} />;

  if (loadingData && !data.properties.length && !data.tenants.length) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Inter',system-ui,-apple-system,sans-serif", color: "#64748b", fontSize: 16 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); -webkit-font-smoothing: antialiased;`}</style>
        Loading your portfolio…
      </div>
    );
  }

  const refresh = fetchAllData;

  const renderPage = () => {
    if (user.role === "landlord") {
      const props = { data, setData, t, refresh, user };
      switch (page) {
        case "dashboard":        return <LandlordDashboard {...props} setPage={setPage} setSelectedPropertyId={setSelectedPropertyId} setSelectedTenantId={setSelectedTenantId} />;
        case "properties":       return <PropertiesPage {...props} setPage={setPage} setSelectedPropertyId={setSelectedPropertyId} />;
        case "tenants":          return <TenantsPage {...props} setPage={setPage} setSelectedTenantId={setSelectedTenantId} />;
        case "tenant-detail":    return <TenantContactPage data={data} setData={setData} refresh={fetchAllData} user={user} tenantId={selectedTenantId} onBack={() => setPage('tenants')} onNavigateToProperty={(id) => { setSelectedPropertyId(id); setPage('property-detail'); }} />;
        case "contracts":        return <ContractsPage {...props} />;
        case "payments":         return <PaymentsPage data={data} t={t} setPage={setPage} setSelectedTenantId={setSelectedTenantId} />;
        case "maintenance":      return <MaintenancePage {...props} />;
        case "email":            return <EmailPage {...props} />;
        case "documents":        return <DocumentsPageV2 data={data} setData={setData} refresh={fetchAllData} user={user} />;
        case "property-detail":  return <PropertyDetailPage data={data} setData={setData} refresh={fetchAllData} user={user} propertyId={selectedPropertyId} onBack={() => setPage('properties')} onNavigateToTenant={(id) => { setSelectedTenantId(id); setPage('tenant-detail'); }} />;
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
    setUser(null);
    setData({ properties: [], tenants: [], contracts: [], payments: [], maintenance: [], emailSettings: EMPTY_EMAIL_SETTINGS, units: [], documents: [] });
    setPage("dashboard");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; -webkit-font-smoothing: antialiased; }`}</style>
      <Sidebar user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout} lang={lang} setLang={setLang} t={t} />
      <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", minHeight: "100vh" }}>
        {renderPage()}
      </main>
    </div>
  );
}
