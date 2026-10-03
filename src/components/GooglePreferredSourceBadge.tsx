import React from 'react';
import { Link } from 'react-router-dom';

interface GooglePreferredSourceBadgeProps {
  variant?: 'button' | 'banner' | 'compact' | 'footer';
  className?: string;
  theme?: 'light' | 'dark';
  authorName?: string;
  authorBio?: string;
  authorLink?: string;
  tag?: string;
  buttonText?: string;
  linkedinUrl?: string;
}

export const GooglePreferredSourceBadge: React.FC<GooglePreferredSourceBadgeProps> = ({
  variant = 'button',
  className = '',
  theme = 'light',
  authorName = 'Youssef Agrebi',
  authorBio = 'Youssef Agrebi is an editor at Halal Ottawa with deep roots across the National Capital Region. Youssef is dedicated to reporting on local community announcements and Halal dining discoveries in Ottawa.',
  authorLink = '/author/youssef-agrebi',
  tag = 'Author',
  buttonText = 'Add as preferred source on Google',
  linkedinUrl = 'https://www.linkedin.com/in/youssef-agrebi-a05010aa/'
}) => {
  const preferredSourceUrl = 'https://www.google.com/preferences/source?q=halalottawa.ca';
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'YA';

  const FaviconIcon = ({ size = 'w-6 h-6' }: { size?: string }) => (
    <img
      src="/favicon.png"
      alt="Halal Ottawa"
      className={`${size} object-contain shrink-0`}
      width="24"
      height="24"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/favicon.webp';
      }}
    />
  );

  const GoogleLogo = ({ size = 'w-4 h-4' }: { size?: string }) => (
    <svg className={`${size} shrink-0`} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.41 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.59 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );

  // Compact Pill Badge (e.g. for article headers, breadcrumbs, byline tags)
  if (variant === 'compact') {
    return (
      <a
        href={preferredSourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Add Halal Ottawa as preferred source on Google"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 select-none shadow-xs ${
          theme === 'dark'
            ? 'bg-gray-800/90 text-gray-200 border-gray-700 hover:bg-gray-750 hover:text-white hover:border-gray-600'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300'
        } ${className}`}
        {...{ 'google-add-preferred-source-btn': '' }}
        data-theme={theme}
      >
        <GoogleLogo size="w-3.5 h-3.5" />
        <span>Add as preferred source</span>
      </a>
    );
  }

  // Footer Badge
  if (variant === 'footer') {
    return (
      <a
        href={preferredSourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Add as preferred source on Google"
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-200 select-none ${
          theme === 'dark'
            ? 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-600'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300'
        } ${className}`}
        {...{ 'google-add-preferred-source-btn': '' }}
        data-theme={theme}
      >
        <GoogleLogo size="w-4 h-4 shrink-0" />
        <span className="font-semibold">Add as preferred source on Google</span>
      </a>
    );
  }

  // Engaging Editorial Banner (e.g. for News hub and article footers)
  if (variant === 'banner') {
    return (
      <div
        className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
          theme === 'dark'
            ? 'bg-gray-900 border-gray-800 text-white'
            : 'bg-gradient-to-r from-gray-50 via-white to-gray-50/80 border-gray-200/80 text-gray-900'
        } ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-gray-100 flex items-center justify-center shrink-0">
              <FaviconIcon size="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to={authorLink}
                  className="font-bold text-sm sm:text-base text-gray-900 hover:text-[#e90b35] transition-colors"
                >
                  {authorName}
                </Link>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                  {tag}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 leading-relaxed">
                {authorBio}
              </p>
              {linkedinUrl && (
                <div className="mt-2 flex items-center">
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${authorName} on LinkedIn`}
                    aria-label={`${authorName} on LinkedIn`}
                    className="text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center justify-center group"
                  >
                    <svg className="w-5 h-5 fill-current group-hover:scale-105 transition-transform shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>

          <a
            href={preferredSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Add as preferred source on Google"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 shadow-xs hover:shadow-sm active:scale-98 transition-all shrink-0 select-none self-start sm:self-auto"
            {...{ 'google-add-preferred-source-btn': '' }}
            data-theme={theme}
          >
            <GoogleLogo size="w-4 h-4 shrink-0" />
            <span className="text-left leading-tight">
              Add as preferred source on Google
            </span>
          </a>
        </div>
      </div>
    );
  }

  // Standard Button (Official Google Pill)
  return (
    <a
      href={preferredSourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Add Halal Ottawa as preferred source on Google"
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all duration-200 select-none shadow-xs active:scale-98 ${
        theme === 'dark'
          ? 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-750 hover:text-white hover:border-gray-600'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300'
      } ${className}`}
      {...{ 'google-add-preferred-source-btn': '' }}
      data-theme={theme}
    >
      <GoogleLogo size="w-4 h-4" />
      <span>Add as preferred source</span>
    </a>
  );
};
