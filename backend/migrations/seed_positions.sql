INSERT INTO positions (name, description)
SELECT * FROM (
  SELECT 'Accounts Assistant' AS name, NULL AS description UNION ALL
  SELECT 'Assistant Product Owner', NULL UNION ALL
  SELECT 'Associate Solution Consultant 1', NULL UNION ALL
  SELECT 'Associate Solution Consultant 2', NULL UNION ALL
  SELECT 'Associate Support Analyst 1', NULL UNION ALL
  SELECT 'Associate System Engineer', NULL UNION ALL
  SELECT 'Business Analyst', NULL UNION ALL
  SELECT 'Business Analyst Intern', NULL UNION ALL
  SELECT 'CCO', NULL UNION ALL
  SELECT 'CEO', NULL UNION ALL
  SELECT 'CoE Manager', NULL UNION ALL
  SELECT 'CPO', NULL UNION ALL
  SELECT 'CTO', NULL UNION ALL
  SELECT 'Customer Management', NULL UNION ALL
  SELECT 'Delivery Lead', NULL UNION ALL
  SELECT 'Director', NULL UNION ALL
  SELECT 'DMS Engineer', NULL UNION ALL
  SELECT 'Driver', NULL UNION ALL
  SELECT 'Engineering Manager', NULL UNION ALL
  SELECT 'Entry Business Analyst', NULL UNION ALL
  SELECT 'Entry Level 1', NULL UNION ALL
  SELECT 'Entry Level 2', NULL UNION ALL
  SELECT 'Entry Level 3', NULL UNION ALL
  SELECT 'Entry Software Engineer 1', NULL UNION ALL
  SELECT 'Entry Software Engineer 2', NULL UNION ALL
  SELECT 'Entry Software Engineer 3', NULL UNION ALL
  SELECT 'Entry System Engineer 1', NULL UNION ALL
  SELECT 'Entry System Engineer 2', NULL UNION ALL
  SELECT 'Entry System Engineer 3', NULL UNION ALL
  SELECT 'Finance Manager', NULL UNION ALL
  SELECT 'HOD Projects', NULL UNION ALL
  SELECT 'Hospitality Personnel', NULL UNION ALL
  SELECT 'HR & Executive Support', NULL UNION ALL
  SELECT 'HR Admin', NULL UNION ALL
  SELECT 'Infrastructure Intern', NULL UNION ALL
  SELECT 'Intern-Engineering', NULL UNION ALL
  SELECT 'Intern-Support', NULL UNION ALL
  SELECT 'Marketing Executive', NULL UNION ALL
  SELECT 'Operations Lead', NULL UNION ALL
  SELECT 'Operations Manager', NULL UNION ALL
  SELECT 'Product Owner', NULL UNION ALL
  SELECT 'Products Manager', NULL UNION ALL
  SELECT 'Project Coordinator', NULL UNION ALL
  SELECT 'Project Manager', NULL UNION ALL
  SELECT 'PSM Manager', NULL UNION ALL
  SELECT 'QA Associate Analyst', NULL UNION ALL
  SELECT 'Sales Development Representative', NULL UNION ALL
  SELECT 'Sales Executive', NULL UNION ALL
  SELECT 'Senior Software Engineer', NULL UNION ALL
  SELECT 'Software Engineer', NULL UNION ALL
  SELECT 'Solution Consultant 1', NULL UNION ALL
  SELECT 'Solution Consultant 3', NULL UNION ALL
  SELECT 'Solution Owner', NULL UNION ALL
  SELECT 'Support Analyst 1', NULL UNION ALL
  SELECT 'Support Analyst 2', NULL UNION ALL
  SELECT 'Support Analyst 3', NULL UNION ALL
  SELECT 'Support Intern', NULL UNION ALL
  SELECT 'System Architect', NULL UNION ALL
  SELECT 'System Engineer', NULL UNION ALL
  SELECT 'System Engineer Intern', NULL UNION ALL
  SELECT 'Team Lead System Engineer', NULL UNION ALL
  SELECT 'Technical Lead', NULL UNION ALL
  SELECT 'UX Designer', NULL
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM positions p WHERE p.name = tmp.name
);

