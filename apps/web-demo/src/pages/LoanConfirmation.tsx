import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

interface LoanProduct {
  id: string;
  lenderName: string;
  apr: number;
  monthlyPayment: number;
  totalInterest: number;
  loanType: string;
}

export const LoanConfirmation = () => {
  const navigate = useNavigate();
  const { loanId } = useParams<{ loanId: string }>();
  const [searchParams] = useSearchParams();
  const [loan, setLoan] = useState<LoanProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const amount = searchParams.get('amount');
  const term = searchParams.get('term');

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:7002/data/loan/get', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: loanId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch loan details');
        }

        const data = await response.json();
        if (!data.loan) {
          throw new Error('Loan not found');
        }

        setLoan(data.loan);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (loanId) {
      fetchLoan();
    }
  }, [loanId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Processing your loan application...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error: {error || 'Loan not found'}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 text-red-600 hover:text-red-800 underline"
            >
              Return to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Loan Application Submitted
            </h1>
            <p className="text-gray-600">
              Your loan application has been successfully submitted and is being processed.
            </p>
          </div>

          <div
            data-testid="loan-confirmation-details"
            className="bg-gradient-to-r from-fintech-accent to-blue-600 rounded-xl p-6 text-white mb-6"
          >
            <h2 className="text-lg font-medium mb-4 opacity-90">Loan Details</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="opacity-90">Lender:</span>
                <span className="font-semibold">{loan.lenderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-90">Loan Type:</span>
                <span className="font-semibold capitalize">{loan.loanType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-90">Loan Amount:</span>
                <span className="font-semibold">{formatCurrency(parseFloat(amount || '0'))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-90">Term:</span>
                <span className="font-semibold">{term} years</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-3 mt-3">
                <span className="opacity-90">APR:</span>
                <span className="text-2xl font-bold">{loan.apr}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Monthly Payment</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(loan.monthlyPayment)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Interest</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(loan.totalInterest)}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• You'll receive an email confirmation within 24 hours</li>
              <li>• A loan specialist will review your application</li>
              <li>• We'll contact you if we need additional information</li>
              <li>• Final approval typically takes 3-5 business days</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            data-testid="return-to-dashboard"
            className="w-full bg-fintech-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

