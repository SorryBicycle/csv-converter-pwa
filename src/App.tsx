import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  ChevronRight,
  Zap,
  CheckCircle2
} from 'lucide-react';
import Papa from 'papaparse';
import { parseFileToJSON } from './utils/fileParser';
import { processBatchWithAI } from './services/ai';

import { convertLegacyData } from './services/legacyConverter';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultCsv, setResultCsv] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [conversionMode] = useState<'script' | 'ai'>('script');

  useEffect(() => {
    const savedKey = localStorage.getItem('xai_api_key') || import.meta.env.VITE_GROQ_API_KEY;
    if (savedKey) setApiKey(savedKey);
  }, []);

  // API key is now managed in background (localStorage or .env)

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>, type: 'template' | 'supplier') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'template') setTemplateFile(file);
      if (type === 'supplier') setSupplierFile(file);
      setError(null);
    }
  };

  const startProcessing = async () => {
    if (conversionMode === 'ai' && !apiKey) return setError("Please input your API Key first.");
    if (!templateFile || !supplierFile) return setError("Please upload both files.");
    
    setIsProcessing(true);
    setProgress(5);
    setProgressText('Extracting template schema...');
    setError(null);
    setResultCsv(null);

    try {
      const templateData = await parseFileToJSON(templateFile);
      if (templateData.length === 0) throw new Error("Template file is empty.");
      const templateHeaders = Object.keys(templateData[0]);

      setProgress(15);
      
      let finalData: any[] = [];

      if (conversionMode === 'script') {
        setProgressText('Running Legacy Script Logic...');
        const rawSupplierRows = await parseFileToJSON(supplierFile, true);
        if (rawSupplierRows.length === 0) throw new Error("Supplier file is empty.");
        
        finalData = convertLegacyData(rawSupplierRows);
        setProgress(90);
      } else {
        // AI Mode
        setProgressText('Parsing supplier data (AI mode)...');
        const supplierData = await parseFileToJSON(supplierFile);
        if (supplierData.length === 0) throw new Error("Supplier file is empty.");

        const validSupplierData = supplierData.filter(row => Object.keys(row).length > 0);
        const BATCH_SIZE = 5; 
        const totalBatches = Math.ceil(validSupplierData.length / BATCH_SIZE);
        
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 0; i < totalBatches; i++) {
          if (i > 0) {
            setIsCoolingDown(true);
            const WAIT_TIME = 15;
            for (let c = WAIT_TIME; c > 0; c--) {
              setCountdown(c);
              setProgressText(`Cooling down... (${c}s)`);
              await sleep(1000);
            }
            setIsCoolingDown(false);
          }

          setProgressText(`Processing batch ${i + 1} of ${totalBatches}...`);
          const batch = validSupplierData.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
          
          let retries = 3;
          let success = false;
          while (retries > 0 && !success) {
            try {
              const processedBatch = await processBatchWithAI(apiKey, templateHeaders, batch);
              finalData = [...finalData, ...processedBatch];
              success = true;
            } catch (err: any) {
              retries--;
              if (err.status === 429 || err.message?.includes('429')) {
                setProgressText(`Rate limited. Retrying in 20s...`);
                await sleep(20000);
              } else if (retries === 0) {
                throw new Error(`AI processing failed: ${err.message}`);
              } else {
                await sleep(2000);
              }
            }
          }
          
          const percentage = 15 + Math.round(((i + 1) / totalBatches) * 80);
          setProgress(percentage);
        }
      }

      setProgressText('Finalizing result...');
      setProgress(98);

      const csvOutput = Papa.unparse(finalData, { columns: templateHeaders });
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      setResultCsv(url);
      setProgress(100);
      setProgressText('Processing Complete');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setTemplateFile(null);
    setSupplierFile(null);
    setResultCsv(null);
    setError(null);
    setProgress(0);
    setProgressText('');
  };

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center justify-center relative sm:py-20 overflow-x-hidden">
      
      {/* Dynamic Header */}
      <div className="w-full max-w-4xl mb-12 text-center scale-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/[0.03] text-zinc-400 text-xs font-bold uppercase tracking-widest mb-6">
          <Zap className="w-3 h-3 text-accent" /> Tougher Script Engine
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">
          CSV <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Converter Pro</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
          The ultimate utility for mapping supplier files to Shopify.
          Optimized for speed and precision.
        </p>
      </div>

      <div className="w-full max-w-4xl space-y-8">
        {/* Main Interface */}
        <div className="premium-card p-6 sm:p-12">
          {/* File Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Template */}
            <div className="group space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">1. Target Schema</span>
                {templateFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <label className="drop-zone-v2 min-h-56 group">
                <input type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'template')} />
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                  <UploadCloud className={`w-7 h-7 ${templateFile ? 'text-accent' : 'text-zinc-500'}`} />
                </div>
                <span className="text-base text-white font-bold truncate max-w-full px-4 text-center">
                  {templateFile ? templateFile.name : "Target Template"}
                </span>
              </label>
            </div>

            {/* Data */}
            <div className="group space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">2. Supplier File</span>
                {supplierFile && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <label className="drop-zone-v2 min-h-56 group">
                <input type="file" accept=".csv, .xlsx, .xls" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleFileDrop(e, 'supplier')} />
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                  <FileSpreadsheet className={`w-7 h-7 ${supplierFile ? 'text-accent' : 'text-zinc-500'}`} />
                </div>
                <span className="text-base text-white font-bold truncate max-w-full px-4 text-center">
                  {supplierFile ? supplierFile.name : "Raw Data Source"}
                </span>
              </label>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col gap-4">
            {error && (
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 text-red-400 font-bold scale-in">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {isProcessing ? (
              <div className="space-y-6 p-2">
                <div className="flex items-center justify-between text-white font-black text-[10px] uppercase tracking-[0.25em]">
                  <span className="flex items-center gap-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> 
                    {progressText}
                  </span>
                  <span className="text-accent">{progress}%</span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 transition-all duration-500 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent w-full"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <button 
                  onClick={startProcessing} 
                  disabled={!templateFile || !supplierFile}
                  className="flex-1 btn-action h-16 text-lg"
                >
                  <Sparkles className="w-5 h-5" /> Start Conversion
                </button>
                {(templateFile || supplierFile || resultCsv) && (
                  <button 
                    onClick={handleReset}
                    className="px-6 rounded-3xl bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                    title="Reset All"
                  >
                    <AlertCircle className="w-5 h-5 rotate-180" /> Clear
                  </button>
                )}
              </div>
            )}

            {/* Results Block - Now integrated below the actions */}
            {resultCsv && !isProcessing && (
              <div className="mt-8 p-1 rounded-3xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-[1.4rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Conversion Ready</h3>
                      <p className="text-zinc-500 text-sm">Your Shopify CSV is prepared.</p>
                    </div>
                  </div>
                  <a 
                    href={resultCsv} 
                    download="shopify_converted.csv"
                    className="w-full sm:w-auto px-10 h-14 bg-white text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-3 shadow-xl"
                  >
                    <Download className="w-5 h-5" /> Download
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
