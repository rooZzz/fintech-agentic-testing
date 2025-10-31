import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const Loans = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [loanType, setLoanType] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; term?: string; loanType?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { amount?: string; term?: string; loanType?: string } = {};
    
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum)) {
      newErrors.amount = 'Amount is required';
    } else if (amountNum < 1000) {
      newErrors.amount = 'Minimum loan amount is $1,000';
    } else if (amountNum > 500000) {
      newErrors.amount = 'Maximum loan amount is $500,000';
    }
    
    const termNum = parseInt(term);
    if (!term || isNaN(termNum)) {
      newErrors.term = 'Term is required';
    } else if (termNum < 1) {
      newErrors.term = 'Minimum term is 1 year';
    } else if (termNum > 30) {
      newErrors.term = 'Maximum term is 30 years';
    }
    
    if (!loanType) {
      newErrors.loanType = 'Loan type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormComplete = amount && term && loanType;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      navigate(`/loans/results?amount=${amount}&term=${term}&loanType=${loanType}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Loan</h1>
          <p className="text-gray-600 mb-8">Search for the perfect loan based on your needs</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                Loan Amount ($)
              </label>
              <input
                id="amount"
                type="number"
                data-testid="loan-amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 25000"
                className={`w-full px-4 py-3 border ${errors.amount ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent`}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600" data-testid="amount-error">
                  {errors.amount}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-2">
                Loan Term (years)
              </label>
              <select
                id="term"
                data-testid="loan-term-select"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className={`w-full px-4 py-3 border ${errors.term ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent bg-white`}
              >
                <option value="">Select term...</option>
                {[1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 25, 30].map((years) => (
                  <option key={years} value={years}>
                    {years} {years === 1 ? 'year' : 'years'}
                  </option>
                ))}
              </select>
              {errors.term && (
                <p className="mt-1 text-sm text-red-600" data-testid="term-error">
                  {errors.term}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="loanType" className="block text-sm font-medium text-gray-700 mb-2">
                Loan Type
              </label>
              <select
                id="loanType"
                data-testid="loan-type-select"
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className={`w-full px-4 py-3 border ${errors.loanType ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent bg-white`}
              >
                <option value="">Select type...</option>
                <option value="personal">Personal Loan</option>
                <option value="auto">Auto Loan</option>
                <option value="mortgage">Mortgage</option>
              </select>
              {errors.loanType && (
                <p className="mt-1 text-sm text-red-600" data-testid="loan-type-error">
                  {errors.loanType}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                data-testid="search-loans-button"
                disabled={!isFormComplete}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                  isFormComplete
                    ? 'bg-fintech-accent text-white hover:bg-blue-700 cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                Search Loans
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

