import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="max-w-md w-full relative">
        <h1 className="text-9xl font-extrabold text-gray-200 tracking-widest relative z-0">404</h1>
        <div className="bg-red-500 text-white px-3 py-1 text-sm rounded rotate-12 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg whitespace-nowrap z-10 font-medium">
          Page Not Found
        </div>
        
        <div className="mt-8">
          <h2 className="text-3xl font-heading font-bold text-gray-900 mt-8 mb-4">
            Oops! Are you lost?
          </h2>
          <p className="text-gray-500 text-lg mb-10 leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-gray-300"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
