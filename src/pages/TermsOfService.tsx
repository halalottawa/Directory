import React from 'react';
import { FileText } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export const TermsOfService: React.FC = () => {
  return (
    <div className="animate-in fade-in duration-500 bg-white md:max-w-7xl md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] xl:w-full md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
      <Helmet>
        <title>Terms of Service | Halal Ottawa</title>
        <meta name="description" content="Terms of Service for Halal Ottawa." />
      </Helmet>

      <div className="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
            <p className="text-gray-500">Last updated: April 29, 2024</p>
          </div>
        </div>
          
        <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed space-y-8">
          <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Halal Ottawa, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">2. Use License</h2>
              <p>
                Permission is granted to temporarily download one copy of the materials (information or software) on Halal Ottawa's website for personal, non-commercial transitory viewing only.
              </p>
              <p className="mt-4">Under this license you may not:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Modify or copy the materials;</li>
                <li>Use the materials for any commercial purpose, or for any public display;</li>
                <li>Attempt to decompile or reverse engineer any software contained on Halal Ottawa's website;</li>
                <li>Remove any copyright or other proprietary notations from the materials;</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">3. User Content</h2>
              <p>
                By posting reviews, listings, or other content, you grant Halal Ottawa a non-exclusive, royalty-free, perpetual, and irrevocable right to use, reproduce, and display such content. You are solely responsible for the content you post and must ensure it is accurate and does not violate any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">4. Disclaimer</h2>
              <p>
                The materials on Halal Ottawa's website are provided on an 'as is' basis. Halal Ottawa makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">5. Limitations</h2>
              <p>
                In no event shall Halal Ottawa or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Halal Ottawa's website.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">6. Governing Law</h2>
              <p>
                These terms and conditions are governed by and construed in accordance with the laws of Ontario, Canada, and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
              </p>
            </section>
          </div>
      </div>
    </div>
  );
};
