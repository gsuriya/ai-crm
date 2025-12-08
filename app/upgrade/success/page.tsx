"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function SuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto w-20 h-20 bg-black rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-black mb-3">
            You&apos;re all set!
          </h1>
          
          <p className="text-gray-600 text-lg">
            Welcome to unlimited outreach
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              <span className="text-sm text-gray-700">Unlimited people per month</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              <span className="text-sm text-gray-700">Unlimited email sends</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              <span className="text-sm text-gray-700">Smart email caching</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
              <span className="text-sm text-gray-700">Priority support</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-6 rounded-lg bg-black text-white font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 mb-4"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-sm text-gray-500">
          Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}
