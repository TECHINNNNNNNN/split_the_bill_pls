import Link from 'next/link';

export default function QuickSplitNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="max-w-md w-full relative space-y-12">
        <div className="relative mx-auto w-32 h-32 flex justify-center items-center">
          <div className="absolute inset-0 bg-gray-200 rounded-3xl rotate-12 transform-gpu transition-transform hover:rotate-6"></div>
          <div className="absolute inset-0 bg-white border border-gray-100 shadow-xl rounded-3xl flex items-center justify-center transform-gpu transition-transform hover:-rotate-3 z-10">
             <svg className="w-14 h-14 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
          </div>
          <div className="absolute -bottom-3 -right-3 bg-red-500 text-white rounded-full p-2.5 shadow-lg border-4 border-gray-50 z-20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        
        <div>
          <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4 tracking-tight">
            Bill Not Found
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-6">
            We couldn't find the quick split group you are looking for. It might have been deleted, or the invite link could be incorrect.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
          <Link
            href="/quick-split"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-300"
          >
            Create new bill
          </Link>
          <Link
            href="/home"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-8 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:-translate-y-0.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
