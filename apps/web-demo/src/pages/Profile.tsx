import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/auth/AuthContext';
import { getUserProfile, updateUserName, type UserProfile } from '@/api/auth';

export const Profile = () => {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user?.userId) {
        try {
          const userProfile = await getUserProfile(session.user.userId);
          setProfile(userProfile);
          setName(userProfile.name || '');
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          setError('Failed to load profile');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [session?.user?.userId]);

  const handleEditClick = () => {
    setEditing(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setName(profile?.name || '');
    setError(null);
  };

  const validateName = (value: string): string | null => {
    if (!value || value.trim().length === 0) {
      return 'Name cannot be empty';
    }
    if (value.length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (value.length > 100) {
      return 'Name must be 100 characters or less';
    }
    return null;
  };

  const handleSaveName = async () => {
    if (!session?.user?.userId) return;

    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const updatedProfile = await updateUserName(session.user.userId, name);
      setProfile(updatedProfile);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <Header />
          <div className="text-center py-12">
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <Header />

        <main role="main">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile Settings</h1>

          {success && (
            <div 
              className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6"
              data-testid="success-message"
              role="alert"
            >
              <p className="text-green-800">Profile updated successfully!</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-4 border-b border-gray-200">
                <span className="text-gray-600">Account Status</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-200">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium text-gray-900">November 2, 2025</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-gray-600">Plan Type</span>
                <span className="font-medium text-gray-900 capitalize" data-testid="profile-plan">
                  {profile?.plan || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  data-testid="profile-email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={profile?.userId || ''}
                  disabled
                  data-testid="profile-user-id"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 font-mono text-sm"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                {editing ? (
                  <div>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="profile-name-input"
                      className={`w-full px-4 py-3 border ${
                        error ? 'border-red-500' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-fintech-accent focus:border-transparent`}
                      placeholder="Enter your full name"
                    />
                    {error && (
                      <p className="mt-1 text-sm text-red-600" data-testid="name-error">
                        {error}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-gray-500">
                      Your full name as it appears on official documents
                    </p>
                  </div>
                ) : (
                  <div
                    data-testid="profile-name-display"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                  >
                    {profile?.name || 'Not set'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Security & Privacy</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-4 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <span className="text-sm text-gray-500">Not enabled</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">Password</p>
                  <p className="text-sm text-gray-500">Last changed 30 days ago</p>
                </div>
                <button className="text-sm text-fintech-accent hover:text-blue-700">
                  Change
                </button>
              </div>
              <div className="flex justify-between items-center py-4">
                <div>
                  <p className="font-medium text-gray-900">Login History</p>
                  <p className="text-sm text-gray-500">View recent login activity</p>
                </div>
                <button className="text-sm text-fintech-accent hover:text-blue-700">
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Preferences</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Email Notifications
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-fintech-accent" defaultChecked />
                    <span className="ml-3 text-sm text-gray-700">Account updates</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-fintech-accent" defaultChecked />
                    <span className="ml-3 text-sm text-gray-700">Credit score changes</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-fintech-accent" />
                    <span className="ml-3 text-sm text-gray-700">Marketing emails</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Language
                </label>
                <select className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white">
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Spanish</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 mb-6" data-testid="actions-section">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Actions</h2>

            <div className="space-y-4">
              {editing ? (
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    data-testid="save-name-button"
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                      saving
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-fintech-accent text-white hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    data-testid="cancel-edit-button"
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEditClick}
                  data-testid="edit-name-button"
                  className="w-full px-6 py-3 bg-fintech-accent text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  Edit Name
                </button>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-medium text-blue-900 mb-2">Privacy Notice</h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              Your personal information is encrypted and stored securely. We never share your data 
              with third parties without your explicit consent. For more information, please review 
              our Privacy Policy and Terms of Service.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

