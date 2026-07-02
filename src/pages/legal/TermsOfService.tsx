import { Link } from 'react-router-dom';
import { ScrollTextIcon, ArrowLeftIcon, UserCheckIcon, ShieldAlertIcon, GavelIcon, BanIcon, ServerIcon, AlertTriangleIcon, MailIcon, RefreshCwIcon, CheckCircleIcon } from 'lucide-react';
import { useBranding } from '../../contexts/BrandingContext';
import ThemeToggle from '../../components/ui/ThemeToggle';

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-xl bg-secondary/10 dark:bg-secondary/20 shrink-0">
        <Icon className="w-5 h-5 text-secondary dark:text-blue-400" />
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
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary dark:bg-blue-400 shrink-0" />
    <span>{children}</span>
  </li>
);

const TermsOfService = () => {
  const { siteName, logoUrl } = useBranding();
  const effectiveDate = 'May 5, 2025';

  return (
    <div className="min-h-screen bg-lightblue dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-secondary dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </Link>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt={siteName} className="h-7 w-auto" />
              <span className="font-bold text-secondary text-sm hidden sm:block dark:text-blue-400">{siteName}</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/10 dark:bg-secondary/20 mb-5">
            <ScrollTextIcon className="w-8 h-8 text-secondary dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-secondary dark:text-white mb-3">Terms of Service</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Effective date: <span className="font-semibold text-gray-700 dark:text-gray-300">{effectiveDate}</span></p>
          <div className="mt-4 inline-block px-4 py-2 rounded-full bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-blue-400 text-xs font-semibold tracking-wide uppercase">
            {siteName}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-gray-100 dark:border-gray-800 p-8 md:p-12">

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-10 pb-8 border-b border-gray-100 dark:border-gray-800">
            These Terms of Service ("Terms") govern your access to and use of <strong className="text-secondary dark:text-white">{siteName}</strong>,
            an internal enterprise asset management platform operated by the organisation that has deployed it.
            By accessing or using this platform — whether via email/password authentication or Google Sign-In —
            you agree to be bound by these Terms. If you do not agree, you must not access or use the platform.
          </p>

          <Section icon={UserCheckIcon} title="1. Eligibility & Authorised Use">
            <p>Access to {siteName} is restricted to:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Current employees, contractors, or other personnel formally authorised by the organisation.</Bullet>
              <Bullet>Users who have been granted a verified account by a system administrator.</Bullet>
              <Bullet>Users whose email domain has been approved by the organisation (where domain restrictions are configured).</Bullet>
            </ul>
            <p className="mt-3">You must be at least 18 years of age or the minimum legal working age in your jurisdiction. Accounts are personal and non-transferable. You may not share your login credentials with any other individual.</p>
          </Section>

          <Section icon={CheckCircleIcon} title="2. Account Registration & Responsibilities">
            <p>When registering for an account, you agree to:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Provide accurate, complete, and up-to-date information including your real name, position, and department.</Bullet>
              <Bullet>Keep your password confidential and not share it with others.</Bullet>
              <Bullet>Notify an administrator immediately if you suspect unauthorised access to your account.</Bullet>
              <Bullet>Update your profile information promptly when it changes (e.g. role change, department transfer).</Bullet>
              <Bullet>Enable multi-factor authentication (MFA) where required by your organisation's policy.</Bullet>
            </ul>
            <p className="mt-3">You are solely responsible for all activity that occurs under your account. The organisation and platform administrators are not liable for losses resulting from your failure to safeguard your credentials.</p>
          </Section>

          <Section icon={ServerIcon} title="3. Acceptable Use Policy">
            <p>You agree to use {siteName} only for its intended purpose of managing organisational assets, reporting issues, and submitting asset requests. You must not:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Access or attempt to access accounts, data, or systems that you are not authorised to view.</Bullet>
              <Bullet>Attempt to bypass, disable, or circumvent any security measures including authentication, rate limiting, or access controls.</Bullet>
              <Bullet>Submit false or misleading asset requests, issue reports, or profile information.</Bullet>
              <Bullet>Use the platform to store, transmit, or process data that is not related to its intended organisational purpose.</Bullet>
              <Bullet>Reverse-engineer, decompile, or attempt to extract source code from the platform.</Bullet>
              <Bullet>Introduce malware, viruses, or malicious code into the system.</Bullet>
              <Bullet>Perform automated scraping, crawling, or bulk data extraction without written authorisation.</Bullet>
              <Bullet>Interfere with or disrupt the integrity or performance of the platform or its underlying infrastructure.</Bullet>
            </ul>
          </Section>

          <Section icon={ShieldAlertIcon} title="4. Data & Privacy">
            <p>
              Your use of {siteName} is also governed by our <Link to="/privacy" className="text-primary underline hover:opacity-80">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using the platform, you consent to the collection and processing
              of your data as described therein.
            </p>
            <ul className="space-y-2 mt-3">
              <Bullet>Asset assignments, issue reports, and requests you submit are visible to administrators and relevant managers within your organisation.</Bullet>
              <Bullet>Audit logs of your actions (login times, changes, requests) are maintained for compliance purposes and accessible to administrators.</Bullet>
              <Bullet>Notification preferences you set are stored and respected; you may update them at any time in your account settings.</Bullet>
            </ul>
          </Section>

          <Section icon={GavelIcon} title="5. Intellectual Property">
            <p>
              All software, interfaces, designs, workflows, and content comprising {siteName} are the intellectual property of the
              organisation or its licensors. Nothing in these Terms grants you any ownership rights in the platform.
            </p>
            <ul className="space-y-2 mt-3">
              <Bullet>You are granted a limited, non-exclusive, non-transferable licence to use the platform solely for authorised organisational purposes.</Bullet>
              <Bullet>Data you enter (asset records, issue descriptions, request details) remains the property of the organisation.</Bullet>
              <Bullet>You may not copy, redistribute, republish, or create derivative works from any part of the platform without express written permission.</Bullet>
            </ul>
          </Section>

          <Section icon={RefreshCwIcon} title="6. Platform Availability & Maintenance">
            <p>We aim to provide a reliable and highly available platform, but we do not guarantee uninterrupted access. The platform may be temporarily unavailable due to:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>Scheduled maintenance windows, typically communicated in advance via in-app notifications.</Bullet>
              <Bullet>Unplanned outages, infrastructure failures, or force majeure events beyond our reasonable control.</Bullet>
              <Bullet>Security patches or emergency updates necessary to protect the platform and its data.</Bullet>
            </ul>
            <p className="mt-3">We are not liable for any losses or disruption to work arising from temporary unavailability of the platform.</p>
          </Section>

          <Section icon={BanIcon} title="7. Suspension & Termination">
            <p>We reserve the right to suspend or terminate your access to {siteName} under the following circumstances:</p>
            <ul className="space-y-2 mt-3">
              <Bullet>You violate any provision of these Terms or the Acceptable Use Policy.</Bullet>
              <Bullet>Your employment or authorised association with the organisation ends.</Bullet>
              <Bullet>Your account shows signs of compromise or suspicious activity.</Bullet>
              <Bullet>An administrator deactivates your account in accordance with internal HR or IT policy.</Bullet>
            </ul>
            <p className="mt-3">Upon termination, your right to access the platform ceases immediately. Certain data associated with your account may be retained in accordance with our data retention policy and applicable law.</p>
          </Section>

          <Section icon={AlertTriangleIcon} title="8. Disclaimer of Warranties">
            <p>
              {siteName} is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties of any kind,
              whether express, implied, or statutory. To the maximum extent permitted by applicable law, we disclaim all warranties including:
            </p>
            <ul className="space-y-2 mt-3">
              <Bullet>Implied warranties of merchantability, fitness for a particular purpose, or non-infringement.</Bullet>
              <Bullet>Warranties that the platform will be error-free, uninterrupted, or free of viruses or harmful components.</Bullet>
              <Bullet>Warranties regarding the accuracy, completeness, or timeliness of any data displayed.</Bullet>
            </ul>
          </Section>

          <Section icon={GavelIcon} title="9. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, neither the organisation nor the platform administrators shall be liable for:
            </p>
            <ul className="space-y-2 mt-3">
              <Bullet>Any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the platform.</Bullet>
              <Bullet>Loss of data, profits, goodwill, or business opportunities, even if advised of the possibility of such damages.</Bullet>
              <Bullet>Actions taken by third-party services (e.g. Google OAuth, SMTP providers) that affect your use of the platform.</Bullet>
            </ul>
            <p className="mt-3">Our total aggregate liability to you for any claims arising out of or related to these Terms shall not exceed the amount, if any, paid by your organisation for the platform in the twelve months preceding the claim.</p>
          </Section>

          <Section icon={RefreshCwIcon} title="10. Changes to These Terms">
            <p>
              We may revise these Terms periodically. When we make material changes, we will update the effective date above and notify
              users via an in-app notification or email. Your continued use of {siteName} after changes take effect constitutes your
              acceptance of the revised Terms. If you disagree with any changes, you must stop using the platform and request account
              deactivation from your administrator.
            </p>
          </Section>

          <Section icon={GavelIcon} title="11. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the organisation
              is incorporated, without regard to its conflict of law provisions. Any disputes arising out of or in connection with
              these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.
            </p>
          </Section>

          <Section icon={MailIcon} title="12. Contact & Enquiries">
            <p>For questions about these Terms or to report a violation, please contact:</p>
            <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1">
              <p className="font-bold text-secondary dark:text-white">{siteName}</p>
              <p>Legal & Compliance Team</p>
              <p>Email: <a href="mailto:legal@caavagroup.com" className="text-secondary dark:text-blue-400 underline hover:opacity-80">legal@caavagroup.com</a></p>
            </div>
          </Section>

          {/* Footer nav */}
          <div className="pt-8 mt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-secondary dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
              <Link to="/login" className="hover:text-secondary dark:hover:text-blue-400 transition-colors">Back to Login</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
