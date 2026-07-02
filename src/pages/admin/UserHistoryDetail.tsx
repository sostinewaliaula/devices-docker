import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  UsersIcon,
  MonitorIcon,
  TicketIcon,
  ClipboardListIcon,
  HistoryIcon
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { userService } from '../../services/apiDatabase';
import { AssetAssignmentHistoryEntry, AssetRequest, Issue, UserHistoryDetail as UserHistoryDetailType, AssetIssueEventEntry } from '../../lib/supabase';

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const capitalize = (value?: string | null) => {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const UserHistoryDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { addToast } = useNotifications();
  const [history, setHistory] = useState<UserHistoryDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const payload = await userService.getHistoryDetail(userId);
      setHistory(payload);
    } catch (error: any) {
      console.error('Failed to load user history detail:', error);
      addToast({
        title: 'Error loading history',
        message: error?.response?.data?.message || 'Unable to fetch user history right now.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [userId, addToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const summaryStats = useMemo(() => {
    if (!history) {
      return {
        assignments: 0,
        issuesReported: 0,
        issuesAssigned: 0,
        requests: 0,
        issueEvents: 0
      };
    }
    return {
      assignments: history.assignments.length,
      issuesReported: history.reportedIssues.length,
      issuesAssigned: history.assignedIssues.length,
      requests: history.assetRequests.length,
      issueEvents: history.issueEvents.length
    };
  }, [history]);

  if (!userId) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <p className="text-red-500">User identifier is missing.</p>
      </div>
    );
  }

  const user = history?.user;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/admin/users/history"
          className="inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to list
        </Link>
        <h1 className="text-3xl font-bold text-primary">User History Detail</h1>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600 dark:text-gray-300">
            <UsersIcon className="w-10 h-10 animate-spin mb-3 text-primary" />
            Loading history...
          </div>
        ) : !user ? (
          <div className="text-center text-gray-600 dark:text-gray-300">Unable to find user details.</div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">User</p>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{user.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
                <p className="text-xs text-gray-400">
                  {user.position || 'No position'} • {user.department_name || 'No department'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
                <SummaryBadge icon={<MonitorIcon className="w-4 h-4" />} label="Assignments" value={summaryStats.assignments.toString()} />
                <SummaryBadge icon={<TicketIcon className="w-4 h-4" />} label="Issues raised" value={summaryStats.issuesReported.toString()} />
                <SummaryBadge icon={<TicketIcon className="w-4 h-4" />} label="Assigned issues" value={summaryStats.issuesAssigned.toString()} />
                <SummaryBadge icon={<ClipboardListIcon className="w-4 h-4" />} label="Asset requests" value={summaryStats.requests.toString()} />
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

      {!loading && history && (
        <>
          <Section title="Device Assignment History" icon={<MonitorIcon className="w-4 h-4 text-primary" />} emptyMessage="No assignment history yet.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Asset</th>
                    <th className="px-4 py-2 text-left">Assignment</th>
                    <th className="px-4 py-2 text-left">Performed by</th>
                    <th className="px-4 py-2 text-left">Department</th>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {history.assignments.map((assignment: AssetAssignmentHistoryEntry) => (
                    <tr key={assignment.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{assignment.asset_name || 'Unknown asset'}</div>
                        <div className="text-xs text-gray-500">{assignment.asset_serial || 'No serial'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-lightred text-primary">
                          {capitalize(assignment.assignment_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{assignment.assigned_by_name || 'System'}</td>
                      <td className="px-4 py-3">{assignment.department_name || '—'}</td>
                      <td className="px-4 py-3">{formatDateTime(assignment.assignment_type === 'return' ? assignment.returned_at : assignment.assigned_at)}</td>
                      <td className="px-4 py-3 whitespace-pre-line">{assignment.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Issues Reported" icon={<TicketIcon className="w-4 h-4 text-primary" />} emptyMessage="No issues reported yet.">
            <IssueList issues={history.reportedIssues} />
          </Section>

          <Section title="Issues Assigned to User" icon={<TicketIcon className="w-4 h-4 text-primary" />} emptyMessage="No issues assigned to this user.">
            <IssueList issues={history.assignedIssues} />
          </Section>

          <Section title="Asset Requests" icon={<ClipboardListIcon className="w-4 h-4 text-primary" />} emptyMessage="No asset requests submitted.">
            <AssetRequestList requests={history.assetRequests} />
          </Section>

          <Section title="Issue Activity" icon={<HistoryIcon className="w-4 h-4 text-primary" />} emptyMessage="No issue events recorded.">
            <IssueEventList events={history.issueEvents} />
          </Section>
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; emptyMessage: string; children: React.ReactNode }> = ({
  title,
  icon,
  emptyMessage,
  children
}) => {
  const isEmpty = React.Children.toArray(children).length === 0 || (Array.isArray(children) && children.length === 0);
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {icon}
        {title}
      </div>
      {isEmpty ? <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p> : children}
    </div>
  );
};

const IssueList: React.FC<{ issues: Issue[] }> = ({ issues }) => {
  if (!issues.length) return null;
  return (
    <div className="space-y-4">
      {issues.map(issue => (
        <div key={issue.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{issue.title}</span>
            <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
              {issue.status}
            </span>
            <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs uppercase tracking-wide">
              {issue.priority}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{issue.description || 'No description provided.'}</p>
          <div className="mt-2 text-xs text-gray-400">
            Created: {formatDateTime(issue.created_at)} • Updated: {formatDateTime(issue.updated_at)}
          </div>
        </div>
      ))}
    </div>
  );
};

const AssetRequestList: React.FC<{ requests: AssetRequest[] }> = ({ requests }) => {
  if (!requests.length) return null;
  return (
    <div className="grid gap-4">
      {requests.map(request => (
        <div key={request.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{request.asset_name || 'Asset request'}</span>
            <span className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide">
              {request.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{request.reason || 'No reason provided.'}</p>
          <div className="text-xs text-gray-400 mt-2">
            Requested: {formatDateTime(request.requested_date)} • Approved: {formatDateTime(request.approved_date)}
          </div>
        </div>
      ))}
    </div>
  );
};

const IssueEventList: React.FC<{ events: AssetIssueEventEntry[] }> = ({ events }) => {
  if (!events.length) return null;
  return (
    <ol className="relative border-l border-gray-200 dark:border-gray-800">
      {events.map(event => (
        <li key={event.id} className="ml-6 mb-6 last:mb-0">
          <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
            <HistoryIcon className="w-3.5 h-3.5" />
          </span>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wide text-primary">{event.event_type}</span>
            <span>{formatDateTime(event.occurred_at)}</span>
          </div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">{event.summary}</h4>
          {event.details && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{event.details}</p>}
        </li>
      ))}
    </ol>
  );
};

const SummaryBadge: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2">
    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  </div>
);

export default UserHistoryDetail;

