import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Plus, ChevronRight, DollarSign, Search, Clock, Building2, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Job } from '../types';
import { DEMO_JOBS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatDate } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { AdDisplay } from '../components/AdDisplay';
import { SEO } from '../components/SEO';

export const Jobs: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>(DEMO_JOBS);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const q = user?.role === 'admin' 
      ? query(collection(db, 'jobs')) 
      : query(collection(db, 'jobs'), where('isApproved', '==', true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreJobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Job[];

      // Sort client-side: Featured first, then by date
      firestoreJobs.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Merge with demo data, avoiding duplicates if any (though demo IDs are different)
      const allJobs = [...firestoreJobs, ...DEMO_JOBS];
      
      // Sort allJobs as well
      allJobs.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Filter by search query
      const filtered = allJobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.location.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setJobs(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'jobs');
    });

    return () => unsubscribe();
  }, [searchQuery, user]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalPages = Math.ceil(jobs.length / itemsPerPage);
  const currentJobs = jobs.slice(
    isMobile ? 0 : (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && currentPage < totalPages) {
          setCurrentPage(prev => Math.min(prev + 1, totalPages));
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [isMobile, currentPage, totalPages]);

  // Reset page when searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title="Jobs" 
        description="Explore local job opportunities and careers tailored for the Ottawa Muslim community." 
        canonicalUrl="https://www.halalottawa.ca/jobs" 
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
              "name": "Jobs",
              "item": "https://www.halalottawa.ca/jobs"
            }
          ]
        }}
      />

      <AdDisplay />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">Jobs</h1>
        <Link 
          to="/jobs/add" 
          className="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f]"
        >
          <Plus className="w-6 h-6 md:w-5 md:h-5" />
        </Link>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search jobs..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {currentJobs.map((job) => (
          <Link
            key={job.id}
            to={`/jobs/${job.slug || job.id}`}
            className="block bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md group active:scale-95 transition-all"
          >
            <div className="flex gap-3 items-start">
              <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {job.companyLogo && job.companyLogo.trim() !== '' ? (
                  <img 
                    src={getOptimizedImageUrl(job.companyLogo, 48, 48)} 
                    alt={job.company} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                    width="48"
                    height="48"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <h2 className="font-bold text-gray-900 leading-tight">{job.title}</h2>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {job.isFeatured && (
                      <span className="bg-red-50 text-[#e90b35] text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</span>
                    )}
                    {!job.isApproved && (
                      <span className="bg-yellow-50 text-yellow-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Pending</span>
                    )}
                  </div>
                </div>
                <p className="text-[#e90b35] font-bold text-sm flex items-center gap-2 mt-1">
                  <Briefcase className="w-3 h-3 shrink-0" /> <span>{job.company}</span>
                </p>
              </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 font-medium">
              {job.salary && <span className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" /> {job.salary}</span>}
              {job.type && <span className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> {job.type}</span>}
              {(!job.salary && !job.type) && job.location && (
                <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {job.location.split(',')[1]?.trim() || job.location.split(',')[0]}</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Infinite Scroll target for mobile */}
      {isMobile && currentPage < totalPages && (
        <div ref={observerTarget} className="h-10 w-full flex justify-center items-center py-4">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#e90b35] rounded-full animate-spin"></div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="hidden md:flex justify-center items-center gap-2 pt-8 pb-12">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                  currentPage === i + 1 
                    ? 'bg-[#e90b35] text-white shadow-lg shadow-red-200' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
};
