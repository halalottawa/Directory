import React from 'react';
import { ChevronLeft, Shield, Lock, Eye, FileText, Mail, MapPin, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="animate-in fade-in duration-500 bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
      <SEO 
        title="Privacy Policy" 
        description="Read the Privacy Policy for Halal Ottawa." 
        canonicalUrl="https://www.halalottawa.ca/privacy-policy"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://www.halalottawa.ca"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Privacy Policy",
              "item": "https://www.halalottawa.ca/privacy-policy"
            }
          ]
        }}
      />

      <div className="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Your Privacy Matters</h2>
            <p className="text-gray-500">Last updated: March 25, 2026</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <Eye className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">Introduction</h3>
            </div>
            <p>
              Halal Ottawa ("we", "us", or "our") is committed to protecting the privacy of our users in Ontario and across Canada. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile-optimized web application.
              We comply with the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong> and other applicable Canadian privacy laws.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <FileText className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">Information We Collect</h3>
            </div>
            <p>We collect information that you provide directly to us when you:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> When you sign in via Google, we receive your name, email address, and profile picture.</li>
              <li><strong>User Content:</strong> Information you submit through our platform, including business listings, event details, job postings, news articles, comments, and reviews.</li>
              <li><strong>Interaction Data:</strong> Information about the items you save (bookmarks) and your interactions with other users' content.</li>
              <li><strong>Location Data:</strong> If you provide it, we use location information to show you relevant local events and businesses in the Ottawa area.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <Lock className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">How We Use Your Information</h3>
            </div>
            <p>We use the collected information for purposes such as:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Providing and maintaining our community platform services.</li>
              <li>Verifying ownership of business listings (Claims process).</li>
              <li>Moderating community content to ensure a safe and respectful environment.</li>
              <li>Displaying your name and profile picture alongside content you publish (reviews, comments, listings).</li>
              <li>Communicating with you about your submissions or account status.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <Globe className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">Disclosure of Information</h3>
            </div>
            <p>
              We do not sell your personal information. We may disclose information in the following circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Public Content:</strong> Any information you post in public listings, events, or reviews is visible to all users.</li>
              <li><strong>Service Providers:</strong> We use third-party services like Google Firebase for authentication and database management.</li>
              <li><strong>Legal Requirements:</strong> If required by Canadian law or in response to valid requests by public authorities.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <MapPin className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">Data Residency</h3>
            </div>
            <p>
              Our services are hosted using Google Cloud/Firebase. While we primarily serve the Ontario community, your data may be processed on servers located outside of Canada. 
              We ensure that all service providers maintain high standards of data protection.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3 text-gray-900">
              <Mail className="w-5 h-5 text-[#e90b35]" />
              <h3 className="text-xl font-bold m-0">Your Rights</h3>
            </div>
            <p>
              Under PIPEDA, you have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate information.</li>
              <li>Withdraw consent for data processing (which may limit your ability to use certain features).</li>
              <li>Request deletion of your account and associated personal data.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
