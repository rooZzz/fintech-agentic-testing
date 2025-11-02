import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { createTestUser } from '@/api/auth';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const isFormValid = email.trim() !== '' && password.trim() !== '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTestUser = async () => {
    setError('');
    setIsCreatingUser(true);

    try {
      const user = await createTestUser();
      setEmail(user.email);
      setPassword(user.password);
      
      await login(user.email, user.password);
      navigate('/dashboard');
    } catch {
      setError('Failed to create test user. Please try again.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fintech-blue to-gray-800 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to view your credit report</p>
        </div>

        {/* <button
          type="button"
          data-testid="create-test-user-button"
          onClick={handleCreateTestUser}
          disabled={isCreatingUser || isLoading}
          className="w-full mb-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreatingUser ? 'Creating Test User...' : 'Create & Login as Test User'}
        </button> */}

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or login with existing credentials</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              data-testid="email-input"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent outline-none transition"
              placeholder="you@example.com"
              disabled={isLoading || isCreatingUser}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              data-testid="password-input"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent outline-none transition"
              placeholder="Enter your password"
              disabled={isLoading || isCreatingUser}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            data-testid="login-button"
            aria-label="Log in"
            disabled={isLoading || isCreatingUser || !isFormValid}
            className="w-full bg-fintech-accent hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>For manual testing: Click "Create & Login as Test User" above</p>
        </div>
      </div>
    </div>
  );
};

