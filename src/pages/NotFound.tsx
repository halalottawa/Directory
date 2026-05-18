import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';

interface NotFoundProps {
  title?: string;
  message?: string;
  buttonText?: string;
  buttonLink?: string;
  showBackButton?: boolean;
}

export const NotFound: React.FC<NotFoundProps> = ({ 
  title = "Page Not Found",
  message = "Sorry, we couldn't find the page you're looking for.",
  buttonText = "Go Home",
  buttonLink = "/",
  showBackButton = true
}) => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 mt-8 lg:mt-12 mb-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <SEO 
        title={title} 
        description={message} 
      />
      
      <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 w-full text-center space-y-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl font-bold text-[#e90b35]">404</span>
        </div>
        
        <div className="space-y-2 max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500">{message}</p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center w-full max-w-md mx-auto">
          {showBackButton && (
            <button
              onClick={() => navigate(-1)}
              className="flex-1 inline-flex items-center justify-center px-6 py-3.5 border border-gray-200 rounded-2xl text-gray-700 bg-white hover:bg-gray-50 font-bold transition-all active:scale-95"
            >
              Go Back
            </button>
          )}
          <Link
            to={buttonLink}
            className="flex-1 inline-flex items-center justify-center px-6 py-3.5 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-[#d00a2f] active:scale-95 transition-all"
          >
            {buttonText}
          </Link>
        </div>
      </div>
    </main>
  );
};
