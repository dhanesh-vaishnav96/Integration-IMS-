import React, { useState } from 'react';
import { Video, AlertCircle } from 'lucide-react';

export const RecordingPlayer = ({ url, status }) => {
  const [error, setError] = useState(false);

  if (status === 'FAILED') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
        <p className="text-sm font-semibold text-rose-700">Recording processing failed</p>
        <p className="text-xs text-rose-600 mt-1">We were unable to process the video.</p>
      </div>
    );
  }

  if (status !== 'UPLOADED' || !url) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl h-48 flex flex-col items-center justify-center text-center">
        <Video className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-500">Recording not available</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center h-48">
        <Video className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-600">Unable to load video playback</p>
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 text-sm text-primary-600 hover:underline">Download / Open directly</a>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black border border-slate-800 shadow-sm">
      <video 
        controls 
        className="w-full h-auto max-h-64 object-contain"
        src={url}
        onError={() => setError(true)}
      />
    </div>
  );
};
