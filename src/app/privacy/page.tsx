'use client'

export default function PrivacyPage() {
  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-24">

        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>Legal</p>
        <h1 className="text-5xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#606060', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '48px' }}>
          Last updated: 22 March 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          <Section title="1. Overview">
            <P>LiftRunRepeat ("we", "us", "our") operates the LiftRunRepeat platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Service. By using the Service you agree to the collection and use of information in accordance with this policy.</P>
            <P>We take your privacy seriously. We collect only what we need, we store it securely, and we do not sell it.</P>
          </Section>

          <Section title="2. Information We Collect">
            <SubHeading>2.1 Account Information</SubHeading>
            <P>When you create an account we collect your username, email address, and a hashed password. We do not store your password in plain text.</P>

            <SubHeading>2.2 Training Data</SubHeading>
            <P>We store the workout sessions, programmes, and exercise logs you choose to save on the platform. This data is associated with your account and protected by row-level security so that only you can access it.</P>

            <SubHeading>2.3 Usage Data</SubHeading>
            <P>We may collect information about how you access and use the Service, including browser type, pages visited, time and date of visits, and device identifiers. This is used solely to improve the Service.</P>

            <SubHeading>2.4 Locally Stored Data</SubHeading>
            <P>Some features (such as calculator state and saved programmes) store data in your browser&apos;s localStorage. This data remains on your device and is not transmitted to our servers unless you explicitly save a session.</P>
          </Section>

          <Section title="3. How We Use Your Information">
            <P>We use the information we collect to:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li>Provide, maintain, and improve the Service</li>
              <li>Authenticate your account and protect against unauthorised access</li>
              <li>Sync your training data across devices</li>
              <li>Respond to support enquiries</li>
              <li>Monitor and analyse usage patterns to improve functionality</li>
              <li>Comply with legal obligations</li>
            </ul>
            <P>We do not use your data to serve advertising, and we do not sell or rent your personal data to third parties.</P>
          </Section>

          <Section title="4. Data Storage and Security">
            <P>Your data is stored using Supabase, a third-party database and authentication provider. Supabase stores data on infrastructure hosted by Amazon Web Services (AWS). Data is encrypted in transit (TLS) and at rest. We apply row-level security policies so that each user can only access their own data.</P>
            <P>While we implement commercially reasonable security measures, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.</P>
          </Section>

          <Section title="5. Third-Party Services">
            <P>The Service uses the following third-party providers who may process your data:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li><strong style={{ color: '#F5F5F5' }}>Supabase</strong> — database, authentication, and row-level security</li>
              <li><strong style={{ color: '#F5F5F5' }}>Vercel</strong> — application hosting and edge delivery</li>
              <li><strong style={{ color: '#F5F5F5' }}>DeepSeek</strong> — AI language model provider used to generate programme reviews</li>
            </ul>
            <P>Each third party operates under its own privacy policy. We encourage you to review those policies.</P>
          </Section>

          <Section title="5a. AI Coach Feature — Data Sharing with DeepSeek">
            <P>The AI Coach feature ("Programme Review") uses the DeepSeek large language model to analyse your training programme and generate personalised coaching feedback. When you use this feature, the following data is transmitted to DeepSeek&apos;s API:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li>Your programme structure — training split, session names, exercises, sets, reps, run segments, and RPE values</li>
              <li>Any additional context you voluntarily provide — such as goals, age, bodyweight, injuries, 1RMs, race times, sleep, and nutrition details</li>
            </ul>
            <P>This data is sent to DeepSeek solely to generate your review. We do not include your name, email address, or account identifiers in the data sent to DeepSeek. By using the AI Coach feature you explicitly consent to this data being transmitted to and processed by DeepSeek in accordance with <strong style={{ color: '#F5F5F5' }}>DeepSeek&apos;s Privacy Policy</strong>.</P>
            <P>You are not required to use the AI Coach feature. If you do not wish your programme data to be shared with a third-party AI provider, do not use the Programme Review function.</P>
            <SubHeading>AI Output Disclaimer</SubHeading>
            <P>Reviews generated by the AI Coach are produced by an automated language model and are for informational purposes only. They do not constitute professional medical, physiotherapy, or coaching advice. Always use your own judgement and consult a qualified professional before making changes to your training.</P>
          </Section>

          <Section title="6. Data Retention">
            <P>We retain your personal data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law.</P>
            <P>Locally stored data (localStorage) can be cleared at any time by clearing your browser data.</P>
          </Section>

          <Section title="7. Your Rights">
            <P>Depending on your jurisdiction you may have the following rights regarding your personal data:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li><strong style={{ color: '#F5F5F5' }}>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong style={{ color: '#F5F5F5' }}>Correction</strong> — request correction of inaccurate data</li>
              <li><strong style={{ color: '#F5F5F5' }}>Deletion</strong> — request deletion of your account and associated data</li>
              <li><strong style={{ color: '#F5F5F5' }}>Portability</strong> — request your data in a machine-readable format</li>
              <li><strong style={{ color: '#F5F5F5' }}>Objection</strong> — object to certain processing of your data</li>
            </ul>
            <P>To exercise any of these rights, contact us at the address below. We will respond within 30 days.</P>
          </Section>

          <Section title="8. Cookies">
            <P>The Service may use session cookies strictly necessary for authentication. We do not use tracking cookies or advertising cookies. You can disable cookies in your browser settings, but this may affect the functionality of the Service.</P>
          </Section>

          <Section title="9. Children's Privacy">
            <P>The Service is not directed at children under the age of 16. We do not knowingly collect personal data from children under 16. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.</P>
          </Section>

          <Section title="10. Changes to This Policy">
            <P>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date at the top of this page. Continued use of the Service after changes constitutes acceptance of the updated policy.</P>
          </Section>

          <Section title="11. Contact">
            <P>If you have any questions about this Privacy Policy or how we handle your data, please contact us at:</P>
            <p style={{ color: '#00BFA5', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>privacy@liftrunrepeat.com</p>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #1E1E1E' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </section>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '13px', fontWeight: 700, color: '#C0C0C0', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
      {children}
    </p>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '1.8', margin: 0 }}>
      {children}
    </p>
  )
}
