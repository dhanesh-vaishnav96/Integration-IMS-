import React, { useState } from 'react';
import { Video, AlertCircle } from 'lucide-react';

export const RecordingPlayer = ({ url, status }) => {
  const [error, setError] = useState(false);

  if (status === 'FAILED') {
    return (
      <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
        <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-800 flex items-center">
            <Video className="w-5 h-5 mr-3 text-primary-500" />
            Interview Recording
          </span>
        </div>
        <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
          <p className="text-base font-bold text-rose-700">Recording processing failed</p>
          <p className="text-sm text-rose-600 mt-2">We were unable to process the video.</p>
        </div>
      </div>
    );
  }

  if (status !== 'UPLOADED' || !url) {
    return (
      <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
        <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
          <span className="text-base font-bold text-slate-800 flex items-center">
            <Video className="w-5 h-5 mr-3 text-primary-500" />
            Interview Recording
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-5 border border-slate-100">
            <Video className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Interview Recording Video Not Available</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Recording will automatically appear here once the interview recording is uploaded and processed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[16px] p-6 border border-slate-200 shadow-sm flex flex-col min-h-[320px]">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <span className="text-base font-bold text-slate-800 flex items-center">
          <Video className="w-5 h-5 mr-3 text-primary-500" />
          Interview Recording
        </span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {error ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center h-full">
            <Video className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-600">Unable to load video playback</p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-800 hover:underline">
              Download / Open directly
            </a>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-black border border-slate-800 shadow-md">
            <video 
              controls 
              className="w-full h-auto max-h-[500px] object-contain"
              src={url}
              onError={() => setError(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
