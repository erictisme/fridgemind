import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-emerald-600">
                FridgeMind
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/dashboard/inventory">Inventory</NavLink>
                <NavLink href="/dashboard/scan">Scan</NavLink>
                <NavLink href="/dashboard/meal-plan">Meal Plan</NavLink>
                <NavLink href="/dashboard/shopping-list">Shopping List</NavLink>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div className="sm:hidden bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex space-x-2 overflow-x-auto">
          <MobileNavLink href="/dashboard">Home</MobileNavLink>
          <MobileNavLink href="/dashboard/inventory">Inventory</MobileNavLink>
          <MobileNavLink href="/dashboard/scan">Scan</MobileNavLink>
          <MobileNavLink href="/dashboard/meal-plan">Meals</MobileNavLink>
          <MobileNavLink href="/dashboard/shopping-list">Shop</MobileNavLink>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
    >
      {children}
    </Link>
  )
}

function MobileNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-emerald-600 bg-gray-100 hover:bg-emerald-50 rounded-full whitespace-nowrap"
    >
      {children}
    </Link>
  )
}

function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Sign out
      </button>
    </form>
  )
}
