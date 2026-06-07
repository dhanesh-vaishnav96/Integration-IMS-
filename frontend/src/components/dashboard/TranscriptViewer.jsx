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
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
        <p className="text-sm font-semibold text-rose-700">Transcript processing failed</p>
      </div>
    );
  }

  if (status !== 'UPLOADED' || !url) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl h-48 flex flex-col items-center justify-center text-center">
        <FileText className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-500">Transcript not available</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl h-48 flex flex-col items-center justify-center text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mb-2 text-primary-400" />
        <p className="text-sm">Loading transcript...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center h-48">
        <p className="text-sm font-semibold text-slate-600 mb-2">Unable to render transcript inline.</p>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">Download File</a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-64">
      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center">
        <FileText className="w-4 h-4 text-slate-500 mr-2" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Raw Transcript</span>
      </div>
      <div className="p-4 overflow-y-auto text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
        {content || 'No text found.'}
      </div>
    </div>
  );
};
