import React from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const FAQ_ITEMS = [
  {
    question: "What is Halal Ottawa?",
    answer: "Halal Ottawa is a community-driven platform designed to help residents and visitors discover halal-certified restaurants, grocery stores, mosques, schools, and organizations in the Ottawa region."
  },
  {
    question: "How can I add a business listing?",
    answer: "You can click on 'Add Listing' in the navigation menu. You'll need to create an account, fill out the business details (name, category, address, hours, photos), and submit it for review. Our team will approve it once verified."
  },
  {
    question: "Is it free to list my business?",
    answer: "Basic listings are completely free. We also offer featured listing options if you want to increase your visibility on our home page and search results."
  },
  {
    question: "How do you verify halal status?",
    answer: "We rely on a combination of community reporting, official certification agency data (like HMA or HMS), and direct verification with business owners. If you notice an error, please report it to us immediately."
  },
  {
    question: "Can I post jobs or events?",
    answer: "Yes! Registered users can post community events and job openings through the 'Add Event' and 'Add Job' buttons. All posts are moderated to ensure they align with our community standards."
  },
  {
    question: "How do I report a listing?",
    answer: "If you find information that is incorrect or a business that should no longer be listed, please contact us via email at info@halalottawa.ca with the listing details."
  }
];

export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div className="animate-in fade-in duration-500 bg-white md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
      <Helmet>
        <title>FAQ | Halal Ottawa</title>
        <meta name="description" content="Frequently Asked Questions about Halal Ottawa." />
      </Helmet>

      <div className="pt-8 pb-12 px-6 md:px-12 max-w-3xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35] mx-auto">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Frequently Asked Questions</h1>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Everything you need to know about using Halal Ottawa. Can't find what you're looking for? Reach out to our team.
            </p>
          </div>
        </div>
          
        <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => (
              <div 
                key={index}
                className="border border-gray-100 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-900">{item.question}</span>
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-[#e90b35]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="px-6 pb-6 text-gray-600 leading-relaxed"
                  >
                    {item.answer}
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 p-8 bg-red-50 rounded-2xl text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Still have questions?</h3>
            <p className="text-gray-600 mb-6">We're here to help you with any inquiries you might have.</p>
            <a 
              href="mailto:info@halalottawa.ca"
              className="inline-flex items-center px-6 py-3 bg-[#e90b35] text-white font-bold rounded-xl hover:bg-[#d00a30] transition-colors shadow-lg shadow-red-100"
            >
              Contact Support
            </a>
          </div>
      </div>
    </div>
  );
};
