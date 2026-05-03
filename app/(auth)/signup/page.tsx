import Link from "next/link"

export default function SignupChooser() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Join Affisell</h1>
          <p className="mt-2 text-gray-600">Choose your account type to get started</p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <Link href="/signup/affiliate" className="group">
            <div className="flex h-full flex-col rounded-2xl border-2 border-blue-600 bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 text-4xl">💼</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Join as an Affiliate</h2>
              <p className="mb-6 flex-1 text-gray-600">
                Create your account to start earning commissions by promoting products
              </p>
              <span className="inline-flex w-fit items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition group-hover:bg-blue-700">
                Get Started
              </span>
            </div>
          </Link>

          <Link href="/signup/supplier" className="group">
            <div className="flex h-full flex-col rounded-2xl border-2 border-green-600 bg-white p-8 shadow-sm transition-all hover:border-green-700 hover:shadow-md">
              <div className="mb-4 text-4xl">📦</div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Join as a Supplier</h2>
              <p className="mb-6 flex-1 text-gray-600">
                Create your account to start selling products through our affiliate network
              </p>
              <span className="inline-flex w-fit items-center justify-center rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition group-hover:bg-green-700">
                Get Started
              </span>
            </div>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-gray-600">
          Already have an account or cashback wallet?{" "}
          <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
