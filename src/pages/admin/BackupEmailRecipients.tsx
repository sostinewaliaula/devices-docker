import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const BackupEmailRecipients: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Backup Management page
    navigate('/admin/backup-management', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to Backup Management...</p>
      </div>
    </div>
  );
};

export default BackupEmailRecipients;
