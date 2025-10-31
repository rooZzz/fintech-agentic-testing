import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface LoanProduct {
  id: string;
  lenderName: string;
  apr: number;
  monthlyPayment: number;
  totalInterest: number;
  loanType: string;
}

export const LoanResults = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loans, setLoans] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const amount = searchParams.get('amount');
  const term = searchParams.get('term');
  const loanType = searchParams.get('loanType');

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:7002/data/loan/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount ? parseFloat(amount) : undefined,
            term: term ? parseInt(term) : undefined,
            loanType: loanType || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch loans');
        }

        const data = await response.json();
        setLoans(data.loans || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [amount, term, loanType]);

  const handleSelectLoan = (loanId: string) => {
    navigate(`/loans/confirmation/${loanId}?amount=${amount}&term=${term}`);
  };

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
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading loan offers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={() => navigate('/loans')}
              className="mt-4 text-red-600 hover:text-red-800 underline"
            >
              Back to search
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/loans')}
            className="text-fintech-accent hover:text-blue-700 font-medium"
          >
            ← Back to search
          </button>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Available Loan Offers</h1>
          <p className="text-gray-600">
            {loans.length} {loans.length === 1 ? 'offer' : 'offers'} found for {formatCurrency(parseFloat(amount || '0'))} over {term} {term === '1' ? 'year' : 'years'}
          </p>
        </div>

        {loans.length === 0 ? (
          <div className="bg-white shadow-sm rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-4">No loan offers match your criteria.</p>
            <button
              onClick={() => navigate('/loans')}
              className="text-fintech-accent hover:text-blue-700 font-medium underline"
            >
              Try a different search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan, index) => (
              <div
                key={loan.id}
                data-testid={`loan-offer-${index}`}
                className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{loan.lenderName}</h3>
                    <p className="text-sm text-gray-500 capitalize">{loan.loanType} Loan</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-fintech-accent">{loan.apr}%</div>
                    <div className="text-sm text-gray-500">APR</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Monthly Payment</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {formatCurrency(loan.monthlyPayment)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Interest</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {formatCurrency(loan.totalInterest)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectLoan(loan.id)}
                  data-testid={`select-loan-${index}`}
                  className="w-full bg-fintech-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Select This Loan
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

