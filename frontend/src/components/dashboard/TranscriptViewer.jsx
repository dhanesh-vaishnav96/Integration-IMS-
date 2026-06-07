import React, { useEffect, useState } from 'react';
import { FileText, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

export const TranscriptViewer = ({ url, status }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === 'UPLOADED' && url) {
      setLoading(true);
      setError(false);
      axios.get(url)
        .then(res => {
          // If it's a VTT file or raw text, just display it. 
          // If it's JSON from Graph, we might stringify it nicely.
          if (typeof res.data === 'object') {
            setContent(JSON.stringify(res.data, null, 2));
          } else {
            setContent(res.data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load transcript text', err);
          setError(true);
          setLoading(false);
        });
    }
  }, [url, status]);

  if (status === 'FAILED') {
    return (
      <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
        <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-800 flex items-center">
            <FileText className="w-5 h-5 mr-3 text-primary-500" />
            Interview Transcript
          </span>
        </div>
        <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
          <p className="text-base font-bold text-rose-700">Transcript processing failed</p>
        </div>
      </div>
    );
  }

  if (status !== 'UPLOADED' || !url) {
    return (
      <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
        <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-800 flex items-center">
            <FileText className="w-5 h-5 mr-3 text-primary-500" />
            Interview Transcript
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-5 border border-slate-100">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Interview Transcript Not Available</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Transcript will automatically appear here once processing is completed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <span className="text-base font-bold text-slate-800 flex items-center">
          <FileText className="w-5 h-5 mr-3 text-primary-500" />
          Interview Transcript
        </span>
        <a 
          href={url} 
          target="_blank" 
          rel="noreferrer" 
          className="text-[13px] font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-4 py-2 rounded-lg transition-colors border border-primary-200 shadow-sm inline-flex items-center"
        >
          Download Transcript
        </a>
      </div>
      <div className="flex-1 flex flex-col">
        {loading ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl flex-1 flex flex-col items-center justify-center text-center text-slate-500 min-h-[200px]">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-primary-400" />
            <p className="text-base font-medium">Loading transcript content...</p>
          </div>
        ) : error ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex-1 flex flex-col items-center justify-center text-center min-h-[200px]">
            <p className="text-base font-semibold text-slate-600 mb-4">Unable to render transcript inline.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-[300px]">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Raw Transcript Output</span>
            </div>
            <div className="p-6 overflow-y-auto max-h-[500px] text-[15px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
              {content || 'No text found.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
