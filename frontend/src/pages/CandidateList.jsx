import { useEffect, useState, useCallback } from 'react';
import { candidateApi } from '../services/api';
import { Link } from 'react-router-dom';
import { UserPlus, Search, ChevronRight, X, Briefcase, Calendar as CalendarIcon } from 'lucide-react';

const CandidateList = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', job_role: '', years_of_experience: 0, skills: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await candidateApi.getAll();
      setCandidates(res.data.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        years_of_experience: Number(formData.years_of_experience),
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean)
      };
      await candidateApi.create(payload);
      setIsModalOpen(false);
      setFormData({ name: '', email: '', job_role: '', years_of_experience: 0, skills: '' });
      setLoading(true);
      fetchCandidates();
    } catch (err) {
      console.error("Create error:", err);
      alert("Error creating candidate: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-textMain tracking-tight">Candidates</h1>
          <p className="text-slate-500 text-[15px] mt-1">Manage pipeline and schedule interviews.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Candidate
        </button>
      </div>

      <div className="bg-surface border border-borderSoft rounded-[16px] shadow-card overflow-hidden">
        <div className="p-5 border-b border-borderSoft flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, or role..." 
              className="input-field pl-10 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary py-2 text-sm"><Briefcase className="w-4 h-4 mr-2 text-slate-400"/>Role</button>
            <button className="btn-secondary py-2 text-sm"><CalendarIcon className="w-4 h-4 mr-2 text-slate-400"/>Stage</button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            Loading candidates...
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No candidates yet</h3>
            <p className="text-slate-500 mt-1 mb-6">Add your first candidate to start scheduling interviews.</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Candidate
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-borderSoft">
                <tr>
                  <th className="px-6 py-4">Candidate</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Experience</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSoft">
                {candidates.map((c) => (
                  <tr key={c.id || c._id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm border border-primary-100 flex-shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-[15px] group-hover:text-primary-700 transition-colors">{c.name}</div>
                          <div className="text-slate-500 text-[13px]">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {c.job_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {c.years_of_experience} yrs
                    </td>
                    <td className="px-6 py-4">
                      <span className="badge badge-info">Interviewing</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/dashboard/${c.id || c._id}`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        Profile
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-borderSoft rounded-[16px] w-full max-w-md shadow-2xl overflow-hidden transform transition-all">
            <div className="flex justify-between items-center p-5 border-b border-borderSoft bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Add New Candidate</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Email Address</label>
                <input required type="email" className="input-field" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="jane@example.com" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Job Role</label>
                <input required type="text" className="input-field" value={formData.job_role} onChange={e => setFormData({...formData, job_role: e.target.value})} placeholder="Senior Frontend Engineer" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Years of Experience</label>
                <input required type="number" min="0" className="input-field w-1/2" value={formData.years_of_experience} onChange={e => setFormData({...formData, years_of_experience: e.target.value})} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Skills <span className="text-slate-400 font-normal">(comma separated)</span></label>
                <input type="text" className="input-field" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} placeholder="React, Node.js, TypeScript" />
              </div>
              <div className="pt-6 mt-2 flex justify-end gap-3 border-t border-borderSoft">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateList;
