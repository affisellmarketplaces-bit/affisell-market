import Link from "next/link"

export default function SignupChooser() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Join Affisell</h1>
          <p className="mt-2 text-gray-600">Choose how you want to get started</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/signup/affiliate" className="group">
            <div className="h-full rounded-2xl border-2 border-blue-600 bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 text-4xl">💼</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Join as Affiliate</h2>
              <p className="mb-6 text-gray-600">Promote products, earn up to 100% commission and margin</p>
              <div className="flex items-center gap-1 font-medium text-blue-600 group-hover:gap-2">
                Get started <span>→</span>
              </div>
            </div>
          </Link>

          <Link href="/signup/customer" className="group">
            <div className="h-full rounded-2xl border-2 border-violet-500 bg-white p-8 shadow-sm transition-all hover:border-violet-600 hover:shadow-md">
              <div className="mb-4 text-4xl">🛒</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Join as Customer</h2>
              <p className="mb-6 text-gray-600">Shop and get up to 20% cashback on every order</p>
              <div className="flex items-center gap-1 font-medium text-violet-600 group-hover:gap-2">
                Get started <span>→</span>
              </div>
            </div>
          </Link>

          <Link href="/signup/supplier" className="group">
            <div className="h-full rounded-2xl border-2 border-green-600 bg-white p-8 shadow-sm transition-all hover:border-green-700 hover:shadow-md">
              <div className="mb-4 text-4xl">📦</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Join as Supplier</h2>
              <p className="mb-6 text-gray-600">Sell to thousands of affiliates instantly</p>
              <div className="flex items-center gap-1 font-medium text-green-600 group-hover:gap-2">
                Get started <span>→</span>
              </div>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
