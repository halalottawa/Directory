import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Briefcase, MapPin, ChevronLeft, ExternalLink, DollarSign, Building2, Calendar, Edit2, Trash2, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Job } from '../types';
import { DEMO_JOBS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { SaveButton } from '../components/SaveButton';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { formatDate } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SEO } from '../components/SEO';

export const JobDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [relatedJobs, setRelatedJobs] = useState<Job[]>([]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!slug) return;
      
      let fetchedJob: Job | null = null;

      // Check demo jobs first
      const found = DEMO_JOBS.find(j => j.id === slug || j.slug === slug);
      if (found) {
        fetchedJob = found;
        setJob(found);
      } else {
        // Fetch from Firestore
        try {
          let docSnap = await getDoc(doc(db, 'jobs', slug));
          let jobData: Job | null = null;
          
          if (docSnap.exists()) {
            jobData = { id: docSnap.id, ...docSnap.data() } as Job;
          } else {
            const q = query(collection(db, 'jobs'), where('slug', '==', slug));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              docSnap = querySnapshot.docs[0];
              jobData = { id: docSnap.id, ...docSnap.data() } as Job;
            }
          }
          
          if (jobData) {
            fetchedJob = jobData;
            setJob(jobData);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `jobs/${slug}`);
        }
      }

      setLoading(false);

      if (fetchedJob) {
        // Fetch related jobs (just latest ones excluding current)
        try {
          const qJobs = query(collection(db, 'jobs'), where('isApproved', '==', true));
          const snap = await getDocs(qJobs);
          const relatedFs = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Job))
            .filter(j => j.id !== fetchedJob!.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
          const relatedDemo = DEMO_JOBS.filter(j => j.id !== fetchedJob!.id && j.id !== slug);
          const combined = [...relatedFs, ...relatedDemo].slice(0, 3);
          setRelatedJobs(combined);
        } catch (err) {
          const relatedDemo = DEMO_JOBS.filter(j => j.id !== fetchedJob!.id && j.id !== slug).slice(0, 3);
          setRelatedJobs(relatedDemo);
        }
      }
    };

    fetchJob();
  }, [slug]);

  const onEdit = () => {
    if (!job) return;
    navigate(`/jobs/edit/${job.id}`);
  };

  const onDelete = async () => {
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!job) return;
    try {
      await deleteDoc(doc(db, 'jobs', job.id));
      navigate('/jobs');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `jobs/${job.id}`);
    }
  };

  const handleApply = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      navigate('/login', { 
        state: { 
          from: window.location.pathname,
          message: 'Please sign in to apply for this job.'
        } 
      });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading job...</div>;
  if (!job) return <div className="p-8 text-center">Job not found.</div>;

  return (
    <>
      <div className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
        <SEO
        title={`${job.title} at ${job.company}`}
        description={job.description.length > 150 ? job.description.substring(0, 150) + '...' : job.description}
        canonicalUrl={`https://www.halalottawa.ca/jobs/${slug}`}
        ogImage={job.companyLogo || undefined}
        structuredData={[
          {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": job.title,
            "description": job.description,
            "identifier": {
              "@type": "PropertyValue",
              "name": job.company,
              "value": job.id
            },
            "datePosted": job.createdAt,
            "employmentType": job.type,
            "hiringOrganization": {
              "@type": "Organization",
              "name": job.company,
              "logo": job.companyLogo || "https://www.halalottawa.ca/default-og.jpg"
            },
            "jobLocation": {
              "@type": "Place",
              "address": "Ottawa, Canada"
            }
          },
          {
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
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": job.title
              }
            ]
          }
        ]}
      />

      <div className="bg-white p-8 border-b border-gray-100 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {job.isFeatured && <span className="bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</span>}
          </div>
          <div className="flex gap-2">
            <SaveButton id={job.id} type="job" variant="minimal" />
            {(user?.uid === job.submittedBy || user?.role === 'admin') && (
              <>
                <button onClick={onEdit} className="p-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                  <Edit2 className="w-5 h-5" />
                </button>
                <button onClick={onDelete} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-5 items-center">
            {job.companyLogo && job.companyLogo.trim() !== '' && (
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 row-span-2">
                <img 
                  src={getOptimizedImageUrl(job.companyLogo, 64, 64)} 
                  alt={job.company} 
                  className="w-full h-full object-cover" 
                  fetchPriority="high"
                  width="64"
                  height="64"
                />
              </div>
            )}
            <div className={job.companyLogo && job.companyLogo.trim() !== '' ? "col-start-2 min-w-0" : "col-span-2 min-w-0"}>
              <h1 className="text-xl font-bold leading-tight text-gray-900">{job.title}</h1>
            </div>
            <div className={`${job.companyLogo && job.companyLogo.trim() !== '' ? "col-start-2" : "col-span-2"} flex items-center gap-3 text-base font-bold text-[#e90b35] mt-2 w-full`}>
              <Building2 className="w-5 h-5 shrink-0" />
              <span>{job.company}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-1">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Job Type</span>
            <span className="font-bold text-sm">{job.type}</span>
          </div>
          <div className="bg-gray-50 p-4 rounded-2xl flex flex-col gap-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Salary</span>
            <span className="font-bold text-sm">{job.salary || 'Not specified'}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <section className="space-y-4">
            <h2 className="text-xl font-bold">Job Description</h2>
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
              <ReactMarkdown>{job.description}</ReactMarkdown>
            </div>
          </section>

        <div className="flex justify-start mt-8">
          <a 
            href={job.applyLink.startsWith('http') ? job.applyLink : `https://${job.applyLink}`} 
            target="_blank" 
            rel="noreferrer"
            onClick={handleApply}
            className="w-full md:w-auto md:px-12 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Apply now <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Job"
        message={`Are you sure you want to delete "${job?.title}"? This action cannot be undone.`}
      />
      </div>

      {/* Related Jobs - Desktop Only */}
      {relatedJobs.length > 0 && (
        <div className="hidden md:block w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto mt-12 mb-16 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold mb-6">More Jobs</h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedJobs.map((related) => (
              <Link
                key={related.id}
                to={`/jobs/${related.slug || related.id}`}
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col transition-all group"
              >
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex gap-3 items-start">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {related.companyLogo && related.companyLogo.trim() !== '' ? (
                        <img 
                          src={getOptimizedImageUrl(related.companyLogo, 48, 48)} 
                          alt={related.company} 
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
                      <h3 className="font-bold text-gray-900 leading-tight group-hover:text-[#e90b35] transition-colors line-clamp-2">{related.title}</h3>
                    </div>
                  </div>
                  <div className="mt-4 text-[#e90b35] font-bold text-sm flex items-center gap-1">
                    <Briefcase className="w-3 h-3 shrink-0" /> <span>{related.company}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400 font-medium">
                    {related.salary && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {related.salary}</span>}
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {related.type}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
