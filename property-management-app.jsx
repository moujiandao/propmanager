'use client'

import { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client';

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
    st_occupied: "Occupied", st_vacant: "Vacant",
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
    st_occupied: "已出租", st_vacant: "空置",
  }
};



// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
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
  };
  return icons[name] || null;
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const statusColors = {
  completed: { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  pending:   { bg: "#fef9c3", text: "#854d0e", dot: "#eab308" },
  overdue:   { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  failed:    { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  active:    { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  open:      { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
  "in-progress": { bg: "#fef9c3", text: "#854d0e", dot: "#eab308" },
  resolved:  { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  occupied:  { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  vacant:    { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
};

const Badge = ({ status, t }) => {
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
  <button onClick={() => onChange(!value)} style={{ width: 48, height: 26, borderRadius: 13, background: value ? "#d97706" : "#d1d5db", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", padding: 0, flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 3, left: value ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
  </button>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.15)" }}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "#f8fafc", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}><Icon name="x" size={16} /></button>
      </div>
      <div style={{ padding: 28 }}>{children}</div>
    </div>
  </div>
);

const Inp = ({ label, value, onChange, type = "text", placeholder, readOnly }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", background: readOnly ? "#f8fafc" : "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
  </div>
);

const Sel = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", background: "#fff", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", size = "md", icon }) => {
  const s = { primary: { background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", border: "none" }, secondary: { background: "#f8fafc", color: "#374151", border: "1.5px solid #e2e8f0" }, ghost: { background: "transparent", color: "#64748b", border: "none" } };
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
    <span style={{ fontSize: 11, color: "#64748b", flex: 1, textTransform: "uppercase", letterSpacing: ".6px", fontWeight: 600 }}>Language</span>
    <div style={{ display: "flex", background: "rgba(0,0,0,.3)", borderRadius: 6, padding: 3, gap: 2 }}>
      {[["en", "EN"], ["zh", "中文"]].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)}
          style={{ padding: "3px 9px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", transition: "all .15s",
            background: lang === l ? "rgba(217,119,6,.9)" : "transparent",
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

    const { data: tenant } = await supabase.from("tenant_profiles").select("*").eq("user_id", authData.user.id).single();
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Crimson Pro',Georgia,serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Crimson+Pro:wght@300;400;600&display=swap');`}</style>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(8)].map((_, i) => <div key={i} style={{ position: "absolute", width: 2, height: 2, background: `rgba(217,119,6,${0.15+i*0.05})`, borderRadius: "50%", top: `${10+i*12}%`, left: `${5+i*13}%`, boxShadow: `0 0 ${20+i*10}px ${8+i*4}px rgba(217,119,6,${0.05+i*0.02})` }} />)}
      </div>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg,#d97706,#92400e)", borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="building" size={28} /></div>
          <h1 style={{ color: "#f8fafc", fontSize: 30, fontWeight: 700, margin: "0 0 6px", fontFamily: "'Playfair Display',Georgia,serif" }}>PropManager</h1>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 15, fontWeight: 300 }}>Property management, simplified.</p>
        </div>
        <div style={{ background: "rgba(255,255,255,.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 32 }}>
          {/* Role tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "rgba(0,0,0,.2)", borderRadius: 10, padding: 4 }}>
            {["landlord", "tenant"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: "8px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .2s", background: tab === t ? "rgba(217,119,6,.9)" : "transparent", color: tab === t ? "#fff" : "#94a3b8" }}>
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
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#d97706,#b45309)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, fontFamily: "'Playfair Display',Georgia,serif" }}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
              {tab === "landlord" && (
                <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 13, color: "#64748b" }}>
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { reset(); setMode("signup"); }} style={{ background: "none", border: "none", color: "#d97706", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Create one</button>
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
                style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg,#d97706,#b45309)", border: "none", borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.75 : 1, fontFamily: "'Playfair Display',Georgia,serif" }}>
                {loading ? "Creating account…" : "Create Account"}
              </button>
              <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 13, color: "#64748b" }}>
                Already have an account?{" "}
                <button onClick={() => { reset(); setMode("login"); }} style={{ background: "none", border: "none", color: "#d97706", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>Sign in</button>
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
    { id: "contracts", label: t.navLeases, icon: "file" },
    { id: "payments", label: t.navPayments, icon: "dollar" },
    { id: "maintenance", label: t.navMaintenance, icon: "wrench" },
    { id: "email", label: t.navEmail, icon: "mail" },
  ];
  const tenantNav = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "payment-portal", label: "Payment Portal", icon: "dollar" },
    { id: "maintenance-new", label: "Maintenance", icon: "wrench" },
    { id: "payment-history", label: "Payment History", icon: "clock" },
  ];
  const nav = user.role === "landlord" ? landlordNav : tenantNav;

  return (
    <div style={{ width: 240, background: "#0f172a", minHeight: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, fontFamily: "'Crimson Pro',Georgia,serif" }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#d97706,#92400e)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}><Icon name="building" size={20} /></div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16, fontFamily: "'Playfair Display',Georgia,serif" }}>{t.appName}</div>
            <div style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: ".7px" }}>{user.role === "landlord" ? t.landlord : t.tenant}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "14px 12px" }}>
        {/* Language toggle — landlord only */}
        {user.role === "landlord" && <LangToggle lang={lang} setLang={setLang} />}

        {nav.map(item => {
          const active = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", marginBottom: 3, textAlign: "left", fontFamily: "inherit", transition: "all .15s",
                background: active ? "rgba(217,119,6,.15)" : "transparent", color: active ? "#fbbf24" : "#94a3b8", fontWeight: active ? 600 : 400, fontSize: 14 }}>
              <Icon name={item.icon} size={17} />{item.label}
              {active && <span style={{ marginLeft: "auto", width: 4, height: 4, background: "#d97706", borderRadius: "50%" }} />}
            </button>
          );
        })}
      </nav>

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
const PageHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.5px" }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const StatCard = ({ label, value, sub, icon, color = "#d97706" }) => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <p style={{ margin: "0 0 6px", color: "#64748b", fontSize: 13, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{value}</p>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>{sub}</p>}
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}><Icon name={icon} size={20} /></div>
    </div>
  </div>
);

// ─── LANDLORD DASHBOARD ───────────────────────────────────────────────────────
const LandlordDashboard = ({ data, t }) => {
  const { properties, tenants, payments, maintenance, contracts } = data;
  const occupied = properties.filter(p => p.status === "occupied").length;
  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "overdue");
  const openMaint = maintenance.filter(m => m.status !== "resolved");

  return (
    <div>
      <PageHeader title={t.dashTitle} subtitle={t.dashSubtitle} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label={t.statProperties} value={properties.length} sub={`${occupied} ${t.statOccupied}`} icon="building" />
        <StatCard label={t.statRevenue} value={fmt(contracts.reduce((s,c) => s+c.rentAmount, 0))} sub={t.statActiveLeases} icon="trending" color="#22c55e" />
        <StatCard label={t.statPending} value={pendingPayments.length} sub={t.statRequireAttention} icon="clock" color="#ef4444" />
        <StatCard label={t.statOpenMaint} value={openMaint.length} sub={t.statRequests} icon="wrench" color="#f59e0b" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{t.tenantPaymentStatus}</h3>
          {tenants.map(ten => {
            const latest = payments.filter(p => p.tenantId === ten.id).sort((a,b) => new Date(b.dueDate)-new Date(a.dueDate))[0];
            return (
              <div key={ten.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#d97706,#92400e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>{ten.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ten.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.unit} · {properties.find(p => p.id === ten.propertyId)?.address}</div>
                  </div>
                </div>
                {latest && <Badge status={latest.status} t={t} />}
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{t.recentMaintenance}</h3>
          {maintenance.slice(0, 4).map(m => {
            const ten = tenants.find(ten => ten.id === m.tenantId);
            return (
              <div key={m.id} style={{ padding: "11px 0", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 500, lineHeight: 1.4 }}>{m.description.slice(0,55)}...</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{ten?.name} · {fmtDate(m.date)}</div>
                  </div>
                  <Badge status={m.status} t={t} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9", gridColumn: "1/-1" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{t.recentPayments}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
                {[t.colTenant, t.colAmount, t.colDueDate, t.colPaidDate, t.colType, t.colAchStatus, t.colStatus].map(h => <th key={h} style={{ padding: "0 12px 10px 0", textAlign: "left" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payments.slice(0,5).map(p => {
                const ten = tenants.find(ten => ten.id === p.tenantId);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #f8fafc" }}>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14, fontWeight: 500 }}>{ten?.name}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 14 }}>{fmt(p.amount)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "#64748b" }}>{fmtDate(p.dueDate)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 13, color: "#64748b" }}>{fmtDate(p.paidDate)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: "#64748b" }}>{p.type === "recurring" ? t.typeRecurring : t.typeOneTime}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}>{p.achStatus ? <Badge status={p.achStatus} t={t} /> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}><Badge status={p.status} t={t} /></td>
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
const PropertiesPage = ({ data, setData, t, refresh }) => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ address: "", city: "", state: "CA", zip: "", units: "1", type: "Single Family", status: "vacant" });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const add = async () => {
    if (!form.address) return;
    const { error } = await supabase.from("properties").insert({
      address: form.address, city: form.city, state: form.state, zip: form.zip,
      units: +form.units, type: form.type, status: form.status,
    });
    if (!error) { await refresh(); setShow(false); }
  };

  return (
    <div>
      <PageHeader title={t.propTitle} subtitle={t.propSubtitle(data.properties.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addProperty}</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 18 }}>
        {data.properties.map(p => {
          const pts = data.tenants.filter(ten => ten.propertyId === p.id);
          const rev = data.contracts.filter(c => c.propertyId === p.id).reduce((s,c) => s+c.rentAmount, 0);
          return (
            <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}><Icon name="home" size={22} /></div>
                <Badge status={p.status} t={t} />
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{p.address}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>{p.city}, {p.state} {p.zip} · {p.type}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.tenants}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{pts.length}<span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 400 }}>/{p.units}</span></div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2, textTransform: "uppercase", letterSpacing: ".5px" }}>{t.revenue}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{fmt(rev)}</div>
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
    </div>
  );
};

// ─── TENANTS PAGE ─────────────────────────────────────────────────────────────
const TenantsPage = ({ data, setData, t, refresh }) => {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", propertyId: "", unit: "", password: "" });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const add = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    const res = await fetch("/api/auth/create-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, email: form.email, phone: form.phone,
        password: form.password, property_id: form.propertyId, unit: form.unit,
      }),
    });
    if (res.ok) { await refresh(); setShow(false); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title={t.tenTitle} subtitle={t.tenSubtitle(data.tenants.length)} action={<Btn icon="plus" onClick={() => setShow(true)}>{t.addTenant}</Btn>} />
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {[t.colTenant, t.colContact, t.colProperty, t.colBank, t.colRecurring, t.colStatus].map(h => <th key={h} style={{ padding: "14px 20px", textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.tenants.map(ten => {
              const prop = data.properties.find(p => p.id === ten.propertyId);
              return (
                <tr key={ten.id} style={{ borderTop: "1px solid #f8fafc" }}>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#d97706,#92400e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{ten.name.charAt(0)}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ten.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ fontSize: 13, color: "#374151" }}>{ten.email}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.phone}</div>
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <div style={{ fontSize: 13, color: "#374151" }}>{prop?.address || "—"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{ten.unit}</div>
                  </td>
                  <td style={{ padding: "14px 20px" }}>{ten.bankConnected ? <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}><Icon name="check" size={14} />{t.bankConnected}</span> : <span style={{ color: "#94a3b8", fontSize: 13 }}>{t.bankNotConnected}</span>}</td>
                  <td style={{ padding: "14px 20px" }}>{ten.recurringPayment ? <span style={{ color: "#3b82f6", display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}><Icon name="refresh" size={14} />{t.recurringEnabled}</span> : <span style={{ color: "#94a3b8", fontSize: 13 }}>{t.recurringOff}</span>}</td>
                  <td style={{ padding: "14px 20px" }}><Badge status={ten.status} t={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {show && (
        <Modal title={t.addTenantTitle} onClose={() => setShow(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={t.fullName} value={form.name} onChange={v => setF("name",v)} placeholder="Jane Smith" />
            <Inp label={t.email} value={form.email} onChange={v => setF("email",v)} type="email" />
            <Inp label={t.phone} value={form.phone} onChange={v => setF("phone",v)} />
            <Inp label={t.loginPassword} value={form.password} onChange={v => setF("password",v)} type="text" placeholder={t.tempPassword} />
            <Sel label={t.navProperties} value={form.propertyId} onChange={v => setF("propertyId",v)} options={[{value:"",label:t.selectProperty},...data.properties.map(p => ({value:p.id,label:p.address}))]} />
            <Inp label={t.unit} value={form.unit} onChange={v => setF("unit",v)} placeholder="Unit A" />
          </div>
          <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 9, padding: 12, marginBottom: 16, fontSize: 13, color: "#92400e" }}><strong>{t.note}:</strong> {t.tenantNote}</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setShow(false)}>{t.cancel}</Btn>
            <Btn onClick={add}>{saving ? "Creating…" : t.createTenantAccount}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── CONTRACTS PAGE ───────────────────────────────────────────────────────────
const ContractsPage = ({ data, setData, t, refresh }) => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ tenantId: "", propertyId: "", unit: "", startDate: "", endDate: "", rentAmount: "", dueDay: "1" });
  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const add = async () => {
    if (!form.tenantId || !form.rentAmount) return;
    const { error } = await supabase.from("contracts").insert({
      tenant_id: form.tenantId, property_id: form.propertyId, unit: form.unit,
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
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{ten?.name||"—"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{prop?.address} · {c.unit}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.rent}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(c.rentAmount)}<span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>/mo</span></div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{t.dueOf} {c.dueDay}{t.ofMonth}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.term}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{fmtDate(c.startDate)}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>→ {fmtDate(c.endDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{t.colDaysRemaining}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: daysLeft < 60 ? "#ef4444" : "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>{daysLeft > 0 ? `${daysLeft} ${t.daysRemaining}` : t.expired}</div>
              </div>
              <Badge status={c.status} t={t} />
            </div>
          );
        })}
      </div>
      {show && (
        <Modal title={t.addLeaseTitle} onClose={() => setShow(false)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Sel label={t.colTenant} value={form.tenantId} onChange={v => setF("tenantId",v)} options={[{value:"",label:t.selectTenant},...data.tenants.map(ten => ({value:ten.id,label:ten.name}))]} />
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
const PaymentsPage = ({ data, t }) => {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? data.payments : data.payments.filter(p => p.status === filter);
  const filterLabels = { all: t.filterAll, completed: t.st_completed, pending: t.st_pending, overdue: t.st_overdue, failed: t.st_failed };

  return (
    <div>
      <PageHeader title={t.payTitle} subtitle={t.paySubtitle} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all","completed","pending","overdue","failed"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .15s", borderColor: filter===f?"#d97706":"#e2e8f0", background: filter===f?"#d97706":"#fff", color: filter===f?"#fff":"#64748b" }}>
            {filterLabels[f]}
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
              {[t.colTenant,t.colAmount,t.colDueDate,t.colPaidDate,t.colType,t.colAchStatus,t.colStatus].map(h => <th key={h} style={{ padding: "14px 18px", textAlign: "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const ten = data.tenants.find(ten => ten.id === p.tenantId);
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #f8fafc" }}>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#d97706,#92400e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{ten?.name.charAt(0)}</div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ten?.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{fmt(p.amount)}</td>
                  <td style={{ padding: "14px 18px", fontSize: 13, color: "#64748b" }}>{fmtDate(p.dueDate)}</td>
                  <td style={{ padding: "14px 18px", fontSize: 13, color: "#64748b" }}>{fmtDate(p.paidDate)}</td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: "#64748b" }}>{p.type==="recurring"?t.typeRecurring:t.typeOneTime}</td>
                  <td style={{ padding: "14px 18px" }}>{p.achStatus ? <Badge status={p.achStatus} t={t} /> : <span style={{ color: "#d1d5db", fontSize: 13 }}>{t.naLabel}</span>}</td>
                  <td style={{ padding: "14px 18px" }}><Badge status={p.status} t={t} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── MAINTENANCE PAGE ─────────────────────────────────────────────────────────
const MaintenancePage = ({ data, setData, t, refresh }) => {
  const pColors = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" };
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
                      <span>{ten?.name}</span><span>{prop?.address} · {m.unit}</span><span>{fmtDate(m.date)}</span>
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
              <div style={{ width: 42, height: 42, borderRadius: 11, background: s[r.key]?"rgba(217,119,6,.1)":"#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: s[r.key]?"#d97706":"#94a3b8" }}><Icon name="mail" size={19} /></div>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1.5px solid #d97706" }}>
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
        <StatCard label="Open Requests" value={openMaint.length} sub="maintenance requests" icon="wrench" color="#f59e0b" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: "1px solid #f1f5f9" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>Your Unit</h3>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 50, height: 50, background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706", flexShrink: 0 }}><Icon name="home" size={24} /></div>
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
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>Recent Payments</h3>
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
                <div style={{ width: 42, height: 42, borderRadius: 11, background: tenant.recurringPayment?"rgba(217,119,6,.1)":"#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: tenant.recurringPayment?"#d97706":"#94a3b8" }}><Icon name="refresh" size={19} /></div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Auto-Pay</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Pay {fmt(contract.rentAmount)} on the {contract.dueDay}{contract.dueDay===1?"st":"th"}</div>
                  <div style={{ fontSize: 12, color: tenant.recurringPayment?"#d97706":"#94a3b8", marginTop: 3, fontWeight: 500 }}>{tenant.recurringPayment?"Enabled":"Disabled"}</div>
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
          <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>New Request</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Describe the issue in detail..." rows={5}
              style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 9, fontSize: 14, color: "#0f172a", resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>
          <Sel label="Priority" value={form.priority} onChange={v => setForm(f => ({...f,priority:v}))} options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"}]} />
          <Btn icon="plus" onClick={submit}>Submit Request</Btn>
        </div>
        <div>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>My Requests</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {myReqs.map(m => {
              const pC = { high:"#ef4444",medium:"#f59e0b",low:"#3b82f6" };
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
            <div style={{ width: 52, height: 52, background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}><Icon name="file" size={24} /></div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: "'Playfair Display',Georgia,serif" }}>Lease Agreement</div>
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
            <div style={{ fontSize: 36, fontWeight: 800, color: daysLeft<60?"#ef4444":"#22c55e", fontFamily: "'Playfair Display',Georgia,serif" }}>{daysLeft} days</div>
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
                <td style={{ padding:"14px 20px",fontSize:16,fontWeight:700,color:"#0f172a",fontFamily:"'Playfair Display',Georgia,serif" }}>{fmt(p.amount)}</td>
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
  const [data, setData] = useState({ properties: [], tenants: [], contracts: [], payments: [], maintenance: [], emailSettings: EMPTY_EMAIL_SETTINGS });
  const [loadingData, setLoadingData] = useState(false);
  const [lang, setLang] = useState("en");
  const t = T[lang];

  useEffect(() => { document.body.style.margin = "0"; document.body.style.background = "#f8fafc"; }, []);
  useEffect(() => { if (user) fetchAllData(); }, [user]);

  // ─── MAPPERS (snake_case Supabase → camelCase UI) ──────────────────────────
  const mapProperty  = (p) => ({ id: p.id, address: p.address, city: p.city, state: p.state || "CA", zip: p.zip, units: p.units, type: p.type, status: p.status });
  const mapTenant    = (t) => ({ id: t.id, name: t.name, email: t.email, phone: t.phone || "", propertyId: t.property_id, unit: t.unit, status: t.status || "active", bankConnected: t.bank_connected || false, recurringPayment: t.recurring_payment || false });
  const mapContract  = (c) => ({ id: c.id, tenantId: c.tenant_id, propertyId: c.property_id, unit: c.unit, startDate: c.start_date, endDate: c.end_date, rentAmount: c.rent_amount, dueDay: c.due_day, status: c.status || "active" });
  const mapPayment   = (p) => ({ id: p.id, tenantId: p.tenant_id, contractId: p.contract_id, amount: p.amount, dueDate: p.due_date, paidDate: p.paid_date, status: p.status, type: p.type, achStatus: p.ach_status });
  const mapMaintenance = (m) => ({ id: m.id, tenantId: m.tenant_id, propertyId: m.property_id, unit: m.unit, description: m.description, priority: m.priority, status: m.status, date: (m.created_at || m.date || "").split("T")[0] });
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
        const [propRes, tenRes, conRes, payRes, maintRes, emailRes] = await Promise.all([
          supabase.from("properties").select("*").order("created_at", { ascending: true }),
          supabase.from("tenant_profiles").select("*"),
          supabase.from("contracts").select("*"),
          supabase.from("payments").select("*").order("due_date", { ascending: false }),
          supabase.from("maintenance_requests").select("*").order("created_at", { ascending: false }),
          supabase.from("email_settings").select("*").single(),
        ]);
        setData({
          properties:    (propRes.data  || []).map(mapProperty),
          tenants:       (tenRes.data   || []).map(mapTenant),
          contracts:     (conRes.data   || []).map(mapContract),
          payments:      (payRes.data   || []).map(mapPayment),
          maintenance:   (maintRes.data || []).map(mapMaintenance),
          emailSettings: mapEmailSettings(emailRes.data),
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Crimson Pro',Georgia,serif", color: "#64748b", fontSize: 16 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Crimson+Pro:wght@300;400;500;600;700&display=swap');`}</style>
        Loading your portfolio…
      </div>
    );
  }

  const refresh = fetchAllData;

  const renderPage = () => {
    if (user.role === "landlord") {
      const props = { data, setData, t, refresh };
      switch (page) {
        case "dashboard":   return <LandlordDashboard {...props} />;
        case "properties":  return <PropertiesPage {...props} />;
        case "tenants":     return <TenantsPage {...props} />;
        case "contracts":   return <ContractsPage {...props} />;
        case "payments":    return <PaymentsPage data={data} t={t} />;
        case "maintenance": return <MaintenancePage {...props} />;
        case "email":       return <EmailPage {...props} />;
        default:            return <LandlordDashboard {...props} />;
      }
    } else {
      const props = { data, setData, user, refresh };
      switch (page) {
        case "dashboard":       return <TenantDashboard data={data} user={user} />;
        case "payment-portal":  return <PaymentPortal {...props} />;
        case "maintenance-new": return <TenantMaintenancePage {...props} />;
        case "lease":           return <TenantLeasePage data={data} user={user} />;
        case "payment-history": return <PaymentHistoryPage data={data} user={user} />;
        default:                return <TenantDashboard data={data} user={user} />;
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setData({ properties: [], tenants: [], contracts: [], payments: [], maintenance: [], emailSettings: EMPTY_EMAIL_SETTINGS });
    setPage("dashboard");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "'Crimson Pro',Georgia,serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Crimson+Pro:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; } body { margin: 0; }`}</style>
      <Sidebar user={user} currentPage={page} onNavigate={setPage} onLogout={handleLogout} lang={lang} setLang={setLang} t={t} />
      <main style={{ marginLeft: 240, flex: 1, padding: "36px 40px", minHeight: "100vh" }}>
        {renderPage()}
      </main>
    </div>
  );
}
