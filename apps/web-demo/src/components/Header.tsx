import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', testId: 'nav-dashboard' },
    { path: '/credit-report', label: 'Credit Report', testId: 'nav-credit-report' },
    { path: '/loans', label: 'Loans', testId: 'nav-loans' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 mb-8 rounded-lg py-4 px-6" role="banner">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-gray-900">FinTech Demo</h1>
          <nav className="flex gap-6" role="navigation" aria-label="Main navigation">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                data-testid={link.testId}
                className={`text-sm font-medium transition ${
                  isActive(link.path)
                    ? 'text-fintech-accent'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session?.user.email}</span>
          <button
            onClick={() => navigate('/profile')}
            data-testid="profile-button"
            aria-label="View profile"
            className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
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
      </div>
    </header>
  );
};

