import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/auth/AuthContext';
import { getCreditReport, type CreditReport as CreditReportType } from '@/api/auth';

export const CreditReport = () => {
  const { session } = useAuth();
  const [creditReport, setCreditReport] = useState<CreditReportType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreditReport = async () => {
      if (!session?.user?.userId) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const report = await getCreditReport(session.user.userId);
        setCreditReport(report);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch credit report:', err);
        setError('Failed to load credit report');
      } finally {
        setLoading(false);
      }
    };

    fetchCreditReport();
  }, [session?.user?.userId]);

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
        <Header />

        <main role="main">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Credit Report</h1>

        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Credit Score Overview</h2>
            {loading ? (
              <div className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-12">
                <div className="text-center text-gray-600">Loading credit score...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center bg-red-50 rounded-lg p-12">
                <div className="text-center text-red-600">{error}</div>
              </div>
            ) : creditReport ? (
              <div
                data-testid="credit-score-chart"
                className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-12"
                role="img"
                aria-label={`Credit score chart showing score of ${creditReport.creditScore}`}
              >
                <div className="text-center">
                  <div className="text-7xl font-bold text-fintech-accent mb-2">{creditReport.creditScore}</div>
                  <div className="text-lg text-gray-600 mb-4">{creditReport.scoreRating}</div>
                  <div className="flex items-center justify-center gap-8 text-sm">
                    <div className="text-center">
                      <div className="text-gray-500">MIN</div>
                      <div className="font-semibold text-gray-700">300</div>
                    </div>
                    <div className="w-48 h-3 bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 to-emerald-500 rounded-full"></div>
                    <div className="text-center">
                      <div className="text-gray-500">MAX</div>
                      <div className="font-semibold text-gray-700">999</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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

