import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/auth/AuthContext';
import { getCreditLockStatus, toggleCreditLock, getCreditReport, type CreditReport } from '@/api/auth';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [creditLocked, setCreditLocked] = useState<boolean>(false);
  const [isLoadingLockStatus, setIsLoadingLockStatus] = useState<boolean>(true);
  const [creditReport, setCreditReport] = useState<CreditReport | null>(null);
  const [isLoadingCreditScore, setIsLoadingCreditScore] = useState<boolean>(true);

  useEffect(() => {
    const fetchCreditLockStatus = async () => {
      if (session?.user?.userId) {
        try {
          const status = await getCreditLockStatus(session.user.userId);
          setCreditLocked(status);
        } catch (error) {
          console.error('Failed to fetch credit lock status:', error);
        } finally {
          setIsLoadingLockStatus(false);
        }
      }
    };

    const fetchCreditScore = async () => {
      if (session?.user?.userId) {
        try {
          const report = await getCreditReport(session.user.userId);
          setCreditReport(report);
        } catch (error) {
          console.error('Failed to fetch credit report:', error);
        } finally {
          setIsLoadingCreditScore(false);
        }
      }
    };

    fetchCreditLockStatus();
    fetchCreditScore();
  }, [session?.user?.userId]);

  const handleToggleCreditLock = async () => {
    if (!session?.user?.userId) return;

    try {
      const newStatus = await toggleCreditLock(session.user.userId);
      setCreditLocked(newStatus);
    } catch (error) {
      console.error('Failed to toggle credit lock:', error);
    }
  };

  const navigationTiles = [
    {
      id: 'credit-report',
      testId: 'view-credit-report',
      title: 'Credit Report',
      description: 'View your detailed credit report',
      icon: '📊',
      action: () => navigate('/credit-report'),
      enabled: true,
    },
    {
      id: 'loans',
      testId: 'view-loans',
      title: 'Loans',
      description: 'Find and apply for loans',
      icon: '💰',
      action: () => navigate('/loans'),
      enabled: true,
    },
    {
      id: 'disputes',
      testId: 'view-disputes',
      title: 'Disputes',
      description: 'File or track disputes',
      icon: '⚖️',
      action: () => {},
      enabled: false,
    },
    {
      id: 'alerts',
      testId: 'view-alerts',
      title: 'Alerts',
      description: 'Manage your notifications',
      icon: '🔔',
      action: () => {},
      enabled: false,
    },
    {
      id: 'offers',
      testId: 'view-offers',
      title: 'Offers',
      description: 'Personalized credit offers',
      icon: '💳',
      action: () => {},
      enabled: false,
    },
    {
      id: 'help',
      testId: 'view-help',
      title: 'Help Center',
      description: 'Get support and answers',
      icon: '❓',
      action: () => {},
      enabled: false,
    },
    {
      id: 'privacy',
      testId: 'view-privacy',
      title: 'Privacy',
      description: 'Privacy settings and policies',
      icon: '🔒',
      action: () => {},
      enabled: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <Header />

        <main role="main">
        <div className="mb-8">
          <div className="bg-gradient-to-r from-fintech-accent to-blue-600 rounded-xl shadow-lg p-8 text-white">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-lg font-medium opacity-90">Your Credit Score</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm opacity-90">
                  {creditLocked ? '🔒 Locked' : '🔓 Unlocked'}
                </span>
                <button
                  role="switch"
                  aria-checked={creditLocked}
                  aria-label="Credit report lock"
                  data-testid="credit-lock-toggle"
                  onClick={handleToggleCreditLock}
                  disabled={isLoadingLockStatus}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${creditLocked ? 'bg-white/30' : 'bg-white/50'}
                    ${isLoadingLockStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/60'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${creditLocked ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
            {isLoadingCreditScore ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl opacity-75">Loading...</span>
              </div>
            ) : creditReport ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-bold">{creditReport.creditScore}</span>
                  <span className="text-2xl opacity-75">/ 999</span>
                </div>
                <p className="mt-4 text-sm opacity-90">{creditReport.scoreRating} - Last updated today</p>
              </>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl opacity-75">Unable to load credit score</span>
              </div>
            )}
          </div>
        </div>

        <nav role="navigation" aria-label="Main navigation">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {navigationTiles.map((tile) => (
              <button
                key={tile.id}
                data-testid={tile.testId}
                aria-label={tile.title}
                onClick={tile.action}
                disabled={!tile.enabled}
                className={`
                  bg-white rounded-lg shadow-md p-6 text-left transition duration-200
                  ${tile.enabled 
                    ? 'hover:shadow-xl hover:scale-105 cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <div className="text-4xl mb-3">{tile.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{tile.title}</h3>
                <p className="text-sm text-gray-600">{tile.description}</p>
                {!tile.enabled && (
                  <span className="inline-block mt-2 text-xs text-gray-500">Coming soon</span>
                )}
              </button>
            ))}
          </div>
        </nav>
        </main>
      </div>
    </div>
  );
};

