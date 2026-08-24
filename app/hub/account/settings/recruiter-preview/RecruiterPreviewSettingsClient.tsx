'use client';

import { useEffect, useState } from 'react';
import { RecruiterpPreviewRoleConfig } from './RecruiterpPreviewRoleConfig';

export default function RecruiterPreviewSettingsClient({
  initialEnabled,
  initialLinkedinUrl,
}: {
  initialEnabled: boolean;
  initialLinkedinUrl: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveState === 'saved') {
        setSaveState('idle');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  async function handleSaveSettings() {
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/hub/recruiter-preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          linkedinUrl: linkedinUrl || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error ?? 'Error saving settings');
        setSaveState('error');
        return;
      }

      setSaveState('saved');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Unknown error');
      setSaveState('error');
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 md:p-8">
      <h1 className="text-2xl font-semibold mb-8">Recruiter Preview Settings</h1>

      {/* Enable/Disable Section */}
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Preview Status</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Allow recruiters to view your profile</p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="mr-3"
            />
            <span className="text-sm">{enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>

      {/* LinkedIn URL Section */}
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">LinkedIn Profile</h2>
        <p className="text-sm text-gray-600 mb-4">Optional: Share your LinkedIn profile URL</p>
        <input
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={linkedinUrl}
          onChange={e => setLinkedinUrl(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* Save Button */}
      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={handleSaveSettings}
          disabled={saveState === 'saving'}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saveState === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
        {saveState === 'saved' && (
          <span className="text-sm text-green-600">Saved!</span>
        )}
        {saveState === 'error' && (
          <span className="text-sm text-red-600">{errorMessage || 'Error saving'}</span>
        )}
      </div>

      {/* Application Visibility Section */}
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">Application Visibility</h2>
        {enabled ? (
          <RecruiterpPreviewRoleConfig />
        ) : (
          <p className="text-gray-500">Enable recruiter preview above to configure application visibility.</p>
        )}
      </div>
    </main>
  );
}
