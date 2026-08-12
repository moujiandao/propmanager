'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { T } from '@/lib/i18n/strings'
import { routes } from '@/lib/routes'
import { useAppUser, useAppLang } from '@/components/app-store'
import { Icon } from '@/property-management-app'

const supabase = createClient()

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
)

export function Sidebar() {
  const { user } = useAppUser()
  const { lang, setLang } = useAppLang()
  const pathname = usePathname()
  const t = T[lang]

  const landlordNav = [
    { href: routes.dashboard(),   label: t.navDashboard,  icon: "home" },
    { href: routes.properties(),  label: t.navProperties, icon: "building" },
    { href: routes.tenants(),     label: t.navTenants,    icon: "users" },
    { href: routes.payments(),    label: t.navPayments,   icon: "dollar" },
    { href: routes.maintenance(), label: t.navTodo,       icon: "wrench" },
  ]
  const landlordBottomNav = [
    { href: routes.parking(),          label: t.navParking,          icon: "car" },
    { href: routes.leases(),           label: t.navLeases,           icon: "file" },
    { href: routes.renewals(),         label: t.navRenewals,         icon: "file" },
    { href: routes.email(),            label: t.navEmailAutomation,  icon: "mail" },
    { href: routes.reminders(),        label: t.navPaymentReminders, icon: "dollar" },
    { href: routes.documents(),        label: t.navDocuments,        icon: "key" },
    { href: routes.team(),             label: t.navAdminUsers,       icon: "users" },
  ]
  const tenantNav = [
    { href: routes.portal(),            label: t.navDashboard,      icon: "home" },
    { href: routes.portalPayments(),    label: t.navPaymentPortal,  icon: "dollar" },
    { href: routes.portalHistory(),     label: t.navPaymentHistory, icon: "clock" },
    { href: routes.portalProfile(),     label: t.navMyProfile,      icon: "key" },
    { href: routes.portalMaintenance(), label: t.navMaintenance,    icon: "wrench" },
  ]

  const isLandlord = user.role === "landlord"
  const nav = isLandlord ? landlordNav : tenantNav
  const bottomNav = isLandlord ? landlordBottomNav : []

  // Light the item whose href is the LONGEST prefix of the current path, rather
  // than every item that happens to be a prefix. Two cases depend on it:
  // /properties/<id> must light Properties (which a bare equality check would
  // miss — the old `currentPage === item.id` left nothing lit on detail views),
  // and /portal/payments/history must light History, not Payments.
  const activeHref = [...nav, ...bottomNav]
    .map(i => i.href)
    .filter(h => pathname === h || pathname.startsWith(h + '/'))
    .sort((a, b) => b.length - a.length)[0]

  const NavLink = ({ item }) => {
    const active = item.href === activeHref
    return (
      // prefetch={false}: all 12 links are in the viewport at load, and every
      // prefetch is an RSC request that runs middleware, which calls
      // supabase.auth.getUser() — a network round trip, not a local decode.
      <Link href={item.href} prefetch={false}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", marginBottom: 3, textAlign: "left", fontFamily: "inherit", transition: "all .15s", textDecoration: "none",
          background: active ? "rgba(255,255,255,.10)" : "transparent", color: active ? "#ffffff" : "#9ca3af", fontWeight: active ? 600 : 400, fontSize: 14 }}>
        <Icon name={item.icon} size={17} />{item.label}
        {active && <span style={{ marginLeft: "auto", width: 4, height: 4, background: "#ffffff", borderRadius: "50%" }} />}
      </Link>
    )
  }

  const logout = async () => {
    await supabase.auth.signOut()
    // Leave the app surface entirely and land on the public marketing home.
    window.location.href = "/"
  }

  return (
    <div style={{ width: 240, background: "#111111", minHeight: "100vh", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, background: "linear-gradient(135deg,#111111,#000000)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}><Icon name="building" size={20} /></div>
          <div>
            <div style={{ color: "#f5f5f5", fontWeight: 700, fontSize: 16, fontFamily: "'Inter',system-ui,-apple-system,sans-serif" }}>{t.appName}</div>
            <div style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: ".7px" }}>{isLandlord ? t.landlord : t.tenant}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "14px 12px" }}>
        {/* Language toggle — landlord only */}
        {isLandlord && <LangToggle lang={lang} setLang={setLang} />}
        {nav.map(item => <NavLink key={item.href} item={item} />)}
      </nav>

      {bottomNav.length > 0 && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          {bottomNav.map(item => <NavLink key={item.href} item={item} />)}
        </div>
      )}

      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ padding: "10px 12px", marginBottom: 4 }}>
          <div style={{ color: "#f5f5f5", fontSize: 14, fontWeight: 600 }}>{user.name}</div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>{user.email}</div>
        </div>
        <button onClick={logout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: "#6b7280", fontFamily: "inherit", fontSize: 14 }}>
          <Icon name="logout" size={17} />{t.logout}
        </button>
      </div>
    </div>
  )
}
