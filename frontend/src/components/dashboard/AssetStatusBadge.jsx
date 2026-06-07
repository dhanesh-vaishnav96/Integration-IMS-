import React from 'react';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
export const AssetStatusBadge = ({ status }) => {
  if (status === 'UPLOADED') {
    return (
      <span className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center">
        <CheckCircle className="w-3 h-3 mr-1" /> Ready
      </span>
    );
  }
  if (status === 'PROCESSING') {
    return (
      <span className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200 flex items-center">
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Processing
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border bg-rose-50 text-rose-700 border-rose-200 flex items-center">
        <AlertCircle className="w-3 h-3 mr-1" /> Failed
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border bg-blue-50 text-blue-700 border-blue-200 flex items-center">
      <RefreshCw className="w-3 h-3 mr-1 opacity-50" /> Pending
    </span>
  );
};
