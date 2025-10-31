import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

export const CreditReport = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const tradelines = [
    {
      id: 1,
      creditor: 'Barclaycard Platinum',
      accountNumber: '****1234',
      type: 'Revolving',
      balance: 2450,
      limit: 10000,
      status: 'Open',
      paymentHistory: 'On Time',
    },
    {
      id: 2,
      creditor: 'Santander Car Loan',
      accountNumber: '****5678',
      type: 'Installment',
      balance: 18500,
      limit: 25000,
      status: 'Open',
      paymentHistory: 'On Time',
    },
    {
      id: 3,
      creditor: 'Student Loan - SLC',
      accountNumber: '****9012',
      type: 'Installment',
      balance: 32000,
      limit: 35000,
      status: 'Open',
      paymentHistory: 'On Time',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 mb-8 rounded-lg py-4 px-6" role="banner">
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/dashboard')}
              data-testid="back-to-dashboard"
              aria-label="Back to dashboard"
              className="text-fintech-accent hover:text-blue-700 font-medium transition"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              aria-label="Log out"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </header>

        <main role="main">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Credit Report</h1>

        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Credit Score Overview</h2>
            <div
              data-testid="credit-score-chart"
              className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-12"
              role="img"
              aria-label="Credit score chart showing score of 658"
            >
              <div className="text-center">
                <div className="text-7xl font-bold text-fintech-accent mb-2">658</div>
                <div className="text-lg text-gray-600 mb-4">GOOD</div>
                <div className="flex items-center justify-center gap-8 text-sm">
                  <div className="text-center">
                    <div className="text-gray-500">MIN</div>
                    <div className="font-semibold text-gray-700">0</div>
                  </div>
                  <div className="w-48 h-3 bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 to-emerald-500 rounded-full"></div>
                  <div className="text-center">
                    <div className="text-gray-500">MAX</div>
                    <div className="font-semibold text-gray-700">999</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Tradelines</h2>
            <div className="space-y-4">
              {tradelines.map((tradeline) => (
                <div
                  key={tradeline.id}
                  className="border border-gray-200 rounded-lg p-6 hover:border-fintech-accent transition"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {tradeline.creditor}
                      </h3>
                      <p className="text-sm text-gray-500">Account: {tradeline.accountNumber}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        tradeline.status === 'Open'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tradeline.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 mb-1">Type</div>
                      <div className="font-medium text-gray-900">{tradeline.type}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Balance</div>
                      <div className="font-medium text-gray-900">
                        £{tradeline.balance.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Limit</div>
                      <div className="font-medium text-gray-900">
                        £{tradeline.limit.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">Payment History</div>
                      <div className="font-medium text-green-600">{tradeline.paymentHistory}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Inquiries</h2>
            <div className="text-center py-8 text-gray-500">
              <p>No recent credit inquiries</p>
              <p className="text-sm mt-2">Hard inquiries from the last 2 years will appear here</p>
            </div>
          </div>
        </section>
        </main>
      </div>
    </div>
  );
};

