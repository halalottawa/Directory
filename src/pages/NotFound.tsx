import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEO } from '../components/SEO';

interface NotFoundProps {
  title?: string;
  message?: string;
  buttonText?: string;
  buttonLink?: string;
  showBackButton?: boolean;
  statusCode?: 404 | 410;
}

export const NotFound: React.FC<NotFoundProps> = ({ 
  title = "Page Not Found",
  message = "Sorry, we couldn't find the page you're looking for.",
  buttonText = "Go Home",
  buttonLink = "/",
  showBackButton = true,
  statusCode = 404
}) => {
  const navigate = useNavigate();

  return (
    <main role="main" className="flex-1 w-full max-w-7xl mx-auto px-4 mt-8 lg:mt-12 mb-20 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <SEO 
        title={title} 
        description={message} 
        noindex={true}
        robots="noindex, nofollow"
      />
      
      <div role="status" aria-live="polite" className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 w-full text-center space-y-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto" aria-hidden="true">
          <span className="text-3xl font-bold text-[#e90b35]">{statusCode}</span>
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

        <nav aria-label="Popular Ottawa Halal Categories" className="pt-4 border-t border-gray-100 w-full max-w-lg mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Explore Popular Categories</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/restaurants" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Restaurants</Link>
            <Link to="/mosques" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Mosques</Link>
            <Link to="/grocery" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Grocery</Link>
            <Link to="/butchers" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Butchers</Link>
            <Link to="/schools" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Schools</Link>
            <Link to="/organizations" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">Organizations</Link>
            <Link to="/news" className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-red-50 hover:text-[#e90b35] transition-colors">News</Link>
          </div>
        </nav>
      </div>
    </main>
  );
};
