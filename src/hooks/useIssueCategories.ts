import { useCallback, useEffect, useMemo, useState } from 'react';
import { issueCategoryService } from '../services/apiDatabase';
import { IssueCategory } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';

export const useIssueCategories = (options?: { includeInactive?: boolean }) => {
  const { includeInactive = false } = options || {};
  const { addToast } = useNotifications();
  const [issueCategories, setIssueCategories] = useState<IssueCategory[]>([]);
  const [loadingIssueCategories, setLoadingIssueCategories] = useState(true);

  const loadIssueCategories = useCallback(async () => {
    try {
      setLoadingIssueCategories(true);
      const data = await issueCategoryService.getAll(includeInactive);
      setIssueCategories(data);
    } catch (error: any) {
      console.error('Failed to load issue categories:', error);
      addToast({
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to load issue categories',
        type: 'error'
      });
    } finally {
      setLoadingIssueCategories(false);
    }
  }, [addToast, includeInactive]);

  useEffect(() => {
    loadIssueCategories();
  }, [loadIssueCategories]);

  const activeIssueCategories = useMemo(
    () => issueCategories.filter(category => category.is_active),
    [issueCategories]
  );

  return {
    issueCategories,
    activeIssueCategories,
    loadingIssueCategories,
    reloadIssueCategories: loadIssueCategories
  };
};

export default useIssueCategories;

