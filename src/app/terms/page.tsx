'use client'

export default function TermsPage() {
  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-24">

        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>Legal</p>
        <h1 className="text-5xl font-black uppercase mb-2" style={{ fontFamily: 'Montserrat, sans-serif', color: '#F5F5F5' }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ color: '#606060', fontSize: '13px', fontFamily: 'Inter, sans-serif', marginBottom: '48px' }}>
          Last updated: 21 March 2026
        </p>

        {/* Health Warning Banner */}
        <div style={{ background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.3)', borderRadius: '12px', padding: '20px 24px', marginBottom: '48px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#C8102E', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Important Health Disclaimer
          </p>
          <p style={{ color: '#A0A0A0', fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: '1.7', margin: 0 }}>
            LiftRunRepeat provides general fitness information and tracking tools only. Nothing on this platform constitutes medical advice, diagnosis, or treatment. Always consult a qualified medical professional before beginning any exercise programme, particularly if you have any pre-existing health conditions, injuries, or concerns. Exercise carries inherent risk of injury. You participate entirely at your own risk.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          <Section title="1. Acceptance of Terms">
            <P>By accessing or using the LiftRunRepeat platform ("Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you must not use the Service. These Terms apply to all users of the Service, including browsers, registered users, and contributors of content.</P>
            <P>We reserve the right to update these Terms at any time. Continued use of the Service after any changes constitutes your acceptance of the new Terms. It is your responsibility to review these Terms periodically.</P>
          </Section>

          <Section title="2. Description of Service">
            <P>LiftRunRepeat is a fitness tracking and planning platform designed for hybrid athletes. The Service includes workout logging, programme building, exercise libraries, calculators, and analytics tools. The Service is provided for informational and personal organisational purposes only.</P>
            <P>We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice, and without liability to you.</P>
          </Section>

          <Section title="3. Health, Fitness and Medical Disclaimer">
            <P><strong style={{ color: '#F5F5F5' }}>LiftRunRepeat is not a medical service.</strong> The content, tools, calculators, workout plans, and all other information provided through the Service are for general informational and educational purposes only. Nothing on the Service should be construed as medical advice, a diagnosis, or a recommendation for any specific treatment or course of action.</P>
            <P>You acknowledge and agree that:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li>Exercise and physical training carry an inherent and unavoidable risk of physical injury, including serious injury or death</li>
              <li>You should consult a qualified medical professional before beginning any exercise programme</li>
              <li>You are solely responsible for assessing your own fitness level and the suitability of any programme or exercise for your individual circumstances</li>
              <li>Calculator outputs (including 1RM estimates, macro calculations, and Wilks scores) are estimates based on general formulae and are not guaranteed to be accurate for your individual physiology</li>
              <li>Suggested training programmes are general in nature and may not be appropriate for your fitness level, health status, or goals</li>
            </ul>
            <P>To the maximum extent permitted by law, LiftRunRepeat, its owners, employees, and contributors accept no responsibility or liability for any injury, illness, death, loss, or damage arising from or in connection with use of the Service or reliance on any information provided through it.</P>
          </Section>

          <Section title="4. Eligibility">
            <P>You must be at least 16 years of age to use the Service. By using the Service you represent and warrant that you meet this age requirement. If you are between 16 and 18, you represent that you have obtained parental or guardian consent.</P>
          </Section>

          <Section title="5. User Accounts">
            <P>To access certain features you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorised use of your account.</P>
            <P>You agree to provide accurate and current information when registering. We reserve the right to suspend or terminate accounts that contain false or misleading information, or that are used in breach of these Terms.</P>
          </Section>

          <Section title="6. User Content">
            <P>You may submit content to the Service, including workout logs, custom exercises, and programme data ("User Content"). You retain ownership of your User Content. By submitting User Content you grant us a limited, non-exclusive, royalty-free licence to store and process that content solely to provide the Service to you.</P>
            <P>You are solely responsible for your User Content. You warrant that your User Content does not infringe any third-party rights and does not contain anything unlawful, harmful, or offensive.</P>
          </Section>

          <Section title="7. Acceptable Use">
            <P>You agree not to:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
              <li>Introduce viruses, malware, or any other malicious code</li>
              <li>Scrape, crawl, or extract data from the Service without our express written permission</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
              <li>Use the Service to harass, abuse, or harm others</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <P>All content on the Service — including text, graphics, logos, icons, code, and design — is the property of LiftRunRepeat or its content suppliers and is protected by applicable intellectual property laws. You may not reproduce, distribute, modify, or create derivative works from any part of the Service without our express written permission.</P>
          </Section>

          <Section title="9. Limitation of Liability">
            <P>To the fullest extent permitted by applicable law:</P>
            <ul style={{ paddingLeft: '20px', color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '2', listStyleType: 'disc' }}>
              <li>The Service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied</li>
              <li>We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components</li>
              <li>We do not warrant the accuracy, completeness, or suitability of any information on the Service</li>
              <li>LiftRunRepeat shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, personal injury, or property damage, arising from your use of or inability to use the Service</li>
              <li>Our total aggregate liability to you for any claim arising out of or relating to the Service shall not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) £100</li>
            </ul>
            <P>Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability for certain types of damages. In such jurisdictions, our liability is limited to the greatest extent permitted by law.</P>
          </Section>

          <Section title="10. Indemnification">
            <P>You agree to indemnify, defend, and hold harmless LiftRunRepeat and its owners, officers, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your access to or use of the Service, your User Content, or your violation of these Terms.</P>
          </Section>

          <Section title="11. Third-Party Links and Services">
            <P>The Service may contain links to third-party websites or services. These links are provided for convenience only. We have no control over and accept no responsibility for the content, privacy policies, or practices of any third-party sites or services. We encourage you to review the terms and privacy policies of any third-party sites you visit.</P>
          </Section>

          <Section title="12. Termination">
            <P>We reserve the right to suspend or terminate your access to the Service at any time, for any reason, without notice or liability to you, including if we reasonably believe you have violated these Terms.</P>
            <P>You may terminate your account at any time by contacting us. Upon termination, your right to use the Service ceases immediately.</P>
          </Section>

          <Section title="13. Governing Law">
            <P>These Terms shall be governed by and construed in accordance with the laws of England and Wales. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales, unless otherwise required by mandatory consumer protection laws in your jurisdiction.</P>
          </Section>

          <Section title="14. Severability">
            <P>If any provision of these Terms is found to be unenforceable or invalid under applicable law, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining provisions shall continue in full force and effect.</P>
          </Section>

          <Section title="15. Entire Agreement">
            <P>These Terms, together with our Privacy Policy, constitute the entire agreement between you and LiftRunRepeat regarding your use of the Service and supersede all prior agreements and understandings.</P>
          </Section>

          <Section title="16. Contact">
            <P>If you have any questions about these Terms, please contact us at:</P>
            <p style={{ color: '#00BFA5', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>legal@liftrunrepeat.com</p>
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

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#A0A0A0', fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: '1.8', margin: 0 }}>
      {children}
    </p>
  )
}
