import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseCSVAsync } from '../utils/parseCSV';
import { WorkOrderSchema, InvoiceSchema, MasterJoinedSchema } from '../types/schemas';
import { uploadWorkOrdersThunk, uploadInvoicesThunk, uploadJoinedMasterThunk } from '../store/dbSlice';
import { useDispatch } from 'react-redux';
import { X, UploadCloud, AlertCircle, FileText, CheckCircle } from 'lucide-react';
import { downloadWorkOrderTemplate, downloadInvoiceTemplate } from '../utils/excelTemplates';

interface UploadModalProps {
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose }) => {
  const dispatch = useDispatch();
  const [uploadType, setUploadType] = useState<'work_orders' | 'invoices' | 'master'>('work_orders');
  const [errorList, setErrorList] = useState<{ row: number; field: string; message: string }[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setErrorList([]);
    setProgress(null);
    setSuccessCount(null);

    try {
      const rawData = await parseCSVAsync(file);
      setProgress({ current: 0, total: rawData.length });

      let schema: any;
      if (uploadType === 'work_orders') {
        schema = WorkOrderSchema;
      } else if (uploadType === 'invoices') {
        schema = InvoiceSchema;
      } else {
        schema = MasterJoinedSchema;
      }      const validRows: any[] = [];
      const errors: { row: number; field: string; message: string }[] = [];

      if (rawData.length > 0) {
        const firstRow = rawData[0];
        if (firstRow['Patient MRN'] !== undefined || firstRow['call_outcome'] !== undefined) {
          setErrorList([{ row: 0, field: 'Schema Check', message: 'Rejected: Medical call-center operations log uploaded instead of core console tables.' }]);
          setProgress(null);
          return;
        }      }
      rawData.forEach((row, idx) => {
        const normalizedRow: Record<string, any> = {};

        Object.keys(row).forEach((key) => {
          let normalizedKey = key;
          
          // Remove leading underscores
          if (key.startsWith('_')) {
            normalizedKey = key.slice(1);
          }          
          // Map CSV display headers for Invoices to Schema keys
          if (uploadType === 'invoices') {
            if (normalizedKey === 'Invoice #') normalizedKey = 'invoice_number';
            else if (normalizedKey === 'Created Date') normalizedKey = 'created_date';
            else if (normalizedKey === 'Status') normalizedKey = 'status';
            else if (normalizedKey === 'PO #') normalizedKey = 'po_number';
            else if (normalizedKey === 'Total') normalizedKey = 'total';
            else if (normalizedKey === 'Unanswered Comments') normalizedKey = 'unanswered_comments';
            else if (normalizedKey === 'Dispute Reason') normalizedKey = 'dispute_reason';
          }          let value = row[key];
          if (typeof value === 'string') {
            value = value.trim();
          }          normalizedRow[normalizedKey] = value;
        });

        const parsed = schema.safeParse(normalizedRow);
        if (parsed.success) {
          validRows.push(parsed.data);
        } else {
          const err = parsed.error as any;
          if (err && err.issues) {
            err.issues.forEach((e: any) => {
              errors.push({
                row: idx + 1,
                field: e.path.join('.'),
                message: e.message,
              });
            });
          }        }        setProgress({ current: idx + 1, total: rawData.length });
      });

      if (errors.length > 0) {
        setErrorList(errors);
      } else {
        if (uploadType === 'work_orders') {
          await dispatch(uploadWorkOrdersThunk(validRows) as any).unwrap();
        } else if (uploadType === 'invoices') {
          await dispatch(uploadInvoicesThunk(validRows) as any).unwrap();
        } else {
          await dispatch(uploadJoinedMasterThunk(validRows) as any).unwrap();
        }        setSuccessCount(validRows.length);
      }    } catch (err: any) {
      setErrorList([{ row: 0, field: 'Persist DB', message: err.message || 'Failed to sync to Supabase database.' }]);
    } finally {
      setProgress(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false });

  return (
    React.createElement('div', { className: 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none' },
      React.createElement('div', { className: 'bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]' },
        React.createElement('div', { className: 'flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50' },
          React.createElement('div', null,
            React.createElement('h2', { className: 'text-base font-bold text-slate-800 my-0' }, 'Data Importer'),
            React.createElement('p', { className: 'text-xs text-slate-500 mt-0.5' }, 'CSV uploads auto-validated row-by-row with Zod')
          ),
          React.createElement('button', { onClick: onClose, className: 'text-slate-400 hover:text-slate-600 cursor-pointer p-1' },
            React.createElement(X, { className: 'w-5 h-5' })
          )
        ),
        React.createElement('div', { className: 'p-6 flex-1 overflow-y-auto space-y-6' },
          React.createElement('div', { className: 'flex gap-4' },
            React.createElement('button', {
              onClick: () => setUploadType('work_orders'),
              className: 'flex-1 py-2 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'work_orders' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Work Orders'),
            React.createElement('button', {
              onClick: () => setUploadType('invoices'),
              className: 'flex-1 py-2 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'invoices' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Invoices'),
            React.createElement('button', {
              onClick: () => setUploadType('master'),
              className: 'flex-1 py-2 px-4 rounded-xl border text-xs font-semibold cursor-pointer transition-all ' +
                (uploadType === 'master' ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
            }, 'Master (Joined)')
          ),
          React.createElement('div', getRootProps({ className: 'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ' +
            (isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50')
          }),
            React.createElement('input', getInputProps()),
            React.createElement(UploadCloud, { className: 'w-10 h-10 text-slate-400 mb-3' }),
            React.createElement('p', { className: 'text-sm font-semibold text-slate-700' }, 'Drag & drop your CSV file here'),
            React.createElement('p', { className: 'text-xs text-slate-400 mt-1' }, 'or click to browse from device')
          ),
          progress && React.createElement('div', { className: 'flex items-center gap-2.5 p-3.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs font-mono' },
            React.createElement('span', { className: 'animate-pulse' }, 'Processing...'),
            React.createElement('span', null, progress.current + ' / ' + progress.total + ' rows completed')
          ),
          successCount !== null && React.createElement('div', { className: 'flex items-center gap-2.5 p-3.5 bg-green-50 rounded-xl border border-green-100 text-green-700 text-xs font-medium' },
            React.createElement(CheckCircle, { className: 'w-4 h-4' }),
            React.createElement('span', null, 'Successfully parsed and saved ' + successCount + ' rows directly into Supabase database. Cache updated.')
          ),
          errorList.length > 0 && React.createElement('div', { className: 'space-y-3' },
            React.createElement('div', { className: 'flex items-center gap-2 text-red-600 font-semibold text-xs' },
              React.createElement(AlertCircle, { className: 'w-4 h-4' }),
              React.createElement('span', null, 'Schema validation failed: ' + errorList.length + ' errors found')
            ),
            React.createElement('div', { className: 'border border-red-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto font-mono text-[10px]' },
              React.createElement('table', { className: 'w-full text-left bg-red-50/50' },
                React.createElement('thead', { className: 'bg-red-100/50 text-red-800' },
                  React.createElement('tr', null,
                    React.createElement('th', { className: 'p-2' }, 'Row'),
                    React.createElement('th', { className: 'p-2' }, 'Field'),
                    React.createElement('th', { className: 'p-2' }, 'Error message')
                  )
                ),
                React.createElement('tbody', null,
                  errorList.map((err, i) =>
                    React.createElement('tr', { key: i, className: 'border-b border-red-100/50 text-red-900' },
                      React.createElement('td', { className: 'p-2' }, err.row),
                      React.createElement('td', { className: 'p-2 font-bold' }, err.field),
                      React.createElement('td', { className: 'p-2' }, err.message)
                    )
                  )
                )
              )
            )
          )
        ),
        React.createElement('div', { className: 'px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs' },
          React.createElement('span', { className: 'text-slate-500' }, 'Need sample format?'),
          React.createElement('div', { className: 'flex gap-3' },
            React.createElement('button', {
              onClick: downloadWorkOrderTemplate,
              className: 'flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm font-semibold select-none'
            },
              React.createElement(FileText, { className: 'w-3 h-3 text-slate-400' }),
              'Work Order Template'
            ),
            React.createElement('button', {
              onClick: downloadInvoiceTemplate,
              className: 'flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm font-semibold select-none'
            },
              React.createElement(FileText, { className: 'w-3 h-3 text-slate-400' }),
              'Invoice Template'
            )
          )
        )
      )
    )
  );
};
