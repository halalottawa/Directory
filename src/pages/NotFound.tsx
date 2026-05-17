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
    <main className="min-h-screen bg-[#F9FAFB] animate-in fade-in duration-500 pb-20">
      <SEO 
        title={title} 
        description={message} 
      />
      
      <div className="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] pt-8 md:pt-16 pb-12 px-4 md:px-0">
        <div className="bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-gray-100 w-full text-center space-y-8 flex flex-col justify-center items-center py-20 min-h-[60vh]">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl font-bold text-[#e90b35]">404</span>
          </div>
          
          <div className="space-y-4 max-w-lg mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-500 text-lg">{message}</p>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md mx-auto">
            {showBackButton && (
              <button
                onClick={() => navigate(-1)}
                className="w-full inline-flex items-center justify-center px-8 py-4 border border-gray-200 rounded-full text-gray-700 bg-white hover:bg-gray-50 font-bold transition-all active:scale-95 text-base"
              >
                Go Back
              </button>
            )}
            <Link
              to={buttonLink}
              className="w-full inline-flex items-center justify-center px-8 py-4 border border-transparent rounded-full text-white bg-[#e90b35] hover:bg-[#d00a2f] font-bold shadow-lg shadow-red-100 transition-all active:scale-95 text-base"
            >
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};
