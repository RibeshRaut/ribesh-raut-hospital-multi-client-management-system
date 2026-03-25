'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authAPI, APIError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<'hospital' | 'admin'>('hospital');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authAPI.forgotPassword(email, userType);
      setSuccess(response.message || 'Password reset email sent successfully');
      setSubmitted(true);
      setEmail('');
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message || 'An error occurred. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Forgot Password?</h1>
          <p className="text-gray-600 mt-2">Enter your email to receive a password reset link</p>
        </div>

        {submitted ? (
          <div className="space-y-6">
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <p className="text-gray-600 text-sm">
                Check your email for a password reset link. The link will expire in 1 hour.
              </p>
              <p className="text-gray-600 text-sm">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  try again
                </button>
              </p>
            </div>

            <Link href="/login">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {/* User Type Selection */}
            <div>
              <Label htmlFor="userType" className="mb-2 block text-sm font-medium text-gray-700">
                I am a:
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType('hospital')}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    userType === 'hospital'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Hospital Admin
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('admin')}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    userType === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Super Admin
                </button>
              </div>
            </div>

            {/* Email Input */}
            <div>
              <Label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                {userType === 'hospital' ? 'Hospital Email' : 'Username'}
              </Label>
              <Input
                id="email"
                type={userType === 'hospital' ? 'email' : 'text'}
                placeholder={userType === 'hospital' ? 'your@hospital.com' : 'username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            {/* Back to Login */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Back to Login
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
