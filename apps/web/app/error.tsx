'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="max-w-md w-full relative space-y-8">
        <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center shadow-inner">
          <svg 
            className="w-12 h-12 text-red-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <div>
          <h2 className="text-3xl font-heading font-bold text-gray-900 mb-4 tracking-tight">
            Something went wrong!
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10">
            An unexpected error occurred. Don't worry, our team has been notified and is looking into it.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-300"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-8 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:-translate-y-0.5 shadow-sm focus:outline-none focus:ring-4 focus:ring-gray-100"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
