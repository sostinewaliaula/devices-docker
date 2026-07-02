import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, MapPinIcon, RefreshCwIcon, UserIcon, HistoryIcon, ClockIcon, AlertTriangleIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { assetService } from '../../services/apiDatabase';
import { AssetHistoryPayload, AssetAssignmentHistoryEntry, AssetIssueEventEntry } from '../../lib/supabase';

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const capitalize = (value?: string | null) => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const AssetHistoryDetail: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const { addToast } = useNotifications();
  const [history, setHistory] = useState<AssetHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!assetId) return;
    try {
      setLoading(true);
      const payload = await assetService.getHistory(assetId);
      setHistory(payload);
    } catch (error: any) {
      console.error('Failed to load asset history detail:', error);
      addToast({
        title: 'Error loading history',
        message: error?.response?.data?.message || 'Unable to fetch asset history right now.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [assetId, addToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const asset = history?.asset;

  const combinedTimeline = useMemo(() => {
    if (!history) return [];

    const assignmentEntries = history.assignments.map(entry => ({
      id: entry.id,
      category: 'Assignment' as const,
      occurredAt: entry.assignment_type === 'return' && entry.returned_at ? entry.returned_at : entry.assigned_at,
      summary: `${capitalize(entry.assignment_type)} ${entry.user_name ? entry.user_name : 'asset'}`,
      details: entry.notes || '',
      meta: entry
    }));

    const issueEntries = history.issueEvents.map(entry => ({
      id: entry.id,
      category: 'Issue' as const,
      occurredAt: entry.occurred_at,
      summary: entry.summary,
      details: entry.details || '',
      meta: entry
    }));

    return [...assignmentEntries, ...issueEntries].sort((a, b) => {
      const dateA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const dateB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [history]);

  if (!assetId) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <p className="text-red-500">Asset identifier is missing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/assets/history"
          className="inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to list
        </Link>
        <h1 className="text-3xl font-bold text-primary">Asset History Detail</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600 dark:text-gray-300">
            <HistoryIcon className="w-10 h-10 animate-spin mb-3 text-primary" />
            Loading history...
          </div>
        ) : !asset ? (
          <div className="text-center text-gray-600 dark:text-gray-300">
            Unable to find asset details.
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">Asset</p>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{asset.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">{asset.serial_number || 'Serial not recorded'}</p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-primary" />
                  Owner: {asset.assigned_user_name || 'Unassigned'}
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-primary" />
                  Location: {asset.location || 'Not specified'}
                </div>
              </div>
            </div>
            <button
              onClick={loadHistory}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCwIcon className="w-4 h-4 mr-2" />
              Refresh history
            </button>
          </>
        )}
      </div>

      {!loading && asset && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Timeline</h3>
            {combinedTimeline.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No recorded history yet.</p>
            ) : (
              <ol className="relative border-l border-gray-200 dark:border-gray-800">
                {combinedTimeline.map(entry => (
                  <li key={entry.id} className="ml-6 mb-6 last:mb-0">
                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                      {entry.category === 'Assignment' ? <UserIcon className="w-3.5 h-3.5" /> : <AlertTriangleIcon className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold uppercase tracking-wide text-primary">{entry.category}</span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {formatDateTime(entry.occurredAt)}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">{entry.summary}</h4>
                    {entry.details && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{entry.details}</p>}

                    {entry.category === 'Assignment' ? (
                      <AssignmentMetadata assignment={entry.meta as AssetAssignmentHistoryEntry} />
                    ) : (
                      <IssueMetadata issue={entry.meta as AssetIssueEventEntry} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const AssignmentMetadata: React.FC<{ assignment: AssetAssignmentHistoryEntry }> = ({ assignment }) => (
  <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Assigned to:</span>{' '}
      {assignment.user_name || 'Unassigned'}
    </div>
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Performed by:</span>{' '}
      {assignment.assigned_by_name || 'System'}
    </div>
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Department:</span>{' '}
      {assignment.department_name || 'Not set'}
    </div>
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Assignment type:</span>{' '}
      {capitalize(assignment.assignment_type)}
    </div>
    {assignment.condition_on_assign && (
      <div>
        <span className="font-medium text-gray-900 dark:text-gray-100">Condition on assign:</span>{' '}
        {capitalize(assignment.condition_on_assign)}
      </div>
    )}
    {assignment.condition_on_return && (
      <div>
        <span className="font-medium text-gray-900 dark:text-gray-100">Condition on return:</span>{' '}
        {capitalize(assignment.condition_on_return)}
      </div>
    )}
  </div>
);

const IssueMetadata: React.FC<{ issue: AssetIssueEventEntry }> = ({ issue }) => (
  <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Issue:</span>{' '}
      {issue.issue_title || issue.issue_id}
    </div>
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Event:</span>{' '}
      {capitalize(issue.event_type)}
    </div>
    <div>
      <span className="font-medium text-gray-900 dark:text-gray-100">Status:</span>{' '}
      {issue.status ? capitalize(issue.status) : 'Not specified'}
    </div>
    {issue.issue_priority && (
      <div>
        <span className="font-medium text-gray-900 dark:text-gray-100">Priority:</span>{' '}
        {capitalize(issue.issue_priority)}
      </div>
    )}
  </div>
);

export default AssetHistoryDetail;

