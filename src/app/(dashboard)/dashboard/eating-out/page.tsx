'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EatingOutPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new meals page
    router.replace('/dashboard/meals')
  }, [router])

  return (
    <div className="max-w-2xl mx-auto py-20 text-center">
      <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-500">Redirecting to Meals...</p>
    </div>
  )
}
