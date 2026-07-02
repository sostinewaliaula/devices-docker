import { Link } from 'react-router-dom';
import { ShieldIcon, ArrowLeftIcon, LockIcon, EyeIcon, DatabaseIcon, UserIcon, BellIcon, TrashIcon, MailIcon, RefreshCwIcon } from 'lucide-react';
import { useBranding } from '../../contexts/BrandingContext';
import ThemeToggle from '../../components/ui/ThemeToggle';

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-secondary dark:text-white m-0">{title}</h2>
    </div>
    <div className="pl-12 space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      {children}
    </div>
  </section>
);

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
    <span>{children}</span>
  </li>
);

const PrivacyPolicy = () => {
  const { siteName, logoUrl } = useBranding();
  const effectiveDate = 'May 5, 2025';

  return (
    <div className="min-h-screen bg-lightred dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </Link>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt={siteName} className="h-7 w-auto" />
              <span className="font-bold text-primary text-sm hidden sm:block">{siteName}</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 mb-5">
            <ShieldIcon className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-secondary dark:text-white mb-3">Privacy Policy</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Effective date: <span className="font-semibold text-gray-700 dark:text-gray-300">{effectiveDate}</span></p>
          <div className="mt-4 inline-block px-4 py-2 rounded-full bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold tracking-wide uppercase">
            {siteName}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 p-8 md:p-12">

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-10 pb-8 border-b border-gray-100 dark:border-gray-800">
            Welcome to <strong className="text-secondary dark:text-white">{siteName}</strong>. We are committed to protecting the personal information
            of our users and handling it with transparency, integrity, and care. This Privacy Policy explains what data we collect,
            how we use it, who we share it with, and the rights you have over your information when you use our asset management platform.
          </p>

          <Section icon={UserIcon} title="1. Information We Collect">
            <p>We collect the following categories of personal information when you use {siteName}:</p>
            <ul className="space-y-2 mt-3">
              <Bullet><strong>Account Information:</strong> Your full name, email address, job position, and department when you register or update your profile.</Bullet>
              <Bullet><strong>Authentication Data:</strong> Password hashes (never stored in plain text), Google OAuth identifiers if you sign in with Google, and multi-factor authentication (MFA) secrets.</Bullet>
              <Bullet><strong>Usage Data:</strong> Pages visited, actions performed (asset assignments, issue reports, requests), timestamps, and session durations.</Bullet>
              <Bullet><strong>Device & Network Data:</strong> IP address, browser type, operating system, and user-agent string collected automatically for security and audit purposes.</Bullet>
              <Bullet><strong>Asset & Operational Data:</strong> Records of assets assigned to you, maintenance requests, issues raised, and asset request history.</Bullet>
              <Bullet><strong>Communication Preferences:</strong> Your notification settings and email subscription preferences.</Bullet>
            </ul>
          </Section>

          <Section icon={DatabaseIcon} title="2. How We Use Your Information">
            <p>Your data is used exclusively to operate and improve {siteName}. Specifically we use it to:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Authenticate your identity and maintain the security of your account.</Bullet>
              <Bullet>Provide you with access to assets, requests, and issues relevant to your role and department.</Bullet>
              <Bullet>Send transactional emails such as password resets, assignment notifications, and weekly digests, based on your notification preferences.</Bullet>
              <Bullet>Generate audit logs for compliance, accountability, and internal governance purposes.</Bullet>
              <Bullet>Allow administrators and managers to manage departments, assign assets, and review usage.</Bullet>
              <Bullet>Improve platform reliability, diagnose technical issues, and analyse aggregate usage patterns.</Bullet>
              <Bullet>Enforce our Terms of Service and protect against fraudulent or unauthorised access.</Bullet>
            </ul>
            <p className="mt-3">We do <strong>not</strong> use your data for advertising, sell it to third parties, or use it for profiling unrelated to the operation of this platform.</p>
          </Section>

          <Section icon={EyeIcon} title="3. Legal Basis for Processing">
            <p>We process your personal data on the following legal grounds:</p>
            <ul className="space-y-2 mt-3">
              <Bullet><strong>Contract:</strong> Processing is necessary to provide the service you have registered for.</Bullet>
              <Bullet><strong>Legitimate Interests:</strong> Security logging, fraud prevention, and system reliability.</Bullet>
              <Bullet><strong>Consent:</strong> Where you have explicitly opted in, such as enabling email notifications or MFA.</Bullet>
              <Bullet><strong>Legal Obligation:</strong> Where we are required by applicable law to retain or process certain data.</Bullet>
            </ul>
          </Section>

          <Section icon={LockIcon} title="4. Data Security">
            <p>We take the security of your data seriously and implement the following measures:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>All passwords are hashed using <strong>bcrypt</strong> with a minimum of 10 salt rounds — plain-text passwords are never stored.</Bullet>
              <Bullet>All data in transit is protected using <strong>TLS/HTTPS</strong> encryption.</Bullet>
              <Bullet>Authentication uses signed <strong>JSON Web Tokens (JWT)</strong> with a configurable expiry.</Bullet>
              <Bullet>Optional <strong>TOTP-based multi-factor authentication</strong> (compatible with Google Authenticator, Authy, and similar apps) is available and encouraged.</Bullet>
              <Bullet>Role-based access control (RBAC) ensures users can only access data within their permitted scope.</Bullet>
              <Bullet>All sensitive admin actions are recorded in an immutable audit log with timestamps, IP addresses, and actor identities.</Bullet>
              <Bullet>Rate limiting is applied to authentication endpoints to mitigate brute-force attacks.</Bullet>
            </ul>
            <p className="mt-3">Despite these measures, no system is completely immune to breaches. We will notify affected users promptly in the event of a data incident.</p>
          </Section>

          <Section icon={RefreshCwIcon} title="5. Data Sharing & Third Parties">
            <p>We do not sell, rent, or trade your personal information. We may share limited data with the following parties:</p>
            <ul className="space-y-2 mt-3">
              <Bullet><strong>Google (OAuth):</strong> If you choose to sign in with Google, we receive your name, email address, and Google account identifier from Google's Identity Services. Google's use of this data is governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">Google's Privacy Policy</a>.</Bullet>
              <Bullet><strong>Email Service Provider:</strong> Your email address is used to send transactional notifications through our configured SMTP provider. No marketing emails are sent without your explicit consent.</Bullet>
              <Bullet><strong>Administrators:</strong> Your name, email, position, department, and activity logs are visible to authorised administrators and managers within your organisation.</Bullet>
              <Bullet><strong>Legal Authorities:</strong> We may disclose data where required by law, court order, or to protect the rights and safety of users.</Bullet>
            </ul>
          </Section>

          <Section icon={DatabaseIcon} title="6. Data Retention">
            <ul className="space-y-2">
              <Bullet><strong>Account data</strong> is retained for as long as your account is active and for a reasonable period after deactivation for audit continuity.</Bullet>
              <Bullet><strong>Audit logs</strong> are retained for a minimum of 12 months to support compliance and governance requirements.</Bullet>
              <Bullet><strong>Password reset tokens</strong> expire after 15 minutes and are purged from the database thereafter.</Bullet>
              <Bullet><strong>Backup data</strong> is retained according to the backup schedule configured by your administrator and is purged after the retention window.</Bullet>
            </ul>
          </Section>

          <Section icon={UserIcon} title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="space-y-2 mt-3">
              <Bullet><strong>Access:</strong> Request a copy of the personal data we hold about you.</Bullet>
              <Bullet><strong>Rectification:</strong> Correct inaccurate or incomplete profile information at any time via your profile settings.</Bullet>
              <Bullet><strong>Erasure:</strong> Request deletion of your account and associated personal data (subject to legal retention obligations).</Bullet>
              <Bullet><strong>Restriction:</strong> Ask us to limit how your data is used in certain circumstances.</Bullet>
              <Bullet><strong>Portability:</strong> Request your personal data in a structured, machine-readable format.</Bullet>
              <Bullet><strong>Objection:</strong> Object to processing carried out on the basis of legitimate interests.</Bullet>
              <Bullet><strong>Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of prior processing.</Bullet>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact your system administrator or reach out via the contact details below.</p>
          </Section>

          <Section icon={BellIcon} title="8. Cookies & Local Storage">
            <p>{siteName} does not use tracking cookies. We use browser <strong>localStorage</strong> to store:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Your authentication token (JWT) — cleared on logout.</Bullet>
              <Bullet>Your theme preference (light/dark/system).</Bullet>
              <Bullet>Your cached user profile for faster page loads.</Bullet>
            </ul>
            <p className="mt-3">None of this data is shared with advertising networks or analytics platforms.</p>
          </Section>

          <Section icon={TrashIcon} title="9. Children's Privacy">
            <p>
              {siteName} is an enterprise asset management platform intended for use by employees and authorised personnel within an organisation.
              It is not directed at children under the age of 16. We do not knowingly collect personal information from minors.
              If you believe a minor has provided us with personal data, please contact us immediately.
            </p>
          </Section>

          <Section icon={RefreshCwIcon} title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements.
              When we do, we will update the effective date at the top of this page. Material changes will be communicated to users via
              an in-app notification or email. Continued use of the platform after changes are posted constitutes your acceptance of the revised policy.
            </p>
          </Section>

          <Section icon={MailIcon} title="11. Contact Us">
            <p>If you have any questions, concerns, or requests regarding this Privacy Policy or how your data is handled, please contact:</p>
            <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1">
              <p className="font-bold text-secondary dark:text-white">{siteName}</p>
              <p>Data Privacy Team</p>
              <p>Email: <a href="mailto:privacy@caavagroup.com" className="text-primary underline hover:opacity-80">privacy@caavagroup.com</a></p>
            </div>
          </Section>

          {/* Footer nav */}
          <div className="pt-8 mt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
            <div className="flex gap-4">
              <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Back to Login</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
